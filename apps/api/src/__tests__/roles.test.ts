import { hasRoleLevel, hasPermission, getAssignableRoles, isValidRole, getRoleInfo, ROLES } from '../utils/roles';

describe('Roles Utility', () => {
  describe('ROLES', () => {
    it('should define all four roles', () => {
      expect(ROLES).toHaveProperty('owner');
      expect(ROLES).toHaveProperty('admin');
      expect(ROLES).toHaveProperty('member');
      expect(ROLES).toHaveProperty('viewer');
    });

    it('should have correct role hierarchy', () => {
      expect(ROLES.owner.level).toBeGreaterThan(ROLES.admin.level);
      expect(ROLES.admin.level).toBeGreaterThan(ROLES.member.level);
      expect(ROLES.member.level).toBeGreaterThan(ROLES.viewer.level);
    });

    it('should have descriptions for all roles', () => {
      Object.values(ROLES).forEach(role => {
        expect(role.description).toBeDefined();
        expect(role.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('hasRoleLevel', () => {
    it('should return true for exact role match', () => {
      expect(hasRoleLevel('admin', 'admin')).toBe(true);
      expect(hasRoleLevel('owner', 'owner')).toBe(true);
    });

    it('should return true for higher role', () => {
      expect(hasRoleLevel('owner', 'admin')).toBe(true);
      expect(hasRoleLevel('owner', 'member')).toBe(true);
      expect(hasRoleLevel('admin', 'member')).toBe(true);
      expect(hasRoleLevel('admin', 'viewer')).toBe(true);
    });

    it('should return false for lower role', () => {
      expect(hasRoleLevel('member', 'admin')).toBe(false);
      expect(hasRoleLevel('viewer', 'member')).toBe(false);
      expect(hasRoleLevel('admin', 'owner')).toBe(false);
    });

    it('should return false for invalid roles', () => {
      expect(hasRoleLevel('invalid', 'admin')).toBe(false);
      expect(hasRoleLevel('admin', 'invalid' as any)).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should grant owner all permissions', () => {
      expect(hasPermission('owner', 'anything:read')).toBe(true);
      expect(hasPermission('owner', 'org:delete')).toBe(true);
    });

    it('should check exact permission match', () => {
      expect(hasPermission('admin', 'org:read')).toBe(true);
      expect(hasPermission('member', 'org:read')).toBe(true);
    });

    it('should support wildcard permissions', () => {
      expect(hasPermission('admin', 'monitors:read')).toBe(true);
      expect(hasPermission('admin', 'monitors:write')).toBe(true);
      expect(hasPermission('admin', 'monitors:delete')).toBe(true);
    });

    it('should deny missing permissions', () => {
      expect(hasPermission('viewer', 'monitors:write')).toBe(false);
      expect(hasPermission('member', 'billing:read')).toBe(false);
    });

    it('should return false for invalid role', () => {
      expect(hasPermission('invalid', 'org:read')).toBe(false);
    });
  });

  describe('getAssignableRoles', () => {
    it('should return roles lower than owner', () => {
      const roles = getAssignableRoles('owner');
      expect(roles).toContain('admin');
      expect(roles).toContain('member');
      expect(roles).toContain('viewer');
      expect(roles).not.toContain('owner');
    });

    it('should return roles lower than admin', () => {
      const roles = getAssignableRoles('admin');
      expect(roles).toContain('member');
      expect(roles).toContain('viewer');
      expect(roles).not.toContain('admin');
      expect(roles).not.toContain('owner');
    });

    it('should return only viewer for member', () => {
      const roles = getAssignableRoles('member');
      expect(roles).toContain('viewer');
      expect(roles).not.toContain('member');
    });

    it('should return empty array for viewer', () => {
      const roles = getAssignableRoles('viewer');
      expect(roles).toEqual([]);
    });

    it('should return empty array for invalid role', () => {
      const roles = getAssignableRoles('invalid');
      expect(roles).toEqual([]);
    });
  });

  describe('isValidRole', () => {
    it('should return true for valid roles', () => {
      expect(isValidRole('owner')).toBe(true);
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('member')).toBe(true);
      expect(isValidRole('viewer')).toBe(true);
    });

    it('should return false for invalid roles', () => {
      expect(isValidRole('superadmin')).toBe(false);
      expect(isValidRole('')).toBe(false);
      expect(isValidRole('ADMIN')).toBe(false); // case sensitive
    });
  });

  describe('getRoleInfo', () => {
    it('should return role info for valid role', () => {
      const info = getRoleInfo('admin');
      expect(info).not.toBeNull();
      expect(info?.level).toBe(3);
      expect(info?.description).toBeDefined();
    });

    it('should return null for invalid role', () => {
      expect(getRoleInfo('invalid')).toBeNull();
    });
  });
});
