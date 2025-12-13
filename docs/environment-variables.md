# Environment Variables Guide

This document details all environment variables required for Clausync.ai services in development and production environments.

---

## Quick Start

1. Copy `.env.example` to `.env` in each service directory
2. For **local development**, most values are pre-configured in `docker-compose.yml`
3. For **production**, use GCP Secret Manager and Cloud Run environment variables

---

## Service: API (`apps/api`)

| Variable | Required | Dev Default | Description | How to Get |
|----------|----------|-------------|-------------|------------|
| `PORT` | ✅ | `8080` | Server port | Cloud Run uses 8080 by default |
| `GCP_PROJECT_ID` | ✅ | `clausync-dev` | GCP project identifier | [GCP Console](https://console.cloud.google.com/) → Project Selector |
| `DATABASE_URL` | ✅ | Set in docker-compose | PostgreSQL connection string | Format: `postgresql://USER:PASS@HOST:5432/DB`. Get from [Cloud SQL Console](https://console.cloud.google.com/sql) |
| `PUBSUB_TOPIC_SCRAPE` | ✅ | `cmd.scrape_url` | Topic for scrape commands | Create via Terraform or GCP Console |
| `IDENTITY_PLATFORM_AUDIENCE` | ⚠️ Prod | — | Expected audience in JWT tokens | Your GCP Project ID or custom value from [Identity Platform Settings](https://console.cloud.google.com/customer-identity) |
| `REDIS_URL` | ⚠️ Prod | `redis://redis:6379` | Redis for rate limiting | Format: `redis://HOST:6379`. Get from [Memorystore Console](https://console.cloud.google.com/memorystore) |

### Development Notes
- In dev with `docker-compose`, Pub/Sub emulator is used automatically via `PUBSUB_EMULATOR_HOST`
- Auth is bypassed when `PUBSUB_EMULATOR_HOST` is set (dev user assigned)

---

## Service: Ingestion Worker (`apps/ingestion-worker`)

| Variable | Required | Dev Default | Description | How to Get |
|----------|----------|-------------|-------------|------------|
| `GCP_PROJECT_ID` | ✅ | `clausync-dev` | GCP project identifier | GCP Console |
| `PUBSUB_SUBSCRIPTION_ID` | ✅ | `cmd.scrape_url-sub` | Subscription for scrape commands | Create subscription for `cmd.scrape_url` topic |
| `PUBSUB_TOPIC_ID` | ✅ | `event.change_detected` | Topic to publish change events | Create via GCP Console |
| `GCS_BUCKET_NAME` | ✅ | `legalwatch-snapshots` | Bucket for HTML snapshots | Create in [Cloud Storage](https://console.cloud.google.com/storage) |
| `DATABASE_URL` | ✅ | Set in docker-compose | PostgreSQL connection | Cloud SQL Console |
| `REDIS_HOST` | ✅ | `redis` | Redis host for locking | Memorystore Console |
| `REDIS_PORT` | ⚪ | `6379` | Redis port | Default: 6379 |
| `PROXY_HOST` | ⚠️ Prod | — | Bright Data proxy endpoint | [Bright Data Dashboard](https://brightdata.com/) → Zone → Access Parameters |
| `PROXY_PORT` | ⚠️ Prod | `22225` | Proxy port | Bright Data Dashboard |
| `PROXY_USER` | ⚠️ Prod | — | Proxy username | Bright Data Dashboard |
| `PROXY_PASS` | ⚠️ Prod | — | Proxy password | Bright Data Dashboard |

### Bright Data Setup (Production)
1. Sign up at [brightdata.com](https://brightdata.com)
2. Create a new **Zone** (Datacenter or Residential)
3. Navigate to Zone → **Access Parameters**
4. Copy Host, Port, Username, Password

---

## Service: Analysis Worker (`apps/analysis-worker`)

| Variable | Required | Dev Default | Description | How to Get |
|----------|----------|-------------|-------------|------------|
| `GCP_PROJECT_ID` | ✅ | `clausync-dev` | GCP project identifier | GCP Console |
| `GCP_REGION` | ✅ | `us-central1` | Region for Vertex AI | Choose based on latency/compliance needs |
| `PUBSUB_SUBSCRIPTION_ID` | ✅ | `event.change_detected-sub` | Subscription for change events | Create subscription for topic |
| `PUBSUB_TOPIC_NOTIFY` | ✅ | `cmd.send_notification` | Topic for notification commands | Create via GCP Console |
| `GCS_BUCKET_NAME` | ✅ | `legalwatch-snapshots` | Bucket to read snapshots | Same as Ingestion Worker |
| `DATABASE_URL` | ✅ | Set in docker-compose | PostgreSQL connection | Cloud SQL Console |

### Vertex AI Setup
1. Enable [Vertex AI API](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com)
2. Service account needs `Vertex AI User` role
3. In production, uses Application Default Credentials (ADC)

---

## Service: Vectorize Worker (`apps/vectorize-worker`)

| Variable | Required | Dev Default | Description | How to Get |
|----------|----------|-------------|-------------|------------|
| `GCP_PROJECT_ID` | ✅ | `clausync-dev` | GCP project identifier | GCP Console |
| `GCP_REGION` | ✅ | `us-central1` | Region for Vertex AI | Same as Analysis Worker |
| `PUBSUB_SUBSCRIPTION_ID` | ✅ | `cmd.vectorize_doc-sub` | Subscription for vectorize commands | Create subscription |
| `GCS_BUCKET_NAME` | ✅ | `legalwatch-uploads` | Bucket for user-uploaded documents | Create separate bucket for uploads |
| `DATABASE_URL` | ✅ | Set in docker-compose | PostgreSQL with pgvector | Cloud SQL Console |
| `EMBEDDING_MODEL` | ⚪ | `text-embedding-004` | Vertex AI embedding model | Default is recommended |
| `CHUNK_SIZE` | ⚪ | `1000` | Characters per text chunk | Tune based on document types |
| `CHUNK_OVERLAP` | ⚪ | `200` | Overlap between chunks | Tune for context preservation |

---

## Service: Notification Worker (`apps/notification-worker`)

| Variable | Required | Dev Default | Description | How to Get |
|----------|----------|-------------|-------------|------------|
| `GCP_PROJECT_ID` | ✅ | `clausync-dev` | GCP project identifier | GCP Console |
| `PUBSUB_SUBSCRIPTION_ID` | ✅ | `cmd.send_notification-sub` | Subscription for notification commands | Create subscription |
| `DATABASE_URL` | ✅ | Set in docker-compose | PostgreSQL connection | Cloud SQL Console |
| `RESEND_API_KEY` | ✅ | — | Resend API key for emails | [Resend Dashboard](https://resend.com/api-keys) → Create API Key |
| `EMAIL_FROM` | ✅ | — | Sender email address | Must be verified in [Resend Domains](https://resend.com/domains) |
| `DASHBOARD_URL` | ⚪ | `https://app.clausync.ai` | Link in email templates | Your deployed frontend URL |

### Resend Setup
1. Sign up at [resend.com](https://resend.com)
2. Add and verify your domain under **Domains**
3. Create an API key under **API Keys**
4. Use a verified email as `EMAIL_FROM` (e.g., `alerts@yourdomain.com`)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Required in all environments |
| ⚠️ Prod | Required only in production |
| ⚪ | Optional (has sensible default) |

---

## Development vs Production

### Development (Local with Docker Compose)

```bash
# Start all services with emulators
docker-compose up --build

# Environment automatically configured via docker-compose.yml:
# - PUBSUB_EMULATOR_HOST set → uses local Pub/Sub emulator
# - STORAGE_EMULATOR_HOST set → uses fake-gcs-server
# - DATABASE_URL → points to local PostgreSQL container
# - REDIS_HOST → points to local Redis container
```

**What's NOT needed in dev:**
- `RESEND_API_KEY` (emails won't send, but worker runs)
- `PROXY_*` variables (scraping works without proxy locally)
- `IDENTITY_PLATFORM_AUDIENCE` (auth bypassed in dev mode)

### Production (Cloud Run)

1. **Store secrets in Secret Manager:**
   ```bash
   gcloud secrets create resend-api-key --data-file=- <<< "re_xxxxx"
   gcloud secrets create database-url --data-file=- <<< "postgresql://..."
   gcloud secrets create proxy-pass --data-file=- <<< "brightdata-password"
   ```

2. **Reference in Cloud Run:**
   ```yaml
   # cloudbuild.yaml or terraform
   env:
     - name: RESEND_API_KEY
       valueFrom:
         secretKeyRef:
           name: resend-api-key
           key: latest
   ```

3. **Service Account Permissions:**
   - `roles/pubsub.publisher` and `roles/pubsub.subscriber`
   - `roles/storage.objectAdmin` (for GCS)
   - `roles/cloudsql.client` (for Cloud SQL)
   - `roles/aiplatform.user` (for Vertex AI)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `PUBSUB_EMULATOR_HOST` not working | Ensure emulator is running and accessible at the specified host:port |
| Database connection refused | Check `DATABASE_URL` format and ensure PostgreSQL is running |
| Vertex AI permission denied | Ensure service account has `Vertex AI User` role |
| Resend emails not sending | Verify domain is confirmed and API key is valid |
| Proxy connection failed | Check Bright Data credentials and zone configuration |
