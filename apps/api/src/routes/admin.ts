import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { z } from 'zod';
import { requireRole } from '../middleware/rbac';

const router = Router();

// Super admin only middleware
const requireSuperAdmin = requireRole('super_admin');

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: List all users (super_admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated user list
 */
router.get('/users', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const search = req.query.search as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.user.count({ where });
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        deletedAt: true,
        organization: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.status(200).json({
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /admin/organizations:
 *   get:
 *     summary: List all organizations (super_admin only)
 *     tags: [Admin]
 */
router.get('/organizations', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const total = await prisma.organization.count();
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        homeRegion: true,
        createdAt: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.status(200).json({
      data: orgs.map(o => ({ ...o, userCount: o._count.users })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error listing organizations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /admin/metrics:
 *   get:
 *     summary: Get system metrics (super_admin only)
 *     tags: [Admin]
 */
router.get('/metrics', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Get counts
    const [userCount, orgCount, monitorCount, changeCount] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.monitoredResource.count(),
      prisma.changeEvent.count(),
    ]);

    // Get recent activity (24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [recentChanges, recentSignups] = await Promise.all([
      prisma.changeEvent.count({ where: { createdAt: { gte: yesterday } } }),
      prisma.user.count({ where: { createdAt: { gte: yesterday } } }),
    ]);

    res.status(200).json({
      data: {
        totals: {
          users: userCount,
          organizations: orgCount,
          monitors: monitorCount,
          changes: changeCount,
        },
        last24h: {
          changes: recentChanges,
          signups: recentSignups,
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /admin/users/{userId}/role:
 *   patch:
 *     summary: Update user role (super_admin only)
 *     tags: [Admin]
 */
router.patch('/users/:userId/role', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['viewer', 'member', 'admin', 'owner', 'super_admin'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.uid,
        action: 'ADMIN_SET_ROLE',
        entityType: 'user',
        entityId: userId,
        details: { newRole: role },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.status(200).json({ message: 'Role updated', data: user });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
