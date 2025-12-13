import { Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { hasRoleLevel, hasPermission, Role } from '../utils/roles';

/**
 * Middleware to require a minimum role level
 * Use after authenticate middleware
 */
export const requireRole = (minimumRole: Role) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get user from DB to check role
      const user = await prisma.user.findUnique({
        where: { identityProviderUid: req.user.uid },
        select: { role: true, organizationId: true },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (!hasRoleLevel(user.role, minimumRole)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `This action requires ${minimumRole} role or higher`,
          requiredRole: minimumRole,
          currentRole: user.role,
        });
        return;
      }

      // Attach role info to request for later use
      (req as any).userRole = user.role;
      (req as any).userOrgId = user.organizationId;

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};

/**
 * Middleware to require a specific permission
 */
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { identityProviderUid: req.user.uid },
        select: { role: true, organizationId: true },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (!hasPermission(user.role, permission)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Missing permission: ${permission}`,
          requiredPermission: permission,
        });
        return;
      }

      (req as any).userRole = user.role;
      (req as any).userOrgId = user.organizationId;

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};

/**
 * Middleware to require organization membership
 * Checks if user belongs to the org specified in :orgId param
 */
export const requireOrgMembership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orgId = req.params.orgId || req.params.id;
    
    if (!orgId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user.uid },
      select: { id: true, organizationId: true, role: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.organizationId !== orgId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of this organization',
      });
      return;
    }

    (req as any).dbUserId = user.id;
    (req as any).userRole = user.role;
    (req as any).userOrgId = user.organizationId;

    next();
  } catch (error) {
    console.error('Org membership check error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Middleware to require org owner role
 */
export const requireOrgOwner = requireRole('owner');

/**
 * Middleware to require org admin role
 */
export const requireOrgAdmin = requireRole('admin');
