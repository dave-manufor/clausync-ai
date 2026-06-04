import { PubSub, Message } from '@google-cloud/pubsub';
import { Resend } from 'resend';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as React from 'react';
import { render } from '@react-email/components';
import { ChangeAlertEmail } from './emails/ChangeAlertEmail';
import { BillingEmail, BillingNotificationType } from './emails/BillingEmail';
import { ReportReadyEmail } from './emails/ReportReadyEmail';

dotenv.config();

// Configuration
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'clausync-dev';
const SUBSCRIPTION_ID = process.env.PUBSUB_SUBSCRIPTION_ID || 'cmd.send_notification-sub';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'alerts@clausync.ai';
const DATABASE_URL = process.env.DATABASE_URL || '';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.clausync.ai';

// Initialize clients
const pubsub = new PubSub({ projectId: GCP_PROJECT_ID });
// Initialize Resend with a dummy key if missing to prevent startup crash
const resend = new Resend(RESEND_API_KEY || 're_dummy12345678901234567890123456789');
const pool = new Pool({ connectionString: DATABASE_URL });

// Base notification payload shared by all types
interface BaseNotificationPayload {
  notification_id: string;
  user_id: string;
  email: string;
  subject: string;
  summary: string;
  risk_level?: string;
}

// Change alert specific payload
interface ChangeAlertPayload extends BaseNotificationPayload {
  is_billing_notification?: false;
  change_event_id: string;
  is_new_subscription?: boolean;
  has_personalization?: boolean;
  monitor_name?: string;
  monitor_url?: string;
}

// Billing notification specific payload
interface BillingNotificationPayload extends BaseNotificationPayload {
  is_billing_notification: true;
  billing_notification_type: BillingNotificationType;
  change_event_id: null;
  tier_name?: string;
  trial_ends_at?: string;
  grace_period_ends_at?: string;
  previous_tier?: string;
  reason?: string;
}

// Report ready specific payload
interface ReportReadyPayload {
  type: 'report_ready';
  email: string;
  subject?: string;
  body?: string;
  report_id: string;
  report_type?: 'risk_summary' | 'change_history' | 'compliance';
  report_format?: 'pdf' | 'csv';
}

type NotificationPayload = ChangeAlertPayload | BillingNotificationPayload | ReportReadyPayload;

async function markNotificationSent(notificationId: string): Promise<void> {
  try {
    await pool.query(
      'UPDATE notifications SET sent_at = NOW() WHERE id = $1',
      [notificationId]
    );
    console.log(`Marked notification ${notificationId} as sent`);
  } catch (error) {
    console.error('Failed to update notification:', error);
  }
}

async function isAlreadySent(notificationId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT sent_at FROM notifications WHERE id = $1',
      [notificationId]
    );
    return result.rows[0]?.sent_at !== null;
  } catch (error) {
    console.error('Failed to check notification status:', error);
    return false;
  }
}

async function renderBillingEmail(data: BillingNotificationPayload): Promise<string> {
  const emailComponent = BillingEmail({
    notificationType: data.billing_notification_type,
    summary: data.summary,
    dashboardUrl: DASHBOARD_URL,
    tierName: data.tier_name,
    trialEndsAt: data.trial_ends_at,
    gracePeriodEndsAt: data.grace_period_ends_at,
    previousTier: data.previous_tier,
    reason: data.reason,
  });
  return render(emailComponent as React.ReactElement);
}

async function renderChangeAlertEmail(data: ChangeAlertPayload): Promise<string> {
  const emailComponent = ChangeAlertEmail({
    riskLevel: (data.risk_level || 'medium') as 'low' | 'medium' | 'high' | 'critical',
    summary: data.summary,
    changeEventId: data.change_event_id,
    dashboardUrl: DASHBOARD_URL,
    isNewSubscription: data.is_new_subscription,
    hasPersonalization: data.has_personalization,
    monitorName: data.monitor_name,
    monitorUrl: data.monitor_url,
  });
  return render(emailComponent as React.ReactElement);
}

async function renderReportReadyEmail(data: ReportReadyPayload): Promise<string> {
  const emailComponent = ReportReadyEmail({
    reportType: data.report_type || 'risk_summary',
    reportFormat: data.report_format || 'pdf',
    reportId: data.report_id,
    dashboardUrl: DASHBOARD_URL,
  });
  return render(emailComponent as React.ReactElement);
}

import express, { Request, Response } from 'express';

async function processMessage(rawData: any): Promise<boolean> {
  try {
    // Check for report_ready type first (different message structure)
    if (rawData.type === 'report_ready') {
      const data = rawData as ReportReadyPayload;
      console.log('Processing report ready notification:', { 
        email: data.email,
        type: 'report_ready',
        report_id: data.report_id,
      });
      
      const emailHtml = await renderReportReadyEmail(data);
      
      const { data: emailResult, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: data.email,
        subject: data.subject || 'Your Clausync Report is Ready',
        html: emailHtml,
      });
      
      if (error) {
        console.error('Failed to send report ready email:', error);
        return false;
      }
      
      console.log('Report ready email sent successfully:', emailResult?.id);
      return true;
    }
    
    // Handle standard notification types (change_alert, billing)
    const data: ChangeAlertPayload | BillingNotificationPayload = rawData;
    const isBilling = (data as BillingNotificationPayload).is_billing_notification === true;
    
    console.log('Processing notification:', { 
      notification_id: data.notification_id,
      email: data.email,
      type: isBilling ? 'billing' : 'change_alert',
      billing_type: isBilling ? (data as BillingNotificationPayload).billing_notification_type : undefined,
    });

    // Idempotency check - prevent duplicate emails
    if (!data.notification_id) {
      console.log('Notification missing notification_id, skipping');
      return true; // Ack
    }
    
    if (await isAlreadySent(data.notification_id)) {
      console.log(`Notification ${data.notification_id} already sent, skipping`);
      return true; // Ack
    }

    // Render appropriate email template
    let emailHtml: string;
    if (isBilling) {
      emailHtml = await renderBillingEmail(data as BillingNotificationPayload);
    } else {
      emailHtml = await renderChangeAlertEmail(data as ChangeAlertPayload);
    }

    // Send email via Resend
    const { data: emailResult, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: data.email,
      subject: data.subject,
      html: emailHtml,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return false; // Nack
    }

    console.log('Email sent successfully:', emailResult?.id);

    // Mark notification as sent
    await markNotificationSent(data.notification_id);

    return true; // Ack
  } catch (error) {
    console.error('Error processing message:', error);
    return false; // Nack
  }
}

const app = express();
app.use(express.json());

app.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const envelope = req.body;
    if (!envelope || !envelope.message) {
      res.status(400).send('Bad Request: Invalid Pub/Sub message format');
      return;
    }

    const pubsubMessage = envelope.message;
    if (pubsubMessage.data) {
      const dataStr = Buffer.from(pubsubMessage.data, 'base64').toString('utf-8');
      const data = JSON.parse(dataStr);
      console.log('Received message:', JSON.stringify(data));
      
      const success = await processMessage(data);
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).send('Internal Server Error');
      }
    } else {
      res.status(400).send('Bad Request: No data in message');
    }
  } catch (error) {
    console.error('Error processing Pub/Sub message:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`Notification Worker listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  server.close();
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  server.close();
  pool.end();
  process.exit(0);
});

