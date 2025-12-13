import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/client';
import { z } from 'zod';
import { requireRole, requireOrgMembership } from '../middleware/rbac';

const router = Router({ mergeParams: true }); // Access :id from parent route

// Validation schemas
const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

const UpdateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

/**
 * @openapi
 * /organizations/{id}/webhooks:
 *   get:
 *     summary: List webhooks for organization
 *     tags: [Webhooks]
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
 *         description: List of webhooks
 */
router.get('/', requireOrgMembership, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.params.id;

    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        enabled: true,
        lastDeliveryAt: true,
        lastStatus: true,
        failureCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ data: webhooks });
  } catch (error) {
    console.error('Error listing webhooks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}/webhooks:
 *   post:
 *     summary: Create a webhook endpoint
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, url, events]
 *             properties:
 *               name: { type: string }
 *               url: { type: string, format: uri }
 *               events: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Webhook created
 */
router.post('/', requireOrgMembership, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.params.id;
    const parseResult = CreateWebhookSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { name, url, events } = parseResult.data;

    // Generate signing secret
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        organizationId: orgId,
        name,
        url,
        events,
        secret,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).dbUserId,
        action: 'CREATE',
        entityType: 'webhook',
        entityId: webhook.id,
        details: { name, url, events },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.status(201).json({
      message: 'Webhook created',
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret, // Only shown once!
      },
      note: 'Save the secret - it will not be shown again',
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}/webhooks/{webhookId}:
 *   patch:
 *     summary: Update webhook endpoint
 *     tags: [Webhooks]
 */
router.patch('/:webhookId', requireOrgMembership, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: orgId, webhookId } = req.params;
    const parseResult = UpdateWebhookSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    // Verify webhook belongs to org
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, organizationId: orgId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const webhook = await prisma.webhookEndpoint.update({
      where: { id: webhookId },
      data: parseResult.data,
    });

    res.status(200).json({ message: 'Webhook updated', data: webhook });
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}/webhooks/{webhookId}:
 *   delete:
 *     summary: Delete webhook endpoint
 *     tags: [Webhooks]
 */
router.delete('/:webhookId', requireOrgMembership, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: orgId, webhookId } = req.params;

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, organizationId: orgId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    await prisma.webhookEndpoint.delete({
      where: { id: webhookId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).dbUserId,
        action: 'DELETE',
        entityType: 'webhook',
        entityId: webhookId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.status(200).json({ message: 'Webhook deleted' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}/webhooks/{webhookId}/test:
 *   post:
 *     summary: Send test event to webhook
 *     tags: [Webhooks]
 */
router.post('/:webhookId/test', requireOrgMembership, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: orgId, webhookId } = req.params;

    const webhook = await prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, organizationId: orgId },
    });

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    // Create test payload
    const payload = {
      event: 'test.ping',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.id,
      },
    };

    // Sign the payload
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Send test webhook
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Clausync-Signature': `sha256=${signature}`,
          'X-Clausync-Event': 'test.ping',
        },
        body: JSON.stringify(payload),
      });

      await prisma.webhookEndpoint.update({
        where: { id: webhookId },
        data: {
          lastDeliveryAt: new Date(),
          lastStatus: response.status,
          failureCount: response.ok ? 0 : webhook.failureCount + 1,
        },
      });

      res.status(200).json({
        message: 'Test webhook sent',
        status: response.status,
        success: response.ok,
      });
    } catch (err) {
      await prisma.webhookEndpoint.update({
        where: { id: webhookId },
        data: {
          lastDeliveryAt: new Date(),
          lastStatus: 0,
          failureCount: webhook.failureCount + 1,
        },
      });

      res.status(200).json({
        message: 'Test webhook failed',
        error: (err as Error).message,
        success: false,
      });
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
