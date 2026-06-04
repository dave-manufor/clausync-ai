# =============================================================================
# Pub/Sub Module - Event Bus for Microservices
# =============================================================================

variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

locals {
  # Topic configurations
  topics = {
    scrape_url = {
      name        = "cmd.scrape_url"
      description = "Commands to trigger URL scraping"
    }
    change_detected = {
      name        = "event.change_detected"
      description = "Events when URL content changes are detected"
    }
    send_notification = {
      name        = "cmd.send_notification"
      description = "Commands to send user notifications"
    }
    vectorize_doc = {
      name        = "cmd.vectorize_doc"
      description = "Commands to vectorize user documents"
    }
  }
}

# -----------------------------------------------------------------------------
# Topics
# -----------------------------------------------------------------------------
resource "google_pubsub_topic" "topics" {
  for_each = local.topics

  name    = "${each.value.name}-${var.environment}"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days

  labels = {
    environment = var.environment
    purpose     = each.key
  }
}

# -----------------------------------------------------------------------------
# Dead Letter Topics (for failed messages)
# -----------------------------------------------------------------------------
resource "google_pubsub_topic" "dlq" {
  for_each = local.topics

  name    = "${each.value.name}-dlq-${var.environment}"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days

  labels = {
    environment = var.environment
    purpose     = "${each.key}-dlq"
  }
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "topic_scrape_url_name" {
  value = google_pubsub_topic.topics["scrape_url"].name
}

output "topic_scrape_url_id" {
  value = google_pubsub_topic.topics["scrape_url"].id
}

output "topic_change_detected_name" {
  value = google_pubsub_topic.topics["change_detected"].name
}

output "topic_change_detected_id" {
  value = google_pubsub_topic.topics["change_detected"].id
}

output "topic_send_notification_name" {
  value = google_pubsub_topic.topics["send_notification"].name
}

output "topic_send_notification_id" {
  value = google_pubsub_topic.topics["send_notification"].id
}

output "topic_vectorize_doc_name" {
  value = google_pubsub_topic.topics["vectorize_doc"].name
}

output "topic_vectorize_doc_id" {
  value = google_pubsub_topic.topics["vectorize_doc"].id
}
# -----------------------------------------------------------------------------
# DLQ Subscriptions (for monitoring failed messages)
# -----------------------------------------------------------------------------
resource "google_pubsub_subscription" "dlq_subscriptions" {
  for_each = local.topics

  name    = "${each.value.name}-dlq-sub-${var.environment}"
  topic   = google_pubsub_topic.dlq[each.key].name
  project = var.project_id

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"

  labels = {
    environment = var.environment
    purpose     = "${each.key}-dlq"
  }
}

output "topic_scrape_url_dlq_id" {
  value = google_pubsub_topic.dlq["scrape_url"].id
}
output "topic_change_detected_dlq_id" {
  value = google_pubsub_topic.dlq["change_detected"].id
}
output "topic_send_notification_dlq_id" {
  value = google_pubsub_topic.dlq["send_notification"].id
}
output "topic_vectorize_doc_dlq_id" {
  value = google_pubsub_topic.dlq["vectorize_doc"].id
}
