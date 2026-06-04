# =============================================================================
# IAM Module - Service Accounts and Permissions
# =============================================================================
# Implements least-privilege access for each service

variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

# -----------------------------------------------------------------------------
# API Gateway Service Account
# -----------------------------------------------------------------------------
resource "google_service_account" "api" {
  account_id   = "clausync-api-${var.environment}"
  display_name = "Clausync API Gateway"
  description  = "Service account for the API Gateway Cloud Run service"
  project      = var.project_id
}

resource "google_project_iam_member" "api_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# -----------------------------------------------------------------------------
# Ingestion Worker Service Account
# -----------------------------------------------------------------------------
resource "google_service_account" "ingestion_worker" {
  account_id   = "clausync-ingestion-${var.environment}"
  display_name = "Clausync Ingestion Worker"
  description  = "Service account for the Ingestion Worker (scraper)"
  project      = var.project_id
}

resource "google_project_iam_member" "ingestion_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.ingestion_worker.email}"
}

resource "google_project_iam_member" "ingestion_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.ingestion_worker.email}"
}

resource "google_project_iam_member" "ingestion_storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.ingestion_worker.email}"
}

resource "google_project_iam_member" "ingestion_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.ingestion_worker.email}"
}

# -----------------------------------------------------------------------------
# Analysis Worker Service Account
# -----------------------------------------------------------------------------
resource "google_service_account" "analysis_worker" {
  account_id   = "clausync-analysis-${var.environment}"
  display_name = "Clausync Analysis Worker"
  description  = "Service account for the Analysis Worker (AI)"
  project      = var.project_id
}

resource "google_project_iam_member" "analysis_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.analysis_worker.email}"
}

resource "google_project_iam_member" "analysis_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.analysis_worker.email}"
}

resource "google_project_iam_member" "analysis_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.analysis_worker.email}"
}

resource "google_project_iam_member" "analysis_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.analysis_worker.email}"
}

resource "google_project_iam_member" "analysis_vertex_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.analysis_worker.email}"
}

# -----------------------------------------------------------------------------
# Vectorize Worker Service Account
# -----------------------------------------------------------------------------
resource "google_service_account" "vectorize_worker" {
  account_id   = "clausync-vectorize-${var.environment}"
  display_name = "Clausync Vectorize Worker"
  description  = "Service account for the Vectorize Worker (embeddings)"
  project      = var.project_id
}

resource "google_project_iam_member" "vectorize_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.vectorize_worker.email}"
}

resource "google_project_iam_member" "vectorize_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.vectorize_worker.email}"
}

resource "google_project_iam_member" "vectorize_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.vectorize_worker.email}"
}

resource "google_project_iam_member" "vectorize_vertex_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.vectorize_worker.email}"
}

# -----------------------------------------------------------------------------
# Notification Worker Service Account
# -----------------------------------------------------------------------------
resource "google_service_account" "notification_worker" {
  account_id   = "clausync-notify-${var.environment}"
  display_name = "Clausync Notification Worker"
  description  = "Service account for the Notification Worker (email/webhooks)"
  project      = var.project_id
}

resource "google_project_iam_member" "notification_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.notification_worker.email}"
}

resource "google_project_iam_member" "notification_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.notification_worker.email}"
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "api_service_account_email" {
  value = google_service_account.api.email
}

output "api_service_account_name" {
  value = google_service_account.api.name
}

output "ingestion_worker_service_account_email" {
  value = google_service_account.ingestion_worker.email
}

output "ingestion_worker_service_account_name" {
  value = google_service_account.ingestion_worker.name
}

output "analysis_worker_service_account_email" {
  value = google_service_account.analysis_worker.email
}

output "analysis_worker_service_account_name" {
  value = google_service_account.analysis_worker.name
}

output "vectorize_worker_service_account_email" {
  value = google_service_account.vectorize_worker.email
}

output "vectorize_worker_service_account_name" {
  value = google_service_account.vectorize_worker.name
}

output "notification_worker_service_account_email" {
  value = google_service_account.notification_worker.email
}

output "notification_worker_service_account_name" {
  value = google_service_account.notification_worker.name
}
