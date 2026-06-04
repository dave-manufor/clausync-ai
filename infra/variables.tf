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
