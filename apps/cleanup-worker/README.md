# Cleanup Worker

Python worker that runs scheduled cleanup of soft-deleted records.

## Features
- Hard deletes records past retention period (30 days)
- Cleans up GCS snapshots for deleted resources
- Maintains audit trail of all deletions
