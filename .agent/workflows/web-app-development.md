---
description: How to develop web app features and track implementation progress
---

# Web App Development Workflow

When working on any feature in `apps/web-app`, follow these steps:

## Before Implementation

1. Review `docs/web-app-requirements.md` to understand the full specification
2. Check which phase the feature belongs to (1-5)
3. Review the design system rules in `.agent/rules/design-system-2.md`

## During Implementation

### Pages/Screens
1. Create page component in `apps/web-app/src/pages/`
2. Add route in `App.tsx` or router configuration
3. Wrap with `ProtectedRoute` if authentication required
4. Use existing layout components (`AppLayout`, `AuthLayout`)

### Components
1. Create reusable components in `apps/web-app/src/components/`
2. Follow existing patterns (see `Button`, `Card`, `Input`)
3. Use Tailwind CSS with design tokens from `index.css`
4. Add loading/empty/error states

### API Integration
1. Use the API client in `src/lib/api.ts` or `src/hooks/`
2. Add React Query hooks for data fetching
3. Handle loading, error, and empty states
4. Implement optimistic updates where appropriate

### Styling
1. Use dark mode only (no theme toggle)
2. Follow design tokens: `--accent`, `--critical`, `--warning`, `--safe`
3. Use glassmorphism patterns from design system
4. Ensure responsive design (mobile-first)

## After Implementation

// turbo
1. Update `docs/web-app-requirements.md`:
   - Mark the screen/feature as ✅ in the phase tables
   - Update functionality checklists: `- [ ]` → `- [x]`
   - Add notes about implementation details if relevant

2. Verify the implementation:
   ```bash
   cd apps/web-app && npm run dev
   ```

3. Test in browser:
   - Check responsive design (mobile, tablet, desktop)
   - Verify dark mode styling
   - Test loading and error states
   - Verify authentication flows

## Documentation Updates

When updating `docs/web-app-requirements.md`, use these conventions:

| Notation | Meaning |
|----------|---------|
| `- [x]` | Completed |
| `- [ ]` | Not started |
| `- [/]` | In progress |
| ~~Strikethrough~~ | Removed/Deferred |

## File Locations

- Pages: `apps/web-app/src/pages/`
- Components: `apps/web-app/src/components/`
- Layouts: `apps/web-app/src/layouts/`
- Hooks: `apps/web-app/src/hooks/`
- Stores: `apps/web-app/src/stores/`
- Styles: `apps/web-app/src/index.css`
- Requirements Doc: `docs/web-app-requirements.md`
- Design System: `.agent/rules/design-system-2.md`

## Component Checklist

When creating new components, ensure:

- [ ] TypeScript types/interfaces defined
- [ ] Props documented with JSDoc
- [ ] Loading state variant
- [ ] Error state variant
- [ ] Empty state variant (if applicable)
- [ ] Keyboard accessible
- [ ] Mobile responsive
- [ ] Uses design tokens (not hardcoded colors)
