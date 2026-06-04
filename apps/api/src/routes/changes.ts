import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { PaginationSchema } from '../utils/validation';

const router = Router();

/**
 * GET /changes
 * List recent change events for the user's subscribed resources
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(200).json({ data: [], pagination: { page, limit, total: 0 } });
      return;
    }

    // Get user's subscribed resource IDs
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: user.id },
      select: { resourceId: true, displayName: true },
    });

    const resourceIds = subscriptions.map((s: { resourceId: string }) => s.resourceId);
    const resourceMap = new Map(subscriptions.map((s: { resourceId: string; displayName: string | null }) => [s.resourceId, s.displayName]));

    if (resourceIds.length === 0) {
      res.status(200).json({ data: [], pagination: { page, limit, total: 0 } });
      return;
    }

    const [changes, total] = await Promise.all([
      prisma.changeEvent.findMany({
        where: { resourceId: { in: resourceIds } },
        include: {
          resource: { select: { urlNormalized: true, selector: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.changeEvent.count({ where: { resourceId: { in: resourceIds } } }),
    ]);

    const changesWithDisplayName = changes.map(change => ({
      ...change,
      displayName: resourceMap.get(change.resourceId) || null,
    }));

    res.status(200).json({
      data: changesWithDisplayName,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error listing changes:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /changes/:id
 * Get a specific change event with full analysis
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'Change event not found' });
      return;
    }

    // Verify user has access to this change (subscribed to the resource)
    const change = await prisma.changeEvent.findUnique({
      where: { id },
      include: {
        resource: true,
        oldSnapshot: true,
        newSnapshot: true,
      },
    });

    if (!change) {
      res.status(404).json({ error: 'Change event not found' });
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id, resourceId: change.resourceId },
    });

    if (!subscription) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get personalized notification if exists
    const notification = await prisma.notification.findFirst({
      where: { userId: user.id, changeEventId: id },
    });

    res.status(200).json({
      ...change,
      personalizedAnalysis: notification?.personalizedSummary || null,
      riskLevel: notification?.riskLevel || null,
      displayName: subscription.displayName,
    });
  } catch (error) {
    console.error('Error getting change:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
