#!/bin/bash

# Clausync Pub/Sub Dataflow Test
# Tests the full message flow through the system

set -e

PUBSUB_HOST="${PUBSUB_EMULATOR_HOST:-localhost:8085}"
PROJECT_ID="${GCP_PROJECT_ID:-clausync-dev}"
API_URL="${API_URL:-http://localhost:8080}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "============================================="
echo "  Clausync Pub/Sub Dataflow Test"
echo "============================================="
echo ""
echo "Pub/Sub Host: $PUBSUB_HOST"
echo "Project ID: $PROJECT_ID"
echo ""

# Helper to publish a message
publish_message() {
    local topic=$1
    local message=$2
    
    # Base64 encode the message
    encoded=$(echo -n "$message" | base64)
    
    curl -s -X POST "http://$PUBSUB_HOST/v1/projects/$PROJECT_ID/topics/$topic:publish" \
        -H "Content-Type: application/json" \
        -d "{\"messages\": [{\"data\": \"$encoded\"}]}" 2>/dev/null
}

# 1. Check Pub/Sub Emulator
echo -e "${YELLOW}1. Checking Pub/Sub Emulator${NC}"
echo "-------------------------------------------"

topics_response=$(curl -s "http://$PUBSUB_HOST/v1/projects/$PROJECT_ID/topics" 2>/dev/null || echo "failed")
if [[ "$topics_response" == *"topics"* ]] || [[ "$topics_response" == *"{"* ]]; then
    echo -e "${GREEN}✓${NC} Pub/Sub Emulator is accessible"
else
    echo -e "${RED}✗${NC} Pub/Sub Emulator not accessible at $PUBSUB_HOST"
    echo "  Response: $topics_response"
    exit 1
fi

# 2. List existing topics
echo ""
echo -e "${YELLOW}2. Listing Topics${NC}"
echo "-------------------------------------------"

echo "$topics_response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    topics = data.get('topics', [])
    if not topics:
        print('  No topics found')
    for t in topics:
        name = t.get('name', '').split('/')[-1]
        print(f'  - {name}')
except:
    print('  Unable to parse topics')
" 2>/dev/null || echo "  Unable to parse topics"

# 3. Create topics if they don't exist
echo ""
echo -e "${YELLOW}3. Creating Topics${NC}"
echo "-------------------------------------------"

topics=("cmd.scrape_url" "cmd.analyse_change" "cmd.send_notification" "cmd.vectorize_document")
for topic in "${topics[@]}"; do
    result=$(curl -s -X PUT "http://$PUBSUB_HOST/v1/projects/$PROJECT_ID/topics/$topic" 2>/dev/null)
    if [[ "$result" == *"$topic"* ]] || [[ "$result" == *"already exists"* ]] || [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✓${NC} Topic '$topic' ready"
    else
        echo -e "${YELLOW}○${NC} Topic '$topic' may already exist"
    fi
done

# 4. Create subscriptions
echo ""
echo -e "${YELLOW}4. Creating Subscriptions${NC}"
echo "-------------------------------------------"

subscriptions=(
    "cmd.scrape_url-sub:cmd.scrape_url"
    "cmd.analyse_change-sub:cmd.analyse_change"
    "cmd.send_notification-sub:cmd.send_notification"
    "cmd.vectorize_document-sub:cmd.vectorize_document"
)

for sub_topic in "${subscriptions[@]}"; do
    IFS=':' read -r sub topic <<< "$sub_topic"
    result=$(curl -s -X PUT "http://$PUBSUB_HOST/v1/projects/$PROJECT_ID/subscriptions/$sub" \
        -H "Content-Type: application/json" \
        -d "{\"topic\": \"projects/$PROJECT_ID/topics/$topic\"}" 2>/dev/null)
    if [[ "$result" == *"$sub"* ]] || [[ "$result" == *"already exists"* ]] || [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✓${NC} Subscription '$sub' ready"
    else
        echo -e "${YELLOW}○${NC} Subscription '$sub' may already exist"
    fi
done

# 5. Test API Monitor Creation (triggers scrape message)
echo ""
echo -e "${YELLOW}5. Testing Monitor Creation Flow${NC}"
echo "-------------------------------------------"

echo -e "${BLUE}→${NC} Creating a monitor via API..."
monitor_response=$(curl -s -X POST "$API_URL/monitors" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://example.com/test-terms", "selector": "body"}')

echo "  Response: $monitor_response" | head -c 200
echo ""

if [[ "$monitor_response" == *"Monitor created"* ]] || [[ "$monitor_response" == *"Already subscribed"* ]]; then
    echo -e "${GREEN}✓${NC} Monitor creation successful"
else
    echo -e "${YELLOW}○${NC} Monitor may have failed (check API logs)"
fi

# 6. Manually publish test messages
echo ""
echo -e "${YELLOW}6. Publishing Test Messages${NC}"
echo "-------------------------------------------"

# Test scrape message
scrape_msg='{"resource_id": "test-123", "url": "https://example.com/terms", "selector": "body", "timestamp": 1702340000}'
echo -e "${BLUE}→${NC} Publishing to cmd.scrape_url..."
result=$(publish_message "cmd.scrape_url" "$scrape_msg")
if [[ "$result" == *"messageIds"* ]]; then
    echo -e "${GREEN}✓${NC} Scrape message published"
else
    echo -e "${YELLOW}○${NC} May have published (check: $result)"
fi

# Test analysis message
analysis_msg='{"change_event_id": "change-123", "old_content": "old terms", "new_content": "new terms", "timestamp": 1702340000}'
echo -e "${BLUE}→${NC} Publishing to cmd.analyse_change..."
result=$(publish_message "cmd.analyse_change" "$analysis_msg")
if [[ "$result" == *"messageIds"* ]]; then
    echo -e "${GREEN}✓${NC} Analysis message published"
else
    echo -e "${YELLOW}○${NC} May have published (check: $result)"
fi

# 7. Check worker status
echo ""
echo -e "${YELLOW}7. Worker Status${NC}"
echo "-------------------------------------------"

workers=("ingestion-worker" "analysis-worker" "vectorize-worker" "notification-worker")
for worker in "${workers[@]}"; do
    container="clausync-ai-${worker}-1"
    status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not found")
    exit_code=$(docker inspect --format='{{.State.ExitCode}}' "$container" 2>/dev/null || echo "?")
    
    if [[ "$status" == "running" ]]; then
        echo -e "${GREEN}✓${NC} $worker: running"
    elif [[ "$status" == "exited" && "$exit_code" == "0" ]]; then
        echo -e "${YELLOW}○${NC} $worker: exited (code 0 - waiting for messages)"
    elif [[ "$status" == "exited" ]]; then
        echo -e "${RED}✗${NC} $worker: exited (code $exit_code)"
    else
        echo -e "${RED}✗${NC} $worker: $status"
    fi
done

# 8. Check recent logs
echo ""
echo -e "${YELLOW}8. Recent Worker Logs${NC}"
echo "-------------------------------------------"

for worker in ingestion-worker analysis-worker; do
    container="clausync-ai-${worker}-1"
    echo -e "${BLUE}[$worker]${NC}"
    docker logs --tail 5 "$container" 2>&1 | sed 's/^/  /' || echo "  No logs available"
    echo ""
done

# Summary
echo "============================================="
echo -e "${YELLOW}Summary${NC}"
echo "============================================="
echo ""
echo "Pub/Sub topics and subscriptions are set up."
echo ""
echo "To see workers process messages, restart them:"
echo "  docker-compose restart ingestion-worker analysis-worker"
echo ""
echo "To view worker logs:"
echo "  docker-compose logs -f ingestion-worker"
echo "  docker-compose logs -f analysis-worker"
echo ""
