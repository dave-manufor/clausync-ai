# Clausync Web App - Production Requirements

Comprehensive requirements organized by implementation phase.

---

## Phase 1: MVP Foundation (Weeks 1-4)

> **Goal:** Core authentication, navigation, and basic monitor management.

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
- [x] Dark mode (default, theme switching disabled)

---

## Phase 2: Core Features (Weeks 5-8)

> **Goal:** User settings, analytics basics, and improved change viewing.

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

- [x] React Query caching
- [x] Optimistic updates
- [x] Form validation (React Hook Form + Zod)
- [x] Toast notification system
- [ ] Session timeout warning
- [ ] Keyboard shortcuts (basic)

---

## Phase 3: Monitor Enhancements (Weeks 9-10)

> **Goal:** Advanced monitor features including snapshots, documents, and export capabilities.

### New Screens (4)

| Screen | Route | Features | API Source |
|--------|-------|----------|------------|
| **Documents** | `/documents` | List user documents, upload button, delete | API Phase 3 |
| **Document Upload** | `/documents/new` | Drag-drop upload, file type restrictions | API Phase 3 |
| **Snapshot Viewer** | `/monitors/:id/snapshots/:sid` | View historical snapshot content | API Phase 1 |
| **Data Exports** | `/profile/exports` | List exports, download when ready | API Phase 2 |

### Screen Enhancements (Existing)

| Screen | Feature | API Source |
|--------|---------|------------|
| **Monitor Detail** | Pause/Resume toggle button | API Phase 1 |
| **Monitor Detail** | Snapshots list with pagination | API Phase 1 |
| **Monitor Detail** | Export history button | API Phase 2 |
| **Change Detail** | Diff viewer link (compare old vs new) | API Phase 2 |
| **Privacy Center** | Cancel pending deletion button | API Phase 2 |

### New Components (7)

| Component | Usage | API Source |
|-----------|-------|------------|
| File upload (drag-drop) | Document upload, max 20MB | API Phase 3 |
| Diff viewer | Side-by-side with additions/deletions | API Phase 2 |
| Document card | Filename, type icon, size, delete | API Phase 3 |
| Export button | Trigger data export with status | API Phase 2 |
| Pause/Resume toggle | Monitor status control | API Phase 1 |
| Snapshot timeline | Historical snapshots list | API Phase 1 |
| Deletion countdown | Shows grace period remaining | API Phase 2 |

### Validation Requirements

| Validation | Display |
|------------|---------|
| File types: PDF, DOCX, TXT, MD | File picker filter + error toast |
| Max file size: 20MB | Pre-upload check + error message |
| File upload progress | Progress bar or spinner |
| Monitor pause confirmation | Confirm before pausing active monitor |

### UX Requirements

| Feature | Priority |
|---------|----------|
| Document list with search | Required |
| Delete confirmation modal | Required |
| Export status indicator (pending/ready/expired) | Required |
| Download ready notification | Required |
| Empty state for no documents | Required |
| Pause/resume visual feedback | Required |
| Snapshot content preview | Required |
| Deletion grace period countdown | Required |
| Cancel deletion confirmation | Required |

### Notifications

| Notification | Trigger |
|--------------|---------|
| Monitor paused | User pauses monitor |
| Monitor resumed | User resumes monitor |
| Export ready | Data export completes |
| Document processed | Vectorization complete |
| Account deletion scheduled | Deletion requested |

---

## Phase 4: Analytics & Reporting (Weeks 11-12)

> **Goal:** Data visualization, reports generation, and scheduled reporting.

### New Screens (2)

| Screen | Route | Features |
|--------|-------|----------|
| **Reports List** | `/reports` | List all generated reports, status badges |
| **Scheduled Reports** | `/reports/schedules` | List schedules, create/delete |

### Screen Enhancements

| Screen | Feature |
|--------|---------|
| **Analytics** | Risk trends chart (line/area) |
| **Analytics** | Period selector (7d/30d/90d) |

### New Components (5)

| Component | Usage |
|-----------|-------|
| Generate report modal | Type, format, period selection |
| Report download button | With loading state |
| Report status badge | pending/ready/failed |
| Report expiry indicator | 7-day countdown |
| Create schedule modal | Type, format, frequency |

### Form Elements

| Element | Options |
|---------|---------|
| PDF/CSV format selector | Radio or dropdown |
| Period selector | 7d, 30d, 90d |
| Frequency selector | Weekly, Monthly |

### UX Requirements

| Feature | Priority |
|---------|----------|
| Next run date display | Required |
| Delete schedule button with confirmation | Required |
| Active/inactive status toggle | Optional |

---

## Phase 5: Organization & Team (Weeks 13-14)

> **Goal:** Multi-user organization management, invitations, and webhooks.

### New Screens (6)

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

## Phase 6: Session & API Management (Weeks 15-16)

> **Goal:** Enhanced security features and developer experience.

### New Screens (2)

| Screen | Route | Features |
|--------|-------|----------|
| **Active Sessions** | `/settings/sessions` | Device info, IP, SSO provider, revoke |
| **Changelog** | `/changelog` | API version history (optional) |

### Session Management Components

| Component | Usage |
|-----------|-------|
| Session list | Device, IP, SSO provider display |
| Revoke session button | Individual session termination |
| Revoke all sessions button | Terminate all except current |
| Current session indicator | Highlight active session |

### API Infrastructure

| Requirement | Priority |
|-------------|----------|
| Update API client base URL to `/api/v1/` | Required |
| Handle deprecation response headers | Optional |
| API version display in footer/settings | Optional |

---

## Phase 7: Billing & Subscriptions (Weeks 17-18)

> **Goal:** Payment integration, subscription management, and usage tracking.

### New Screens (3)

| Screen | Route | Features |
|--------|-------|----------|
| **Pricing** | `/pricing` | Subscription tiers list, compare features |
| **Billing Settings** | `/settings/billing` | Current subscription, usage, invoices |
| **Payment Method** | `/settings/billing/payment` | Add/update payment method |

### Subscription Components

| Component | Usage |
|-----------|-------|
| Subscribe/upgrade flow | Tier selection + checkout |
| Cancel subscription modal | With confirmation |
| Usage meters | Monitors, documents, team members |
| Invoice history | Past payments list |
| Plan limit warnings | Show when approaching limits |

### Subscription Lifecycle Components

| Component | Usage |
|-----------|-------|
| **Grace Period Warning Banner** | Payment failed - update payment method |
| Grace period countdown | Display `gracePeriodEndsAt` |
| Link to payment settings | Quick action CTA |
| **Trial Countdown Badge** | Days remaining (`trialDaysRemaining`) |
| Trial CTA | "Add payment method" when trial < 3 days |
| **Subscription Status Badges** | `active` (green), `trialing` (blue), `past_due` (orange), `canceled` (gray) |
| **Downgrade Confirmation Modal** | Show features that will be lost |
| Retry failed payment button | Quick retry action |

### Display Logic

| Condition | Action |
|-----------|--------|
| `isGracePeriod: true` | Show grace period banner |
| `isTrialing: true` | Show trial countdown badge |
| `trialDaysRemaining < 3` | Show "Add payment method" CTA |

---

## Subscription-Based UI Restrictions

> **Principle:** Users should NEVER learn about plan limits from an API error. The UI must proactively communicate what is and isn't available on their plan.

### Plan Tier Reference

| Feature | Free | Pro ($29) | Business ($99) | Enterprise ($499) |
|---------|:----:|:---------:|:--------------:|:-----------------:|
| Monitors | 3 | 25 | 100 | Unlimited |
| Team Members | 1 | 3 | 10 | Unlimited |
| Documents | 0 | 5 | 25 | Unlimited |
| Webhooks | 0 | 1 | 10 | Unlimited |
| API Access | ✗ | 1K/mo | 10K/mo | Unlimited |
| Reports | ✗ | 5/mo | 25/mo | Unlimited |
| RAG Analysis | ✗ | ✓ | ✓ | ✓ |
| Slack/Teams | ✗ | Slack | All | All |
| SSO/SAML | ✗ | ✗ | ✗ | ✓ |
| Change History | 30d | 1yr | 3yr | 7yr (WORM) |

### Proactive Limit Display Components

#### 1. Usage Meters (Required)

Show current/limit for all metered resources:

| Location | Display |
|----------|---------|
| Dashboard | Summary cards with percentage bars |
| Monitors List | "24/25 monitors" in header |
| Documents List | "3/5 documents" in header |
| Team Settings | "2/3 members" in header |
| API Keys | "850/1,000 API requests this month" |

**Visual States:**
- `0-75%` → Default (gray/blue progress bar)
- `75-90%` → Warning (amber progress bar + tooltip)
- `90-99%` → Critical (red progress bar + banner)
- `100%` → Limit reached (red badge + upgrade CTA)

#### 2. Pre-Action Limit Checks (Required)

Before showing creation forms, check limits and show appropriate UI:

| Action | If Under Limit | If At Limit |
|--------|----------------|-------------|
| Add Monitor | Show form normally | Disable button + "Upgrade for more monitors" |
| Upload Document | Show upload modal | Show upgrade modal instead |
| Invite Team Member | Show invite form | "Your plan allows 3 members. Upgrade?" |
| Add Webhook | Show webhook form | "Webhooks require Pro plan" |

#### 3. Feature Gating Patterns

**Pattern A: Disabled with Upgrade CTA**
```
┌────────────────────────────────────────┐
│ [Disabled Button]  🔒 Available on Pro │
│                    ───────────────────│
│                    Upgrade →          │
└────────────────────────────────────────┘
```

**Pattern B: Teaser with Blur**
```
┌────────────────────────────────────────┐
│ ┌──────────────────────────────────┐  │
│ │ [Blurred Content]                │  │
│ │                                  │  │
│ │    🔒 Reports require Pro plan   │  │
│ │    [See Plans] [Learn More]      │  │
│ └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**Pattern C: Feature Lock Overlay**
```
┌────────────────────────────────────────┐
│ AI-Powered RAG Analysis                │
│ ─────────────────────────────────────  │
│ Upload your contracts and get          │
│ personalized conflict detection.       │
│                                         │
│ [🔒 Unlock with Pro Plan]              │
└────────────────────────────────────────┘
```

### Feature Availability by Page

| Page | Free Tier Restrictions |
|------|------------------------|
| Dashboard | Hide "Export" button, hide API usage card |
| Monitors List | Disable "Add" at limit, show counter |
| Monitor Detail | Hide scheduled report options |
| Changes List | Limit to 30 days (show "Upgrade for full history") |
| Change Detail | Hide RAG insights section with Pattern C |
| Documents | Lock entire page with Pattern B (Pro+ only) |
| Reports | Lock page with Pattern B (Pro+ only) |
| Webhooks | Lock creation with Pattern A (Pro+ only) |
| API Keys | Lock page with Pattern A (Pro+ only) |
| Team Members | Show invite form but disable at limit |
| SSO Settings | Lock page with "Enterprise only" badge |

### Upgrade Prompts (Required)

#### Trigger Points

| Trigger | Prompt Type |
|---------|-------------|
| Approach limit (90%+) | Toast notification |
| Hit limit | Modal with comparison |
| Access locked feature | Inline CTA |
| Free trial ending | Persistent banner |
| Payment failed | Full-width alert |

#### Upgrade Modal Content

Must include:
1. Current plan name and price
2. Recommended upgrade tier
3. **Specific benefit gained** (not generic)
4. Price difference clearly shown
5. "Compare all plans" link

**Example:**
```
┌──────────────────────────────────────────────────┐
│ You've reached your monitor limit                │
│ ──────────────────────────────────────────────   │
│ Free plan: 3 monitors                            │
│ ──────────────────────────────────────────────   │
│                                                  │
│ Upgrade to Pro for:                              │
│ ✓ 25 monitors (22 more!)                         │
│ ✓ Daily checks instead of weekly                 │
│ ✓ AI-powered RAG analysis                        │
│ ✓ Slack notifications                            │
│                                                  │
│ $29/month (or $290/year - save 17%)              │
│                                                  │
│ [Upgrade to Pro]  [Compare All Plans]            │
└──────────────────────────────────────────────────┘
```

### API Response Handling for Limits

Handle `PLAN_LIMIT_EXCEEDED` errors gracefully:

```typescript
// Expected API error format
{
  "error": {
    "code": "PLAN_LIMIT_EXCEEDED",
    "message": "Monitor limit reached (25/25)",
    "details": {
      "limit": 25,
      "current": 25,
      "limitType": "monitorLimit"
    }
  }
}
```

**UI Response:**
1. Show upgrade modal (not generic error toast)
2. Pre-fill modal with limit type context
3. Log event for analytics

### Accessibility & Compliance Requirements

#### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Disabled buttons | Use `aria-disabled` + tooltip explaining why |
| Locked features | Include screen reader text for lock reason |
| Progress bars | Value announced: "24 of 25 monitors used" |
| Color coding | Never rely on color alone (use icons + text) |

#### GDPR/Transparency Requirements

| Requirement | Implementation |
|-------------|----------------|
| Clear pricing | Always show price in user's currency |
| No dark patterns | "Skip" option on all upgrade prompts |
| Easy downgrade | Visible downgrade path in billing settings |
| Data portability | Export button available on all plans |

### Global UI Components for Plans

#### 1. PlanBadge Component

Shows user's current plan throughout the app:

```
[Free] | [Pro ✓] | [Business ★] | [Enterprise 🏢]
```

Display in: Sidebar, Profile dropdown, Settings header

#### 2. UsageBar Component

Reusable progress bar with automatic coloring:

```tsx
<UsageBar current={24} limit={25} label="Monitors" />
```

#### 3. FeatureGate Component

Wrapper for gated features:

```tsx
<FeatureGate 
  feature="ragAnalysis" 
  fallback={<UpgradeTeaser feature="AI Analysis" />}
>
  <RAGInsightsPanel />
</FeatureGate>
```

#### 4. UpgradePrompt Component

Contextual upgrade prompts:

```tsx
<UpgradePrompt 
  trigger="monitor_limit" 
  currentPlan="free" 
  targetPlan="pro" 
/>
```

### Testing Requirements

| Test Case | Expected Behavior |
|-----------|-------------------|
| Free user adds 4th monitor | Button disabled before click, tooltip shows "Upgrade" |
| Pro user at 24/25 monitors | Warning banner appears |
| User clicks locked feature | Upgrade modal opens, not error |
| API returns PLAN_LIMIT_EXCEEDED | Upgrade modal with context, not toast |
| Screen reader users | All limits and lock reasons announced |

---


## Phase 8: Enterprise & Admin (Weeks 19-20)

> **Goal:** Super admin capabilities, MFA, and bulk operations.

### New Screens (6)

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

## Phase 9: Compliance & Polish (Weeks 21-22)

> **Goal:** GDPR/SOC 2 compliance, accessibility, and performance optimization.

### New Screens (4)

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
│   │   │   └── /monitors/:id/snapshots/:sid
│   │   ├── /monitors/new
│   │   └── /monitors/import
│   ├── /changes
│   │   └── /changes/:id
│   │       └── /changes/:id/diff
│   ├── /documents
│   │   └── /documents/new
│   ├── /reports
│   │   └── /reports/schedules
│   └── /analytics
│
├── Settings
│   ├── /profile
│   ├── /profile/security
│   ├── /profile/api-keys
│   ├── /profile/notifications
│   ├── /profile/mfa
│   ├── /profile/privacy
│   ├── /profile/exports
│   ├── /settings/sessions
│   └── /settings/billing
│       └── /settings/billing/payment
│
├── Organization
│   ├── /org/settings
│   ├── /org/members
│   ├── /org/invite
│   ├── /org/invitations
│   └── /org/webhooks
│       └── /org/webhooks/new
│
├── Admin (super_admin only)
│   ├── /admin
│   ├── /admin/users
│   ├── /admin/organizations
│   └── /admin/audit-logs
│
├── Pricing
│   └── /pricing
│
└── Legal
    ├── /privacy
    ├── /terms
    ├── /cookies
    └── /changelog
```

---

## Summary by Phase

| Phase | Focus | Screens | Components | Weeks |
|-------|-------|---------|------------|-------|
| **1. MVP Foundation** | Auth, Navigation, Basic Monitors | 8 | 8 | 1-4 |
| **2. Core Features** | Settings, Analytics Basics | 7 | 6 | 5-8 |
| **3. Monitor Enhancements** | Snapshots, Documents, Exports | 4 | 7 | 9-10 |
| **4. Analytics & Reporting** | Charts, Reports, Schedules | 2 | 5 | 11-12 |
| **5. Organization & Team** | Members, Invites, Webhooks | 6 | 4 | 13-14 |
| **6. Session & API** | Security, Developer Experience | 2 | 4 | 15-16 |
| **7. Billing & Subscriptions** | Payments, Usage Tracking | 3 | 10 | 17-18 |
| **8. Enterprise & Admin** | Admin Tools, MFA, Bulk Ops | 6 | 3 | 19-20 |
| **9. Compliance & Polish** | GDPR, SOC 2, A11y, Performance | 4 | - | 21-22 |
| **Total** | | **42** | **47** | **22 weeks** |

---

## Implementation Checklist

> Legend: ✅ = Complete with API | ⚠️ = UI only (mock data) | 🔲 = Not started

### Phase 1 - MVP Foundation

| Item | Status | Notes |
|------|:------:|-------|
| Login screen | ✅ | Firebase Auth |
| Register screen | ✅ | Email verification flow |
| Password reset flow | ✅ | Token-based |
| Email verification | ✅ | Standalone route |
| Dashboard | ✅ | Real API hooks |
| Monitors list | ✅ | Pagination, search |
| Monitor detail | ✅ | Uses `useMonitor` + `useMonitorChanges` |
| Add monitor form | ✅ | Form submission works |
| Changes list | ✅ | Filtering, real data |

### Phase 2 - Core Features

| Item | Status | Notes |
|------|:------:|-------|
| Change detail | ⚠️ | Partial API, some mock fallback |
| Diff viewer component | 🔲 | Not implemented |
| Profile settings | ✅ | `useCurrentUser` + `useUpdateProfile` |
| Security settings | ✅ | Firebase Auth password change |
| API keys management | ✅ | `useApiKeys` + CRUD hooks |
| Notification preferences | ✅ | `useNotificationPreferences` hooks |
| Analytics dashboard | ✅ | Real API with `useAnalyticsDashboard` |

### Phase 3 - Monitor Enhancements 🔲

- [ ] Documents list
- [ ] Document upload
- [ ] Snapshot viewer
- [ ] Data exports
- [ ] Monitor pause/resume
- [ ] Snapshot timeline

### Phase 4 - Analytics & Reporting 🔲

- [ ] Reports list
- [ ] Generate report modal
- [ ] Scheduled reports
- [ ] Risk trends chart (real data)

### Phase 5 - Organization & Team 🔲

- [ ] Org settings
- [ ] Member management
- [ ] Invite flow
- [ ] Webhooks

### Phase 6 - Session & API 🔲

- [ ] Active sessions
- [ ] API versioning support

### Phase 7 - Billing & Subscriptions 🔲

- [ ] Pricing page
- [ ] Billing settings
- [ ] Subscription lifecycle UI
- [ ] Payment method management

### Phase 8 - Enterprise & Admin 🔲

- [ ] Admin dashboard
- [ ] User management
- [ ] Org management
- [ ] Audit logs
- [ ] MFA setup
- [ ] Bulk import

### Phase 9 - Compliance & Polish 🔲

- [ ] Privacy center
- [ ] Cookie management
- [ ] Legal pages
- [ ] Accessibility audit
- [ ] Performance optimization

---

## Known Issues & Technical Debt

| Issue | Location | Priority |
|-------|----------|----------|
| Duplicate `severityColors` | 3 files | Low |

---

## Test Infrastructure ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Vitest + React Testing Library | ✅ | Unit tests |
| Playwright | ✅ | E2E tests |
| MSW (Mock Service Worker) | ✅ | API mocking |
| Test coverage | ✅ | 14 tests passing |
