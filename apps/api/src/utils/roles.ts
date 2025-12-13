/**
 * Role-Based Access Control (RBAC) utilities
 * Role hierarchy: super_admin > owner > admin > member > viewer
 */

export const ROLES = {
  super_admin: {
    level: 5,
    description: 'System administrator with access to all organizations',
    permissions: ['**'], // Super wildcard for cross-org access
  },
  owner: {
    level: 4,
    description: 'Full access, can delete org and transfer ownership',
    permissions: ['*'],
  },
  admin: {
    level: 3,
    description: 'Manage monitors, invite members, view billing',
    permissions: [
      'org:read', 'org:update',
      'members:read', 'members:invite', 'members:update', 'members:remove',
      'monitors:*', 'changes:*', 'snapshots:*', 'documents:*',
      'webhooks:*', 'billing:read', 'analytics:*',
    ],
  },
  member: {
    level: 2,
    description: 'Create and manage own monitors',
    permissions: [
      'org:read',
      'members:read',
      'monitors:read', 'monitors:create', 'monitors:update:own', 'monitors:delete:own',
      'changes:read', 'snapshots:read', 'documents:read',
      'analytics:read',
    ],
  },
  viewer: {
    level: 1,
    description: 'Read-only access',
    permissions: [
      'org:read', 'members:read',
      'monitors:read', 'changes:read', 'snapshots:read',
      'analytics:read',
    ],
  },
} as const;

export type Role = keyof typeof ROLES;

/**
 * Check if a role has at least the required level
 */
export function hasRoleLevel(userRole: string, requiredRole: Role): boolean {
  const userRoleConfig = ROLES[userRole as Role];
  const requiredRoleConfig = ROLES[requiredRole];
  
  if (!userRoleConfig || !requiredRoleConfig) {
    return false;
  }
  
  return userRoleConfig.level >= requiredRoleConfig.level;
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(userRole: string, permission: string): boolean {
  const roleConfig = ROLES[userRole as Role];
  if (!roleConfig) return false;
  
  const permissions = roleConfig.permissions as readonly string[];
  
  // Owner has all permissions
  if (permissions.includes('*')) return true;
  
  // Check for exact match
  if (permissions.includes(permission)) return true;
  
  // Check for wildcard match (e.g., monitors:* matches monitors:read)
  const [resource] = permission.split(':');
  if (permissions.includes(`${resource}:*`)) return true;
  
  return false;
}

/**
 * Get all roles a user can assign (must be lower than their own)
 */
export function getAssignableRoles(userRole: string): Role[] {
  const userLevel = ROLES[userRole as Role]?.level || 0;
  
  return (Object.keys(ROLES) as Role[])
    .filter(role => ROLES[role].level < userLevel);
}

/**
 * Validate that a role string is valid
 */
export function isValidRole(role: string): role is Role {
  return role in ROLES;
}

/**
 * Get role display info
 */
export function getRoleInfo(role: string) {
  return ROLES[role as Role] || null;
}
