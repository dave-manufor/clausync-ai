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

interface ChangeAlertEmailProps {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  changeEventId: string;
  dashboardUrl?: string;
}

const getRiskColor = (level: string) => {
  switch (level) {
    case 'critical': return '#DC2626';
    case 'high': return '#EA580C';
    case 'medium': return '#D97706';
    case 'low': return '#16A34A';
    default: return '#6B7280';
  }
};

export const ChangeAlertEmail: React.FC<ChangeAlertEmailProps> = ({
  riskLevel = 'medium',
  summary = 'A change was detected in a monitored agreement.',
  changeEventId = '',
  dashboardUrl = 'https://app.clausync.ai',
}) => {
  const previewText = `[${riskLevel.toUpperCase()}] Change detected in monitored agreement`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>⚖️ ClauSync AI</Heading>
          </Section>
          
          <Section style={alertBanner(riskLevel)}>
            <Text style={alertText}>
              {riskLevel.toUpperCase()} RISK DETECTED
            </Text>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>Change Summary</Heading>
            <Text style={paragraph}>{summary}</Text>
            
            <Hr style={hr} />
            
            <Text style={paragraph}>
              View the full analysis and take action in your dashboard.
            </Text>
            
            <Link
              href={`${dashboardUrl}/changes/${changeEventId}`}
              style={button}
            >
              View Full Analysis →
            </Link>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              This is an automated alert from ClauSync AI.
              <br />
              You're receiving this because you're subscribed to this agreement.
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

const alertBanner = (level: string) => ({
  backgroundColor: getRiskColor(level),
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

const paragraph = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
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

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '20px',
};

export default ChangeAlertEmail;
