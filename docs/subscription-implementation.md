# Clausync Billing & Subscription System Walkthrough

This document provides a comprehensive breakdown of how subscriptions, payment, limits, usage tracking, and resource monitoring work in Clausync.

---

## System Architecture Overview

```mermaid
graph TB
    subgraph "User Actions"
        U[User/Web App]
        API_KEY[API Key Client]
    end

    subgraph "API Layer"
        AUTH[Auth Middleware]
        USAGE_TRACK[Usage Tracker<br/>middleware/usage-tracker.ts]
        PLAN_LIMIT[Plan Limits<br/>middleware/plan-limits.ts]
        BILLING[Billing Routes<br/>routes/billing.ts]
        MONITORS[Monitor Routes<br/>routes/monitors.ts]
    end

    subgraph "Payment Processing"
        FACTORY[Payment Factory<br/>services/payment/index.ts]
        PAYSTACK[PayStack Processor<br/>services/payment/paystack.ts]
        STRIPE[Stripe Processor<br/>Future]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL)]
        TIER[SubscriptionTier]
        ORG_SUB[OrganizationSubscription]
        USAGE[UsageRecord]
    end

    subgraph "External"
        PAYSTACK_API[PayStack API]
        WEBHOOK["Webhook Endpoint"]
    end

    U --> AUTH
    API_KEY --> AUTH
    AUTH --> USAGE_TRACK
    USAGE_TRACK --> PLAN_LIMIT
    PLAN_LIMIT --> BILLING
    PLAN_LIMIT --> MONITORS

    BILLING --> FACTORY
    FACTORY --> PAYSTACK
    FACTORY -.-> STRIPE
    PAYSTACK --> PAYSTACK_API

    PAYSTACK_API --> WEBHOOK
    WEBHOOK --> ORG_SUB

    BILLING --> TIER
    BILLING --> ORG_SUB
    USAGE_TRACK --> USAGE
    PLAN_LIMIT --> TIER
```

---

## Database Schema

### Core Models

#### 1. SubscriptionTier

Defines available subscription plans with their limits.

```prisma
model SubscriptionTier {
  id              String    @id @default(uuid())
  name            String    @unique // free, pro, business, enterprise
  displayName     String
  priceMonthly    Int       // cents (0 for free)
  priceYearly     Int       // cents
  currency        String    @default("USD")

  // Resource Limits
  monitorLimit    Int       // Max monitors per org
  teamLimit       Int       // Max team members
  documentLimit   Int       // Max RAG documents
  apiRateLimit    Int       // API requests per month
  webhookLimit    Int       // Webhook endpoints
  reportsPerMonth Int?      // null = unlimited

  // Features
  checkFrequency  String    @default("daily") // weekly, daily, hourly
  historyDays     Int       // How long to retain change history
  features        Json?     // Additional feature flags

  isActive        Boolean   @default(true) // false = archived
  subscriptions   OrganizationSubscription[]
}
```

#### 2. OrganizationSubscription

Links an organization to their active subscription tier.

```prisma
model OrganizationSubscription {
  id                    String    @id
  organizationId        String    @unique
  tierId                String
  paymentSubscriptionId String?   // PayStack/Stripe ID
  status                String    @default("trialing")
                                  // trialing, active, past_due, canceled, paused
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  trialEndsAt           DateTime?
  canceledAt            DateTime?
  cancelAtPeriodEnd     Boolean   @default(false)

  organization          Organization
  tier                  SubscriptionTier
}
```

#### 3. UsageRecord

Tracks usage metrics per organization per billing period.

```prisma
model UsageRecord {
  id             String   @id
  organizationId String
  metric         String   // api_requests, web_requests, reports_generated, ai_queries
  count          Int      @default(0)
  periodStart    DateTime // First day of month
  periodEnd      DateTime // Last day of month

  @@unique([organizationId, metric, periodStart])
}
```

### Subscription Status Lifecycle

The `OrganizationSubscription.status` field tracks the subscription state through various events:

```mermaid
stateDiagram-v2
    [*] --> active: Org Created<br/>assignFreeTier()

    active --> active: charge.success<br/>Renewal Payment
    active --> past_due: invoice.payment_failed
    active --> canceled: subscription.disable<br/>User Cancels

    trialing --> active: Trial Ends<br/>+ Payment Success
    trialing --> canceled: Trial Ends<br/>+ No Payment

    past_due --> active: charge.success<br/>Payment Retry Success
    past_due --> canceled: Max Retries Exceeded

    canceled --> active: User Resubscribes<br/>POST /billing/subscription

    note right of active: Full access to tier features
    note right of past_due: Grace period - features still work
    note right of canceled: Downgraded to Free tier
```

### Status Transition Events

| From Status | To Status  | Trigger                  | Handler                      |
| ----------- | ---------- | ------------------------ | ---------------------------- |
| `(new)`     | `active`   | Organization created     | `assignFreeTier()`           |
| `active`    | `active`   | `charge.success`         | `handleChargeSuccess()`      |
| `active`    | `past_due` | `invoice.payment_failed` | `handlePaymentFailed()`      |
| `active`    | `canceled` | `subscription.disable`   | `handleSubscriptionCancel()` |
| `trialing`  | `active`   | Trial ends + payment     | Webhook handler              |
| `past_due`  | `active`   | `charge.success`         | `handleChargeSuccess()`      |
| `past_due`  | `canceled` | Max retries              | `downgradeToFreeTier()`      |
| `canceled`  | `active`   | User resubscribes        | `POST /billing/subscription` |

### Detailed Flow: Payment Failure to Recovery

```mermaid
sequenceDiagram
    participant PayStack
    participant Webhook
    participant DB
    participant SubService as Subscription Service

    Note over PayStack: Payment due date arrives
    PayStack->>PayStack: Attempt charge

    alt Charge Successful
        PayStack->>Webhook: charge.success
        Webhook->>DB: UPDATE status = 'active'<br/>Extend currentPeriodEnd
    else Charge Failed
        PayStack->>Webhook: invoice.payment_failed
        Webhook->>DB: UPDATE status = 'past_due'
        Note over DB: Grace period begins

        loop Retry (up to 3 times)
            PayStack->>PayStack: Retry charge
            alt Retry Successful
                PayStack->>Webhook: charge.success
                Webhook->>DB: UPDATE status = 'active'
            else All Retries Failed
                PayStack->>Webhook: subscription.disable
                Webhook->>SubService: downgradeToFreeTier(orgId, 'payment_failed')
                SubService->>DB: UPDATE tierId = freeTier<br/>status = 'canceled'
                SubService->>DB: INSERT AuditLog<br/>reason = 'payment_failed'
            end
        end
    end
```

---

## Payment Processor Architecture

### Abstraction Layer

The system uses a **Strategy Pattern** for payment processing, allowing hot-swapping between providers.

```mermaid
classDiagram
    class PaymentProcessor {
        <<interface>>
        +providerName: string
        +createCustomer(email, name)
        +getCustomer(customerId)
        +createSubscription(customerId, planId)
        +cancelSubscription(subscriptionId)
        +getInvoices(customerId)
        +verifyWebhook(payload, signature)
    }

    class PaystackProcessor {
        -secretKey: string
        +providerName = "paystack"
        +createCustomer()
        +getAuthorizationUrl()
    }

    class StripeProcessor {
        -secretKey: string
        +providerName = "stripe"
        +createCustomer()
    }

    PaymentProcessor <|.. PaystackProcessor
    PaymentProcessor <|.. StripeProcessor
```

### Factory Pattern

[services/payment/index.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/services/payment/index.ts):

```typescript
export function getPaymentProcessor(): PaymentProcessor {
  const processorType = process.env.PAYMENT_PROCESSOR || "paystack";

  switch (processorType) {
    case "stripe":
      throw new Error("Stripe not yet implemented");
    case "paystack":
    default:
      return new PaystackProcessor();
  }
}
```

### PayStack Integration

[services/payment/paystack.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/services/payment/paystack.ts):

Key features:

- Customer creation/management
- Subscription lifecycle
- Invoice retrieval
- Webhook signature verification (HMAC-SHA512)
- Authorization URL for checkout redirect flow

---

## Plan Limits Enforcement

### Middleware Architecture

[middleware/plan-limits.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/middleware/plan-limits.ts):

```mermaid
sequenceDiagram
    participant Client
    participant Auth
    participant PlanLimits
    participant DB
    participant Route

    Client->>Auth: Request with JWT/API Key
    Auth->>PlanLimits: Authenticated request
    PlanLimits->>DB: Get user's org subscription
    DB-->>PlanLimits: OrganizationSubscription + Tier
    PlanLimits->>DB: Count current resources
    DB-->>PlanLimits: Current count (e.g., 24 monitors)

    alt Count < Limit
        PlanLimits->>Route: Allow request
        Route-->>Client: 201 Created
    else Count >= Limit
        PlanLimits-->>Client: 403 PLAN_LIMIT_EXCEEDED
    end
```

### Implementation

```typescript
// Get limits for a user's organization
export async function getPlanLimits(userId: string): Promise<PlanLimits> {
  const user = await prisma.user.findUnique({
    where: { identityProviderUid: userId },
    include: {
      organization: {
        include: {
          subscription: {
            include: { tier: true },
          },
        },
      },
    },
  });

  if (!user?.organization?.subscription?.tier) {
    return FREE_LIMITS; // Default fallback
  }

  return user.organization.subscription.tier;
}

// Middleware factory
export function requirePlanLimit(
  limitType: keyof PlanLimits,
  getCountFn: (userId: string) => Promise<number>
) {
  return async (req, res, next) => {
    const currentCount = await getCountFn(req.user.uid);
    const result = await checkLimit(req.user.uid, limitType, currentCount);

    if (!result.allowed) {
      return res.status(403).json({
        error: {
          code: "PLAN_LIMIT_EXCEEDED",
          message: `You have reached your ${limitType} limit (${result.limit})`,
        },
      });
    }
    next();
  };
}

// Pre-built middleware
export const checkMonitorLimit = requirePlanLimit(
  "monitorLimit",
  getMonitorCount
);
export const checkDocumentLimit = requirePlanLimit(
  "documentLimit",
  getDocumentCount
);
export const checkTeamLimit = requirePlanLimit("teamLimit", getTeamMemberCount);
```

### Enforcement Points

| Resource     | Limit Field     | Enforcement Point                 | Counter Function           |
| ------------ | --------------- | --------------------------------- | -------------------------- |
| Monitors     | `monitorLimit`  | `POST /monitors`                  | Count active subscriptions |
| Team Members | `teamLimit`     | `POST /organizations/:id/members` | Count org users            |
| Documents    | `documentLimit` | `POST /documents`                 | Count user documents       |
| Webhooks     | `webhookLimit`  | `POST /integrations/webhooks`     | Count org webhooks         |
| API Requests | `apiRateLimit`  | All API routes                    | Monthly usage record       |

---

## Usage Tracking

### Two Types of Request Tracking

[middleware/usage-tracker.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/middleware/usage-tracker.ts):

```mermaid
graph LR
    subgraph "Request Sources"
        WEB[Web App<br/>Firebase Auth]
        API[API Key<br/>Programmatic]
    end

    subgraph "Tracking"
        TRACK[Usage Tracker Middleware]
        WEB --> TRACK
        API --> TRACK
    end

    subgraph "Metrics"
        WEB_METRIC[web_requests<br/>FREE - Informational]
        API_METRIC[api_requests<br/>BILLABLE - Counts toward limit]
    end

    TRACK -->|authType=firebase| WEB_METRIC
    TRACK -->|authType=apiKey| API_METRIC
```

### Implementation

```typescript
export async function trackApiUsage(req, res, next) {
  if (!req.user) return next();

  const isApiKeyRequest = req.authType === "apiKey";
  const metric: UsageMetric = isApiKeyRequest ? "api_requests" : "web_requests";

  // Track asynchronously to not block the request
  setImmediate(async () => {
    const user = await prisma.user.findUnique({
      where: { identityProviderUid: req.user.uid },
      select: { organizationId: true },
    });

    if (user?.organizationId) {
      await incrementUsage(user.organizationId, metric);
    }
  });

  next();
}
```

### Usage Service

[services/usage.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/services/usage.ts):

```typescript
// Upsert pattern for atomic increment
export async function incrementUsage(
  organizationId: string,
  metric: UsageMetric,
  amount: number = 1
) {
  const { start, end } = getCurrentPeriod(); // First/last day of month

  await prisma.usageRecord.upsert({
    where: {
      organizationId_metric_periodStart: {
        organizationId,
        metric,
        periodStart: start,
      },
    },
    create: {
      organizationId,
      metric,
      count: amount,
      periodStart: start,
      periodEnd: end,
    },
    update: {
      count: { increment: amount },
    },
  });
}
```

---

## Billing API Endpoints

[routes/billing.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/routes/billing.ts):

| Endpoint                       | Method | Description                       |
| ------------------------------ | ------ | --------------------------------- |
| `/api/v1/billing/tiers`        | GET    | List available subscription tiers |
| `/api/v1/billing/subscription` | GET    | Get current subscription status   |
| `/api/v1/billing/subscription` | POST   | Create/upgrade subscription       |
| `/api/v1/billing/subscription` | DELETE | Cancel subscription               |
| `/api/v1/billing/usage`        | GET    | Get current usage vs limits       |
| `/api/v1/billing/invoices`     | GET    | List payment history              |

### Subscription Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant PayStack
    participant Webhook
    participant DB

    User->>API: POST /billing/subscription<br/>{tierId, callbackUrl}
    API->>DB: Find org, verify tier exists

    alt Free Tier
        API->>DB: Upsert OrganizationSubscription<br/>status=active
        API-->>User: {subscription}
    else Paid Tier
        API->>DB: Ensure paymentCustomerId exists
        API->>PayStack: getAuthorizationUrl(email, plan)
        PayStack-->>API: authorizationUrl
        API-->>User: {authorizationUrl}
        User->>PayStack: Complete payment on hosted page
        PayStack->>Webhook: POST /webhooks/paystack<br/>subscription.create
        Webhook->>DB: Upsert OrganizationSubscription<br/>status=active
    end
```

---

## Webhook Processing

[routes/paystack-webhook.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/routes/paystack-webhook.ts):

### Event Types Handled

| Event                    | Action                                          |
| ------------------------ | ----------------------------------------------- |
| `subscription.create`    | Create/update OrganizationSubscription (active) |
| `subscription.not_renew` | Mark subscription canceled                      |
| `subscription.disable`   | Mark subscription canceled                      |
| `charge.success`         | Update subscription period, log payment         |
| `invoice.payment_failed` | Mark subscription past_due                      |

### Security

```typescript
// Webhook signature verification
verifyWebhook(payload: string, signature: string): WebhookEvent | null {
  const hash = crypto
    .createHmac('sha512', this.secretKey)
    .update(payload)
    .digest('hex');

  if (hash !== signature) {
    return null; // Invalid signature
  }

  return JSON.parse(payload);
}
```

---

## Automatic Free Tier Assignment

A dedicated subscription service handles free tier assignment automatically.

### Service Layer

[services/subscription.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/services/subscription.ts):

| Function                             | Purpose                                       |
| ------------------------------------ | --------------------------------------------- |
| `getFreeTier()`                      | Gets free tier from DB, auto-seeds if missing |
| `assignFreeTier(orgId)`              | Assigns free tier to new organization         |
| `downgradeToFreeTier(orgId, reason)` | Downgrades org with audit log                 |

### Auto-Seeding

If the free tier doesn't exist in the database, `getFreeTier()` automatically creates it:

- 3 monitors
- Weekly checks
- No API access
- No documents
- 1 team member

### Integration Points

```mermaid
flowchart TD
    subgraph "Triggers"
        ORG_CREATE[Organization Created]
        PAY_FAIL[Payment Failed Webhook]
        SUB_CANCEL[Subscription Canceled Webhook]
    end

    subgraph "Service"
        ASSIGN[assignFreeTier]
        DOWNGRADE[downgradeToFreeTier]
        GET_FREE[getFreeTier]
    end

    subgraph "Database"
        TIER[(SubscriptionTier)]
        ORG_SUB[(OrganizationSubscription)]
        AUDIT[(AuditLog)]
    end

    ORG_CREATE --> ASSIGN
    PAY_FAIL --> DOWNGRADE
    SUB_CANCEL --> DOWNGRADE

    ASSIGN --> GET_FREE
    DOWNGRADE --> GET_FREE
    GET_FREE --> TIER

    ASSIGN --> ORG_SUB
    DOWNGRADE --> ORG_SUB
    DOWNGRADE --> AUDIT
```

### Downgrade Reasons

| Webhook Event            | Downgrade Reason | Action                        |
| ------------------------ | ---------------- | ----------------------------- |
| `invoice.payment_failed` | `payment_failed` | Downgrade to free, log reason |
| `subscription.disable`   | `canceled`       | Downgrade to free, log reason |

---

## Real-World Example: Monitor Creation

### Scenario

User on **Pro** tier (25 monitor limit) with 24 active monitors tries to create a new one.

### Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant PlanLimits
    participant DB

    User->>API: POST /monitors<br/>{url: "stripe.com/terms"}

    Note over API: 1. Auth middleware validates JWT
    Note over API: 2. Usage tracker logs request

    API->>PlanLimits: checkMonitorLimit middleware
    PlanLimits->>DB: SELECT tier FROM users<br/>JOIN organization_subscriptions<br/>JOIN subscription_tiers
    DB-->>PlanLimits: Pro tier (monitorLimit=25)

    PlanLimits->>DB: COUNT(*) FROM subscriptions<br/>WHERE userId=? AND deletedAt IS NULL
    DB-->>PlanLimits: 24

    Note over PlanLimits: 24 < 25 ✓ Allowed

    PlanLimits->>API: next()
    API->>DB: Check if resource exists (Singleton)
    API->>DB: Create subscription
    API->>API: Publish scrape command
    API-->>User: 201 Created
```

### If Limit Exceeded

```json
// Response when user has 25 monitors and tries to create #26
{
  "success": false,
  "error": {
    "code": "PLAN_LIMIT_EXCEEDED",
    "message": "You have reached your monitorLimit limit (25). Please upgrade your plan.",
    "details": {
      "limit": 25,
      "current": 25,
      "limitType": "monitorLimit"
    }
  }
}
```

---

## Usage Dashboard Data

### GET /api/v1/billing/usage Response

```json
{
  "success": true,
  "data": {
    "usage": {
      "monitors": { "current": 24, "limit": 25 },
      "documents": { "current": 3, "limit": 5 },
      "teamMembers": { "current": 2, "limit": 3 },
      "apiRequests": {
        "current": 850,
        "limit": 1000,
        "billable": true
      },
      "webRequests": {
        "current": 1523,
        "limit": null,
        "billable": false
      }
    }
  }
}
```

---

## Key Design Decisions

### 1. Organization-Level Subscriptions

Subscriptions are tied to **organizations**, not individual users. This enables team billing.

### 2. API vs Web Request Separation

- **API Key requests** → Billable, counted toward `apiRateLimit`
- **Web App requests** → Free, tracked for analytics only

### 3. Free Tier Fallback

If a user has no organization or no subscription, they default to `FREE_LIMITS`:

```typescript
const FREE_LIMITS: PlanLimits = {
  monitorLimit: 3,
  teamLimit: 1,
  documentLimit: 0,
  apiRateLimit: 0,
  webhookLimit: 0,
  reportsPerMonth: 0,
};
```

### 4. Asynchronous Usage Tracking

Usage is tracked via `setImmediate()` to not block API responses.

### 5. Archiveable Tiers

`isActive: false` archives old tiers without breaking existing subscriptions.

---

## Files Reference

| File                                                                                                    | Purpose                         |
| ------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [schema.prisma](file:///Users/MAC/Dev/code/clausync-ai/apps/api/prisma/schema.prisma)                   | Database models                 |
| [billing.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/routes/billing.ts)                     | Billing API endpoints           |
| [plan-limits.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/middleware/plan-limits.ts)         | Limit enforcement middleware    |
| [usage-tracker.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/middleware/usage-tracker.ts)     | Request counting middleware     |
| [usage.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/services/usage.ts)                       | Usage service (increment/query) |
| [payment/index.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/services/payment/index.ts)       | Payment processor factory       |
| [payment/paystack.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/services/payment/paystack.ts) | PayStack implementation         |
| [paystack-webhook.ts](file:///Users/MAC/Dev/code/clausync-ai/apps/api/src/routes/paystack-webhook.ts)   | Webhook handler                 |
