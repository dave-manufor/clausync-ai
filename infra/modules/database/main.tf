# =============================================================================
# Database Module - Cloud SQL PostgreSQL with pgvector
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

variable "vpc_network_id" {
  type = string
}

variable "private_ip_range_name" {
  type = string
}

variable "database_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "enable_ha" {
  type    = bool
  default = false
}

variable "deletion_protection" {
  type    = bool
  default = true
}

# -----------------------------------------------------------------------------
# Cloud SQL Instance
# -----------------------------------------------------------------------------
resource "google_sql_database_instance" "main" {
  name             = "clausync-db-${var.environment}"
  database_version = "POSTGRES_16"
  region           = var.region
  project          = var.project_id

  deletion_protection = var.deletion_protection

  settings {
    tier              = var.database_tier
    availability_type = var.enable_ha ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    disk_size         = 10 # GB, minimum
    disk_type         = "PD_SSD"

    # Private IP configuration
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.vpc_network_id
      enable_private_path_for_google_cloud_services = true
    }

    # Backup configuration (SOC 2 compliance)
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00" # 3 AM UTC
      point_in_time_recovery_enabled = true    # 1-hour RPO
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    # Database flags for pgvector and performance
    database_flags {
      name  = "cloudsql.enable_pgvector"
      value = "on"
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000" # Log queries over 1 second
    }

    # Maintenance window
    maintenance_window {
      day          = 7 # Sunday
      hour         = 4 # 4 AM UTC
      update_track = "stable"
    }

    # Insights for query analysis
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false # Privacy
    }
  }
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
resource "google_sql_database" "main" {
  name     = "clausync_db"
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

# -----------------------------------------------------------------------------
# Database User
# -----------------------------------------------------------------------------
resource "random_password" "db_password" {
  length  = 32
  special = false # Cloud SQL has issues with some special chars
}

resource "google_sql_user" "main" {
  name     = "clausync"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
  project  = var.project_id
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "private_ip_address" {
  value     = google_sql_database_instance.main.private_ip_address
  sensitive = true
}

output "database_name" {
  value = google_sql_database.main.name
}

output "database_user" {
  value = google_sql_user.main.name
}

output "database_password" {
  value     = random_password.db_password.result
  sensitive = true
}
