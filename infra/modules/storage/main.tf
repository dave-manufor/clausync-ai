# =============================================================================
# Storage Module - GCS Buckets with WORM Compliance
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

variable "enable_bucket_lock" {
  type    = bool
  default = false
}

variable "retention_period_days" {
  type    = number
  default = 2557 # 7 years
}

# -----------------------------------------------------------------------------
# Snapshots Bucket (WORM - Write Once Read Many)
# Used for storing raw HTML snapshots as legal evidence
# -----------------------------------------------------------------------------
resource "google_storage_bucket" "snapshots" {
  name          = "clausync-snapshots-${var.environment}-${var.project_id}"
  location      = var.region
  project       = var.project_id
  force_destroy = var.environment != "prod" # Protect production

  # Uniform bucket-level access (recommended)
  uniform_bucket_level_access = true

  # Versioning for audit trail
  versioning {
    enabled = true
  }

  # Retention policy for compliance (WORM-like behavior)
  dynamic "retention_policy" {
    for_each = var.environment == "prod" ? [1] : []
    content {
      retention_period = var.retention_period_days * 24 * 60 * 60 # Convert to seconds
      is_locked        = var.enable_bucket_lock                   # WARNING: Irreversible!
    }
  }

  # Lifecycle rules for cost optimization
  lifecycle_rule {
    condition {
      age = 90 # After 90 days
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365 # After 1 year
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 730 # After 2 years
    }
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
  }

  labels = {
    environment = var.environment
    purpose     = "snapshots"
    compliance  = "worm"
  }
}

# -----------------------------------------------------------------------------
# Uploads Bucket (User Documents)
# Used for storing user-uploaded context documents (policies, MSAs)
# -----------------------------------------------------------------------------
resource "google_storage_bucket" "uploads" {
  name          = "clausync-uploads-${var.environment}-${var.project_id}"
  location      = var.region
  project       = var.project_id
  force_destroy = var.environment != "prod"

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  # Cleanup old versions after 30 days
  lifecycle_rule {
    condition {
      age        = 30
      with_state = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  # Move to nearline after 90 days (less frequently accessed)
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  # CORS for direct uploads from browser
  cors {
    origin          = var.environment == "prod" ? ["https://app.clausync.ai"] : ["*"]
    method          = ["GET", "HEAD", "PUT", "POST"]
    response_header = ["Content-Type", "Authorization"]
    max_age_seconds = 3600
  }

  labels = {
    environment = var.environment
    purpose     = "uploads"
  }
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "snapshots_bucket_name" {
  value = google_storage_bucket.snapshots.name
}

output "snapshots_bucket_url" {
  value = google_storage_bucket.snapshots.url
}

output "uploads_bucket_name" {
  value = google_storage_bucket.uploads.name
}

output "uploads_bucket_url" {
  value = google_storage_bucket.uploads.url
}

