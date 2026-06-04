# =============================================================================
# Input Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region (e.g., us-central1, europe-west1)"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------
variable "database_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
  # Dev: db-f1-micro (~$10-15/month, shared core)
  # Prod: db-custom-1-3840 (~$30-40/month, 1 vCPU, 3.75GB RAM)
}

variable "enable_ha_database" {
  description = "Enable High Availability for Cloud SQL (production only)"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Cache Configuration (Optional)
# -----------------------------------------------------------------------------
variable "enable_redis" {
  description = "Enable Cloud Memorystore Redis (adds ~$35/month)"
  type        = bool
  default     = false
}

variable "redis_memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Storage Configuration
# -----------------------------------------------------------------------------
variable "enable_bucket_lock" {
  description = "Enable WORM bucket lock (WARNING: This is IRREVERSIBLE)"
  type        = bool
  default     = false
}

variable "retention_period_days" {
  description = "Retention period for snapshots bucket (in days, 7 years = 2557)"
  type        = number
  default     = 2557 # 7 years for SOC 2 / GDPR compliance
}

# -----------------------------------------------------------------------------
# Monitoring Configuration
# -----------------------------------------------------------------------------
variable "alert_notification_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = ""
}
