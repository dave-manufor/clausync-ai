---
description: Workflow to keep OpenAPI documentation updated when API changes
---

# OpenAPI Documentation Workflow

When adding or modifying API endpoints, follow this workflow to keep documentation in sync.

## 1. Add OpenAPI Comments

Every route handler must have a JSDoc comment with `@openapi` annotations:

```typescript
/**
 * @openapi
 * /endpoint:
 *   get:
 *     summary: Brief description
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: paramName
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
```

## 2. Response Format

All responses must follow the standard format:

**Success:**
```json
{ "success": true, "data": {...}, "meta": { "total": 100 } }
```

**Error:**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

## 3. Tags

Use existing tags from `swagger.ts`:
- Health, Monitors, Changes, Analytics, Reports
- API Keys, Users, Organizations, Notifications
- Documents, Admin

## 4. Verify Documentation

// turbo
After changes, run:
```bash
cd apps/api && npm run build
```

// turbo
Then verify docs are visible:
```bash
curl http://localhost:8080/openapi.json | head -50
```

## 5. Update swagger.ts

If adding a new endpoint category:
1. Add new tag in `swagger.ts` tags array
2. Add relevant schemas to `components.schemas`
