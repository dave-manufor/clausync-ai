import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { z } from 'zod';

const router = Router();

// Validation schemas
const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

/**
 * @openapi
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: { id: true, name: true },
        },
        deletionRequest: {
          select: { id: true, status: true, scheduledAt: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ data: user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /users/me:
 *   patch:
 *     summary: Update user profile
 *     tags: [Users]
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
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Updated profile
 */
router.patch('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = UpdateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { name, email } = parseResult.data;

    const user = await prisma.user.update({
      where: { identityProviderUid: req.user!.uid },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'user',
        entityId: user.id,
        details: { updated: Object.keys(parseResult.data) },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Profile updated', data: user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /users/me:
 *   delete:
 *     summary: Request account deletion (GDPR Art. 17)
 *     description: Schedules account for deletion after 30-day grace period
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion scheduled
 */
router.delete('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
      include: { deletionRequest: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check for existing deletion request
    if (user.deletionRequest?.status === 'pending') {
      res.status(409).json({
        error: 'Deletion already scheduled',
        scheduledAt: user.deletionRequest.scheduledAt,
      });
      return;
    }

    // Create deletion request with 30-day grace period
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 30);

    const deletionRequest = await prisma.deletionRequest.create({
      data: {
        userId: user.id,
        scheduledAt,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE_REQUEST',
        entityType: 'user',
        entityId: user.id,
        details: { scheduledAt },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({
      message: 'Account deletion scheduled',
      scheduledAt,
      note: 'Your account will be permanently deleted after 30 days. You can cancel this request by logging in before then.',
    });
  } catch (error) {
    console.error('Error requesting deletion:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /users/me/export:
 *   post:
 *     summary: Request data export (GDPR Art. 20)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       202:
 *         description: Export request created
 */
router.post('/me/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check for pending export
    const pendingExport = await prisma.dataExport.findFirst({
      where: { userId: user.id, status: { in: ['pending', 'processing'] } },
    });

    if (pendingExport) {
      res.status(409).json({
        error: 'Export already in progress',
        exportId: pendingExport.id,
        status: pendingExport.status,
      });
      return;
    }

    // Create export request
    const dataExport = await prisma.dataExport.create({
      data: {
        userId: user.id,
        status: 'pending',
      },
    });

    // TODO: Trigger background job to generate export
    // In production, publish to a queue for async processing

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXPORT_REQUEST',
        entityType: 'data_export',
        entityId: dataExport.id,
        ipAddress: req.ip,
      },
    });

    res.status(202).json({
      message: 'Data export request created',
      exportId: dataExport.id,
      status: 'pending',
      note: 'You will receive an email when your data export is ready for download.',
    });
  } catch (error) {
    console.error('Error requesting export:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /users/me/export:
 *   get:
 *     summary: List data export requests
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of exports
 */
router.get('/me/exports', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const exports = await prisma.dataExport.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.status(200).json({ data: exports });
  } catch (error) {
    console.error('Error fetching exports:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Cancel pending deletion request
 */
router.post('/me/cancel-deletion', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
      include: { deletionRequest: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.deletionRequest || user.deletionRequest.status !== 'pending') {
      res.status(404).json({ error: 'No pending deletion request found' });
      return;
    }

    await prisma.deletionRequest.update({
      where: { id: user.deletionRequest.id },
      data: { status: 'cancelled' },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CANCEL_DELETE',
        entityType: 'user',
        entityId: user.id,
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Deletion request cancelled' });
  } catch (error) {
    console.error('Error cancelling deletion:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
