import { z } from 'zod';

// Remove tracking parameters and normalize URL
export const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid', 'gclid'];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    
    // Remove trailing slash
    let normalized = parsed.toString();
    if (normalized.endsWith('/') && parsed.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

// Request Schemas
export const CreateMonitorSchema = z.object({
  url: z.string().url({ message: 'Invalid URL format' }),
  name: z.string().min(2).max(100).optional(),
  selector: z.string().optional().default('body'),
  personalization: z.boolean().optional().default(false),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateMonitorInput = z.infer<typeof CreateMonitorSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
