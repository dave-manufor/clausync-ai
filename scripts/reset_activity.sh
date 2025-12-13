#!/bin/bash

# Tables to truncate (leaving users, organizations, api_keys, invitations alone)
TABLES="subscriptions, monitored_resources, audit_logs, notifications, change_events, resource_snapshots, user_context_embeddings, data_exports, deletion_requests, webhook_endpoints"

echo "WARNING: This will delete ALL activity data (monitors, changes, logs, etc.) from the local database."
echo "Users and Organizations will be PRESERVED."
echo "Tables to be truncated: $TABLES"
echo ""
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Resetting database activity..."
    docker compose exec postgres psql -U clausync -d clausync_db -c "TRUNCATE $TABLES CASCADE;"
    
    if [ $? -eq 0 ]; then
        echo "✅ Database activity reset successfully."
    else
        echo "❌ Failed to reset database."
    fi
else
    echo "Operation cancelled."
fi
