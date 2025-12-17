/**
 * User Provisioning Middleware
 * 
 * Automatically creates user, organization, and free tier subscription
 * on first API access for authenticated Firebase users.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { assignFreeTier } from '../services/subscription';

/**
 * Ensure authenticated user exists in database with org and subscription.
 * Creates user, organization, and assigns free tier if not exists.
 */
export const ensureUserProvisioned = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user?.uid) {
    return next();
  }

  try {
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user.uid },
      include: { organization: true },
    });

    if (user) {
      // User exists - check if they have an organization
      if (!user.organization) {
        // Create org for orphaned user
        const org = await createOrganizationForUser(user.id, req.user.email);
        console.log(`Created organization ${org.id} for orphaned user ${user.id}`);
      }
      return next();
    }

    // New user - create everything in a transaction
    console.log(`Provisioning new user: ${req.user.email}`);

    let createdUserId: string | null = null;
    let createdOrgId: string | null = null;

    await prisma.$transaction(async (tx) => {
      // 1. Create organization
      const organization = await tx.organization.create({
        data: {
          name: `${req.user!.email.split('@')[0]}'s Organization`,
        },
      });
      createdOrgId = organization.id;

      // 2. Create user linked to organization
      const newUser = await tx.user.create({
        data: {
          identityProviderUid: req.user!.uid,
          email: req.user!.email,
          name: req.user!.email.split('@')[0],
          role: 'owner',
          organizationId: organization.id,
        },
      });
      createdUserId = newUser.id;

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          userId: newUser.id,
          action: 'USER_PROVISIONED',
          entityType: 'user',
          entityId: newUser.id,
          details: {
            email: req.user!.email,
            organizationId: organization.id,
            signInProvider: req.user!.signInProvider,
          },
          ipAddress: req.ip,
        },
      });
    });

    // 4. Assign free tier (outside transaction since it may have its own)
    const freshUser = await prisma.user.findUnique({
      where: { identityProviderUid: req.user.uid },
      include: { organization: true },
    });

    if (freshUser?.organization) {
      await assignFreeTier(freshUser.organization.id);
      console.log(`Assigned free tier to org ${freshUser.organization.id}`);
    }

    next();
  } catch (error) {
    console.error('Error provisioning user:', error);
    // Don't fail the request - continue and let the endpoint handle missing user
    next();
  }
};

/**
 * Create organization for an existing user without one
 */
async function createOrganizationForUser(userId: string, email: string) {
  const organization = await prisma.organization.create({
    data: {
      name: `${email.split('@')[0]}'s Organization`,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: organization.id },
  });

  await assignFreeTier(organization.id);

  return organization;
}
