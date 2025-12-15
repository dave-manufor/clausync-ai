/**
 * Documents Routes - User document management for RAG personalization
 * 
 * Security considerations:
 * - Input sanitization for prompt injection prevention
 * - Ownership validation on every request
 * - Audit logging for all operations
 * - Soft delete for GDPR compliance
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import prisma from '../db/client';
import { PubSub } from '@google-cloud/pubsub';
import { Storage } from '@google-cloud/storage';

const router = Router();

// GCP clients
const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const bucketName = process.env.GCS_BUCKET_UPLOADS || 'local-uploads';

// Multer config - memory storage with size/type limits
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, TXT, MD`));
    }
  },
});

// Validation schemas
const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const DocumentIdSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Sanitize content for prompt injection prevention.
 * Strips control characters and escape sequences.
 */
function sanitizeForPrompt(content: string): string {
  return content
    // Remove control characters except newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove potential prompt delimiters
    .replace(/```/g, '′′′')
    .replace(/"""/g, '″″″');
}

/**
 * @openapi
 * /documents:
 *   post:
 *     summary: Upload document
 *     description: Upload a document for RAG personalization (max 20MB)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF, DOCX, TXT, or MD file
 *     responses:
 *       202:
 *         description: Document accepted for processing
 *       400:
 *         description: Invalid file type or size
 *       413:
 *         description: File too large
 */
router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.uid;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Generate unique GCS path
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const gcsPath = `documents/${user.id}/${timestamp}_${safeName}`;
    const gcsUri = `gs://${bucketName}/${gcsPath}`;

    // Upload to GCS
    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(gcsPath);
    await blob.save(file.buffer, {
      contentType: file.mimetype,
      metadata: {
        userId: user.id,
        originalName: file.originalname,
      },
    });

    // Create document record
    const document = await prisma.userDocument.create({
      data: {
        userId: user.id,
        filename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        gcsUri,
        status: 'pending',
      },
    });

    // Publish to vectorize worker
    const topic = pubsub.topic('cmd.vectorize_doc');
    await topic.publishMessage({
      json: {
        user_id: user.id,
        document_id: document.id,
        gcs_uri: gcsUri,
        filename: file.originalname,
        file_type: file.mimetype.includes('pdf') ? 'pdf' : 
                   file.mimetype.includes('wordprocessing') ? 'docx' : 'text',
        action: 'create',
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPLOAD',
        entityType: 'document',
        entityId: document.id,
        details: { filename: file.originalname, size: file.size },
        ipAddress: req.ip,
      },
    });

    res.status(202).json({
      message: 'Document accepted for processing',
      document: {
        id: document.id,
        filename: document.filename,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File too large. Maximum size is 20MB' });
        return;
      }
    }
    if (error instanceof Error && error.message.includes('Unsupported file type')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /documents:
 *   get:
 *     summary: List documents
 *     description: List user's uploaded documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of documents
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = PaginationSchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const { page, limit } = parseResult.data;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(200).json({ data: [], pagination: { page, limit, total: 0, pages: 0 } });
      return;
    }

    const whereClause = {
      userId: user.id,
      deletedAt: null,
    };

    const [documents, total] = await Promise.all([
      prisma.userDocument.findMany({
        where: whereClause,
        select: {
          id: true,
          filename: true,
          mimeType: true,
          fileSize: true,
          status: true,
          chunkCount: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userDocument.count({ where: whereClause }),
    ]);

    res.status(200).json({
      data: documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /documents/{id}:
 *   get:
 *     summary: Get document metadata
 *     description: Get metadata for a specific document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Document metadata
 *       404:
 *         description: Document not found
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = DocumentIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const { id } = parseResult.data;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const document = await prisma.userDocument.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.status(200).json({
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      status: document.status,
      chunkCount: document.chunkCount,
      createdAt: document.createdAt,
    });
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /documents/{id}:
 *   delete:
 *     summary: Delete document
 *     description: Soft delete a document and clean up embeddings
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Document deleted
 *       404:
 *         description: Document not found
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = DocumentIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const { id } = parseResult.data;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const document = await prisma.userDocument.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Soft delete
    await prisma.userDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Trigger embedding cleanup via vectorize worker
    const topic = pubsub.topic('cmd.vectorize_doc');
    await topic.publishMessage({
      json: {
        user_id: user.id,
        filename: document.filename,
        action: 'delete',
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'document',
        entityId: id,
        details: { filename: document.filename },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /documents/{id}/content:
 *   get:
 *     summary: Download document content
 *     description: Get signed URL to download document content
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Signed URL for download
 *       404:
 *         description: Document not found
 */
router.get('/:id/content', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = DocumentIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const { id } = parseResult.data;
    const userId = req.user!.uid;

    const user = await prisma.user.findUnique({ where: { identityProviderUid: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const document = await prisma.userDocument.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Audit log for download
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DOWNLOAD',
        entityType: 'document',
        entityId: id,
        details: { filename: document.filename },
        ipAddress: req.ip,
      },
    });

    // Generate signed URL (15 min expiry for security)
    // For local dev with emulator, return placeholder
    if (process.env.STORAGE_EMULATOR_HOST) {
      res.status(501).json({
        error: 'Not Implemented',
        message: 'Signed URLs not supported with GCS emulator',
        gcsUri: document.gcsUri,
      });
      return;
    }

    const bucket = storage.bucket(bucketName);
    const gcsPath = document.gcsUri.replace(`gs://${bucketName}/`, '');
    const [signedUrl] = await bucket.file(gcsPath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    res.status(200).json({
      url: signedUrl,
      expiresIn: 900, // seconds
      filename: document.filename,
      mimeType: document.mimeType,
    });
  } catch (error) {
    console.error('Error getting document content:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
export { sanitizeForPrompt };
