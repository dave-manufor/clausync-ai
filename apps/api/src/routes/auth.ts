import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { sendSuccess, sendPaginated, errors } from '../middleware/response-formatter';
import * as UAParserModule from 'ua-parser-js';

const router = Router();

/**
 * Parse User-Agent into readable device info
 */
function parseDeviceInfo(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown Device';
  
  const UAParser = (UAParserModule as any).default || UAParserModule;
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  const browser = result.browser.name || 'Unknown Browser';
  const os = result.os.name || 'Unknown OS';
  const device = result.device.type || 'desktop';
  
  return `${browser} on ${os} (${device})`;
}

/**
 * @openapi
 * /api/v1/auth/sessions:
 *   get:
 *     summary: List user sessions
 *     description: List all active sessions for the current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: List of sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       deviceInfo: { type: string }
 *                       ipAddress: { type: string }
 *                       ssoProvider: { type: string }
 *                       lastActiveAt: { type: string, format: date-time }
 *                       createdAt: { type: string, format: date-time }
 *                       isCurrent: { type: boolean }
 */
router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      errors.notFound(res, 'User not found');
      return;
    }

    const sessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        ssoProvider: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    // Get current session ID from request context if available
    const currentSessionId = (req as any).sessionId;

    const sessionsWithCurrent = sessions.map((s: typeof sessions[0]) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));

    sendSuccess(res, sessionsWithCurrent);
  } catch (error) {
    console.error('Error listing sessions:', error);
    errors.internal(res);
  }
});

/**
 * @openapi
 * /api/v1/auth/sessions:
 *   post:
 *     summary: Create/refresh session
 *     description: Create a new session or update existing session on login
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session created
 */
router.post('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      errors.notFound(res, 'User not found');
      return;
    }

    const deviceInfo = parseDeviceInfo(req.headers['user-agent']);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const ssoProvider = req.user!.signInProvider;

    // Create new session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo,
        ipAddress,
        ssoProvider,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'session',
        entityId: session.id,
        details: { deviceInfo, ssoProvider },
        ipAddress,
      },
    });

    sendSuccess(res, {
      sessionId: session.id,
      deviceInfo: session.deviceInfo,
      ssoProvider: session.ssoProvider,
      createdAt: session.createdAt,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    errors.internal(res);
  }
});

/**
 * @openapi
 * /api/v1/auth/sessions/{id}:
 *   delete:
 *     summary: Revoke a session
 *     description: Revoke a specific session (logout from device)
 *     tags: [Auth]
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
 *         description: Session revoked
 *       404:
 *         description: Session not found
 */
router.delete('/sessions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      errors.notFound(res, 'User not found');
      return;
    }

    // Find session belonging to user
    const session = await prisma.session.findFirst({
      where: {
        id,
        userId: user.id,
        revokedAt: null,
      },
    });

    if (!session) {
      errors.notFound(res, 'Session not found');
      return;
    }

    // Revoke session (soft delete)
    await prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGOUT',
        entityType: 'session',
        entityId: id,
        details: { deviceInfo: session.deviceInfo },
        ipAddress: req.ip,
      },
    });

    sendSuccess(res, { message: 'Session revoked' });
  } catch (error) {
    console.error('Error revoking session:', error);
    errors.internal(res);
  }
});

/**
 * @openapi
 * /api/v1/auth/sessions/revoke-all:
 *   post:
 *     summary: Revoke all sessions
 *     description: Revoke all sessions except current (logout from all devices)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions revoked
 */
router.post('/sessions/revoke-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      errors.notFound(res, 'User not found');
      return;
    }

    const currentSessionId = (req as any).sessionId;

    // Revoke all sessions except current
    const result = await prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGOUT_ALL',
        entityType: 'session',
        entityId: null,
        details: { revokedCount: result.count },
        ipAddress: req.ip,
      },
    });

    sendSuccess(res, { 
      message: 'All sessions revoked',
      revokedCount: result.count,
    });
  } catch (error) {
    console.error('Error revoking all sessions:', error);
    errors.internal(res);
  }
});

export default router;
