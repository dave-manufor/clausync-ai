import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { z } from 'zod';

const router = Router();

// Validation schema for updating preferences
const UpdatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  digestFrequency: z.enum(['instant', 'daily', 'weekly']).optional(),
  riskThreshold: z.number().int().min(1).max(10).optional(),
});

/**
 * @openapi
 * /preferences/notifications:
 *   get:
 *     summary: Get notification preferences
 *     description: Returns the user's notification preference settings (GDPR/CAN-SPAM compliant)
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Notification preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     emailEnabled: { type: boolean }
 *                     digestFrequency: { type: string, enum: [instant, daily, weekly] }
 *                     riskThreshold: { type: integer, minimum: 1, maximum: 10 }
 *       401:
 *         description: Unauthorized
 */
router.get('/notifications', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get or create default preferences
    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });

    if (!preferences) {
      // Create default preferences (GDPR: explicit consent defaults)
      preferences = await prisma.notificationPreference.create({
        data: {
          userId: user.id,
          emailEnabled: true,
          digestFrequency: 'instant',
          riskThreshold: 5,
        },
      });
    }

    res.status(200).json({ data: preferences });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /preferences/notifications:
 *   patch:
 *     summary: Update notification preferences
 *     description: Update user's notification settings (GDPR/CAN-SPAM compliant - user controls their data)
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailEnabled:
 *                 type: boolean
 *                 description: Enable/disable email notifications (CAN-SPAM unsubscribe)
 *               digestFrequency:
 *                 type: string
 *                 enum: [instant, daily, weekly]
 *                 description: How often to receive notification digests
 *               riskThreshold:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Only notify for changes above this risk level
 *     responses:
 *       200:
 *         description: Preferences updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.patch('/notifications', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = UpdatePreferencesSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const userId = req.user!.uid;
    const updates = parseResult.data;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Upsert preferences (create if doesn't exist)
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        emailEnabled: updates.emailEnabled ?? true,
        digestFrequency: updates.digestFrequency ?? 'instant',
        riskThreshold: updates.riskThreshold ?? 5,
      },
      update: updates,
    });

    // Audit log for GDPR compliance - track consent changes
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'notification_preference',
        entityId: preferences.id,
        details: {
          changes: updates,
          // Track email consent specifically for CAN-SPAM
          emailConsentChanged: updates.emailEnabled !== undefined,
        },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({
      message: 'Notification preferences updated',
      data: preferences,
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
