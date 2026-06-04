# =============================================================================
# Secret Manager Module
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

# -----------------------------------------------------------------------------
# Secrets Definition
# -----------------------------------------------------------------------------
locals {
  secret_configs = {
    database_url = {
      description = "PostgreSQL connection string"
      accessors = [
        var.api_service_account_email,
        var.ingestion_worker_service_account_email,
        var.analysis_worker_service_account_email,
        var.vectorize_worker_service_account_email,
        var.notification_worker_service_account_email,
      ]
    }
    redis_url = {
      description = "Redis connection string"
      accessors = [
        var.api_service_account_email,
        var.ingestion_worker_service_account_email,
      ]
    }
    resend_api_key = {
      description = "Resend API key for sending emails"
      accessors = [
        var.notification_worker_service_account_email,
      ]
    }
    brevo_api_key = {
      description = "Brevo API key for sending emails"
      accessors = [
        var.notification_worker_service_account_email,
      ]
    }
    proxy_host = {
      description = "Bright Data proxy host"
      accessors = [
        var.ingestion_worker_service_account_email,
      ]
    }
    proxy_user = {
      description = "Bright Data proxy username"
      accessors = [
        var.ingestion_worker_service_account_email,
      ]
    }
    proxy_pass = {
      description = "Bright Data proxy password"
      accessors = [
        var.ingestion_worker_service_account_email,
      ]
    }
  }
}

# -----------------------------------------------------------------------------
# Create Secrets
# -----------------------------------------------------------------------------
resource "google_secret_manager_secret" "main" {
  for_each = local.secret_configs

  secret_id = "clausync-${each.key}-${var.environment}"
  project   = var.project_id

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  labels = {
    environment = var.environment
    purpose     = each.key
  }
}

# -----------------------------------------------------------------------------
# Grant Access to Service Accounts
# -----------------------------------------------------------------------------
resource "google_secret_manager_secret_iam_member" "api_sa_access" {
  for_each  = toset(["database_url", "redis_url"])
  project   = var.project_id
  secret_id = google_secret_manager_secret.main[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_service_account_email}"
}

resource "google_secret_manager_secret_iam_member" "ingestion_worker_sa_access" {
  for_each  = toset(["database_url", "redis_url", "proxy_host", "proxy_user", "proxy_pass"])
  project   = var.project_id
  secret_id = google_secret_manager_secret.main[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.ingestion_worker_service_account_email}"
}

resource "google_secret_manager_secret_iam_member" "analysis_worker_sa_access" {
  for_each  = toset(["database_url"])
  project   = var.project_id
  secret_id = google_secret_manager_secret.main[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.analysis_worker_service_account_email}"
}

resource "google_secret_manager_secret_iam_member" "vectorize_worker_sa_access" {
  for_each  = toset(["database_url"])
  project   = var.project_id
  secret_id = google_secret_manager_secret.main[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.vectorize_worker_service_account_email}"
}

resource "google_secret_manager_secret_iam_member" "notification_worker_sa_access" {
  for_each  = toset(["database_url", "resend_api_key", "brevo_api_key"])
  project   = var.project_id
  secret_id = google_secret_manager_secret.main[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.notification_worker_service_account_email}"
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "database_url_secret_id" {
  value = google_secret_manager_secret.main["database_url"].secret_id
}

output "redis_url_secret_id" {
  value = google_secret_manager_secret.main["redis_url"].secret_id
}

output "resend_api_key_secret_id" {
  value = google_secret_manager_secret.main["resend_api_key"].secret_id
}

output "proxy_host_secret_id" {
  value = google_secret_manager_secret.main["proxy_host"].secret_id
}

output "proxy_user_secret_id" {
  value = google_secret_manager_secret.main["proxy_user"].secret_id
}

output "proxy_pass_secret_id" {
  value = google_secret_manager_secret.main["proxy_pass"].secret_id
}

output "brevo_api_key_secret_id" {
  value = google_secret_manager_secret.main["brevo_api_key"].secret_id
}
