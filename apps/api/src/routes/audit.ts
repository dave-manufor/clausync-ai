import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { z } from 'zod';

const router = Router();

// Validation schemas
const QueryLogsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * @openapi
 * /audit-logs:
 *   get:
 *     summary: Query audit logs with filters
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: entityType
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated audit logs
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = QueryLogsSchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { page, limit, userId, action, entityType, startDate, endDate } = parseResult.data;

    // Get current user and org
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Build where clause - scope to org users
    const orgUsers = user.organizationId
      ? await prisma.user.findMany({
          where: { organizationId: user.organizationId },
          select: { id: true },
        })
      : [{ id: user.id }];
    
    const userIds = orgUsers.map(u => u.id);

    const where: any = {
      userId: { in: userIds },
    };

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Count total
    const total = await prisma.auditLog.count({ where });

    // Get logs
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.status(200).json({
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error querying audit logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /audit-logs/stats:
 *   get:
 *     summary: Get audit log statistics
 *     tags: [Audit]
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const orgUsers = user.organizationId
      ? await prisma.user.findMany({
          where: { organizationId: user.organizationId },
          select: { id: true },
        })
      : [{ id: user.id }];
    
    const userIds = orgUsers.map(u => u.id);

    // Get actions breakdown
    const actionsRaw = await prisma.auditLog.groupBy({
      by: ['action'],
      where: { userId: { in: userIds } },
      _count: true,
    });

    // Get entity types breakdown
    const entityTypesRaw = await prisma.auditLog.groupBy({
      by: ['entityType'],
      where: { userId: { in: userIds } },
      _count: true,
    });

    // Get recent activity (last 24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentCount = await prisma.auditLog.count({
      where: {
        userId: { in: userIds },
        createdAt: { gte: yesterday },
      },
    });

    res.status(200).json({
      data: {
        actions: actionsRaw.map(a => ({ action: a.action, count: a._count })),
        entityTypes: entityTypesRaw.map(e => ({ type: e.entityType, count: e._count })),
        last24h: recentCount,
      },
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /audit-logs/export:
 *   post:
 *     summary: Export audit logs as JSON
 *     tags: [Audit]
 */
router.post('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Super admin or admin required
    if (!['super_admin', 'owner', 'admin'].includes(user.role)) {
      res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
      return;
    }

    const orgUsers = user.organizationId
      ? await prisma.user.findMany({
          where: { organizationId: user.organizationId },
          select: { id: true },
        })
      : [{ id: user.id }];
    
    const userIds = orgUsers.map(u => u.id);

    // Get last 90 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const logs = await prisma.auditLog.findMany({
      where: {
        userId: { in: userIds },
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
    res.status(200).json({ exportedAt: new Date(), count: logs.length, logs });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
