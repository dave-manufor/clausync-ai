# =============================================================================
# Network Module - VPC, Subnets, and Serverless Connector
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

# -----------------------------------------------------------------------------
# VPC Network
# -----------------------------------------------------------------------------
resource "google_compute_network" "main" {
  name                    = "clausync-vpc-${var.environment}"
  auto_create_subnetworks = false
  project                 = var.project_id
}

# -----------------------------------------------------------------------------
# Subnet for Cloud Run VPC Connector
# -----------------------------------------------------------------------------
resource "google_compute_subnetwork" "serverless" {
  name          = "clausync-serverless-${var.environment}"
  ip_cidr_range = "10.8.0.0/28"
  region        = var.region
  network       = google_compute_network.main.id
  project       = var.project_id

  private_ip_google_access = true
}



# -----------------------------------------------------------------------------
# Firewall Rules
# -----------------------------------------------------------------------------
# Allow internal communication
resource "google_compute_firewall" "allow_internal" {
  name    = "clausync-allow-internal-${var.environment}"
  network = google_compute_network.main.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
}

# Allow health checks from Google
resource "google_compute_firewall" "allow_health_checks" {
  name    = "clausync-allow-health-checks-${var.environment}"
  network = google_compute_network.main.name
  project = var.project_id

  allow {
    protocol = "tcp"
  }

  source_ranges = [
    "35.191.0.0/16", # Google health check sources
    "130.211.0.0/22"
  ]
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "vpc_network_id" {
  value = google_compute_network.main.id
}

output "vpc_network_name" {
  value = google_compute_network.main.name
}


