import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/client';
import { z } from 'zod';
import { requireRole, requireOrgMembership } from '../middleware/rbac';
import { isValidRole, getAssignableRoles, hasRoleLevel } from '../utils/roles';

const router = Router({ mergeParams: true }); // Access :id from parent route

// Validation schemas
const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.string().default('member'),
});

const UpdateMemberSchema = z.object({
  role: z.string(),
});

/**
 * @openapi
 * /organizations/{id}/members:
 *   get:
 *     summary: List organization members
 *     tags: [Members]
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
 *         description: List of members
 */
router.get('/', requireOrgMembership, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.params.id;

    const members = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get pending invitations
    const invitations = await prisma.invitation.findMany({
      where: { organizationId: orgId, acceptedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      data: {
        members,
        pendingInvitations: invitations,
      },
    });
  } catch (error) {
    console.error('Error listing members:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}/members:
 *   post:
 *     summary: Invite a member to organization
 *     tags: [Members]
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
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [viewer, member, admin] }
 *     responses:
 *       201:
 *         description: Invitation sent
 */
router.post('/', requireOrgMembership, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.params.id;
    const parseResult = InviteMemberSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { email, role } = parseResult.data;

    // Validate role
    if (!isValidRole(role)) {
      res.status(400).json({ error: 'Invalid role', validRoles: ['viewer', 'member', 'admin'] });
      return;
    }

    // Can only assign roles lower than your own
    const assignableRoles = getAssignableRoles((req as any).userRole);
    if (!assignableRoles.includes(role as any) && role !== (req as any).userRole) {
      res.status(403).json({
        error: 'Cannot assign this role',
        message: 'You can only assign roles lower than your own',
        assignableRoles,
      });
      return;
    }

    // Check if already a member
    const existingUser = await prisma.user.findFirst({
      where: { email, organizationId: orgId },
    });

    if (existingUser) {
      res.status(409).json({ error: 'User is already a member of this organization' });
      return;
    }

    // Check for pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: { email, organizationId: orgId, acceptedAt: null },
    });

    if (existingInvitation) {
      res.status(409).json({
        error: 'Invitation already pending',
        invitationId: existingInvitation.id,
      });
      return;
    }

    // Create invitation token (expires in 7 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: orgId,
        email,
        role,
        token,
        invitedBy: (req as any).dbUserId,
        expiresAt,
      },
      include: {
        organization: { select: { name: true } },
      },
    });

    // TODO: Send invitation email via Resend
    // const inviteUrl = `${process.env.APP_URL}/invite/${token}`;
    // await sendInvitationEmail(email, invitation.organization.name, inviteUrl);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).dbUserId,
        action: 'INVITE',
        entityType: 'invitation',
        entityId: invitation.id,
        details: { email, role },
        ipAddress: req.ip,
      },
    });

    res.status(201).json({
      message: 'Invitation sent',
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      note: 'Email invitation will be sent when Resend is configured',
    });
  } catch (error) {
    console.error('Error inviting member:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}/members/{userId}:
 *   patch:
 *     summary: Update member role
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string }
 *     responses:
 *       200:
 *         description: Role updated
 */
router.patch('/:userId', requireOrgMembership, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: orgId, userId } = req.params;
    const parseResult = UpdateMemberSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { role } = parseResult.data;

    // Validate role
    if (!isValidRole(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    // Get target user
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Cannot modify your own role
    if (userId === (req as any).dbUserId) {
      res.status(403).json({ error: 'Cannot modify your own role' });
      return;
    }

    // Cannot modify someone with higher/equal role
    if (!hasRoleLevel((req as any).userRole, targetUser.role as any)) {
      res.status(403).json({ error: 'Cannot modify a user with equal or higher role' });
      return;
    }

    // Update role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).dbUserId,
        action: 'UPDATE_ROLE',
        entityType: 'user',
        entityId: userId,
        details: { oldRole: targetUser.role, newRole: role },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Role updated', data: updatedUser });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /organizations/{id}/members/{userId}:
 *   delete:
 *     summary: Remove member from organization
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Member removed
 */
router.delete('/:userId', requireOrgMembership, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: orgId, userId } = req.params;

    // Get target user
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Cannot remove yourself (use leave endpoint)
    if (userId === (req as any).dbUserId) {
      res.status(403).json({ error: 'Cannot remove yourself. Use leave organization instead.' });
      return;
    }

    // Cannot remove owner
    if (targetUser.role === 'owner') {
      res.status(403).json({ error: 'Cannot remove organization owner' });
      return;
    }

    // Cannot remove someone with higher/equal role
    if (!hasRoleLevel((req as any).userRole, targetUser.role as any)) {
      res.status(403).json({ error: 'Cannot remove a user with equal or higher role' });
      return;
    }

    // Remove from organization
    await prisma.user.update({
      where: { id: userId },
      data: { organizationId: null, role: 'member' },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).dbUserId,
        action: 'REMOVE_MEMBER',
        entityType: 'user',
        entityId: userId,
        details: { removedEmail: targetUser.email },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Member removed from organization' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
