import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/client';
import { validateScopes, API_SCOPES, SCOPE_PRESETS } from '../utils/scopes';
import { generateApiKey } from '../middleware/api-key';
import { z } from 'zod';

const router = Router();

// Validation schemas
const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional().default(['monitors:read', 'changes:read']),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

const ListApiKeysSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * POST /api-keys
 * Create a new API key
 * Note: The full key is only returned ONCE at creation
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = CreateApiKeySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { name, scopes, expiresInDays } = parseResult.data;
    const userId = req.user!.uid;

    // Validate scopes
    const scopeValidation = validateScopes(scopes);
    if (!scopeValidation.valid) {
      res.status(400).json({
        error: 'Invalid scopes',
        invalidScopes: scopeValidation.invalid,
        validScopes: Object.keys(API_SCOPES),
      });
      return;
    }

    // Get user from DB
    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Generate the key
    const { key, prefix } = generateApiKey('live');
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    // Calculate expiration
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Create the API key record
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name,
        keyPrefix: prefix,
        keyHash,
        scopes,
        expiresAt,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'api_key',
        entityId: apiKey.id,
        details: { name, scopes },
        ipAddress: req.ip,
      },
    });

    // Return the key (only time it's visible)
    res.status(201).json({
      message: 'API key created successfully',
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key, // Full key, only shown once
        prefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      warning: 'Save this key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api-keys
 * List user's API keys (without the actual key values)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit } = ListApiKeysSchema.parse(req.query);
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(200).json({ data: [], pagination: { page, limit, total: 0 } });
      return;
    }

    const [apiKeys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where: { userId: user.id, revokedAt: null },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.apiKey.count({ where: { userId: user.id, revokedAt: null } }),
    ]);

    res.status(200).json({
      data: apiKeys.map(k => ({
        ...k,
        // Show only prefix + masked characters
        maskedKey: `${k.keyPrefix}${'*'.repeat(24)}`,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api-keys/scopes
 * List available scopes and presets
 */
router.get('/scopes', async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    scopes: Object.entries(API_SCOPES).map(([scope, description]) => ({
      scope,
      description,
    })),
    presets: Object.entries(SCOPE_PRESETS).map(([name, scopes]) => ({
      name,
      scopes,
    })),
  });
});

/**
 * DELETE /api-keys/:id
 * Revoke an API key
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    // Find the key
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId: user.id, revokedAt: null },
    });

    if (!apiKey) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    // Revoke (soft delete)
    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'api_key',
        entityId: id,
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
