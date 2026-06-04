# =============================================================================
# Terraform Backend Configuration
# =============================================================================
# Uncomment and configure for production use with remote state

# terraform {
#   backend "gcs" {
#     bucket = "clausync-terraform-state"
#     prefix = "terraform/state"
#   }
# }

# For initial setup, run:
# 1. Create the state bucket:
#    gsutil mb -l us-central1 gs://clausync-terraform-state
#    gsutil versioning set on gs://clausync-terraform-state
#
# 2. Uncomment the backend block above
#
# 3. Initialize with:
#    terraform init -migrate-state
