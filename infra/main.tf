# =============================================================================
# Clausync.ai - GCP Infrastructure
# =============================================================================
# Cloud-Native, Event-Driven Microservices Architecture
# Designed for Lean MVP (~$67/month fixed costs) with SOC 2 & GDPR compliance
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Provider Configuration
# -----------------------------------------------------------------------------
provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# -----------------------------------------------------------------------------
# Enable Required APIs
# -----------------------------------------------------------------------------
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",               # Cloud Run
    "sqladmin.googleapis.com",          # Cloud SQL Admin
    "sql-component.googleapis.com",     # Cloud SQL
    "pubsub.googleapis.com",            # Pub/Sub
    "storage.googleapis.com",           # Cloud Storage
    "secretmanager.googleapis.com",     # Secret Manager
    "vpcaccess.googleapis.com",         # Serverless VPC Access
    "servicenetworking.googleapis.com", # Service Networking
    "redis.googleapis.com",             # Cloud Memorystore Redis
    "aiplatform.googleapis.com",        # Vertex AI
    "artifactregistry.googleapis.com",  # Artifact Registry
    "cloudbuild.googleapis.com",        # Cloud Build
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# Network Module
# -----------------------------------------------------------------------------
module "network" {
  source = "./modules/network"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment

  depends_on = [google_project_service.required_apis]
}

# -----------------------------------------------------------------------------
# Database Module (Cloud SQL PostgreSQL with pgvector)
# -----------------------------------------------------------------------------
module "database" {
  source = "./modules/database"

  project_id            = var.project_id
  region                = var.region
  environment           = var.environment
  vpc_network_id        = module.network.vpc_network_id
  private_ip_range_name = module.network.private_ip_range_name
  database_tier         = var.database_tier
  enable_ha             = var.enable_ha_database
  deletion_protection   = var.environment == "prod"

  depends_on = [module.network]
}

# -----------------------------------------------------------------------------
# Cache Module (Cloud Memorystore Redis) - Optional for MVP
# -----------------------------------------------------------------------------
module "cache" {
  source = "./modules/cache"
  count  = var.enable_redis ? 1 : 0

  project_id     = var.project_id
  region         = var.region
  environment    = var.environment
  vpc_network_id = module.network.vpc_network_id
  memory_size_gb = var.redis_memory_size_gb

  depends_on = [module.network]
}

# -----------------------------------------------------------------------------
# Storage Module (GCS Buckets with WORM compliance)
# -----------------------------------------------------------------------------
module "storage" {
  source = "./modules/storage"

  project_id            = var.project_id
  region                = var.region
  environment           = var.environment
  enable_bucket_lock    = var.enable_bucket_lock
  retention_period_days = var.retention_period_days

  depends_on = [google_project_service.required_apis]
}

# -----------------------------------------------------------------------------
# Pub/Sub Module (Event Bus)
# -----------------------------------------------------------------------------
module "pubsub" {
  source = "./modules/pubsub"

  project_id  = var.project_id
  environment = var.environment

  depends_on = [google_project_service.required_apis]
}

# -----------------------------------------------------------------------------
# IAM Module (Service Accounts & Permissions)
# -----------------------------------------------------------------------------
module "iam" {
  source = "./modules/iam"

  project_id  = var.project_id
  environment = var.environment

  depends_on = [google_project_service.required_apis]
}

# -----------------------------------------------------------------------------
# Secrets Module (Secret Manager)
# -----------------------------------------------------------------------------
module "secrets" {
  source = "./modules/secretmgr"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment

  # Grant access to service accounts
  api_service_account_email                 = module.iam.api_service_account_email
  ingestion_worker_service_account_email    = module.iam.ingestion_worker_service_account_email
  analysis_worker_service_account_email     = module.iam.analysis_worker_service_account_email
  vectorize_worker_service_account_email    = module.iam.vectorize_worker_service_account_email
  notification_worker_service_account_email = module.iam.notification_worker_service_account_email

  depends_on = [module.iam]
}

# -----------------------------------------------------------------------------
# Artifact Registry (Container Images)
# -----------------------------------------------------------------------------
resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "clausync-${var.environment}"
  description   = "Docker repository for Clausync.ai services"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.required_apis]
}

# -----------------------------------------------------------------------------
# Cloud Run Module (Serverless Services)
# -----------------------------------------------------------------------------
module "cloudrun" {
  source = "./modules/cloudrun"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment

  # Network configuration
  vpc_connector_id = module.network.vpc_connector_id

  # Container registry
  artifact_registry_url = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"

  # Service accounts
  api_service_account_email                 = module.iam.api_service_account_email
  ingestion_worker_service_account_email    = module.iam.ingestion_worker_service_account_email
  analysis_worker_service_account_email     = module.iam.analysis_worker_service_account_email
  vectorize_worker_service_account_email    = module.iam.vectorize_worker_service_account_email
  notification_worker_service_account_email = module.iam.notification_worker_service_account_email

  # Database connection
  database_connection_name = module.database.connection_name

  # Pub/Sub topics
  pubsub_topic_scrape    = module.pubsub.topic_scrape_url_name
  pubsub_topic_change    = module.pubsub.topic_change_detected_name
  pubsub_topic_notify    = module.pubsub.topic_send_notification_name
  pubsub_topic_vectorize = module.pubsub.topic_vectorize_doc_name

  # Storage buckets
  snapshots_bucket_name = module.storage.snapshots_bucket_name
  uploads_bucket_name   = module.storage.uploads_bucket_name

  # Redis (optional)
  redis_host = var.enable_redis ? module.cache[0].redis_host : ""
  redis_port = var.enable_redis ? module.cache[0].redis_port : 6379

  depends_on = [
    module.network,
    module.database,
    module.pubsub,
    module.storage,
    module.iam,
    module.secrets,
    google_artifact_registry_repository.containers
  ]
}

# -----------------------------------------------------------------------------
# Monitoring Module (Logging & Alerting)
# -----------------------------------------------------------------------------
module "monitoring" {
  source = "./modules/monitoring"

  project_id  = var.project_id
  environment = var.environment

  # Alert notification channel (optional - configure after deploy)
  notification_email = var.alert_notification_email

  depends_on = [module.cloudrun]
}
