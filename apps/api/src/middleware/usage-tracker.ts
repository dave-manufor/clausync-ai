/**
 * API Usage Tracking Middleware
 * 
 * Tracks API requests per organization for billing purposes.
 * Only API key requests are billable; web app (Firebase) requests are tracked separately.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { incrementUsage, UsageMetric } from '../services/usage';

/**
 * Middleware to track API request usage
 * Add this after authentication middleware
 * 
 * Differentiates between:
 * - api_requests: API key usage (billable, counts toward limit)
 * - web_requests: Firebase/web app usage (informational only, not billable)
 */
export async function trackApiUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Only track for authenticated users
  if (!req.user) {
    next();
    return;
  }

  // Determine auth type and corresponding metric
  const authType = (req as any).authType;
  const isApiKeyRequest = authType === 'apiKey';
  
  // Only track API key requests as billable
  // Web app (Firebase) requests are free and tracked separately
  const metric: UsageMetric = isApiKeyRequest ? 'api_requests' : 'web_requests';

  // Track usage asynchronously (don't block the request)
  setImmediate(async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { identityProviderUid: req.user!.uid },
        select: { organizationId: true },
      });

      if (user?.organizationId) {
        await incrementUsage(user.organizationId, metric);
      }
    } catch (error) {
      // Log but don't fail the request
      console.error('Error tracking API usage:', error);
    }
  });

  next();
}

export default trackApiUsage;
