/**
 * Usage Tracking Service
 * 
 * Tracks and retrieves usage metrics for billing purposes.
 */

import prisma from '../db/client';

export type UsageMetric = 'api_requests' | 'web_requests' | 'reports_generated' | 'ai_queries';

/**
 * Get the current billing period (first and last day of month)
 */
function getCurrentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Increment usage counter for a metric
 */
export async function incrementUsage(
  organizationId: string,
  metric: UsageMetric,
  amount: number = 1
): Promise<void> {
  const { start, end } = getCurrentPeriod();

  await prisma.usageRecord.upsert({
    where: {
      organizationId_metric_periodStart: {
        organizationId,
        metric,
        periodStart: start,
      },
    },
    create: {
      organizationId,
      metric,
      count: amount,
      periodStart: start,
      periodEnd: end,
    },
    update: {
      count: { increment: amount },
    },
  });
}

/**
 * Get current usage for a metric in current period
 */
export async function getCurrentUsage(
  organizationId: string,
  metric: UsageMetric
): Promise<number> {
  const { start } = getCurrentPeriod();

  const record = await prisma.usageRecord.findUnique({
    where: {
      organizationId_metric_periodStart: {
        organizationId,
        metric,
        periodStart: start,
      },
    },
  });

  return record?.count ?? 0;
}

/**
 * Get all usage metrics for current period
 */
export async function getAllUsage(organizationId: string): Promise<Record<UsageMetric, number>> {
  const { start } = getCurrentPeriod();

  const records = await prisma.usageRecord.findMany({
    where: {
      organizationId,
      periodStart: start,
    },
  });

  const usage: Record<UsageMetric, number> = {
    api_requests: 0,
    web_requests: 0,
    reports_generated: 0,
    ai_queries: 0,
  };

  for (const record of records) {
    if (record.metric in usage) {
      usage[record.metric as UsageMetric] = record.count;
    }
  }

  return usage;
}

/**
 * Get usage history for a metric
 */
export async function getUsageHistory(
  organizationId: string,
  metric: UsageMetric,
  months: number = 6
): Promise<Array<{ period: string; count: number }>> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const records = await prisma.usageRecord.findMany({
    where: {
      organizationId,
      metric,
      periodStart: { gte: startDate },
    },
    orderBy: { periodStart: 'asc' },
  });

  return records.map((r: typeof records[0]) => ({
    period: r.periodStart.toISOString().substring(0, 7), // YYYY-MM format
    count: r.count,
  }));
}

/**
 * Check if usage is within limit
 */
export async function checkUsageLimit(
  organizationId: string,
  metric: UsageMetric,
  limit: number | null
): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  if (limit === null || limit === 0) {
    // null or 0 means unlimited or disabled
    return { allowed: true, current: 0, limit };
  }

  const current = await getCurrentUsage(organizationId, metric);
  return {
    allowed: current < limit,
    current,
    limit,
  };
}
