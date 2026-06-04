# =============================================================================
# Monitoring Module - Logging and Alerting
# =============================================================================

variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "notification_email" {
  type    = string
  default = ""
}

# -----------------------------------------------------------------------------
# Notification Channel (Email)
# -----------------------------------------------------------------------------
resource "google_monitoring_notification_channel" "email" {
  count = var.notification_email != "" ? 1 : 0

  display_name = "Clausync Alerts - ${var.environment}"
  type         = "email"
  project      = var.project_id

  labels = {
    email_address = var.notification_email
  }
}

# -----------------------------------------------------------------------------
# Log-based Metrics
# -----------------------------------------------------------------------------

# Scraper failure metric
resource "google_logging_metric" "scraper_failures" {
  name    = "clausync-scraper-failures-${var.environment}"
  project = var.project_id

  filter = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name=~"clausync-ingestion-.*"
    severity>=ERROR
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

# API error metric
resource "google_logging_metric" "api_errors" {
  name    = "clausync-api-errors-${var.environment}"
  project = var.project_id

  filter = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name=~"clausync-api-.*"
    severity>=ERROR
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

# -----------------------------------------------------------------------------
# Alert Policies
# -----------------------------------------------------------------------------

# High API error rate
resource "google_monitoring_alert_policy" "api_error_rate" {
  count = var.notification_email != "" ? 1 : 0

  display_name = "Clausync API Error Rate High - ${var.environment}"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "API error rate > 5%"

    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.api_errors.name}\" resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10 # More than 10 errors in 5 minutes

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].id]

  alert_strategy {
    auto_close = "1800s" # Auto-close after 30 minutes
  }

  documentation {
    content   = "The Clausync API is experiencing a high error rate. Check Cloud Logging for details."
    mime_type = "text/markdown"
  }
}

# Scraper failure alert
resource "google_monitoring_alert_policy" "scraper_failures" {
  count = var.notification_email != "" ? 1 : 0

  display_name = "Clausync Scraper Failures - ${var.environment}"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Scraper errors detected"

    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.scraper_failures.name}\" resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5 # More than 5 failures in 5 minutes

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].id]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "The Clausync ingestion worker is experiencing failures. This may indicate proxy issues or blocked URLs."
    mime_type = "text/markdown"
  }
}

# Pub/Sub unacked messages (message backlog)
resource "google_monitoring_alert_policy" "pubsub_backlog" {
  count = var.notification_email != "" ? 1 : 0

  display_name = "Clausync Pub/Sub Message Backlog - ${var.environment}"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Oldest unacked message > 10 minutes"

    condition_threshold {
      filter          = "metric.type=\"pubsub.googleapis.com/subscription/oldest_unacked_message_age\" resource.type=\"pubsub_subscription\" resource.labels.subscription_id=monitoring.regex.full_match(\".*${var.environment}.*\")"
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 600 # 10 minutes in seconds

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].id]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "Pub/Sub messages are not being processed. Workers may be down or overwhelmed."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# Uptime Check for API
# -----------------------------------------------------------------------------
resource "google_monitoring_uptime_check_config" "api_health" {
  count = var.environment == "prod" ? 1 : 0

  display_name = "Clausync API Health - ${var.environment}"
  project      = var.project_id
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "api.clausync.ai" # Update with actual domain
    }
  }
}

# -----------------------------------------------------------------------------
# Log Sink for Audit Logs (SOC 2 compliance)
# -----------------------------------------------------------------------------
resource "google_storage_bucket" "audit_logs" {
  count = var.environment == "prod" ? 1 : 0

  name          = "clausync-audit-logs-${var.project_id}"
  location      = "US"
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  # Retain audit logs for 7 years
  retention_policy {
    retention_period = 2557 * 24 * 60 * 60 # 7 years in seconds
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }
}

resource "google_logging_project_sink" "audit_sink" {
  count = var.environment == "prod" ? 1 : 0

  name        = "clausync-audit-sink-${var.environment}"
  project     = var.project_id
  destination = "storage.googleapis.com/${google_storage_bucket.audit_logs[0].name}"

  # Capture all write operations
  filter = <<-EOT
    protoPayload.methodName=~"(create|update|delete|insert|patch)"
    OR protoPayload.@type="type.googleapis.com/google.cloud.audit.AuditLog"
  EOT

  unique_writer_identity = true
}

# Grant sink permission to write to bucket
resource "google_storage_bucket_iam_member" "audit_sink_writer" {
  count = var.environment == "prod" ? 1 : 0

  bucket = google_storage_bucket.audit_logs[0].name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.audit_sink[0].writer_identity
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "notification_channel_id" {
  value = var.notification_email != "" ? google_monitoring_notification_channel.email[0].id : null
}

output "audit_logs_bucket_name" {
  value = var.environment == "prod" ? google_storage_bucket.audit_logs[0].name : null
}
