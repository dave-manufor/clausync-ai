import { Router, Request, Response } from 'express';

const router = Router();

/**
 * API Changelog
 * Documents breaking changes, new features, and deprecations
 */
const changelog = [
  {
    version: '1.0.0',
    date: '2024-12-16',
    changes: [
      {
        type: 'added',
        description: 'API versioning: all routes now available under /api/v1/',
      },
      {
        type: 'added',
        description: 'Standardized response format: { success, data, meta } for all endpoints',
      },
      {
        type: 'added',
        description: 'Deprecation headers for legacy routes (Sunset in 6 months)',
      },
      {
        type: 'added',
        description: 'Scheduled reports: POST/GET/DELETE /api/v1/reports/schedules',
      },
      {
        type: 'added',
        description: 'OpenAPI documentation available at /docs',
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2024-12-01',
    changes: [
      {
        type: 'added',
        description: 'Reports generation: POST /reports, GET /reports/:id/download',
      },
      {
        type: 'added',
        description: 'Analytics endpoints: /analytics/dashboard, /analytics/changes, /analytics/risk-trends',
      },
      {
        type: 'added',
        description: 'Document upload for RAG personalization: /documents',
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2024-11-15',
    changes: [
      {
        type: 'added',
        description: 'Monitor notifications with personalization support',
      },
      {
        type: 'added',
        description: 'Email notifications include monitor name and URL',
      },
      {
        type: 'added',
        description: 'Notification preferences: digest frequency, risk threshold',
      },
    ],
  },
];

/**
 * @openapi
 * /api/v1/changelog:
 *   get:
 *     summary: Get API changelog
 *     description: Returns a list of API versions with their changes
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API changelog
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       version:
 *                         type: string
 *                       date:
 *                         type: string
 *                         format: date
 *                       changes:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                               enum: [added, changed, deprecated, removed, fixed, security]
 *                             description:
 *                               type: string
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: changelog,
    meta: {
      currentVersion: changelog[0]?.version || '1.0.0',
      totalVersions: changelog.length,
    },
  });
});

export default router;
