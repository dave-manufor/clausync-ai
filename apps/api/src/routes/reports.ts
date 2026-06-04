import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/client';
import { Storage } from '@google-cloud/storage';

const router = Router();
const storage = new Storage();
const BUCKET_NAME = process.env.REPORTS_BUCKET_NAME || 'clausync-reports';
const REPORT_EXPIRY_DAYS = 7;

// Report generation request schema
const generateReportSchema = z.object({
  type: z.enum(['risk_summary', 'change_history', 'compliance']),
  format: z.enum(['pdf', 'csv']).default('pdf'),
  period: z.enum(['7d', '30d', '90d']).default('30d'),
  resourceIds: z.array(z.string().uuid()).optional(),
});

/**
 * @openapi
 * /reports:
 *   post:
 *     summary: Generate a new report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type: { type: string, enum: [risk_summary, change_history, compliance] }
 *               format: { type: string, enum: [pdf, csv], default: pdf }
 *               period: { type: string, enum: ['7d', '30d', '90d'], default: '30d' }
 *               resourceIds: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Report generation started
 *       400:
 *         description: Validation error
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = generateReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation error', details: parsed.error.errors });
      return;
    }

    const { type, format, period, resourceIds } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Calculate expiry date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REPORT_EXPIRY_DAYS);

    // Create report record
    const report = await prisma.report.create({
      data: {
        userId: user.id,
        type,
        format,
        status: 'pending',
        parameters: {
          period,
          resourceIds: resourceIds || [],
          requestedAt: new Date().toISOString(),
        },
        expiresAt,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'report',
        entityId: report.id,
        details: { type, format, period },
        ipAddress: req.ip,
      },
    });

    // Publish to reports-worker via Pub/Sub
    const { publishMessage } = await import('../services/pubsub');
    await publishMessage('cmd.generate_report', { report_id: report.id });

    res.status(201).json({
      message: 'Report generation started',
      reportId: report.id,
      status: report.status,
      expiresAt: report.expiresAt,
    });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /reports:
 *   get:
 *     summary: List user's reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: List of reports
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          format: true,
          status: true,
          parameters: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      prisma.report.count({ where: { userId: user.id } }),
    ]);

    res.status(200).json({
      data: reports,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /reports/{id}:
 *   get:
 *     summary: Get report metadata
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Report metadata
 *       404:
 *         description: Report not found
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.report.findFirst({
      where: {
        id: req.params.id,
        userId: user.id,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.status(200).json({ data: report });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /reports/{id}/download:
 *   get:
 *     summary: Download report file
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Signed download URL
 *       404:
 *         description: Report not found
 *       409:
 *         description: Report not ready
 */
router.get('/:id/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.report.findFirst({
      where: {
        id: req.params.id,
        userId: user.id,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    if (report.status !== 'ready' || !report.fileUrl) {
      res.status(409).json({
        error: 'Report not ready',
        status: report.status,
      });
      return;
    }

    // Check if expired
    if (report.expiresAt && new Date() > report.expiresAt) {
      res.status(410).json({ error: 'Report has expired' });
      return;
    }

    // Generate download URL
    let downloadUrl: string;
    
    if (process.env.STORAGE_EMULATOR_HOST) {
      // In development with fake-gcs-server, return direct public URL
      // Use localhost:4443 for browser access (not fake-gcs which is Docker internal)
      const encodedPath = encodeURIComponent(report.fileUrl);
      downloadUrl = `http://localhost:4443/storage/v1/b/${BUCKET_NAME}/o/${encodedPath}?alt=media`;
    } else {
      // In production, generate signed URL (15 min expiry)
      const [signedUrl] = await storage
        .bucket(BUCKET_NAME)
        .file(report.fileUrl)
        .getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000,
        });
      downloadUrl = signedUrl;
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DOWNLOAD',
        entityType: 'report',
        entityId: report.id,
        details: { type: report.type },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({
      downloadUrl,
      expiresIn: '15 minutes',
      filename: `report-${report.type}-${report.id}.${report.format}`,
    });
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /reports/{id}:
 *   delete:
 *     summary: Delete a report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Report deleted
 *       404:
 *         description: Report not found
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user!.uid },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.report.findFirst({
      where: {
        id: req.params.id,
        userId: user.id,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // Delete from GCS if exists
    if (report.fileUrl) {
      try {
        await storage.bucket(BUCKET_NAME).file(report.fileUrl).delete();
      } catch (gcsError) {
        console.warn('Failed to delete report file from GCS:', gcsError);
      }
    }

    // Delete record
    await prisma.report.delete({
      where: { id: report.id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'report',
        entityId: report.id,
        details: { type: report.type },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Report deleted' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
