import { hasScope, validateScopes, API_SCOPES, SCOPE_PRESETS, ApiScope } from '../utils/scopes';

describe('Scopes Utility', () => {
  describe('API_SCOPES', () => {
    it('should define all expected scopes', () => {
      expect(API_SCOPES).toHaveProperty('monitors:read');
      expect(API_SCOPES).toHaveProperty('monitors:write');
      expect(API_SCOPES).toHaveProperty('changes:read');
      expect(API_SCOPES).toHaveProperty('snapshots:read');
      expect(API_SCOPES).toHaveProperty('notifications:read');
      expect(API_SCOPES).toHaveProperty('notifications:write');
      expect(API_SCOPES).toHaveProperty('documents:write');
      expect(API_SCOPES).toHaveProperty('analytics:read');
      expect(API_SCOPES).toHaveProperty('api-keys:manage');
      expect(API_SCOPES).toHaveProperty('organization:manage');
      expect(API_SCOPES).toHaveProperty('*');
    });

    it('should have descriptions for all scopes', () => {
      Object.values(API_SCOPES).forEach((description) => {
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SCOPE_PRESETS', () => {
    it('should define read-only preset', () => {
      expect(SCOPE_PRESETS['read-only']).toContain('monitors:read');
      expect(SCOPE_PRESETS['read-only']).toContain('changes:read');
      expect(SCOPE_PRESETS['read-only']).not.toContain('monitors:write');
    });

    it('should define standard preset with read and write', () => {
      expect(SCOPE_PRESETS['standard']).toContain('monitors:read');
      expect(SCOPE_PRESETS['standard']).toContain('monitors:write');
      expect(SCOPE_PRESETS['standard']).toContain('notifications:write');
    });

    it('should define full preset with wildcard', () => {
      expect(SCOPE_PRESETS['full']).toContain('*');
    });
  });

  describe('hasScope', () => {
    it('should return true for exact scope match', () => {
      expect(hasScope(['monitors:read'], 'monitors:read')).toBe(true);
    });

    it('should return false for missing scope', () => {
      expect(hasScope(['monitors:read'], 'monitors:write')).toBe(false);
    });

    it('should return true with wildcard scope', () => {
      expect(hasScope(['*'], 'monitors:read')).toBe(true);
      expect(hasScope(['*'], 'monitors:write')).toBe(true);
      expect(hasScope(['*'], 'organization:manage')).toBe(true);
    });

    it('should grant read access when write scope is present', () => {
      expect(hasScope(['monitors:write'], 'monitors:read')).toBe(true);
      expect(hasScope(['notifications:write'], 'notifications:read')).toBe(true);
    });

    it('should not grant write access with only read scope', () => {
      expect(hasScope(['monitors:read'], 'monitors:write')).toBe(false);
    });

    it('should handle multiple granted scopes', () => {
      const granted = ['monitors:read', 'changes:read', 'notifications:write'];
      expect(hasScope(granted, 'monitors:read')).toBe(true);
      expect(hasScope(granted, 'changes:read')).toBe(true);
      expect(hasScope(granted, 'notifications:read')).toBe(true); // write implies read
      expect(hasScope(granted, 'snapshots:read')).toBe(false);
    });

    it('should handle empty granted scopes', () => {
      expect(hasScope([], 'monitors:read')).toBe(false);
    });
  });

  describe('validateScopes', () => {
    it('should validate correct scopes', () => {
      const result = validateScopes(['monitors:read', 'changes:read']);
      expect(result.valid).toBe(true);
      expect(result.invalid).toEqual([]);
    });

    it('should detect invalid scopes', () => {
      const result = validateScopes(['monitors:read', 'invalid:scope', 'fake:permission']);
      expect(result.valid).toBe(false);
      expect(result.invalid).toContain('invalid:scope');
      expect(result.invalid).toContain('fake:permission');
      expect(result.invalid).not.toContain('monitors:read');
    });

    it('should validate wildcard scope', () => {
      const result = validateScopes(['*']);
      expect(result.valid).toBe(true);
    });

    it('should handle empty array', () => {
      const result = validateScopes([]);
      expect(result.valid).toBe(true);
      expect(result.invalid).toEqual([]);
    });
  });
});
