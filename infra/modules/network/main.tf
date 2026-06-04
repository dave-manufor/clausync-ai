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
# Private Services Access (for Cloud SQL, Memorystore)
# -----------------------------------------------------------------------------
resource "google_compute_global_address" "private_ip_range" {
  name          = "clausync-private-ip-${var.environment}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# -----------------------------------------------------------------------------
# Serverless VPC Access Connector (for Cloud Run → Private Resources)
# -----------------------------------------------------------------------------
resource "google_vpc_access_connector" "serverless" {
  name    = "clausync-connector-${var.environment}"
  region  = var.region
  project = var.project_id

  subnet {
    name = google_compute_subnetwork.serverless.name
  }

  machine_type  = "e2-micro" # Smallest, ~$2-3/month when active
  min_instances = 2
  max_instances = 3
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

output "vpc_connector_id" {
  value = google_vpc_access_connector.serverless.id
}

output "private_ip_range_name" {
  value = google_compute_global_address.private_ip_range.name
}

output "serverless_subnet_name" {
  value = google_compute_subnetwork.serverless.name
}
