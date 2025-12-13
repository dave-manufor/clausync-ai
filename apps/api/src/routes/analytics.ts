import { Router, Request, Response } from 'express';
import prisma from '../db/client';

const router = Router();

// Time periods for analytics
const PERIODS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
} as const;

type Period = keyof typeof PERIODS;

function getPeriodDays(period: string): number {
  return PERIODS[period as Period] || 30;
}

/**
 * @openapi
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard overview metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: ['7d', '30d', '90d'], default: '30d' }
 *     responses:
 *       200:
 *         description: Dashboard metrics
 */
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || '30d';
    const days = getPeriodDays(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user to scope queries
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user || !user.organizationId) {
      res.status(200).json({
        data: {
          monitors: { total: 0, active: 0 },
          changes: { total: 0, highRisk: 0 },
          avgRiskScore: 0,
        },
      });
      return;
    }

    // Get all subscriptions for this org's users
    const orgUsers = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true },
    });
    const userIds = orgUsers.map(u => u.id);

    // Count monitors (subscriptions)
    const totalMonitors = await prisma.subscription.count({
      where: { userId: { in: userIds } },
    });

    // Count change events in period
    const changeEvents = await prisma.changeEvent.count({
      where: {
        createdAt: { gte: startDate },
        resource: {
          subscriptions: {
            some: { userId: { in: userIds } },
          },
        },
      },
    });

    // Get high-risk changes (globalRiskScore >= 7 out of 10)
    const highRiskChanges = await prisma.changeEvent.count({
      where: {
        createdAt: { gte: startDate },
        globalRiskScore: { gte: 7 },
        resource: {
          subscriptions: {
            some: { userId: { in: userIds } },
          },
        },
      },
    });

    // Get average risk score
    const avgRiskResult = await prisma.changeEvent.aggregate({
      where: {
        createdAt: { gte: startDate },
        resource: {
          subscriptions: {
            some: { userId: { in: userIds } },
          },
        },
      },
      _avg: { globalRiskScore: true },
    });

    res.status(200).json({
      data: {
        period,
        monitors: {
          total: totalMonitors,
          active: totalMonitors,
        },
        changes: {
          total: changeEvents,
          highRisk: highRiskChanges,
        },
        avgRiskScore: avgRiskResult._avg?.globalRiskScore || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /analytics/changes:
 *   get:
 *     summary: Get change frequency over time
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: ['7d', '30d', '90d'], default: '30d' }
 *     responses:
 *       200:
 *         description: Change frequency data
 */
router.get('/changes', async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || '30d';
    const days = getPeriodDays(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user || !user.organizationId) {
      res.status(200).json({ data: [] });
      return;
    }

    // Get change events grouped by day
    const changes = await prisma.changeEvent.findMany({
      where: {
        createdAt: { gte: startDate },
        resource: {
          subscriptions: {
            some: {
              user: { organizationId: user.organizationId },
            },
          },
        },
      },
      select: { createdAt: true, globalRiskScore: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const byDate: Record<string, { count: number; avgRisk: number; sum: number }> = {};
    
    changes.forEach(change => {
      const date = change.createdAt.toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = { count: 0, avgRisk: 0, sum: 0 };
      }
      byDate[date].count++;
      byDate[date].sum += change.globalRiskScore || 0;
    });

    // Calculate averages
    const data = Object.entries(byDate).map(([date, stats]) => ({
      date,
      count: stats.count,
      avgRiskScore: stats.count > 0 ? stats.sum / stats.count : 0,
    }));

    res.status(200).json({ data, period });
  } catch (error) {
    console.error('Error fetching change analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /analytics/top-resources:
 *   get:
 *     summary: Get most active monitored resources
 *     tags: [Analytics]
 */
router.get('/top-resources', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const period = (req.query.period as string) || '30d';
    const days = getPeriodDays(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user || !user.organizationId) {
      res.status(200).json({ data: [] });
      return;
    }

    // Get resources with most changes
    const resources = await prisma.monitoredResource.findMany({
      where: {
        subscriptions: {
          some: {
            user: { organizationId: user.organizationId },
          },
        },
      },
      select: {
        id: true,
        urlNormalized: true,
        _count: {
          select: { changeEvents: true },
        },
      },
      orderBy: {
        changeEvents: { _count: 'desc' },
      },
      take: limit,
    });

    const data = resources.map(r => ({
      id: r.id,
      url: r.urlNormalized,
      changeCount: r._count.changeEvents,
    }));

    res.status(200).json({ data, period });
  } catch (error) {
    console.error('Error fetching top resources:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
