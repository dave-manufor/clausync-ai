# Clausync.ai Infrastructure

GCP Terraform infrastructure for Clausync.ai - an automated legal contract monitoring SaaS platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Google Cloud Platform                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────────────────────────────────────────┐   │
│  │ Cloud Armor  │───▶│              Cloud Run Services                   │   │
│  │    (WAF)     │    │                                                   │   │
│  └──────────────┘    │  ┌─────────┐  ┌───────────┐  ┌───────────────┐   │   │
│                      │  │   API   │  │ Ingestion │  │   Analysis    │   │   │
│                      │  │ Gateway │  │  Worker   │  │    Worker     │   │   │
│  Internet ──────────▶│  └────┬────┘  └─────┬─────┘  └───────┬───────┘   │   │
│                      │       │             │                 │          │   │
│                      │  ┌────┴────┐  ┌─────┴─────┐  ┌───────┴───────┐   │   │
│                      │  │Vectorize│  │Notification│  │               │   │   │
│                      │  │ Worker  │  │  Worker   │  │               │   │   │
│                      │  └─────────┘  └───────────┘  │               │   │   │
│                      └──────────────────────────────┴───────────────────┘   │
│                                         │                                    │
│  ┌──────────────────────────────────────┴───────────────────────────────┐   │
│  │                         VPC Connector                                 │   │
│  └───────────────────────────────┬──────────────────────────────────────┘   │
│                                  │                                          │
│  ┌───────────────────────────────┴──────────────────────────────────────┐   │
│  │                          Private VPC                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │  Cloud SQL  │  │ Memorystore │  │   Pub/Sub   │  │  Cloud      │  │   │
│  │  │ PostgreSQL  │  │   Redis     │  │  (Events)   │  │  Storage    │  │   │
│  │  │ + pgvector  │  │  (Cache)    │  │             │  │  (WORM)     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| VPC Network | ✅ Defined | Private subnets with VPC connector |
| Cloud SQL | ✅ Defined | PostgreSQL 16 with pgvector |
| Memorystore | ✅ Defined | Optional (disabled by default for MVP) |
| Cloud Storage | ✅ Defined | WORM-compliant snapshots + uploads |
| Pub/Sub | ✅ Defined | 4 topics with DLQs |
| Cloud Run | ✅ Defined | 5 services (scale-to-zero) |
| IAM | ✅ Defined | Least-privilege service accounts |
| Secret Manager | ✅ Defined | 6 secrets with per-service access |
| Monitoring | ✅ Defined | Alerts + audit logging |

## Cost Estimate (Lean MVP)

| Resource | Monthly Cost | Notes |
|----------|-------------|-------|
| Cloud SQL (db-f1-micro) | ~$10-15 | Shared core for dev |
| Cloud SQL (db-custom-1-3840) | ~$30-40 | 1 vCPU for prod |
| Memorystore Redis (1GB) | ~$35 | **Optional** |
| Cloud Storage | ~$1-5 | Pay per use |
| Cloud Run | ~$0-10 | Scale-to-zero |
| Pub/Sub | ~$0-5 | Per message |
| VPC Connector | ~$2-3 | When active |
| **Total (MVP without Redis)** | **~$50-65/mo** | |
| **Total (with Redis)** | **~$85-100/mo** | |

---

## Prerequisites

1. **GCP Project** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Terraform** v1.5.0+ installed

```bash
# Authenticate with GCP
gcloud auth application-default login

# Set default project
gcloud config set project YOUR_PROJECT_ID
```

---

## Quick Start

### 1. Initialize Terraform

```bash
cd infra

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit with your project ID
vim terraform.tfvars
```

### 2. Set Required Variables

Edit `terraform.tfvars`:

```hcl
project_id = "your-gcp-project-id"
region     = "us-central1"  # or europe-west1 for GDPR
environment = "dev"
```

### 3. Deploy Infrastructure

```bash
# Initialize providers
terraform init

# Preview changes
terraform plan

# Apply (creates all resources)
terraform apply
```

### 4. Populate Secrets

After Terraform creates the secrets, populate them:

```bash
# Database URL (generated during terraform apply)
echo "postgresql://clausync:PASSWORD@PRIVATE_IP:5432/clausync_db" | \
  gcloud secrets versions add clausync-database-url-dev --data-file=-

# Redis URL (if enabled)
echo "redis://REDIS_HOST:6379" | \
  gcloud secrets versions add clausync-redis-url-dev --data-file=-

# Resend API key (from resend.com)
echo "re_xxxxxxxxxxxxx" | \
  gcloud secrets versions add clausync-resend-api-key-dev --data-file=-

# Bright Data proxy credentials (from brightdata.com)
echo "brd.superproxy.io" | \
  gcloud secrets versions add clausync-proxy-host-dev --data-file=-
echo "brd-customer-xxx" | \
  gcloud secrets versions add clausync-proxy-user-dev --data-file=-
echo "your-proxy-password" | \
  gcloud secrets versions add clausync-proxy-pass-dev --data-file=-
```

### 5. Build and Deploy Services

```bash
# Get artifact registry URL
export REGISTRY=$(terraform output -raw artifact_registry_url)

# Build and push each service
cd ../apps/api
docker build -t $REGISTRY/api:latest .
docker push $REGISTRY/api:latest

# Repeat for other services...
```

---

## Configuration Options

### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `enable_redis` | `false` | Enable Memorystore (~$35/mo extra) |
| `enable_bucket_lock` | `false` | Enable WORM lock (**IRREVERSIBLE**) |
| `enable_ha_database` | `false` | Enable HA for Cloud SQL |

### Database Sizing

| Tier | vCPU | Memory | Use Case |
|------|------|--------|----------|
| `db-f1-micro` | 0.2 | 0.6 GB | Development |
| `db-g1-small` | 0.5 | 1.7 GB | Small prod |
| `db-custom-1-3840` | 1 | 3.75 GB | Production |
| `db-custom-2-7680` | 2 | 7.5 GB | High traffic |

### Region Selection

| Region | Best For | Latency |
|--------|----------|---------|
| `us-central1` | Lowest cost | Low (US) |
| `us-east1` | US East users | Low (US East) |
| `europe-west1` | GDPR compliance | Low (EU) |

---

## Module Reference

### Network (`modules/network`)
- VPC with private subnets
- Private Services Access for Cloud SQL/Redis
- Serverless VPC Connector for Cloud Run
- Firewall rules for internal traffic

### Database (`modules/database`)
- Cloud SQL PostgreSQL 16
- pgvector extension enabled
- Automatic backups (30-day retention)
- Point-in-time recovery (1-hour RPO)
- Query Insights enabled

### Cache (`modules/cache`)
- Cloud Memorystore Redis 7.0
- Basic tier for MVP
- Used for distributed locks and rate limiting

### Storage (`modules/storage`)
- **Snapshots bucket**: WORM-compliant (versioning + optional lock)
- **Uploads bucket**: User documents with lifecycle rules
- Storage class transitions to reduce costs

### Pub/Sub (`modules/pubsub`)
- 4 topics: `cmd.scrape_url`, `event.change_detected`, `cmd.send_notification`, `cmd.vectorize_doc`
- Dead Letter Queues after 5 failed attempts
- 7-day message retention

### IAM (`modules/iam`)
- 5 service accounts with least-privilege
- Role assignments per service

### Secrets (`modules/secretmgr`)
- 6 secrets in Secret Manager
- Per-service accessor bindings

### Cloud Run (`modules/cloudrun`)
- 5 services with scale-to-zero
- VPC connector for private access
- Cloud SQL connection via Unix socket
- Health probes configured

### Monitoring (`modules/monitoring`)
- Log-based metrics for errors
- Alert policies (API errors, scraper failures, Pub/Sub backlog)
- Audit log sink to GCS (production only)

---

## Environments

### Development
```bash
terraform apply -var-file=terraform.tfvars
```

### Production
```bash
# Create production tfvars
cat > terraform.prod.tfvars <<EOF
project_id         = "clausync-prod"
region             = "us-central1"
environment        = "prod"
database_tier      = "db-custom-1-3840"
enable_ha_database = true
enable_redis       = true
enable_bucket_lock = true  # CAUTION: Irreversible!
alert_notification_email = "ops@clausync.ai"
EOF

terraform apply -var-file=terraform.prod.tfvars
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "API not enabled" | Wait 1-2 minutes after initial apply |
| Cloud SQL connection failed | Check VPC connector and private IP |
| Pub/Sub permission denied | Verify service account IAM bindings |
| Secret not found | Ensure secret version was created |

### Useful Commands

```bash
# View outputs
terraform output

# Check Cloud Run logs
gcloud run services logs read clausync-api-dev --region us-central1

# Check Pub/Sub messages
gcloud pubsub subscriptions pull cmd.scrape_url-sub-dev --auto-ack --limit=10

# Test database connection
gcloud sql connect clausync-db-dev --user=clausync
```

---

## Cleanup

```bash
# Destroy all resources (CAUTION!)
terraform destroy

# Note: WORM-locked buckets cannot be deleted until retention expires
```

---

## Security Compliance

| Requirement | Implementation |
|-------------|----------------|
| **SOC 2 - Encryption** | CMEK-ready, TLS 1.3 in-transit |
| **SOC 2 - Access Control** | Least-privilege IAM, service accounts |
| **SOC 2 - Audit Logging** | Cloud Logging → GCS sink (7-year retention) |
| **GDPR - Data Residency** | Single-region deployment |
| **GDPR - Right to Erasure** | Soft-delete patterns in application |
| **Legal Admissibility** | WORM storage with versioning |

---

## Contributing

1. Make changes to Terraform modules
2. Run `terraform fmt -recursive` to format
3. Run `terraform validate` to check syntax
4. Submit PR with `terraform plan` output
