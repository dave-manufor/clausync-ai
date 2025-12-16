---
trigger: always_on
description: How to sync backend features with web app requirements
---

# Backend to Frontend Sync

After implementing backend features (API endpoints, workers, etc.), update `docs/web-app-requirements.md` to ensure the web app knows what UI is needed.

## When to Update

Ask these questions after any backend change:

1. **Does this feature need user interaction?**
   - New endpoints for listing/viewing/sorting data → needs screens, components, implementation or updates
   - File upload endpoints → needs upload UI
   - Settings endpoints → needs settings panel

2. **Are there new validation rules?**
   - Max file sizes → show in UI
   - Required fields → form validation
   - Rate limits → user feedback

3. **Are there new data types?**
   - New status values → display badges
   - New risk levels → color coding
   - New document types → icons/labels

## Update Format

Add requirements to the appropriate phase in `docs/web-app-requirements.md`:

```markdown
### Backend Sync: [Feature Name]
*Source: API Phase X - [Feature]*

| Requirement | Type | Priority |
|-------------|------|----------|
| Document upload form | Screen | Required |
| File type validation (PDF, DOCX, TXT, MD) | Validation | Required |
| 20MB file size limit display | UX | Required |
| Document list with delete | Screen | Required |
```

## Examples

### Example 1: Document Management RAG
Backend implemented: `POST /documents`, `GET /documents`, `DELETE /documents/:id`

Add to web-app-requirements.md:
- Documents list screen with upload button
- File upload modal with drag-drop
- Document preview/delete actions
- File type restrictions in UI

### Example 2: Diff Viewer
Backend implemented: `GET /monitors/:id/diff/:old/:new`

Add to web-app-requirements.md:
- Side-by-side diff view component
- Highlight additions (green) and deletions (red)
- Link from change history to diff view

### Example 3: Data Export
Backend implemented: `POST /monitors/:id/export`, `GET /users/me/export/:id/download`

Add to web-app-requirements.md:
- Export button on monitor detail
- Export history list
- Download link when ready
- Loading state while processing

## Quick Reference

| Backend Feature | Web App Needs |
|-----------------|---------------|
| New endpoint | API client method |
| List endpoint | Table/list screen |
| Create endpoint | Form + validation |
| File upload | Upload component |
| Delete endpoint | Confirmation modal |
| New status | Badge/indicator |
| New setting | Settings panel field |
| Background job | Progress/status display |
| Notification type | Toast/badge update |

## Checklist

Before marking a backend feature complete:

- [ ] Reviewed `docs/web-app-requirements.md`
- [ ] Added screen requirements if needed
- [ ] Added component requirements if needed
- [ ] Added validation/UX requirements if needed
- [ ] Assigned to correct phase