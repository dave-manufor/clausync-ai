import { PubSub, Message } from '@google-cloud/pubsub';
import { Resend } from 'resend';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as React from 'react';
import { render } from '@react-email/components';
import { ChangeAlertEmail } from './emails/ChangeAlertEmail';
import { BillingEmail, BillingNotificationType } from './emails/BillingEmail';

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
const resend = new Resend(RESEND_API_KEY);
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

type NotificationPayload = ChangeAlertPayload | BillingNotificationPayload;

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

async function processMessage(message: Message): Promise<void> {
  try {
    const data: NotificationPayload = JSON.parse(message.data.toString());
    
    const isBilling = data.is_billing_notification === true;
    console.log('Processing notification:', { 
      notification_id: data.notification_id,
      email: data.email,
      type: isBilling ? 'billing' : 'change_alert',
      billing_type: isBilling ? (data as BillingNotificationPayload).billing_notification_type : undefined,
    });

    // Idempotency check - prevent duplicate emails
    if (await isAlreadySent(data.notification_id)) {
      console.log(`Notification ${data.notification_id} already sent, skipping`);
      message.ack();
      return;
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
      message.nack();
      return;
    }

    console.log('Email sent successfully:', emailResult?.id);

    // Mark notification as sent
    await markNotificationSent(data.notification_id);

    message.ack();
  } catch (error) {
    console.error('Error processing message:', error);
    message.nack();
  }
}

async function main(): Promise<void> {
  console.log(`Notification Worker Starting...`);
  console.log(`Subscription: ${SUBSCRIPTION_ID}`);
  console.log(`Supports: change_alerts, billing_notifications`);

  const subscription = pubsub.subscription(SUBSCRIPTION_ID);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    subscription.close();
    pool.end();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    subscription.close();
    pool.end();
    process.exit(0);
  });

  subscription.on('message', processMessage);
  subscription.on('error', (error) => {
    console.error('Subscription error:', error);
  });

  console.log('Listening for messages...');
}

main().catch(console.error);

