import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { z } from 'zod';
import { requireRole, requireOrgMembership } from '../middleware/rbac';
import { isValidRole } from '../utils/roles';
import { assignFreeTier } from '../services/subscription';

const router = Router();

// Validation schemas
const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

/**
 * @openapi
 * /organizations:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Organization created
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = CreateOrgSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { name } = parseResult.data;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if user already belongs to an org
    if (user.organizationId) {
      res.status(409).json({
        error: 'Already in organization',
        message: 'Leave your current organization before creating a new one',
      });
      return;
    }

    // Create org and set user as owner
    const organization = await prisma.organization.create({
      data: {
        name,
        users: {
          connect: { id: user.id },
        },
      },
    });

    // Update user role to owner
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'owner' },
    });

    // Auto-assign free tier subscription
    await assignFreeTier(organization.id);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'organization',
        entityId: organization.id,
        details: { name },
        ipAddress: req.ip,
      },
    });

    res.status(201).json({
      message: 'Organization created',
      data: organization,
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}:
 *   get:
 *     summary: Get organization details
 *     tags: [Organizations]
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
 *         description: Organization details
 */
router.get('/:id', requireOrgMembership, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
        _count: {
          select: { users: true, invitations: true },
        },
      },
    });

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.status(200).json({ data: organization });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}:
 *   patch:
 *     summary: Update organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *         description: Organization updated
 */
router.patch('/:id', requireOrgMembership, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parseResult = UpdateOrgSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: parseResult.data,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).dbUserId,
        action: 'UPDATE',
        entityType: 'organization',
        entityId: id,
        details: parseResult.data,
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Organization updated', data: organization });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}:
 *   delete:
 *     summary: Delete organization (owner only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Organization deleted
 */
router.delete('/:id', requireOrgMembership, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Remove all users from org first
    await prisma.user.updateMany({
      where: { organizationId: id },
      data: { organizationId: null, role: 'member' },
    });

    // Delete the organization
    await prisma.organization.delete({
      where: { id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).dbUserId,
        action: 'DELETE',
        entityType: 'organization',
        entityId: id,
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Organization deleted' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
