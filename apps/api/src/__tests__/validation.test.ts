import { normalizeUrl, CreateMonitorSchema, PaginationSchema } from '../utils/validation';

describe('Validation Utils', () => {
  describe('normalizeUrl', () => {
    it('should remove UTM parameters', () => {
      const url = 'https://example.com/page?utm_source=google&utm_medium=cpc&important=1';
      const result = normalizeUrl(url);
      expect(result).toBe('https://example.com/page?important=1');
    });

    it('should remove trailing slash', () => {
      const url = 'https://example.com/page/';
      const result = normalizeUrl(url);
      expect(result).toBe('https://example.com/page');
    });

    it('should preserve root path slash', () => {
      const url = 'https://example.com/';
      const result = normalizeUrl(url);
      expect(result).toBe('https://example.com/');
    });

    it('should lowercase the URL', () => {
      const url = 'https://EXAMPLE.COM/Page';
      const result = normalizeUrl(url);
      expect(result).toBe('https://example.com/Page'.toLowerCase());
    });

    it('should handle invalid URLs gracefully', () => {
      const url = 'not-a-valid-url';
      const result = normalizeUrl(url);
      expect(result).toBe('not-a-valid-url');
    });

    it('should remove fbclid and gclid tracking params', () => {
      const url = 'https://example.com?fbclid=abc123&gclid=xyz789';
      const result = normalizeUrl(url);
      expect(result).toBe('https://example.com/');
    });
  });

  describe('CreateMonitorSchema', () => {
    it('should validate a correct input', () => {
      const input = { url: 'https://example.com/terms' };
      const result = CreateMonitorSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe('https://example.com/terms');
        expect(result.data.selector).toBe('body');
      }
    });

    it('should reject invalid URL', () => {
      const input = { url: 'not-a-url' };
      const result = CreateMonitorSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept custom selector', () => {
      const input = { url: 'https://example.com', selector: '#main-content' };
      const result = CreateMonitorSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selector).toBe('#main-content');
      }
    });
  });

  describe('PaginationSchema', () => {
    it('should use defaults when no params provided', () => {
      const result = PaginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should parse string numbers', () => {
      const result = PaginationSchema.parse({ page: '3', limit: '50' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
    });

    it('should reject page less than 1', () => {
      expect(() => PaginationSchema.parse({ page: '0' })).toThrow();
    });

    it('should cap limit at 100', () => {
      expect(() => PaginationSchema.parse({ limit: '200' })).toThrow();
    });
  });
});
