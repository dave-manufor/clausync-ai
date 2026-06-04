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

interface ReportReadyEmailProps {
  reportType: 'risk_summary' | 'change_history' | 'compliance';
  reportFormat: 'pdf' | 'csv';
  reportId: string;
  dashboardUrl?: string;
}

const getReportTypeName = (type: string): string => {
  switch (type) {
    case 'risk_summary': return 'Risk Summary';
    case 'change_history': return 'Change History';
    case 'compliance': return 'Compliance';
    default: return 'Analytics';
  }
};

export const ReportReadyEmail: React.FC<ReportReadyEmailProps> = ({
  reportType = 'risk_summary',
  reportFormat = 'pdf',
  reportId = '',
  dashboardUrl = 'https://app.clausync.ai',
}) => {
  const reportTypeName = getReportTypeName(reportType);
  const previewText = `Your ${reportTypeName} Report is ready to download`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>⚖️ ClauSync AI</Heading>
          </Section>
          
          <Section style={successBanner}>
            <Text style={successText}>
              📊 REPORT READY
            </Text>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>
              Your {reportTypeName} Report is Ready
            </Heading>
            
            <Text style={paragraph}>
              Your {reportTypeName.toLowerCase()} report has been generated and is ready 
              for download in {reportFormat.toUpperCase()} format.
            </Text>
            
            <Hr style={hr} />
            
            <Text style={details}>
              <strong>Report Type:</strong> {reportTypeName}<br />
              <strong>Format:</strong> {reportFormat.toUpperCase()}
            </Text>
            
            <Text style={paragraph}>
              Click the button below to view and download your report from the dashboard.
            </Text>
            
            <Link
              href={`${dashboardUrl}/reports/${reportId}`}
              style={button}
            >
              Download Report →
            </Link>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              This is an automated notification from ClauSync AI.
              <br />
              Reports are available for download for 7 days.
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

const successBanner = {
  backgroundColor: '#16A34A',
  borderRadius: '8px',
  padding: '16px',
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const successText = {
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

const details = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 24px',
  padding: '16px',
  backgroundColor: '#f9fafb',
  borderRadius: '6px',
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

export default ReportReadyEmail;
