/**
 * Granular permission scopes for API keys
 */
export const API_SCOPES = {
  // Read scopes
  'monitors:read': 'View monitors and subscriptions',
  'changes:read': 'View change events and diffs',
  'snapshots:read': 'View and download snapshots',
  'notifications:read': 'View notification history',
  'analytics:read': 'View analytics and dashboards',
  
  // Write scopes
  'monitors:write': 'Create, update, and delete monitors',
  'notifications:write': 'Mark notifications as read, update preferences',
  'documents:write': 'Upload and manage policy documents',
  
  // Admin scopes
  'api-keys:manage': 'Create and revoke API keys',
  'organization:manage': 'Manage organization settings and members',
  
  // Full access
  '*': 'Full access to all resources',
} as const;

export type ApiScope = keyof typeof API_SCOPES;

/**
 * Preset scope bundles for common use cases
 */
export const SCOPE_PRESETS = {
  'read-only': ['monitors:read', 'changes:read', 'snapshots:read', 'notifications:read'],
  'standard': ['monitors:read', 'monitors:write', 'changes:read', 'snapshots:read', 'notifications:read', 'notifications:write'],
  'full': ['*'],
} as const;

/**
 * Check if a scope grants access to a required permission
 */
export function hasScope(grantedScopes: string[], requiredScope: ApiScope): boolean {
  // Full access scope grants everything
  if (grantedScopes.includes('*')) {
    return true;
  }
  
  // Exact match
  if (grantedScopes.includes(requiredScope)) {
    return true;
  }
  
  // Check if a parent scope grants access (e.g., monitors:write implies monitors:read)
  const [resource, action] = requiredScope.split(':');
  if (action === 'read' && grantedScopes.includes(`${resource}:write`)) {
    return true;
  }
  
  return false;
}

/**
 * Validate that all scopes in an array are valid
 */
export function validateScopes(scopes: string[]): { valid: boolean; invalid: string[] } {
  const invalid = scopes.filter(s => !(s in API_SCOPES));
  return { valid: invalid.length === 0, invalid };
}
