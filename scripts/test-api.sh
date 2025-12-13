#!/bin/bash

# Clausync API Test Script
# Tests the API endpoints and infrastructure services

set -e

API_URL="${API_URL:-http://localhost:8080}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================="
echo "  Clausync API Test Suite"
echo "============================================="
echo ""

# Helper function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local data="$5"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" 2>/dev/null)
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $name (HTTP $status_code)"
        return 0
    else
        echo -e "${RED}✗${NC} $name - Expected $expected_status, got $status_code"
        echo "  Response: $body"
        return 1
    fi
}

# 1. Infrastructure Tests
echo -e "${YELLOW}1. Infrastructure Services${NC}"
echo "-------------------------------------------"

# Test Redis
if docker exec clausync-ai-redis-1 redis-cli ping | grep -q "PONG" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Redis is healthy"
else
    echo -e "${RED}✗${NC} Redis connection failed"
fi

# Test Postgres
if docker exec clausync-ai-postgres-1 pg_isready -U clausync 2>/dev/null | grep -q "accepting"; then
    echo -e "${GREEN}✓${NC} PostgreSQL is healthy"
else
    echo -e "${RED}✗${NC} PostgreSQL connection failed"
fi

# Test Pub/Sub Emulator
if curl -s http://localhost:8085/v1/projects/clausync-dev/topics 2>/dev/null | grep -q "topics"; then
    echo -e "${GREEN}✓${NC} Pub/Sub Emulator is healthy"
else
    echo -e "${RED}✗${NC} Pub/Sub Emulator connection failed"
fi

echo ""

# 2. API Health Check
echo -e "${YELLOW}2. API Health Check${NC}"
echo "-------------------------------------------"
test_endpoint "Health endpoint" "GET" "/health" "200"
echo ""

# 3. API Endpoints (without auth)
echo -e "${YELLOW}3. API Endpoints (Unauthenticated)${NC}"
echo "-------------------------------------------"
test_endpoint "GET /monitors (should require auth)" "GET" "/monitors" "401" || true
test_endpoint "GET /changes (should require auth)" "GET" "/changes" "401" || true
echo ""

# 4. Create Mock Auth Test (if test mode enabled)
echo -e "${YELLOW}4. Database Schema Check${NC}"
echo "-------------------------------------------"

tables=$(docker exec clausync-ai-postgres-1 psql -U clausync -d clausync -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

expected_tables=("users" "resources" "subscriptions" "snapshots" "change_events" "notifications" "user_policies" "audit_logs")
for table in "${expected_tables[@]}"; do
    if echo "$tables" | grep -q "^${table}$"; then
        echo -e "${GREEN}✓${NC} Table '$table' exists"
    else
        echo -e "${YELLOW}○${NC} Table '$table' not found (run migrations)"
    fi
done

echo ""

# 5. Summary
echo "============================================="
echo -e "${YELLOW}Test Summary${NC}"
echo "============================================="
echo ""
echo "API URL: $API_URL"
echo ""
echo "To test with authentication, you'll need to:"
echo "1. Set up GCP Identity Platform"
echo "2. Get a Firebase ID token"
echo "3. Pass it as: Authorization: Bearer <token>"
echo ""
echo "Example authenticated request:"
echo "  curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "       $API_URL/api/monitors"
echo ""
