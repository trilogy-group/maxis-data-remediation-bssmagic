#!/bin/bash
# =============================================================================
# BSS Magic - TMF API CRUD Test Script (T1)
# =============================================================================
# Tests BatchJob, BatchSchedule, and SolutionManagement endpoints
# against the live production TMF Runtime.
#
# Usage: ./test_tmf_api.sh [--skip-solution]
#   --skip-solution  Skip SolutionManagement tests (requires Salesforce)
#
# Prerequisites:
#   - Views must be applied (batchJob.sql, rest_foreign_tables.sql)
#   - ALB must be accessible
# =============================================================================

set -euo pipefail

# Configuration
ALB_URL="http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com"
API_KEY="bssmagic-d58d6761265b01accc13e8b21bae8282"
BATCH_API="$ALB_URL/tmf-api/batchProcessing/v1"
SOL_API="$ALB_URL/tmf-api/solutionManagement/v5"

# Known Salesforce solution ID for testing (in DETECTED state)
TEST_SOLUTION_ID="a246D000000pYfbQAE"

# Parse args
SKIP_SOLUTION=false
for arg in "$@"; do
    case $arg in
        --skip-solution) SKIP_SOLUTION=true ;;
    esac
done

# Counters
PASS=0
FAIL=0
SKIP=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_test() {
    echo -e "\n${CYAN}━━━ TEST: $1 ━━━${NC}"
}

log_pass() {
    echo -e "  ${GREEN}PASS${NC}: $1"
    PASS=$((PASS + 1))
}

log_fail() {
    echo -e "  ${RED}FAIL${NC}: $1"
    FAIL=$((FAIL + 1))
}

log_skip() {
    echo -e "  ${YELLOW}SKIP${NC}: $1"
    SKIP=$((SKIP + 1))
}

# Make API call and capture both status code and body
api_call() {
    local method="$1"
    local url="$2"
    local data="${3:-}"
    
    local tmpfile=$(mktemp)
    local status
    
    if [ -n "$data" ]; then
        status=$(curl -s -w "%{http_code}" -o "$tmpfile" \
            -X "$method" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            "$url" \
            -d "$data" 2>/dev/null)
    else
        status=$(curl -s -w "%{http_code}" -o "$tmpfile" \
            -X "$method" \
            -H "X-API-Key: $API_KEY" \
            "$url" 2>/dev/null)
    fi
    
    local body=$(cat "$tmpfile")
    rm -f "$tmpfile"
    
    echo "$status"
    echo "$body"
}

# Extract field from JSON (simple grep-based, no jq dependency)
json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field',''))" 2>/dev/null || echo ""
}

# Check if response is an array
json_is_array() {
    local json="$1"
    echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('true' if isinstance(d,list) else 'false')" 2>/dev/null || echo "false"
}

# =============================================================================
echo -e "\n${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       BSS Magic - TMF API CRUD Tests (T1)                    ║${NC}"
echo -e "${CYAN}║       BatchJob + BatchSchedule + SolutionManagement          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "ALB: $ALB_URL"
echo "Batch API: $BATCH_API"
echo "Solution API: $SOL_API"
echo "Skip SolutionManagement: $SKIP_SOLUTION"

# =============================================================================
# SECTION 1: BatchSchedule CRUD
# =============================================================================
echo -e "\n${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SECTION 1: BatchSchedule CRUD${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"

# --- T1.1: GET /batchSchedule (list) ---
log_test "GET /batchSchedule (list)"
result=$(api_call GET "$BATCH_API/batchSchedule")
status=$(echo "$result" | head -1)
body=$(echo "$result" | tail -n +2)

if [ "$status" = "200" ]; then
    is_array=$(json_is_array "$body")
    if [ "$is_array" = "true" ]; then
        log_pass "Returns 200 with array (OAS fix confirmed)"
    else
        log_fail "Returns 200 but NOT an array (OAS fix issue)"
    fi
else
    log_fail "Expected 200, got $status"
    echo "  Body: $body"
fi

# --- T1.2: POST /batchSchedule (create) ---
log_test "POST /batchSchedule (create)"
SCHED_PAYLOAD='{
    "name": "Test Schedule - API Test",
    "description": "Created by test_tmf_api.sh",
    "category": "SolutionEmpty",
    "recurrencePattern": "daily",
    "windowStartTime": "00:00:00",
    "windowEndTime": "06:00:00",
    "maxBatchSize": 25,
    "selectionCriteria": "{\"remediationState\": \"DETECTED\"}"
}'
result=$(api_call POST "$BATCH_API/batchSchedule" "$SCHED_PAYLOAD")
status=$(echo "$result" | head -1)
body=$(echo "$result" | tail -n +2)

if [ "$status" = "201" ]; then
    log_pass "Returns 201 Created"
    # TMF Runtime echoes input, not full record. Find the created ID via list.
    sleep 1
    list_result=$(api_call GET "$BATCH_API/batchSchedule?name=Test+Schedule+-+API+Test")
    list_body=$(echo "$list_result" | tail -n +2)
    SCHED_ID=$(echo "$list_body" | python3 -c "
import sys,json
data=json.load(sys.stdin)
if isinstance(data,list):
    for d in data:
        if d.get('name') == 'Test Schedule - API Test':
            print(d['id']); break
" 2>/dev/null)
    if [ -n "$SCHED_ID" ]; then
        log_pass "Found created schedule, id=$SCHED_ID"
    else
        echo "  WARN: Could not find created schedule by name, will try to continue"
        SCHED_ID=""
    fi
else
    log_fail "Expected 201, got $status"
    echo "  Body: $body"
    SCHED_ID=""
fi

# --- T1.3: GET /batchSchedule/{id} (retrieve) ---
if [ -n "${SCHED_ID:-}" ]; then
    log_test "GET /batchSchedule/$SCHED_ID (retrieve by ID)"
    result=$(api_call GET "$BATCH_API/batchSchedule/$SCHED_ID")
    status=$(echo "$result" | head -1)
    body=$(echo "$result" | tail -n +2)
    
    if [ "$status" = "200" ]; then
        ret_name=$(json_field "$body" "name")
        if [ "$ret_name" = "Test Schedule - API Test" ]; then
            log_pass "Returns 200 with correct name"
        else
            log_fail "Returns 200 but name mismatch: '$ret_name'"
        fi
    else
        log_fail "Expected 200, got $status"
    fi
else
    log_skip "GET /batchSchedule/{id} - no ID from POST"
fi

# --- T1.4: PATCH /batchSchedule/{id} (update) ---
if [ -n "${SCHED_ID:-}" ]; then
    log_test "PATCH /batchSchedule/$SCHED_ID (update)"
    PATCH_PAYLOAD='{"maxBatchSize": 50, "description": "Updated by test"}'
    result=$(api_call PATCH "$BATCH_API/batchSchedule/$SCHED_ID" "$PATCH_PAYLOAD")
    status=$(echo "$result" | head -1)
    body=$(echo "$result" | tail -n +2)
    
    if [ "$status" = "200" ]; then
        ret_size=$(json_field "$body" "maxBatchSize")
        if [ "$ret_size" = "50" ]; then
            log_pass "Returns 200, maxBatchSize updated to 50"
        else
            log_fail "Returns 200 but maxBatchSize=$ret_size (expected 50)"
        fi
    else
        log_fail "Expected 200, got $status"
        echo "  Body: $body"
    fi
else
    log_skip "PATCH /batchSchedule/{id} - no ID from POST"
fi

# --- T1.5: DELETE /batchSchedule/{id} ---
if [ -n "${SCHED_ID:-}" ]; then
    log_test "DELETE /batchSchedule/$SCHED_ID"
    result=$(api_call DELETE "$BATCH_API/batchSchedule/$SCHED_ID")
    status=$(echo "$result" | head -1)
    
    if [ "$status" = "204" ] || [ "$status" = "200" ]; then
        log_pass "Returns $status (deleted)"
        
        # Verify it's gone
        result=$(api_call GET "$BATCH_API/batchSchedule/$SCHED_ID")
        verify_status=$(echo "$result" | head -1)
        if [ "$verify_status" = "404" ] || [ "$verify_status" = "500" ]; then
            log_pass "Verified: GET after DELETE returns $verify_status"
        else
            log_fail "GET after DELETE still returns $verify_status (expected 404)"
        fi
    else
        log_fail "Expected 204, got $status"
    fi
else
    log_skip "DELETE /batchSchedule/{id} - no ID from POST"
fi

# --- T1.6: GET /batchSchedule?isActive=true (filter) ---
log_test "GET /batchSchedule?isActive=true (filter)"
result=$(api_call GET "$BATCH_API/batchSchedule?isActive=true")
status=$(echo "$result" | head -1)
body=$(echo "$result" | tail -n +2)

if [ "$status" = "200" ]; then
    is_array=$(json_is_array "$body")
    if [ "$is_array" = "true" ]; then
        log_pass "Returns 200 with array for filtered query"
    else
        log_fail "Returns 200 but NOT array for filtered query"
    fi
else
    log_fail "Expected 200, got $status"
fi

# =============================================================================
# SECTION 2: BatchJob CRUD
# =============================================================================
echo -e "\n${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SECTION 2: BatchJob CRUD${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"

# --- T1.7: GET /batchJob (list) ---
log_test "GET /batchJob (list)"
result=$(api_call GET "$BATCH_API/batchJob")
status=$(echo "$result" | head -1)
body=$(echo "$result" | tail -n +2)

if [ "$status" = "200" ]; then
    is_array=$(json_is_array "$body")
    if [ "$is_array" = "true" ]; then
        log_pass "Returns 200 with array"
    else
        log_fail "Returns 200 but NOT an array"
    fi
else
    log_fail "Expected 200, got $status"
    echo "  Body: $body"
fi

# --- T1.8: POST /batchJob (create) ---
log_test "POST /batchJob (create)"
JOB_PAYLOAD='{
    "name": "Test Batch Job - API Test",
    "description": "Created by test_tmf_api.sh",
    "category": "SolutionEmpty",
    "requestedQuantity": 10,
    "x_configuration": "{\"remediationState\": \"DETECTED\", \"useCase\": \"1147\"}"
}'
result=$(api_call POST "$BATCH_API/batchJob" "$JOB_PAYLOAD")
status=$(echo "$result" | head -1)
body=$(echo "$result" | tail -n +2)

if [ "$status" = "201" ]; then
    log_pass "Returns 201 Created"
    # TMF Runtime echoes input, not full record. Find the created ID via list.
    sleep 1
    list_result=$(api_call GET "$BATCH_API/batchJob")
    list_body=$(echo "$list_result" | tail -n +2)
    JOB_ID=$(echo "$list_body" | python3 -c "
import sys,json
data=json.load(sys.stdin)
if isinstance(data,list):
    for d in data:
        if d.get('name') == 'Test Batch Job - API Test':
            print(d['id']); break
" 2>/dev/null)
    if [ -n "$JOB_ID" ]; then
        log_pass "Found created batch job, id=$JOB_ID"
    else
        echo "  WARN: Could not find created batch job by name, will try to continue"
        JOB_ID=""
    fi
else
    log_fail "Expected 201, got $status"
    echo "  Body: $body"
    JOB_ID=""
fi

# --- T1.9: GET /batchJob/{id} (retrieve) ---
if [ -n "${JOB_ID:-}" ]; then
    log_test "GET /batchJob/$JOB_ID (retrieve by ID)"
    result=$(api_call GET "$BATCH_API/batchJob/$JOB_ID")
    status=$(echo "$result" | head -1)
    body=$(echo "$result" | tail -n +2)
    
    if [ "$status" = "200" ]; then
        ret_name=$(json_field "$body" "name")
        ret_qty=$(json_field "$body" "requestedQuantity")
        if [ "$ret_name" = "Test Batch Job - API Test" ]; then
            log_pass "Returns 200 with correct name, requestedQuantity=$ret_qty"
        else
            log_fail "Returns 200 but name mismatch: '$ret_name'"
        fi
    else
        log_fail "Expected 200, got $status"
    fi
else
    log_skip "GET /batchJob/{id} - no ID from POST"
fi

# --- T1.10: PATCH /batchJob/{id} (update state) ---
if [ -n "${JOB_ID:-}" ]; then
    log_test "PATCH /batchJob/$JOB_ID (update state to inProgress)"
    PATCH_PAYLOAD='{"state": "inProgress", "x_currentItemState": "VALIDATING"}'
    result=$(api_call PATCH "$BATCH_API/batchJob/$JOB_ID" "$PATCH_PAYLOAD")
    status=$(echo "$result" | head -1)
    body=$(echo "$result" | tail -n +2)
    
    if [ "$status" = "200" ]; then
        ret_state=$(json_field "$body" "state")
        if [ "$ret_state" = "inProgress" ]; then
            log_pass "Returns 200, state updated to inProgress"
        else
            log_fail "Returns 200 but state=$ret_state (expected inProgress)"
        fi
    else
        log_fail "Expected 200, got $status"
        echo "  Body: $body"
    fi
else
    log_skip "PATCH /batchJob/{id} - no ID from POST"
fi

# --- T1.11: PATCH /batchJob/{id} (update summary) ---
if [ -n "${JOB_ID:-}" ]; then
    log_test "PATCH /batchJob/$JOB_ID (update summary + actualQuantity)"
    PATCH_PAYLOAD='{"actualQuantity": 5, "x_summary": "{\"total\":10,\"successful\":5,\"failed\":0,\"skipped\":0,\"pending\":5}"}'
    result=$(api_call PATCH "$BATCH_API/batchJob/$JOB_ID" "$PATCH_PAYLOAD")
    status=$(echo "$result" | head -1)
    body=$(echo "$result" | tail -n +2)
    
    if [ "$status" = "200" ]; then
        ret_qty=$(json_field "$body" "actualQuantity")
        if [ "$ret_qty" = "5" ]; then
            log_pass "Returns 200, actualQuantity=5"
        else
            log_fail "Returns 200 but actualQuantity=$ret_qty (expected 5)"
        fi
    else
        log_fail "Expected 200, got $status"
    fi
else
    log_skip "PATCH /batchJob/{id} summary - no ID from POST"
fi

# --- T1.12: DELETE /batchJob/{id} ---
if [ -n "${JOB_ID:-}" ]; then
    log_test "DELETE /batchJob/$JOB_ID"
    result=$(api_call DELETE "$BATCH_API/batchJob/$JOB_ID")
    status=$(echo "$result" | head -1)
    
    if [ "$status" = "204" ] || [ "$status" = "200" ]; then
        log_pass "Returns $status (deleted)"
    else
        log_fail "Expected 204, got $status"
    fi
else
    log_skip "DELETE /batchJob/{id} - no ID from POST"
fi

# --- T1.13: GET /batchJob?state=pending (filter) ---
log_test "GET /batchJob?state=pending (filter)"
result=$(api_call GET "$BATCH_API/batchJob?state=pending")
status=$(echo "$result" | head -1)
body=$(echo "$result" | tail -n +2)

if [ "$status" = "200" ]; then
    is_array=$(json_is_array "$body")
    if [ "$is_array" = "true" ]; then
        log_pass "Returns 200 with array for filtered query"
    else
        log_fail "Returns 200 but NOT array for filtered query"
    fi
else
    log_fail "Expected 200, got $status"
fi

# =============================================================================
# SECTION 3: SolutionManagement (REST FDW)
# =============================================================================
echo -e "\n${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SECTION 3: SolutionManagement (REST FDW)${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"

if [ "$SKIP_SOLUTION" = "true" ]; then
    log_skip "All SolutionManagement tests (--skip-solution flag)"
    SKIP=$((SKIP + 2))
else
    # --- T1.14: GET /solutionInfo/{id} ---
    log_test "GET /solutionInfo/$TEST_SOLUTION_ID (validate)"
    result=$(api_call GET "$SOL_API/solutionInfo/$TEST_SOLUTION_ID")
    status=$(echo "$result" | head -1)
    body=$(echo "$result" | tail -n +2)
    
    if [ "$status" = "200" ]; then
        ret_id=$(json_field "$body" "solutionId")
        success=$(json_field "$body" "success")
        log_pass "Returns 200, solutionId=$ret_id, success=$success"
    elif [ "$status" = "500" ]; then
        log_fail "Returns 500 (FDW/Salesforce error)"
        echo "  Body: $(echo "$body" | head -c 200)"
    else
        log_fail "Expected 200, got $status"
    fi

    # --- T1.15: GET /migrationStatus/{id} ---
    log_test "GET /migrationStatus/$TEST_SOLUTION_ID (poll)"
    result=$(api_call GET "$SOL_API/migrationStatus/$TEST_SOLUTION_ID")
    status=$(echo "$result" | head -1)
    body=$(echo "$result" | tail -n +2)
    
    if [ "$status" = "200" ]; then
        ret_status=$(json_field "$body" "status")
        log_pass "Returns 200, migration status=$ret_status"
    elif [ "$status" = "500" ]; then
        log_fail "Returns 500 (FDW/Salesforce error)"
        echo "  Body: $(echo "$body" | head -c 200)"
    else
        log_fail "Expected 200, got $status"
    fi
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo -e "\n${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  TEST SUMMARY${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""
TOTAL=$((PASS + FAIL + SKIP))
echo -e "  Total:   $TOTAL"
echo -e "  ${GREEN}Passed:  $PASS${NC}"
echo -e "  ${RED}Failed:  $FAIL${NC}"
echo -e "  ${YELLOW}Skipped: $SKIP${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "  ${RED}SOME TESTS FAILED${NC}"
    exit 1
fi
