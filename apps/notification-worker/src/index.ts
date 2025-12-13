import { PubSub, Message } from '@google-cloud/pubsub';
import { Resend } from 'resend';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as React from 'react';
import { render } from '@react-email/components';
import { ChangeAlertEmail } from './emails/ChangeAlertEmail';

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

interface NotificationPayload {
  notification_id: string;
  user_id: string;
  email: string;
  subject: string;
  summary: string;
  change_event_id: string;
}

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

async function processMessage(message: Message): Promise<void> {
  try {
    const data: NotificationPayload = JSON.parse(message.data.toString());
    console.log('Processing notification:', { 
      notification_id: data.notification_id,
      email: data.email 
    });

    // Render email template
    const emailComponent = ChangeAlertEmail({
      riskLevel: 'medium', // TODO: pass from payload
      summary: data.summary,
      changeEventId: data.change_event_id,
      dashboardUrl: DASHBOARD_URL,
    });
    const emailHtml = await render(emailComponent as React.ReactElement);

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
