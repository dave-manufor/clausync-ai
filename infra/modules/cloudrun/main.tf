# =============================================================================
# Cloud Run Module - Serverless Services
# =============================================================================

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "artifact_registry_url" {
  type = string
}

# Service Account Variables
variable "api_service_account_email" {
  type = string
}

variable "ingestion_worker_service_account_email" {
  type = string
}

variable "analysis_worker_service_account_email" {
  type = string
}

variable "vectorize_worker_service_account_email" {
  type = string
}

variable "notification_worker_service_account_email" {
  type = string
}

variable "database_url_secret_id" {
  type = string
}

# Pub/Sub Topics
variable "pubsub_topic_scrape" {
  type = string
}

variable "pubsub_topic_change" {
  type = string
}

variable "pubsub_topic_notify" {
  type = string
}

variable "pubsub_topic_vectorize" {
  type = string
}

# Storage
variable "snapshots_bucket_name" {
  type = string
}

variable "uploads_bucket_name" {
  type = string
}

variable "redis_url_secret_id" {
  type = string
}

# -----------------------------------------------------------------------------
# Local Configuration
# -----------------------------------------------------------------------------
locals {
  # Common environment variables for all services
  common_env = {
    GCP_PROJECT_ID = var.project_id
    GCP_REGION     = var.region
    ENVIRONMENT    = var.environment
  }

  # Service configurations
  services = {
    api = {
      name            = "clausync-api-${var.environment}"
      image           = "${var.artifact_registry_url}/api:latest"
      service_account = var.api_service_account_email
      memory          = "512Mi"
      cpu             = "1"
      min_instances   = 0
      max_instances   = 10
      timeout         = "60s"
      concurrency     = 80
      ingress         = "all" # Public API
      port            = 8080
      env = merge(local.common_env, {
        PUBSUB_TOPIC_SCRAPE = var.pubsub_topic_scrape
      })
      secret_env = {
        DATABASE_URL = var.database_url_secret_id
        REDIS_URL    = var.redis_url_secret_id
      }
    }
    ingestion_worker = {
      name            = "clausync-ingestion-${var.environment}"
      image           = "${var.artifact_registry_url}/ingestion-worker:latest"
      service_account = var.ingestion_worker_service_account_email
      memory          = "1Gi"
      cpu             = "1"
      min_instances   = 0
      max_instances   = 5
      timeout         = "300s" # 5 minutes for scraping
      concurrency     = 1      # Process one scrape at a time
      ingress         = "internal"
      port            = 8080
      env = merge(local.common_env, {
        GCS_BUCKET_NAME     = var.snapshots_bucket_name
        PUBSUB_TOPIC_CHANGE = var.pubsub_topic_change
      })
      secret_env = {
        DATABASE_URL = var.database_url_secret_id
        REDIS_URL    = var.redis_url_secret_id
      }
    }
    analysis_worker = {
      name            = "clausync-analysis-${var.environment}"
      image           = "${var.artifact_registry_url}/analysis-worker:latest"
      service_account = var.analysis_worker_service_account_email
      memory          = "1Gi"
      cpu             = "1"
      min_instances   = 0
      max_instances   = 3
      timeout         = "540s" # 9 minutes for AI analysis
      concurrency     = 1
      ingress         = "internal"
      port            = 8080
      env = merge(local.common_env, {
        GCS_BUCKET_NAME     = var.snapshots_bucket_name
        PUBSUB_TOPIC_NOTIFY = var.pubsub_topic_notify
      })
      secret_env = {
        DATABASE_URL = var.database_url_secret_id
      }
    }
    vectorize_worker = {
      name            = "clausync-vectorize-${var.environment}"
      image           = "${var.artifact_registry_url}/vectorize-worker:latest"
      service_account = var.vectorize_worker_service_account_email
      memory          = "512Mi"
      cpu             = "1"
      min_instances   = 0
      max_instances   = 2
      timeout         = "300s"
      concurrency     = 1
      ingress         = "internal"
      port            = 8080
      env = merge(local.common_env, {
        GCS_BUCKET_NAME = var.uploads_bucket_name
      })
      secret_env = {
        DATABASE_URL = var.database_url_secret_id
      }
    }
    notification_worker = {
      name            = "clausync-notify-${var.environment}"
      image           = "${var.artifact_registry_url}/notification-worker:latest"
      service_account = var.notification_worker_service_account_email
      memory          = "512Mi"
      cpu             = "1"
      min_instances   = 0
      max_instances   = 2
      timeout         = "60s"
      concurrency     = 10
      ingress         = "internal"
      port            = 8080
      env = merge(local.common_env, {
        DASHBOARD_URL = var.environment == "prod" ? "https://app.clausync.ai" : "https://app-${var.environment}.clausync.ai"
      })
      secret_env = {
        DATABASE_URL = var.database_url_secret_id
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Cloud Run Services
# -----------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "services" {
  for_each = local.services

  name     = each.value.name
  location = var.region
  project  = var.project_id

  ingress = each.value.ingress == "all" ? "INGRESS_TRAFFIC_ALL" : "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = each.value.service_account

    scaling {
      min_instance_count = each.value.min_instances
      max_instance_count = each.value.max_instances
    }

    timeout = each.value.timeout

    max_instance_request_concurrency = each.value.concurrency

    containers {
      image = each.value.image

      ports {
        container_port = each.value.port
      }

      resources {
        limits = {
          memory = each.value.memory
          cpu    = each.value.cpu
        }
      }

      # Environment variables
      dynamic "env" {
        for_each = each.value.env
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secrets
      dynamic "env" {
        for_each = lookup(each.value, "secret_env", {})
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      # Startup probe
      startup_probe {
        http_get {
          path = "/health"
          port = each.value.port
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      # Liveness probe
      liveness_probe {
        http_get {
          path = "/health"
          port = each.value.port
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }


  }

  labels = {
    environment = var.environment
    service     = each.key
  }
}

# -----------------------------------------------------------------------------
# IAM - Allow unauthenticated access to API only
# -----------------------------------------------------------------------------
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.services["api"].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Internal services need Pub/Sub invoker access
resource "google_cloud_run_v2_service_iam_member" "internal_invokers" {
  for_each = {
    ingestion_worker    = var.ingestion_worker_service_account_email
    analysis_worker     = var.analysis_worker_service_account_email
    vectorize_worker    = var.vectorize_worker_service_account_email
    notification_worker = var.notification_worker_service_account_email
  }

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.services[each.key].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${each.value}"
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "api_service_url" {
  value = google_cloud_run_v2_service.services["api"].uri
}

output "api_service_name" {
  value = google_cloud_run_v2_service.services["api"].name
}

output "ingestion_worker_service_url" {
  value = google_cloud_run_v2_service.services["ingestion_worker"].uri
}

output "analysis_worker_service_url" {
  value = google_cloud_run_v2_service.services["analysis_worker"].uri
}

output "vectorize_worker_service_url" {
  value = google_cloud_run_v2_service.services["vectorize_worker"].uri
}

output "notification_worker_service_url" {
  value = google_cloud_run_v2_service.services["notification_worker"].uri
}

# -----------------------------------------------------------------------------
# Push Subscriptions
# -----------------------------------------------------------------------------
resource "google_pubsub_subscription" "push_subscriptions" {
  for_each = {
    ingestion_worker = {
      topic = var.pubsub_topic_scrape
      url   = google_cloud_run_v2_service.services["ingestion_worker"].uri
      dlq   = var.pubsub_topic_scrape_dlq_id
      sa    = var.ingestion_worker_service_account_email
    }
    analysis_worker = {
      topic = var.pubsub_topic_change
      url   = google_cloud_run_v2_service.services["analysis_worker"].uri
      dlq   = var.pubsub_topic_change_dlq_id
      sa    = var.analysis_worker_service_account_email
    }
    vectorize_worker = {
      topic = var.pubsub_topic_vectorize
      url   = google_cloud_run_v2_service.services["vectorize_worker"].uri
      dlq   = var.pubsub_topic_vectorize_dlq_id
      sa    = var.vectorize_worker_service_account_email
    }
    notification_worker = {
      topic = var.pubsub_topic_notify
      url   = google_cloud_run_v2_service.services["notification_worker"].uri
      dlq   = var.pubsub_topic_notify_dlq_id
      sa    = var.notification_worker_service_account_email
    }
  }

  name    = "${each.value.topic}-sub"
  topic   = each.value.topic
  project = var.project_id

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"

  push_config {
    push_endpoint = each.value.url
    oidc_token {
      service_account_email = each.value.sa
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = each.value.dlq
    max_delivery_attempts = 5
  }

  expiration_policy {
    ttl = ""
  }

  labels = {
    environment = var.environment
    service     = each.key
  }
}
