import * as React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Link,
} from '@react-email/components';

export type BillingNotificationType =
  | 'trial_started'
  | 'trial_ending_soon'
  | 'trial_converted'
  | 'trial_expired'
  | 'payment_failed'
  | 'payment_recovered'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'subscription_canceled';

interface BillingEmailProps {
  notificationType: BillingNotificationType;
  summary: string;
  dashboardUrl?: string;
  tierName?: string;
  trialEndsAt?: string;
  gracePeriodEndsAt?: string;
  previousTier?: string;
  reason?: string;
}

const getIconAndColor = (type: BillingNotificationType): { icon: string; color: string; bannerText: string } => {
  switch (type) {
    case 'trial_started':
      return { icon: '🎉', color: '#16A34A', bannerText: 'TRIAL STARTED' };
    case 'trial_ending_soon':
      return { icon: '⏰', color: '#D97706', bannerText: 'TRIAL ENDING SOON' };
    case 'trial_converted':
      return { icon: '✅', color: '#16A34A', bannerText: 'SUBSCRIPTION ACTIVE' };
    case 'trial_expired':
      return { icon: '⌛', color: '#6B7280', bannerText: 'TRIAL ENDED' };
    case 'payment_failed':
      return { icon: '⚠️', color: '#DC2626', bannerText: 'PAYMENT FAILED' };
    case 'payment_recovered':
      return { icon: '✅', color: '#16A34A', bannerText: 'PAYMENT SUCCESSFUL' };
    case 'subscription_upgraded':
      return { icon: '🚀', color: '#5814BA', bannerText: 'PLAN UPGRADED' };
    case 'subscription_downgraded':
      return { icon: '📉', color: '#EA580C', bannerText: 'PLAN DOWNGRADED' };
    case 'subscription_canceled':
      return { icon: '👋', color: '#6B7280', bannerText: 'SUBSCRIPTION CANCELED' };
    default:
      return { icon: '📧', color: '#6B7280', bannerText: 'BILLING UPDATE' };
  }
};

const getActionButton = (type: BillingNotificationType): { text: string; show: boolean } => {
  switch (type) {
    case 'trial_ending_soon':
      return { text: 'Add Payment Method →', show: true };
    case 'payment_failed':
      return { text: 'Update Payment Method →', show: true };
    case 'trial_expired':
    case 'subscription_downgraded':
      return { text: 'Upgrade Now →', show: true };
    case 'subscription_canceled':
      return { text: 'Resubscribe →', show: true };
    default:
      return { text: 'View Dashboard →', show: false };
  }
};

export const BillingEmail: React.FC<BillingEmailProps> = ({
  notificationType = 'subscription_upgraded',
  summary = 'Your subscription has been updated.',
  dashboardUrl = 'https://app.clausync.ai',
  tierName,
  trialEndsAt,
  gracePeriodEndsAt,
}) => {
  const { icon, color, bannerText } = getIconAndColor(notificationType);
  const { text: buttonText, show: showButton } = getActionButton(notificationType);

  const previewText = `${icon} ${bannerText}: ${summary.slice(0, 50)}...`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>⚖️ ClauSync AI</Heading>
          </Section>
          
          <Section style={alertBanner(color)}>
            <Text style={alertText}>
              {icon} {bannerText}
            </Text>
          </Section>

          <Section style={content}>
            {tierName && (
              <>
                <Text style={monitorLabel}>Plan:</Text>
                <Text style={monitorNameStyle}>{tierName}</Text>
              </>
            )}
            
            <Heading as="h2" style={h2}>What's happening</Heading>
            <Text style={paragraph}>{summary}</Text>
            
            {trialEndsAt && (
              <Text style={infoBox}>
                <strong>Trial ends:</strong> {new Date(trialEndsAt).toLocaleDateString()}
              </Text>
            )}

            {gracePeriodEndsAt && (
              <Text style={warningBox}>
                <strong>⚠️ Action required by:</strong> {new Date(gracePeriodEndsAt).toLocaleDateString()}
              </Text>
            )}
            
            <Hr style={hr} />
            
            {showButton ? (
              <Link href={`${dashboardUrl}/settings/billing`} style={button}>
                {buttonText}
              </Link>
            ) : (
              <Link href={dashboardUrl} style={buttonSecondary}>
                View Dashboard →
              </Link>
            )}
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              This is an automated message from ClauSync AI.
              <br />
              You're receiving this because of activity on your account.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '600px',
};

const header = {
  padding: '24px',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#1a1a2e',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
};

const h2 = {
  color: '#1a1a2e',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px',
};

const alertBanner = (color: string) => ({
  backgroundColor: color,
  borderRadius: '8px',
  padding: '16px',
  textAlign: 'center' as const,
  marginBottom: '24px',
});

const alertText = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '0',
  letterSpacing: '1px',
};

const content = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '32px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
};

const monitorLabel = {
  color: '#6b7280',
  fontSize: '12px',
  fontWeight: '500',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const monitorNameStyle = {
  color: '#1a1a2e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 20px',
};

const paragraph = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const infoBox = {
  backgroundColor: '#EFF6FF',
  borderRadius: '6px',
  padding: '12px 16px',
  color: '#1E40AF',
  fontSize: '14px',
  margin: '16px 0',
};

const warningBox = {
  backgroundColor: '#FEF3C7',
  borderRadius: '6px',
  padding: '12px 16px',
  color: '#92400E',
  fontSize: '14px',
  margin: '16px 0',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

const button = {
  backgroundColor: '#5814BA',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
  textAlign: 'center' as const,
};

const buttonSecondary = {
  backgroundColor: '#f3f4f6',
  borderRadius: '6px',
  color: '#374151',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
  textAlign: 'center' as const,
};

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '20px',
};

export default BillingEmail;
