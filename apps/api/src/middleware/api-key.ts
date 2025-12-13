import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../db/client';
import { hasScope, ApiScope } from '../utils/scopes';

/**
 * Hash an API key using SHA-256
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Check if a key looks like a Clausync API key
 */
function isApiKeyFormat(key: string): boolean {
  return key.startsWith('clau_live_') || key.startsWith('clau_test_');
}

/**
 * API Key authentication middleware
 * Checks X-API-Key header or Bearer token with clau_ prefix
 */
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check X-API-Key header
  let apiKey = req.headers['x-api-key'] as string | undefined;

  // Or check Authorization Bearer header for API key format
  if (!apiKey) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer clau_')) {
      apiKey = authHeader.slice(7); // Remove 'Bearer '
    }
  }

  if (!apiKey || !isApiKeyFormat(apiKey)) {
    // Not an API key, skip to next auth method
    next();
    return;
  }

  try {
    const keyHash = hashApiKey(apiKey);

    // Look up the key
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKeyRecord) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Check if revoked
    if (apiKeyRecord.revokedAt) {
      res.status(401).json({ error: 'API key has been revoked' });
      return;
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      res.status(401).json({ error: 'API key has expired' });
      return;
    }

    // Update last used timestamp (fire and forget)
    prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {}); // Ignore errors

    // Set user context (API key users are considered verified)
    req.user = {
      uid: apiKeyRecord.user.identityProviderUid,
      email: apiKeyRecord.user.email,
      emailVerified: true,
      signInProvider: 'apiKey',
    };

    // Set API key metadata on request
    (req as any).authType = 'apiKey';
    (req as any).apiKeyId = apiKeyRecord.id;
    (req as any).apiKeyScopes = apiKeyRecord.scopes;
    (req as any).dbUserId = apiKeyRecord.userId;

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Middleware to require specific scope(s)
 * Use after authenticate middleware
 */
export const requireScope = (...requiredScopes: ApiScope[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // If not authenticated via API key, allow (token auth has full access)
    if ((req as any).authType !== 'apiKey') {
      next();
      return;
    }

    const grantedScopes = (req as any).apiKeyScopes as string[] || [];

    // Check if any required scope is granted
    const hasAccess = requiredScopes.every(scope => hasScope(grantedScopes, scope));

    if (!hasAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: `This action requires scope(s): ${requiredScopes.join(', ')}`,
        requiredScopes,
        grantedScopes,
      });
      return;
    }

    next();
  };
};

/**
 * Generate a new API key
 * Returns: { key: string, prefix: string }
 */
export function generateApiKey(environment: 'live' | 'test' = 'live'): { key: string; prefix: string } {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  const prefix = `clau_${environment}_`;
  const key = `${prefix}${randomPart}`;
  return { key, prefix };
}
