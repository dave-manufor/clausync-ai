# =============================================================================
# Output Values
# =============================================================================
# These outputs are used by CI/CD pipelines and for reference

# -----------------------------------------------------------------------------
# Network Outputs
# -----------------------------------------------------------------------------
output "vpc_network_name" {
  description = "VPC Network name"
  value       = module.network.vpc_network_name
}




# -----------------------------------------------------------------------------
# Storage Outputs
# -----------------------------------------------------------------------------
output "snapshots_bucket_name" {
  description = "GCS bucket for HTML snapshots (WORM)"
  value       = module.storage.snapshots_bucket_name
}

output "uploads_bucket_name" {
  description = "GCS bucket for user-uploaded documents"
  value       = module.storage.uploads_bucket_name
}

# -----------------------------------------------------------------------------
# Pub/Sub Outputs
# -----------------------------------------------------------------------------
output "pubsub_topic_scrape_url" {
  description = "Pub/Sub topic for scrape commands"
  value       = module.pubsub.topic_scrape_url_name
}

output "pubsub_topic_change_detected" {
  description = "Pub/Sub topic for change detection events"
  value       = module.pubsub.topic_change_detected_name
}

output "pubsub_topic_send_notification" {
  description = "Pub/Sub topic for notification commands"
  value       = module.pubsub.topic_send_notification_name
}

output "pubsub_topic_vectorize_doc" {
  description = "Pub/Sub topic for vectorization commands"
  value       = module.pubsub.topic_vectorize_doc_name
}

# -----------------------------------------------------------------------------
# Cloud Run Outputs
# -----------------------------------------------------------------------------
output "api_service_url" {
  description = "API Gateway Cloud Run service URL"
  value       = module.cloudrun.api_service_url
}

output "ingestion_worker_service_url" {
  description = "Ingestion Worker Cloud Run service URL"
  value       = module.cloudrun.ingestion_worker_service_url
}

output "analysis_worker_service_url" {
  description = "Analysis Worker Cloud Run service URL"
  value       = module.cloudrun.analysis_worker_service_url
}

output "vectorize_worker_service_url" {
  description = "Vectorize Worker Cloud Run service URL"
  value       = module.cloudrun.vectorize_worker_service_url
}

output "notification_worker_service_url" {
  description = "Notification Worker Cloud Run service URL"
  value       = module.cloudrun.notification_worker_service_url
}

# -----------------------------------------------------------------------------
# Artifact Registry
# -----------------------------------------------------------------------------
output "artifact_registry_url" {
  description = "Docker registry URL for container images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"
}

# -----------------------------------------------------------------------------
# Service Account Emails (for CI/CD)
# -----------------------------------------------------------------------------
output "api_service_account_email" {
  description = "API service account email"
  value       = module.iam.api_service_account_email
}

output "ingestion_worker_service_account_email" {
  description = "Ingestion worker service account email"
  value       = module.iam.ingestion_worker_service_account_email
}

output "analysis_worker_service_account_email" {
  description = "Analysis worker service account email"
  value       = module.iam.analysis_worker_service_account_email
}
