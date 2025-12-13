import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { publishMessage } from '../services/pubsub';
import { CreateMonitorSchema, PaginationSchema, normalizeUrl } from '../utils/validation';

const router = Router();
const SCRAPE_TOPIC = process.env.PUBSUB_TOPIC_SCRAPE || 'cmd.scrape_url';

/**
 * POST /monitors
 * Create a new monitor subscription
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const parseResult = CreateMonitorSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { url, name, selector, personalization } = parseResult.data;
    const normalizedUrl = normalizeUrl(url);
    const userId = req.user!.uid;

    // Get or create user in DB
    let user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          identityProviderUid: userId,
          email: req.user!.email,
        },
      });
    }

    // Check if resource exists (Singleton pattern)
    let resource = await prisma.monitoredResource.findUnique({
      where: { urlNormalized_selector: { urlNormalized: normalizedUrl, selector } },
    });

    if (!resource) {
      // Create new resource
      resource = await prisma.monitoredResource.create({
        data: { urlNormalized: normalizedUrl, selector },
      });

      // Trigger initial scrape
      await publishMessage(SCRAPE_TOPIC, {
        resource_id: resource.id,
        url: normalizedUrl,
        selector,
        timestamp: Date.now(),
      });
    }

    if (resource.deletedAt) {
      // Reactivate soft-deleted resource
      resource = await prisma.monitoredResource.update({
        where: { id: resource.id },
        data: { deletedAt: null },
      });
    }

    // Check if subscription already exists (active or soft-deleted)
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId_resourceId: { userId: user.id, resourceId: resource.id } },
    });

    if (existingSubscription) {
      if (!existingSubscription.deletedAt) {
        res.status(200).json({
          message: 'Already subscribed',
          subscription: existingSubscription,
          resource,
        });
        return;
      }

      // Reactivate soft-deleted subscription
      const reactivatedSubscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          deletedAt: null,
          deletedBy: null,
          displayName: name || null,
          personalizationEnabled: personalization,
          createdAt: new Date(), // Reset created at to now
        },
      });

      // Audit log for reactivation
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE', // Treat as create for user perspective
          entityType: 'subscription',
          entityId: reactivatedSubscription.id,
          details: { url: normalizedUrl, selector, recovered: true },
          ipAddress: req.ip,
        },
      });

      res.status(201).json({
        message: 'Monitor restored successfully',
        subscription: reactivatedSubscription,
        resource,
      });
      return;
    }

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        resourceId: resource.id,
        displayName: name || null,
        personalizationEnabled: personalization,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'subscription',
        entityId: subscription.id,
        details: { url: normalizedUrl, selector },
        ipAddress: req.ip,
      },
    });

    res.status(201).json({
      message: 'Monitor created successfully',
      subscription,
      resource,
    });
  } catch (error) {
    console.error('Error creating monitor:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /monitors
 * List all monitors for the current user
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    const userId = req.user!.uid;
    const includeDeleted = req.query.includeDeleted === 'true';

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(200).json({ data: [], pagination: { page, limit, total: 0 } });
      return;
    }

    // Only admins can view deleted records
    if (includeDeleted && user.role !== 'admin' && user.role !== 'owner') {
      res.status(403).json({ error: 'Admin access required to view deleted records' });
      return;
    }

    const whereClause = {
      userId: user.id,
      ...(includeDeleted ? {} : { deletedAt: null }),
    };

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: whereClause,
        include: { resource: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where: whereClause }),
    ]);

    res.status(200).json({
      data: subscriptions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error listing monitors:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /monitors/:id
 * Get a specific subscription
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: {
        resource: {
          include: {
            changeEvents: {
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    res.status(200).json(subscription);
  } catch (error) {
    console.error('Error getting monitor:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Retention period in days for soft-deleted records
const RETENTION_DAYS = 30;

/**
 * DELETE /monitors/:id
 * Soft delete a subscription (GDPR/SOC2 compliant)
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: { resource: true },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const now = new Date();
    const hardDeleteDate = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Soft delete the subscription
    await prisma.subscription.update({
      where: { id },
      data: {
        deletedAt: now,
        deletedBy: user.id,
      },
    });

    // Check if this was the last active subscription for the resource
    const remainingSubscriptions = await prisma.subscription.count({
      where: {
        resourceId: subscription.resourceId,
        deletedAt: null,
      },
    });

    // If no other subscribers, mark resource for deletion too
    if (remainingSubscriptions === 0) {
      await prisma.monitoredResource.update({
        where: { id: subscription.resourceId },
        data: { deletedAt: now },
      });
    }

    // Enhanced audit log with retention info
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'SOFT_DELETE',
        entityType: 'subscription',
        entityId: id,
        details: {
          resourceId: subscription.resourceId,
          resourceUrl: subscription.resource.urlNormalized,
          retentionDays: RETENTION_DAYS,
          scheduledHardDeleteAt: hardDeleteDate.toISOString(),
          isLastSubscriber: remainingSubscriptions === 0,
        },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ 
      message: 'Subscription deleted successfully',
      recoveryPeriod: `${RETENTION_DAYS} days`,
      scheduledPermanentDeletionAt: hardDeleteDate.toISOString(),
    });
  } catch (error) {
    console.error('Error deleting monitor:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
