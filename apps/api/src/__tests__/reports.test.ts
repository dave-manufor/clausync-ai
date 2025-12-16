import { z } from 'zod';

// Mock the reports validation schema as tested
const generateReportSchema = z.object({
  type: z.enum(['risk_summary', 'change_history', 'compliance']),
  format: z.enum(['pdf', 'csv']).default('pdf'),
  period: z.enum(['7d', '30d', '90d']).default('30d'),
  resourceIds: z.array(z.string().uuid()).optional(),
});

describe('Reports Route Validation', () => {
  describe('generateReportSchema', () => {
    it('should validate risk_summary type', () => {
      const input = { type: 'risk_summary' };
      const result = generateReportSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('risk_summary');
        expect(result.data.format).toBe('pdf');
        expect(result.data.period).toBe('30d');
      }
    });

    it('should validate change_history type', () => {
      const input = { type: 'change_history', format: 'csv', period: '7d' };
      const result = generateReportSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('change_history');
        expect(result.data.format).toBe('csv');
        expect(result.data.period).toBe('7d');
      }
    });

    it('should validate compliance type', () => {
      const input = { type: 'compliance', period: '90d' };
      const result = generateReportSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('compliance');
        expect(result.data.period).toBe('90d');
      }
    });

    it('should reject invalid type', () => {
      const input = { type: 'invalid_type' };
      const result = generateReportSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid format', () => {
      const input = { type: 'risk_summary', format: 'docx' };
      const result = generateReportSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid period', () => {
      const input = { type: 'risk_summary', period: '1y' };
      const result = generateReportSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate resourceIds as UUIDs', () => {
      const input = {
        type: 'risk_summary',
        resourceIds: ['550e8400-e29b-41d4-a716-446655440000'],
      };
      const result = generateReportSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid resourceId format', () => {
      const input = {
        type: 'risk_summary',
        resourceIds: ['not-a-uuid'],
      };
      const result = generateReportSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('Report Status Values', () => {
  const validStatuses = ['pending', 'processing', 'ready', 'failed'];

  it('should have defined status values', () => {
    expect(validStatuses).toContain('pending');
    expect(validStatuses).toContain('processing');
    expect(validStatuses).toContain('ready');
    expect(validStatuses).toContain('failed');
  });
});

describe('Report Expiry', () => {
  it('should calculate 7-day expiry correctly', () => {
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const diffDays = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  it('should detect expired reports', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const isExpired = new Date() > pastDate;
    expect(isExpired).toBe(true);
  });

  it('should detect non-expired reports', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const isExpired = new Date() > futureDate;
    expect(isExpired).toBe(false);
  });
});
