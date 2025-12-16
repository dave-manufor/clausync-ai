# Clausync Web App - Production Requirements

Comprehensive requirements organized by implementation phase.

---

## Phase 1: MVP Foundation (Weeks 1-4)

### Screens (8)

| Screen | Route | Features |
|--------|-------|----------|
| **Login** | `/login` | Email/password, SSO buttons, Forgot password link |
| **Register** | `/register` | Email, password, Terms checkbox, Email verification |
| **Password Reset** | `/reset-password` | Token-based reset flow |
| **Dashboard** | `/` | Overview cards, Recent changes feed, Quick actions |
| **Monitors List** | `/monitors` | Table with search, pagination, Add button |
| **Monitor Detail** | `/monitors/:id` | URL info, Change history, Delete button |
| **Add Monitor** | `/monitors/new` | URL input, Selector input, Submit |
| **Changes List** | `/changes` | Filterable table, Date range, Severity filter |

### Core Components (8)

| Component | Usage |
|-----------|-------|
| Button | Primary, Secondary, Danger variants |
| Input | Text, Password, Search |
| Table | Sortable, Paginated |
| Card | Stats, Content containers |
| Modal | Confirmation dialogs |
| Toast | Success/Error notifications |
| Skeleton | Loading states |
| Empty State | No data display |

### Functionality

- [x] Firebase Authentication integration
- [x] Protected route wrapper
- [x] API client with auth headers
- [x] Basic error handling (401, 404, 500)
- [x] Responsive layout (mobile-first)
- [x] Dark/Light theme toggle

---

## Phase 2: Core Features (Weeks 5-8)

### Screens (7)

| Screen | Route | Features |
|--------|-------|----------|
| **Change Detail** | `/changes/:id` | Diff viewer, AI summary, Risk score |
| **Diff Viewer** | `/changes/:id/diff` | Side-by-side comparison, Syntax highlighting |
| **Profile Settings** | `/profile` | Name, Email, Timezone, Avatar |
| **Security Settings** | `/profile/security` | Change password, Active sessions |
| **API Keys** | `/profile/api-keys` | List, Create, Revoke keys |
| **Notifications** | `/profile/notifications` | Email preferences, Digest frequency |
| **Analytics** | `/analytics` | Dashboard metrics, Charts, Period selector |

### New Components (6)

| Component | Usage |
|-----------|-------|
| Tabs | Settings navigation |
| Select | Dropdown selections |
| Badge | Status, Severity labels |
| Avatar | User profile images |
| Chart (Line) | Trend visualization |
| Chart (Bar) | Comparisons |

### Functionality

- [ ] React Query caching
- [ ] Optimistic updates
- [ ] Form validation (React Hook Form + Zod)
- [ ] Toast notification system
- [ ] Session timeout warning
- [ ] Keyboard shortcuts (basic)

---

## Backend Sync: API Phases 1-3 Features

*Source: API Phases 1-3 implementation (all completed)*

### Screens (4)

| Screen | Route | Features | API Source |
|--------|-------|----------|------------|
| **Documents** | `/documents` | List user documents, upload button, delete | Phase 3 |
| **Document Upload** | `/documents/new` | Drag-drop upload, file type restrictions | Phase 3 |
| **Snapshot Viewer** | `/monitors/:id/snapshots/:sid` | View historical snapshot content | Phase 1 |
| **Data Exports** | `/profile/exports` | List exports, download when ready | Phase 2 |

### Enhanced Screens (existing screens need features)

| Screen | Feature | API Source |
|--------|---------|------------|
| **Monitor Detail** | Pause/Resume toggle button | Phase 1 |
| **Monitor Detail** | Snapshots list with pagination | Phase 1 |
| **Monitor Detail** | Export history button | Phase 2 |
| **Change Detail** | Diff viewer link (compare old vs new) | Phase 2 |
| **Privacy Center** | Cancel pending deletion button | Phase 2 |

### New Components (7)

| Component | Usage | API Source |
|-----------|-------|------------|
| File upload (drag-drop) | Document upload, max 20MB | Phase 3 |
| Diff viewer | Side-by-side with additions/deletions | Phase 2 |
| Document card | Filename, type icon, size, delete | Phase 3 |
| Export button | Trigger data export with status | Phase 2 |
| Pause/Resume toggle | Monitor status control | Phase 1 |
| Snapshot timeline | Historical snapshots list | Phase 1 |
| Deletion countdown | Shows grace period remaining | Phase 2 |

### Validation Requirements

| Validation | Display |
|------------|---------|
| File types: PDF, DOCX, TXT, MD | File picker filter + error toast |
| Max file size: 20MB | Pre-upload check + error message |
| File upload progress | Progress bar or spinner |
| Monitor pause confirmation | Confirm before pausing active monitor |

### UX Requirements

| Feature | Priority | API Source |
|---------|----------|------------|
| Document list with search | Required | Phase 3 |
| Delete confirmation modal | Required | Phase 3 |
| Export status indicator (pending/ready/expired) | Required | Phase 2 |
| Download ready notification | Required | Phase 2 |
| Empty state for no documents | Required | Phase 3 |
| Pause/resume visual feedback | Required | Phase 1 |
| Snapshot content preview | Required | Phase 1 |
| Deletion grace period countdown | Required | Phase 2 |
| Cancel deletion confirmation | Required | Phase 2 |

### Notification Requirements

| Notification | Trigger | API Source |
|--------------|---------|------------|
| Monitor paused | User pauses monitor | Phase 1 |
| Monitor resumed | User resumes monitor | Phase 1 |
| Export ready | Data export completes | Phase 2 |
| Document processed | Vectorization complete | Phase 3 |
| Account deletion scheduled | Deletion requested | Phase 2 |

---

## Phase 3: Organization & Team (Weeks 9-12)

### Screens (6)

| Screen | Route | Features |
|--------|-------|----------|
| **Org Settings** | `/org/settings` | Name, Region |
| **Members** | `/org/members` | Member table, Role display, Remove button |
| **Invite Member** | `/org/invite` | Email input, Role selector |
| **Pending Invites** | `/org/invitations` | Resend, Revoke buttons |
| **Webhooks** | `/org/webhooks` | List, Add, Test, Delete |
| **Add Webhook** | `/org/webhooks/new` | URL, Events checkboxes, Secret display |

### New Components (4)

| Component | Usage |
|-----------|-------|
| Multi-select | Event selection |
| Copy button | Secret/key copying |
| Status indicator | Webhook health |
| Role selector | Member role dropdown |

### Functionality

- [ ] Role-based UI (hide/disable by role)
- [ ] Invitation email flow
- [ ] Webhook test delivery
- [ ] Member role management
- [ ] Bulk member operations

---

### Backend Sync: Analytics & Reporting
*Source: API Phase 4*

| Requirement | Type | Priority |
|-------------|------|----------|
| Risk trends chart (line/area chart) | Screen | Required |
| Reports list screen | Screen | Required |
| Generate report modal (type, format, period) | Component | Required |
| Report download button with loading state | Component | Required |
| Report status badge (pending/ready/failed) | Component | Required |
| Report expiry indicator (7-day countdown) | UX | Required |
| PDF/CSV format selector | Form | Required |
| Period selector (7d/30d/90d) | Form | Required |

---

## Phase 4: Enterprise & Admin (Weeks 13-16)

### Screens (6)

| Screen | Route | Features |
|--------|-------|----------|
| **Admin Dashboard** | `/admin` | System metrics, Health status |
| **All Users** | `/admin/users` | Searchable user list, Role override |
| **All Organizations** | `/admin/organizations` | Org list, User counts |
| **Audit Logs** | `/admin/audit-logs` | Filterable logs, Export button |
| **MFA Setup** | `/profile/mfa` | QR code, Backup codes |
| **Import Monitors** | `/monitors/import` | CSV/JSON upload, Progress |

### New Components (3)

| Component | Usage |
|-----------|-------|
| File upload | CSV/JSON import |
| QR code display | MFA setup |
| Log viewer | Audit log entries |

### Functionality

- [ ] Super admin role check
- [ ] System-wide metrics
- [ ] Audit log filtering/export
- [ ] MFA enrollment
- [ ] Bulk monitor import

---

## Phase 5: Compliance & Polish (Weeks 17-20)

### Screens (4)

| Screen | Route | Features |
|--------|-------|----------|
| **Privacy Center** | `/profile/privacy` | Data export, Delete account |
| **Cookie Settings** | `/cookies` | Preference management |
| **Privacy Policy** | `/privacy` | Static legal page |
| **Terms of Service** | `/terms` | Static legal page |

### Compliance Features

| Feature | Regulation | Screen |
|---------|------------|--------|
| Cookie consent banner | GDPR | Global |
| Data export request | GDPR Art. 20 | Privacy Center |
| Account deletion | GDPR Art. 17 | Privacy Center |
| Email unsubscribe | CAN-SPAM | Notifications |
| Session management | SOC 2 | Security Settings |
| Audit log access | SOC 2 | Admin |

### Accessibility (WCAG 2.1 AA)

| Feature | Priority |
|---------|----------|
| Keyboard navigation | High |
| Screen reader labels | High |
| Focus indicators | High |
| Color contrast (4.5:1) | High |
| Skip navigation | Medium |
| Reduced motion | Medium |

### Performance

| Feature | Target |
|---------|--------|
| Initial bundle | <250KB |
| Time to Interactive | <3s |
| Lighthouse score | >90 |
| Core Web Vitals | Pass |

---

## Navigation Structure

```
├── Auth
│   ├── /login
│   ├── /register
│   └── /reset-password
│
├── Main App
│   ├── / (Dashboard)
│   ├── /monitors
│   │   ├── /monitors/:id
│   │   ├── /monitors/new
│   │   └── /monitors/import
│   ├── /changes
│   │   └── /changes/:id
│   └── /analytics
│
├── Profile
│   ├── /profile
│   ├── /profile/security
│   ├── /profile/api-keys
│   ├── /profile/notifications
│   ├── /profile/mfa
│   └── /profile/privacy
│
├── Organization
│   ├── /org/settings
│   ├── /org/members
│   ├── /org/invitations
│   └── /org/webhooks
│
├── Admin (super_admin only)
│   ├── /admin
│   ├── /admin/users
│   ├── /admin/organizations
│   └── /admin/audit-logs
│
└── Legal
    ├── /privacy
    ├── /terms
    └── /cookies
```

---

## Summary by Phase

| Phase | Screens | Components | Weeks |
|-------|---------|------------|-------|
| **1. MVP** | 8 | 8 | 1-4 |
| **2. Core** | 7 | 6 | 5-8 |
| **3. Team** | 6 | 4 | 9-12 |
| **4. Enterprise** | 6 | 3 | 13-16 |
| **5. Compliance** | 4 | - | 17-20 |
| **Total** | **31** | **21** | **20 weeks** |

