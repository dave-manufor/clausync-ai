# =============================================================================
# Cache Module - Cloud Memorystore Redis
# =============================================================================
# Used for distributed locking (deduplication) and rate limiting

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_network_id" {
  type = string
}

variable "memory_size_gb" {
  type    = number
  default = 1
}

# -----------------------------------------------------------------------------
# Redis Instance
# -----------------------------------------------------------------------------
resource "google_redis_instance" "main" {
  name           = "clausync-redis-${var.environment}"
  tier           = "BASIC" # BASIC for MVP, STANDARD_HA for production
  memory_size_gb = var.memory_size_gb
  region         = var.region
  project        = var.project_id

  authorized_network = var.vpc_network_id

  redis_version = "REDIS_7_0"

  # Maintenance window
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
      }
    }
  }

  labels = {
    environment = var.environment
    service     = "clausync"
  }
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "redis_host" {
  value = google_redis_instance.main.host
}

output "redis_port" {
  value = google_redis_instance.main.port
}

output "redis_instance_name" {
  value = google_redis_instance.main.name
}
