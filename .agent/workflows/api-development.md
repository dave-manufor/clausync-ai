---
description: How to develop API features and track implementation progress
---

# API Development Workflow

When working on any API feature in `apps/api`, follow these steps:

## Before Implementation

1. Review `docs/api-requirements.md` to understand the full specification
2. Check the "Implementation Status" section as well as existing files to see current state
3. Identify which phase the feature belongs to

## During Implementation

1. Create/modify routes in `apps/api/src/routes/`
2. Add Zod validation schemas for all request bodies
3. **Include OpenAPI JSDoc comments** for every endpoint (see below)
4. Add audit logging for all mutations
5. Apply appropriate RBAC middleware (e.g `requireRole`, `requireOrgMembership`)

## OpenAPI Documentation (Required)

Every endpoint MUST have JSDoc OpenAPI annotations. Use this format:

```typescript
/**
 * @openapi
 * /endpoint-path:
 *   get:
 *     summary: Brief description of what this does
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: paramName
 *         schema: { type: string }
 *         description: What this param does
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1]
 *             properties:
 *               field1: { type: string }
 *               field2: { type: integer }
 *     responses:
 *       200:
 *         description: Success response description
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: object }
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Resource not found
 */
router.get('/endpoint-path', async (req, res) => { ... });
```

### OpenAPI Tag Categories

Use consistent tags for grouping:

| Tag | Usage |
|-----|-------|
| `Health` | Health check endpoints |
| `Monitors` | Monitor CRUD operations |
| `Changes` | Change event endpoints |
| `Users` | User profile endpoints |
| `Organizations` | Org management |
| `Members` | Member/invitation endpoints |
| `Webhooks` | Webhook configuration |
| `Analytics` | Dashboard/reports |
| `Admin` | Super admin endpoints |
| `Audit` | Audit log endpoints |
| `Auth` | Authentication endpoints |
| `Billing` | Subscription/payment |

### Swagger Config Location

OpenAPI/Swagger configuration is in: `apps/api/src/config/swagger.ts`

## After Implementation

// turbo
1. Update `docs/api-requirements.md`:
   - Mark the feature as ✅ in the Implementation Status table
   - Update the "What's Working Well" section if applicable
   - Remove from "Known Gaps" if it was listed there
   - Strike through or mark complete in the phase roadmap

2. Run tests to verify the implementation:
   ```bash
   cd apps/api && npm test
   ```

3. Verify OpenAPI docs are updated:
   ```bash
   # Start the API server
   cd apps/api && npm run dev
   
   # Visit in browser
   open http://localhost:8080/docs
   
   # Or fetch the spec directly
   curl http://localhost:8080/openapi.json | jq '.paths | keys'
   ```
   
4. Confirm the new endpoint appears in Swagger UI with:
   - Correct HTTP method and path
   - All parameters documented
   - Request/response schemas defined
   - Proper authentication requirements

## Documentation Updates

When updating `docs/api-requirements.md`, use these conventions:

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented |
| ⚠️ | Partially implemented |
| ❌ | Not implemented |
| ⏸️ | Intentionally deferred |

## File Locations

- Routes: `apps/api/src/routes/`
- Middleware: `apps/api/src/middleware/`
- Prisma Schema: `apps/api/prisma/schema.prisma`
- Swagger Config: `apps/api/src/config/swagger.ts`
- Requirements Doc: `docs/api-requirements.md`
- OpenAPI Spec: `http://localhost:8080/openapi.json` (runtime)