# Clausync API - Production Feature Requirements

This document outlines the additional API functionality required to make Clausync a fully production-ready, enterprise-grade SaaS application.

---

## Current State (✅ Implemented)

| Feature | Status |
|---------|--------|
| Health check endpoint | ✅ |
| Monitor CRUD operations | ✅ |
| Change events listing | ✅ |
| Firebase/Identity Platform auth | ✅ |
| Prisma ORM with PostgreSQL | ✅ |
| Pub/Sub message publishing | ✅ |
| Audit logging (basic) | ✅ |

---

## Required Features for Production

### 1. Authentication & Authorization

| Feature | Priority | Compliance |
|---------|----------|------------|
| **JWT refresh token rotation** | High | OAuth 2.0 |
| **API key authentication** (for integrations) | High | - |
| **Role-Based Access Control (RBAC)** | High | SOC 2 |
| **Organization/team management** | High | Enterprise |
| **Session management** (concurrent session limits) | Medium | SOC 2 |
| **MFA enforcement for org admins** | High | SOC 2, HIPAA |
| **OAuth 2.0/OIDC for SSO** (Google, Microsoft, Okta) | High | Enterprise |
| **Service account tokens** for B2B | Medium | - |
| **IP allowlisting** per organization | Medium | Enterprise |

#### API Endpoints Needed:
```
POST   /auth/api-keys              # Create API key
GET    /auth/api-keys              # List API keys
DELETE /auth/api-keys/:id          # Revoke API key
POST   /auth/refresh               # Refresh access token
GET    /auth/sessions              # List active sessions
DELETE /auth/sessions/:id          # Terminate session
```

---

### 2. User & Organization Management

| Feature | Priority | Compliance |
|---------|----------|------------|
| **User profile management** | High | GDPR |
| **Organization CRUD** | High | Enterprise |
| **Team/workspace management** | Medium | Enterprise |
| **Invite users to org** | High | - |
| **User role assignment** | High | SOC 2 |
| **Data export** (user data) | High | GDPR Art. 20 |
| **Account deletion** | High | GDPR Art. 17 |

#### API Endpoints Needed:
```
GET    /users/me                   # Get current user profile
PATCH  /users/me                   # Update profile
DELETE /users/me                   # Delete account (GDPR)
POST   /users/me/export            # Request data export (GDPR)

POST   /organizations              # Create org
GET    /organizations/:id          # Get org details
PATCH  /organizations/:id          # Update org
DELETE /organizations/:id          # Delete org

POST   /organizations/:id/members  # Invite member
GET    /organizations/:id/members  # List members
PATCH  /organizations/:id/members/:userId  # Update role
DELETE /organizations/:id/members/:userId  # Remove member
```

---

### 3. Subscription & Billing

| Feature | Priority | Compliance |
|---------|----------|------------|
| **Stripe integration** | High | PCI-DSS |
| **Subscription plans** (Free, Pro, Enterprise) | High | - |
| **Usage metering** (monitors, API calls) | High | - |
| **Invoices & receipts** | High | Accounting |
| **Plan limits enforcement** | High | - |
| **Trial period management** | Medium | - |
| **Proration on upgrades/downgrades** | Medium | - |
| **Webhook handlers** (Stripe events) | High | - |

#### API Endpoints Needed:
```
GET    /billing/subscription       # Current subscription
POST   /billing/subscription       # Create/update subscription
DELETE /billing/subscription       # Cancel subscription
GET    /billing/invoices           # List invoices
GET    /billing/invoices/:id/pdf   # Download invoice
POST   /billing/portal             # Create Stripe billing portal session
GET    /billing/usage              # Current period usage
POST   /webhooks/stripe            # Stripe webhook handler
```

---

### 4. Notifications & Preferences

| Feature | Priority | Compliance |
|---------|----------|------------|
| **Email notification preferences** | High | CAN-SPAM |
| **Notification channels** (email, Slack, webhook) | High | Enterprise |
| **Digest frequency** (instant, daily, weekly) | Medium | - |
| **Unsubscribe handling** | High | CAN-SPAM, GDPR |
| **In-app notification center** | Medium | - |
| **Webhook integrations** | High | Enterprise |

#### API Endpoints Needed:
```
GET    /notifications              # List notifications
PATCH  /notifications/:id/read     # Mark as read
POST   /notifications/read-all     # Mark all as read

GET    /preferences/notifications  # Get notification prefs
PATCH  /preferences/notifications  # Update prefs

POST   /integrations/slack         # Connect Slack
DELETE /integrations/slack         # Disconnect Slack
POST   /integrations/webhooks      # Create webhook endpoint
GET    /integrations/webhooks      # List webhooks
DELETE /integrations/webhooks/:id  # Delete webhook
```

---

### 5. Monitor Management (Enhanced)

| Feature | Priority | Compliance |
|---------|----------|------------|
| **Bulk import monitors** (CSV, JSON) | Medium | - |
| **Monitor categories/tags** | Medium | - |
| **Monitor sharing** (within org) | Medium | Enterprise |
| **Custom scrape frequency** | Medium | - |
| **Pause/resume monitoring** | High | - |
| **Historical snapshots browser** | High | Legal |
| **Diff viewer** (side-by-side) | High | - |
| **Export change history** | Medium | Legal |

#### API Endpoints Needed:
```
POST   /monitors/bulk              # Bulk import
PATCH  /monitors/:id/pause         # Pause monitoring
PATCH  /monitors/:id/resume        # Resume monitoring
GET    /monitors/:id/snapshots     # List snapshots
GET    /monitors/:id/snapshots/:sid  # Get snapshot detail
GET    /monitors/:id/snapshots/:sid/content  # Get raw content
GET    /monitors/:id/diff/:old/:new  # Get diff between snapshots
POST   /monitors/:id/export        # Export change history
```

---

### 6. Document Management (RAG Context)

| Feature | Priority | Compliance |
|---------|----------|------------|
| **Upload user policies** (PDF, DOCX) | High | - |
| **Document parsing & chunking** | High | - |
| **Vector embedding storage** | High | - |
| **Document versioning** | Medium | - |
| **Delete documents** | High | GDPR |

#### API Endpoints Needed:
```
POST   /documents                  # Upload document
GET    /documents                  # List documents
GET    /documents/:id              # Get document metadata
DELETE /documents/:id              # Delete document
GET    /documents/:id/content      # Get document content
```

---

### 7. Analytics & Reporting

| Feature | Priority | Compliance |
|---------|----------|------------|
| **Dashboard metrics** | Medium | - |
| **Change frequency charts** | Medium | - |
| **Risk score trends** | Medium | - |
| **Most changed resources** | Medium | - |
| **Export reports** (PDF, CSV) | Medium | Enterprise |
| **Scheduled reports** | Low | Enterprise |

#### API Endpoints Needed:
```
GET    /analytics/dashboard        # Dashboard overview
GET    /analytics/changes          # Change analytics
GET    /analytics/risk-trends      # Risk score trends
POST   /reports/generate           # Generate report
GET    /reports                    # List generated reports
GET    /reports/:id/download       # Download report
```

---

### 8. Security & Compliance

| Feature | Priority | Compliance |
|---------|----------|------------|
| **Rate limiting** | High | Security |
| **Request validation** (Zod) | High | Security |
| **SQL injection prevention** (Prisma) | ✅ Built-in | Security |
| **XSS prevention** | High | Security |
| **CORS configuration** | ✅ Implemented | Security |
| **Helmet.js security headers** | ✅ Implemented | Security |
| **Comprehensive audit logs** | High | SOC 2 |
| **Data encryption at rest** | High | SOC 2, GDPR |
| **Data encryption in transit** (HTTPS) | High | SOC 2 |
| **Vulnerability scanning** | High | SOC 2 |
| **Penetration testing** | Medium | SOC 2 |
| **Incident response plan** | High | SOC 2 |

#### API Endpoints Needed:
```
GET    /audit-logs                 # List audit logs (admin)
GET    /audit-logs/export          # Export audit logs
GET    /security/events            # Security events
```

---

### 9. Admin & Operations

| Feature | Priority | Compliance |
|---------|----------|------------|
| **Admin dashboard API** | Medium | - |
| **User impersonation** (support) | Low | Enterprise |
| **Feature flags** | Medium | - |
| **System health metrics** | High | Operations |
| **Maintenance mode** | Medium | Operations |
| **Data migration tools** | Medium | - |

#### API Endpoints Needed:
```
GET    /admin/users                # List all users
GET    /admin/organizations        # List all orgs
GET    /admin/metrics              # System metrics
POST   /admin/maintenance          # Toggle maintenance mode
GET    /admin/feature-flags        # List feature flags
PATCH  /admin/feature-flags/:id    # Update feature flag
```

---

### 10. Developer Experience

| Feature | Priority | Compliance |
|---------|----------|------------|
| **OpenAPI/Swagger documentation** | High | - |
| **SDKs** (JavaScript, Python) | Medium | - |
| **Postman collection** | Medium | - |
| **Changelog/versioning** | High | - |
| **API versioning** (v1, v2) | High | - |
| **Deprecation notices** | Medium | - |

#### API Endpoints Needed:
```
GET    /docs                       # Swagger UI
GET    /openapi.json               # OpenAPI spec
GET    /changelog                  # API changelog
```

---

## Compliance Requirements Summary

### GDPR (EU Data Protection)
- [ ] Right to access (data export)
- [ ] Right to erasure (account deletion)
- [ ] Right to portability (data export in machine-readable format)
- [ ] Consent management
- [ ] Data processing agreements
- [ ] Privacy policy

### SOC 2 Type II
- [ ] Access controls (RBAC)
- [ ] Encryption at rest and in transit
- [ ] Audit logging
- [ ] Incident response
- [ ] Change management
- [ ] Vendor management

### CAN-SPAM / GDPR Email
- [ ] Unsubscribe links in all emails
- [ ] Preference center
- [ ] Double opt-in for marketing

### PCI-DSS (if handling payments)
- [ ] Use Stripe (PCI-compliant payment processor)
- [ ] Never store card numbers
- [ ] Secure webhook handlers

---

## Priority Implementation Order

### Phase 1: Core (Weeks 1-2)
1. ~~Health check~~ ✅
2. ~~Monitor CRUD~~ ✅
3. ~~Change events~~ ✅
4. Rate limiting
5. API key authentication
6. OpenAPI documentation

### Phase 2: User Management (Weeks 3-4)
1. User profile endpoints
2. Organization management
3. Member invitations
4. RBAC implementation
5. GDPR data export/deletion

### Phase 3: Billing (Weeks 5-6) — ⏸️ DEFERRED
> **Note**: Deferred until payment provider (Stripe/Paddle/etc.) is selected.

1. Stripe integration
2. Subscription management
3. Usage metering
4. Plan enforcement
5. Invoice API

### Phase 4: Enterprise (Weeks 7-8)
1. SSO integration
2. Slack/webhook integrations
3. Advanced analytics
4. Admin dashboard
5. Audit log enhancements

---

## API Design Guidelines

### Standard Response Format
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": { ... }
  }
}
```

### HTTP Status Codes
| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (DELETE) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Rate Limited |
| 500 | Internal Server Error |

### Versioning
- URL prefix: `/api/v1/`, `/api/v2/`
- Accept header: `Accept: application/vnd.clausync.v1+json`

---

## Implementation Status (As of Dec 2024)

Analysis of actual implementation in `apps/api` vs requirements above.

### Summary

| Section | Required | Implemented | Status |
|---------|----------|-------------|--------|
| 1. Auth & Authorization | 9 features | 5 features | ⚠️ Partial |
| 2. User & Org Management | 7 features | 7 features | ✅ Complete |
| 3. Billing | 8 features | 0 features | ⏸️ Deferred |
| 4. Notifications | 6 features | 6 features | ✅ Complete |
| 5. Monitor Management | 8 features | 9 features | ✅ Complete |
| 6. Document Management | 5 features | 0 features | ❌ Missing |
| 7. Analytics & Reporting | 6 features | 3 features | ⚠️ Partial |
| 8. Security & Compliance | 11 features | 7 features | ⚠️ Partial |
| 9. Admin & Operations | 6 features | 2 features | ❌ Limited |
| 10. Developer Experience | 6 features | 3 features | ⚠️ Partial |

### What's Working Well
- ✅ API key authentication with SHA256 hashing, scopes, soft revocation
- ✅ RBAC with 5 role levels and permission wildcards
- ✅ Full user/org CRUD with GDPR-compliant deletion (30-day grace)
- ✅ Rate limiting using Redis sliding window algorithm
- ✅ Comprehensive audit logging on all mutations
- ✅ Webhook endpoint CRUD with test functionality
- ✅ Analytics dashboard, change trends, top resources
- ✅ OpenAPI/Swagger documentation at `/docs`
- ✅ **Notifications** - list, mark read, unread count (Phase 1)
- ✅ **Notification preferences** - GDPR/CAN-SPAM compliant (Phase 1)
- ✅ **Monitor pause/resume** - with audit logging (Phase 1)
- ✅ **Snapshot browsing** - list, detail, content endpoints (Phase 1)

### Known Gaps (Updated Dec 2024)
- ✅ ~~No document upload for RAG context~~ → `POST /api/v1/documents` fully implemented
- ✅ ~~Data export worker not processing~~ → Refactored to Pub/Sub event-driven
- ⏸️ Webhook delivery worker → Deferred (Phase 5)
- ✅ ~~No API versioning~~ → All routes under `/api/v1/`
- ✅ ~~Snapshot content 501~~ → GCS signed URL implemented

---

## Complete Implementation Roadmap

All pending features organized into logical phases.

---

### Phase 1: Core User Experience ✅ COMPLETED
*Focus: Features users expect from day one*

| Feature | Section | Endpoint/Task | Status |
|---------|---------|---------------|--------|
| Notifications list | Notifications | `GET /notifications` | ✅ |
| Mark notification read | Notifications | `PATCH /notifications/:id/read` | ✅ |
| Mark all read | Notifications | `POST /notifications/read-all` | ✅ |
| Notification preferences | Notifications | `GET/PATCH /preferences/notifications` | ✅ |
| Pause monitor | Monitors | `PATCH /monitors/:id/pause` | ✅ |
| Resume monitor | Monitors | `PATCH /monitors/:id/resume` | ✅ |
| List snapshots | Monitors | `GET /monitors/:id/snapshots` | ✅ |
| Get snapshot detail | Monitors | `GET /monitors/:id/snapshots/:sid` | ✅ |
| Get snapshot content | Monitors | `GET /monitors/:id/snapshots/:sid/content` | ⚠️ 501 |

---

### Phase 2: Data Access & GDPR Compliance ✅ COMPLETED
*Focus: User data rights and history access*

| Feature | Section | Endpoint/Task | Status |
|---------|---------|---------------|--------|
| Diff viewer API | Monitors | `GET /monitors/:id/diff/:old/:new` | ✅ |
| Export change history | Monitors | `POST /monitors/:id/export` | ✅ |
| **Data export worker** | Users | Background job to process `DataExport` records | ✅ |
| **Deletion cleanup worker** | Users | Background job in cleanup-worker | ✅ |
| Cancel deletion | Users | `POST /users/me/cancel-deletion` | ✅ |
| Download data export | Users | `GET /users/me/export/:id/download` | ✅ |

---

### Phase 3: Document Management (RAG) ✅ COMPLETED
*Focus: Personalized analysis context*

| Feature | Section | Endpoint/Task | Status |
|---------|---------|---------------|--------|
| Upload document | Documents | `POST /documents` | ✅ |
| List documents | Documents | `GET /documents` | ✅ |
| Get document metadata | Documents | `GET /documents/:id` | ✅ |
| Delete document | Documents | `DELETE /documents/:id` | ✅ |
| Get document content | Documents | `GET /documents/:id/content` | ✅ |
| Document parsing | Documents | Via vectorize-worker | ✅ |
| Vector embeddings | Documents | `UserContextEmbedding` | ✅ |
| **Vectorize worker** | Workers | Already exists | ✅ |

---

### Phase 4: Analytics & Reporting (1-2 weeks) ✅
*Focus: Business intelligence features*

| Feature | Section | Endpoint/Task | Status |
|---------|---------|---------------|--------|
| Risk score trends | Analytics | `GET /analytics/risk-trends` | ✅ |
| Change frequency charts | Analytics | `GET /analytics/changes` | ✅ |
| Most changed resources | Analytics | `/analytics/top-resources` (exists) | ✅ |
| Dashboard metrics | Analytics | Enhance `/analytics/dashboard` | ✅ |
| Generate report | Reporting | `POST /reports/generate` | ✅ |
| List reports | Reporting | `GET /reports` | ✅ |
| Download report | Reporting | `GET /reports/:id/download` | ✅ |
| Scheduled reports | Reporting | `POST/GET/DELETE /reports/schedules` | ✅ |
| **Reports worker** | Worker | PDF/CSV generation + schedules | ✅ |

---

### Phase 5: Integrations & Webhooks (1-2 weeks) ⏸️ *DEFERRED*
*Focus: Third-party connectivity*

| Feature | Section | Endpoint/Task |
|---------|---------|---------------|
| **Webhook delivery worker** | Integrations | Actually send events to webhook URLs |
| Slack OAuth connect | Integrations | `POST /integrations/slack` |
| Slack disconnect | Integrations | `DELETE /integrations/slack` |
| Slack notification delivery | Integrations | Send alerts to Slack channels |
| Digest frequency settings | Notifications | instant/daily/weekly options |
| Unsubscribe handling | Notifications | Token-based email unsubscribe |

---

### Phase 6: API Infrastructure (1 week) ✅
*Focus: Developer experience and stability*

| Feature | Section | Endpoint/Task | Status |
|---------|---------|---------------|--------|
| API versioning | DevEx | All routes under `/api/v1/` prefix | ✅ |
| Consistent response format | DevEx | `middleware/response-formatter.ts` | ✅ |
| OpenAPI/Swagger fix | DevEx | Fixed path resolution in `swagger.ts` | ✅ |
| OpenAPI update workflow | DevEx | `.agent/workflows/update-openapi-docs.md` | ✅ |
| Deprecation headers | DevEx | `middleware/deprecation.ts` (RFC 8594) | ✅ |
| Changelog endpoint | DevEx | `GET /api/v1/changelog` | ✅ |
| Postman collection | DevEx | Export via `/openapi.json` | ✅ |
| SDK generation | DevEx | Deferred - use OpenAPI codegen | ⏸️ |

---

### Phase 7: Enhanced Auth & Security (2 weeks) ✅
*Focus: Enterprise security requirements*

| Feature | Section | Endpoint/Task | Status |
|---------|---------|---------------|--------|
| Session management | Auth | `GET /api/v1/auth/sessions` | ✅ |
| Terminate session | Auth | `DELETE /api/v1/auth/sessions/:id` | ✅ |
| Revoke all sessions | Auth | `POST /api/v1/auth/sessions/revoke-all` | ✅ |
| SSO provider verification | Auth | Provider stored in session | ✅ |
| Service account tokens | Auth | Non-user API access | ⏸️ Deferred |

---

### Phase 8: Admin & Operations (1-2 weeks) ⏸️ *DEFERRED*
*Focus: Platform management*

| Feature | Section | Endpoint/Task |
|---------|---------|---------------|
| System metrics | Admin | `GET /admin/metrics` |
| List all users | Admin | `GET /admin/users` |
| List all orgs | Admin | `GET /admin/organizations` |
| Maintenance mode | Admin | `POST /admin/maintenance` |
| Feature flags | Admin | `GET/PATCH /admin/feature-flags` |
| User impersonation | Admin | Support token generation |
| Security events | Security | `GET /security/events` |

---

### Phase 9: Bulk Operations (1 week) ⏸️ *DEFERRED*
*Focus: Power user efficiency*

| Feature | Section | Endpoint/Task |
|---------|---------|---------------|
| Bulk import monitors | Monitors | `POST /monitors/bulk` (CSV/JSON) |
| Monitor categories/tags | Monitors | Add `tags` field to Subscription |
| Monitor sharing | Monitors | Share within org |
| Custom scrape frequency | Monitors | Per-monitor interval setting |

---

### Phase 10: Billing Integration (2-3 weeks) ✅
*Focus: Monetization (when payment provider selected)*

| Feature | Section | Endpoint/Task | Status |
|---------|---------|---------------|--------|
| Payment processor abstraction | Billing | PayStack/Stripe swappable | ✅ |
| Subscription tiers | Billing | `SubscriptionTier` model (archiveable) | ✅ |
| Org subscription | Billing | `OrganizationSubscription` model | ✅ |
| Get subscription | Billing | `GET /api/v1/billing/subscription` | ✅ |
| Create subscription | Billing | `POST /api/v1/billing/subscription` | ✅ |
| Cancel subscription | Billing | `DELETE /api/v1/billing/subscription` | ✅ |
| List tiers | Billing | `GET /api/v1/billing/tiers` | ✅ |
| Usage stats | Billing | `GET /api/v1/billing/usage` | ✅ |
| List invoices | Billing | `GET /api/v1/billing/invoices` | ✅ |
| PayStack webhook | Billing | `POST /webhooks/paystack` | ✅ |
| Plan limits enforcement | Billing | `plan-limits.ts` middleware | ✅ |

---

## Phase 11: Future Roadmap ⏸️ *DEFERRED*

| Feature | Priority | Description |
|---------|----------|-------------|
| **Manual monitor refresh** | P3 | `POST /monitors/:id/refresh` - Allow users to trigger on-demand re-scrape |
| **Stale session cleanup** | P3 | Daily cleanup of revoked/inactive sessions |
| **Analytics aggregation** | P3 | Pre-computed dashboard metrics |
| **Monitor scheduling UI** | P3 | Per-monitor custom schedules |

---

## Priority Summary

| Priority | Phases | Est. Time |
|----------|--------|-----------|
| **P0 - Critical** | 1, 2 | 3-4 weeks |
| **P1 - Important** | 3, 4, 5 | 4-6 weeks |
| **P2 - Standard** | 6, 7, 8 | 4-5 weeks |
| **P3 - Enhancement** | 9 | 1 week |
| **P4 - Deferred** | 10 | 2-3 weeks |

**Total estimated effort: 14-19 weeks** (phases can be parallelized)

---

## Worker Architecture

The system uses a mix of HTTP-triggered and event-driven workers:

### Scheduled Workers (HTTP-triggered via Cloud Scheduler)

| Worker | Port | Schedule | Description |
|--------|------|----------|-------------|
| `monitor-refresh-worker` | 8087 | `0 * * * *` (hourly) | Claims and refreshes due monitors |
| `billing-lifecycle-worker` | 8086 | `0 0 * * *` (daily) | Trial/subscription lifecycle tasks |
| `cleanup-worker` | 8088 | `0 2 * * *` (2am daily) | GDPR/SOC2 deletions and GCS cleanup |

**Endpoints:** Each worker exposes `/health` and `/run` endpoints.

### Event-Driven Workers (Pub/Sub subscribers)

| Worker | Subscription | Triggered By |
|--------|--------------|--------------|
| `ingestion-worker` | `cmd.scrape_url-sub` | Monitor refresh, new monitor |
| `analysis-worker` | `event.change_detected-sub` | Scraper detects change |
| `notification-worker` | `cmd.send_notification-sub` | Alerts, reports ready |
| `data-export-worker` | `cmd.generate_export-sub` | `POST /users/me/export` |
| `reports-worker` | `cmd.generate_report-sub` | `POST /reports` |
| `vectorize-worker` | `cmd.vectorize_doc-sub` | Document upload |

### Cloud Scheduler Setup (Production)

```bash
# Monitor Refresh (hourly)
gcloud scheduler jobs create http monitor-refresh \
  --schedule="0 * * * *" \
  --uri="https://monitor-refresh-worker.run.app/run" \
  --http-method=POST \
  --headers="X-Cron-Secret=YOUR_SECRET"

# Billing Lifecycle (daily at midnight)
gcloud scheduler jobs create http billing-lifecycle \
  --schedule="0 0 * * *" \
  --uri="https://billing-lifecycle-worker.run.app/run" \
  --http-method=POST \
  --headers="X-Cron-Secret=YOUR_SECRET"

# Cleanup Worker (daily at 2am)
gcloud scheduler jobs create http cleanup \
  --schedule="0 2 * * *" \
  --uri="https://cleanup-worker.run.app/run" \
  --http-method=POST \
  --headers="X-Cron-Secret=YOUR_SECRET"
```

### Pub/Sub Topics

| Topic | Purpose |
|-------|---------|
| `cmd.scrape_url` | Trigger scraping of a URL |
| `event.change_detected` | Change detected by scraper |
| `cmd.send_notification` | Send email/webhook notification |
| `cmd.vectorize_doc` | Vectorize uploaded document |
| `cmd.generate_export` | Generate GDPR data export |
| `cmd.generate_report` | Generate PDF/CSV report |

---

## External Setup Requirements

These require configuration outside the codebase:

### PayStack (Payment Processing)

**What you need:**
1. PayStack business account: https://paystack.com/
2. Get API keys from Dashboard → Settings → API Keys & Webhooks

**Environment variables:**
```bash
PAYMENT_PROCESSOR=paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx  # For frontend
```

**Webhook setup:**
- URL: `https://your-api-domain.com/webhooks/paystack`
- Events: `subscription.create`, `charge.success`, `subscription.disable`, `invoice.payment_failed`
- Copy webhook signing secret to verify signatures

**Plan codes:**
In PayStack Dashboard → Products → Plans, create plans matching your tier names (starter, professional, enterprise). Note the plan codes.

---

### Firebase / GCP Identity Platform

**What you need:**
1. GCP project with Identity Platform enabled
2. Firebase project (or standalone Identity Platform)

**Environment variables:**
```bash
# Firebase Admin SDK (for backend)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# OR
FIREBASE_PROJECT_ID=your-project-id

# For frontend
NEXT_PUBLIC_FIREBASE_API_KEY=xxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

---

### Email Provider (Resend)

**Already configured for:** `notification-worker`

**Environment variables:**
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=notifications@clausync.io
```

---

### GCP Services

| Service | Purpose | Setup |
|---------|---------|-------|
| **Cloud SQL** | PostgreSQL database | Create instance, enable connections |
| **Cloud Storage** | Snapshots, exports, uploads | Create buckets + IAM policies |
| **Pub/Sub** | Event messaging | Topics created via `pubsub-init` |
| **Secret Manager** | Secure secrets | Store API keys, not in code |
| **Cloud Scheduler** | Cron jobs | See Worker Architecture section |
| **Vertex AI** | AI/ML for analysis | Enable API + service account |

