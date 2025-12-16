import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { publishMessage } from '../services/pubsub';
import { CreateMonitorSchema, PaginationSchema, normalizeUrl } from '../utils/validation';
import * as Diff from 'diff';

const router = Router();
const SCRAPE_TOPIC = process.env.PUBSUB_TOPIC_SCRAPE || 'cmd.scrape_url';
const NOTIFY_TOPIC = process.env.PUBSUB_TOPIC_NOTIFY || 'cmd.send_notification';

/**
 * Send an immediate notification for a user subscribing to an existing resource
 * that already has analysis data.
 */
async function sendImmediateNotification(
  userId: string,
  userEmail: string,
  resourceId: string,
  monitorName: string | null,
  monitorUrl: string
): Promise<void> {
  // Find the most recent change event for this resource (within last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const latestChangeEvent = await prisma.changeEvent.findFirst({
    where: {
      resourceId,
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!latestChangeEvent) {
    console.log('No recent change event found, skipping immediate notification');
    return;
  }

  // Create a notification record
  const notification = await prisma.notification.create({
    data: {
      userId,
      changeEventId: latestChangeEvent.id,
      personalizedSummary: latestChangeEvent.globalAiSummary || 'Your monitor is ready.',
      riskLevel: getRiskLevelFromScore(latestChangeEvent.globalRiskScore || 1),
    },
  });

  // Publish notification command
  await publishMessage(NOTIFY_TOPIC, {
    notification_id: notification.id,
    user_id: userId,
    email: userEmail,
    subject: 'Your monitor is ready - Initial Analysis Complete',
    summary: (latestChangeEvent.globalAiSummary || 'Your monitor is ready.').slice(0, 500),
    change_event_id: latestChangeEvent.id,
    is_new_subscription: true,
    has_personalization: false,
    risk_level: getRiskLevelFromScore(latestChangeEvent.globalRiskScore || 1),
    monitor_name: monitorName || monitorUrl,
    monitor_url: monitorUrl,
  });

  console.log('Sent immediate notification for new subscription', {
    userId,
    resourceId,
    changeEventId: latestChangeEvent.id,
  });
}

function getRiskLevelFromScore(score: number): string {
  if (score >= 8) return 'critical';
  if (score >= 6) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

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

    // Track if this is an existing resource with analysis
    let isExistingResourceWithAnalysis = false;

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
    } else {
      // Existing resource - may have analysis data
      isExistingResourceWithAnalysis = true;
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

      // Send immediate notification if resource has existing analysis
      if (isExistingResourceWithAnalysis) {
        try {
          await sendImmediateNotification(
            user.id,
            user.email,
            resource.id,
            reactivatedSubscription.displayName,
            normalizedUrl
          );
        } catch (notifyError) {
          console.error('Failed to send immediate notification:', notifyError);
          // Don't fail the request if notification fails
        }
      }

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

    // Send immediate notification if resource has existing analysis
    if (isExistingResourceWithAnalysis) {
      try {
        await sendImmediateNotification(
          user.id,
          user.email,
          resource.id,
          subscription.displayName,
          normalizedUrl
        );
      } catch (notifyError) {
        console.error('Failed to send immediate notification:', notifyError);
        // Don't fail the request if notification fails
      }
    }

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

/**
 * @openapi
 * /monitors/{id}/pause:
 *   patch:
 *     summary: Pause monitoring for a subscription
 *     description: Temporarily stop receiving notifications for this monitor
 *     tags: [Monitors]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Monitor paused
 *       404:
 *         description: Monitor not found
 *       401:
 *         description: Unauthorized
 */
router.patch('/:id/pause', async (req: Request, res: Response): Promise<void> => {
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
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    if (subscription.pausedAt) {
      res.status(200).json({ message: 'Monitor already paused', data: subscription });
      return;
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { pausedAt: new Date() },
    });

    // Audit log for SOC2 compliance
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PAUSE',
        entityType: 'subscription',
        entityId: id,
        details: { pausedAt: updated.pausedAt },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Monitor paused', data: updated });
  } catch (error) {
    console.error('Error pausing monitor:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /monitors/{id}/resume:
 *   patch:
 *     summary: Resume monitoring for a subscription
 *     description: Resume receiving notifications for this monitor
 *     tags: [Monitors]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Monitor resumed
 *       404:
 *         description: Monitor not found
 *       401:
 *         description: Unauthorized
 */
router.patch('/:id/resume', async (req: Request, res: Response): Promise<void> => {
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
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    if (!subscription.pausedAt) {
      res.status(200).json({ message: 'Monitor already active', data: subscription });
      return;
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { pausedAt: null },
    });

    // Audit log for SOC2 compliance
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'RESUME',
        entityType: 'subscription',
        entityId: id,
        details: { resumedAt: new Date() },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Monitor resumed', data: updated });
  } catch (error) {
    console.error('Error resuming monitor:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /monitors/{id}/snapshots:
 *   get:
 *     summary: List snapshots for a monitor
 *     description: Returns paginated historical snapshots for the monitored resource
 *     tags: [Monitors]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of snapshots
 *       404:
 *         description: Monitor not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id/snapshots', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
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

    const [snapshots, total] = await Promise.all([
      prisma.resourceSnapshot.findMany({
        where: {
          resourceId: subscription.resourceId,
          deletedAt: null,
        },
        select: {
          id: true,
          contentHash: true,
          scrapedAt: true,
          // Don't include gcsUri for security - use content endpoint
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scrapedAt: 'desc' },
      }),
      prisma.resourceSnapshot.count({
        where: {
          resourceId: subscription.resourceId,
          deletedAt: null,
        },
      }),
    ]);

    res.status(200).json({
      data: snapshots,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing snapshots:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /monitors/{id}/snapshots/{sid}:
 *   get:
 *     summary: Get snapshot details
 *     description: Returns metadata for a specific snapshot
 *     tags: [Monitors]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: sid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Snapshot details
 *       404:
 *         description: Snapshot not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id/snapshots/:sid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, sid } = req.params;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const snapshot = await prisma.resourceSnapshot.findFirst({
      where: {
        id: sid,
        resourceId: subscription.resourceId,
        deletedAt: null,
      },
    });

    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    res.status(200).json({
      data: {
        id: snapshot.id,
        contentHash: snapshot.contentHash,
        scrapedAt: snapshot.scrapedAt,
        resourceId: snapshot.resourceId,
      },
    });
  } catch (error) {
    console.error('Error getting snapshot:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /monitors/{id}/snapshots/{sid}/content:
 *   get:
 *     summary: Get snapshot content
 *     description: Returns the raw content of a snapshot (redirects to signed GCS URL)
 *     tags: [Monitors]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: sid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Snapshot content or redirect to GCS
 *         content:
 *           text/plain:
 *             schema: { type: string }
 *       404:
 *         description: Snapshot not found
 *       401:
 *         description: Unauthorized
 *       501:
 *         description: GCS integration not configured
 */
router.get('/:id/snapshots/:sid/content', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, sid } = req.params;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const snapshot = await prisma.resourceSnapshot.findFirst({
      where: {
        id: sid,
        resourceId: subscription.resourceId,
        deletedAt: null,
      },
    });

    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    // In production, generate a signed URL for the GCS object
    // For now, return the GCS URI that workers can use
    // TODO: Implement GCS signed URL generation
    res.status(501).json({
      error: 'Not Implemented',
      message: 'GCS signed URL generation not yet configured',
      gcsUri: snapshot.gcsUri, // For debugging - remove in production
    });
  } catch (error) {
    console.error('Error getting snapshot content:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Strip HTML tags and clean text for diffing
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
    .replace(/<[^>]+>/g, ' ')                          // Remove HTML tags
    .replace(/&nbsp;/g, ' ')                           // Convert nbsp
    .replace(/&amp;/g, '&')                            // Convert amp
    .replace(/&lt;/g, '<')                             // Convert lt
    .replace(/&gt;/g, '>')                             // Convert gt
    .replace(/&quot;/g, '"')                           // Convert quot
    .replace(/\s+/g, ' ')                              // Normalize whitespace
    .trim();
}

/**
 * @openapi
 * /monitors/{id}/diff/{old}/{new}:
 *   get:
 *     summary: Compare two snapshots
 *     description: Returns a clean text diff between two snapshots (HTML stripped)
 *     tags: [Monitors]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Monitor/subscription ID
 *       - in: path
 *         name: old
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Old snapshot ID
 *       - in: path
 *         name: new
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: New snapshot ID
 *     responses:
 *       200:
 *         description: Diff result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 additions: { type: integer }
 *                 deletions: { type: integer }
 *                 changes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type: { type: string, enum: [add, remove, same] }
 *                       content: { type: string }
 *       404:
 *         description: Snapshot not found
 *       501:
 *         description: GCS content not available
 */
router.get('/:id/diff/:old/:new', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, old: oldId, new: newId } = req.params;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    // Verify subscription ownership
    const subscription = await prisma.subscription.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    // Get both snapshots
    const [oldSnapshot, newSnapshot] = await Promise.all([
      prisma.resourceSnapshot.findFirst({
        where: { id: oldId, resourceId: subscription.resourceId, deletedAt: null },
      }),
      prisma.resourceSnapshot.findFirst({
        where: { id: newId, resourceId: subscription.resourceId, deletedAt: null },
      }),
    ]);

    if (!oldSnapshot || !newSnapshot) {
      res.status(404).json({ error: 'One or both snapshots not found' });
      return;
    }

    // TODO: Fetch content from GCS using signed URLs
    // For now, return 501 until GCS integration is complete
    res.status(501).json({
      error: 'Not Implemented',
      message: 'Snapshot content retrieval from GCS not yet configured',
      hint: 'Diff will be available once GCS signed URL generation is implemented',
      oldSnapshotId: oldSnapshot.id,
      newSnapshotId: newSnapshot.id,
      oldScrapedAt: oldSnapshot.scrapedAt,
      newScrapedAt: newSnapshot.scrapedAt,
    });

    // When GCS is ready, use this logic:
    // const oldContent = await fetchFromGcs(oldSnapshot.gcsUri);
    // const newContent = await fetchFromGcs(newSnapshot.gcsUri);
    // const cleanOld = stripHtml(oldContent);
    // const cleanNew = stripHtml(newContent);
    // const diff = Diff.diffLines(cleanOld, cleanNew);
    // 
    // const changes = diff.map(part => ({
    //   type: part.added ? 'add' : part.removed ? 'remove' : 'same',
    //   content: part.value,
    // }));
    // 
    // res.status(200).json({
    //   additions: diff.filter(p => p.added).reduce((sum, p) => sum + (p.count || 0), 0),
    //   deletions: diff.filter(p => p.removed).reduce((sum, p) => sum + (p.count || 0), 0),
    //   changes,
    // });
  } catch (error) {
    console.error('Error generating diff:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /monitors/{id}/export:
 *   post:
 *     summary: Export change history
 *     description: Request export of all changes for this monitor (GDPR Art. 20)
 *     tags: [Monitors]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [json, csv]
 *                 default: json
 *     responses:
 *       202:
 *         description: Export request accepted
 *       404:
 *         description: Monitor not found
 */
router.post('/:id/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const format = req.body?.format || 'json';
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
              orderBy: { createdAt: 'desc' },
              take: 1000, // Limit for safety
            },
          },
        },
      },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    // For now, return the data directly (synchronous export)
    // In production, this would create a DataExport record and process async
    const exportData = {
      exportedAt: new Date().toISOString(),
      monitor: {
        id: subscription.id,
        displayName: subscription.displayName,
        url: subscription.resource.urlNormalized,
        selector: subscription.resource.selector,
        createdAt: subscription.createdAt,
      },
      changeEvents: subscription.resource.changeEvents.map(event => ({
        id: event.id,
        createdAt: event.createdAt,
        globalRiskScore: event.globalRiskScore,
        globalAiSummary: event.globalAiSummary,
        riskKeywords: event.riskKeywords,
      })),
    };

    // Audit log for GDPR compliance
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXPORT',
        entityType: 'subscription',
        entityId: subscription.id,
        details: { format, eventCount: exportData.changeEvents.length },
        ipAddress: req.ip,
      },
    });

    if (format === 'csv') {
      // CSV format
      const csvHeader = 'id,createdAt,riskScore,summary,keywords\n';
      const csvRows = exportData.changeEvents.map(e => 
        `"${e.id}","${e.createdAt}",${e.globalRiskScore || ''},"${(e.globalAiSummary || '').replace(/"/g, '""')}","${(e.riskKeywords || []).join(';')}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="monitor-${id}-export.csv"`);
      res.status(200).send(csvHeader + csvRows);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="monitor-${id}-export.json"`);
      res.status(200).json(exportData);
    }
  } catch (error) {
    console.error('Error exporting monitor:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;


