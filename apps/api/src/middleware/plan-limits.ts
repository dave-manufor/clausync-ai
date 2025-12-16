/**
 * Plan Limits Middleware
 * 
 * Enforces subscription tier limits at API endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../db/client';

export interface PlanLimits {
  monitorLimit: number;
  teamLimit: number;
  documentLimit: number;
  apiRateLimit: number;
  webhookLimit: number;
  reportsPerMonth: number | null;
}

// Default limits for free tier (fallback)
const FREE_LIMITS: PlanLimits = {
  monitorLimit: 3,
  teamLimit: 1,
  documentLimit: 0,
  apiRateLimit: 0,
  webhookLimit: 0,
  reportsPerMonth: 0,
};

/**
 * Get plan limits for a user's organization
 */
export async function getPlanLimits(userId: string): Promise<PlanLimits> {
  const user = await prisma.user.findUnique({
    where: { identityProviderUid: userId },
    include: {
      organization: {
        include: {
          subscription: {
            include: { tier: true },
          },
        },
      },
    },
  });

  if (!user?.organization?.subscription?.tier) {
    return FREE_LIMITS;
  }

  const tier = user.organization.subscription.tier;
  return {
    monitorLimit: tier.monitorLimit,
    teamLimit: tier.teamLimit,
    documentLimit: tier.documentLimit,
    apiRateLimit: tier.apiRateLimit,
    webhookLimit: tier.webhookLimit,
    reportsPerMonth: tier.reportsPerMonth,
  };
}

/**
 * Check if action is within plan limits
 */
export async function checkLimit(
  userId: string,
  limitType: keyof PlanLimits,
  currentCount: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const limits = await getPlanLimits(userId);
  const limit = limits[limitType];

  // null means unlimited
  if (limit === null) {
    return { allowed: true, limit: -1, current: currentCount };
  }

  return {
    allowed: currentCount < limit,
    limit: limit as number,
    current: currentCount,
  };
}

/**
 * Middleware factory for checking plan limits
 */
export function requirePlanLimit(limitType: keyof PlanLimits, getCountFn: (userId: string) => Promise<number>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const currentCount = await getCountFn(req.user.uid);
      const result = await checkLimit(req.user.uid, limitType, currentCount);

      if (!result.allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: 'PLAN_LIMIT_EXCEEDED',
            message: `You have reached your ${limitType} limit (${result.limit}). Please upgrade your plan.`,
            details: {
              limit: result.limit,
              current: result.current,
              limitType,
            },
          },
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking plan limit:', error);
      next(); // Allow on error to avoid blocking users
    }
  };
}

/**
 * Helper to get monitor count for a user
 */
export async function getMonitorCount(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { identityProviderUid: userId },
  });

  if (!user) return 0;

  return prisma.subscription.count({
    where: {
      userId: user.id,
      pausedAt: null,  // Not paused = active
      deletedAt: null, // Not deleted
    },
  });
}

/**
 * Helper to get document count for a user
 */
export async function getDocumentCount(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { identityProviderUid: userId },
  });

  if (!user) return 0;

  return prisma.userDocument.count({
    where: {
      userId: user.id,
      deletedAt: null,
    },
  });
}

/**
 * Helper to get team member count for an organization
 */
export async function getTeamMemberCount(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { identityProviderUid: userId },
    include: { organization: true },
  });

  if (!user?.organization) return 1;

  return prisma.user.count({
    where: {
      organizationId: user.organization.id,
      deletedAt: null,
    },
  });
}

// Pre-built middleware for common limits
export const checkMonitorLimit = requirePlanLimit('monitorLimit', getMonitorCount);
export const checkDocumentLimit = requirePlanLimit('documentLimit', getDocumentCount);
export const checkTeamLimit = requirePlanLimit('teamLimit', getTeamMemberCount);
