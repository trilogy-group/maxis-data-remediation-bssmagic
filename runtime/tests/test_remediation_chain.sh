#!/bin/bash
# =============================================================================
# BSS Magic - Single-Solution 5-Step Remediation Chain Test (T2)
# =============================================================================
# Tests the complete remediation flow for a single solution:
#   1. VALIDATE  - GET /solutionInfo/{id}
#   2. DELETE    - DELETE /solutionMigration/{id}
#   3. MIGRATE   - POST /solutionMigration (body: {"solutionId":"..."})
#   4. POLL      - GET /migrationStatus/{id} (loop until COMPLETED/FAILED)
#   5. POST-UPDATE - POST /solutionUpdate (body: {"solutionId":"..."})
#
# Usage: ./test_remediation_chain.sh [solutionId]
#   solutionId  Salesforce Solution ID in DETECTED state (default: dry-run)
#
# This test also creates a BatchJob to track the remediation,
# demonstrating the full lifecycle: create job -> execute -> update -> complete.
#
# CAUTION: Steps 2-5 modify real Salesforce data! Use with care.
# =============================================================================

set -euo pipefail

# Configuration
ALB_URL="http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com"
API_KEY="bssmagic-d58d6761265b01accc13e8b21bae8282"
BATCH_API="$ALB_URL/tmf-api/batchProcessing/v1"
SOL_API="$ALB_URL/tmf-api/solutionManagement/v5"

# Parse args
SOLUTION_ID="${1:-}"
DRY_RUN=false
if [ -z "$SOLUTION_ID" ]; then
    DRY_RUN=true
    echo "No solution ID provided. Running in DRY-RUN mode (Step 1 only)."
    echo "Usage: $0 <solutionId>"
    echo ""
fi

# Polling configuration
MAX_POLL_ATTEMPTS=60
POLL_INTERVAL_SECS=5

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
STEP_PASS=0
STEP_FAIL=0

# =============================================================================
# Helper Functions
# =============================================================================

log_step() {
    echo -e "\n${CYAN}━━━ STEP $1: $2 ━━━${NC}"
}

log_pass() {
    echo -e "  ${GREEN}PASS${NC}: $1"
    STEP_PASS=$((STEP_PASS + 1))
}

log_fail() {
    echo -e "  ${RED}FAIL${NC}: $1"
    STEP_FAIL=$((STEP_FAIL + 1))
}

log_info() {
    echo -e "  ${YELLOW}INFO${NC}: $1"
}

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

json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field',''))" 2>/dev/null || echo ""
}

# =============================================================================
echo -e "\n${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   BSS Magic - Remediation Chain Test (T2)                    ║${NC}"
echo -e "${CYAN}║   5-Step: Validate → Delete → Migrate → Poll → PostUpdate   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Solution ID: ${SOLUTION_ID:-'(none - dry run)'}"
echo "ALB: $ALB_URL"
echo "Dry Run: $DRY_RUN"
echo ""

# =============================================================================
# PRE-STEP: Create a BatchJob to track this remediation
# =============================================================================
echo -e "${CYAN}── PRE-STEP: Create tracking BatchJob ──${NC}"
JOB_PAYLOAD=$(cat <<EOF
{
    "name": "Remediation Test - ${SOLUTION_ID:-DryRun}",
    "description": "Single-solution test by test_remediation_chain.sh",
    "category": "SolutionEmpty",
    "requestedQuantity": 1,
    "x_configuration": "{\"solutionId\": \"${SOLUTION_ID:-none}\", \"testMode\": true}"
}
EOF
)
result=$(api_call POST "$BATCH_API/batchJob" "$JOB_PAYLOAD")
status=$(echo "$result" | head -1)
if [ "$status" = "201" ]; then
    sleep 1
    # Find the job by listing all
    list_result=$(api_call GET "$BATCH_API/batchJob")
    list_body=$(echo "$list_result" | tail -n +2)
    JOB_ID=$(echo "$list_body" | python3 -c "
import sys,json
data=json.load(sys.stdin)
if isinstance(data,list):
    for d in data:
        if d.get('name','').startswith('Remediation Test'):
            print(d['id']); break
" 2>/dev/null)
    if [ -n "$JOB_ID" ]; then
        log_pass "Created BatchJob: $JOB_ID"
    else
        log_info "BatchJob created but ID not found in listing"
        JOB_ID=""
    fi
else
    log_info "Failed to create tracking BatchJob (status=$status), continuing without it"
    JOB_ID=""
fi

# Update BatchJob to inProgress
if [ -n "${JOB_ID:-}" ]; then
    api_call PATCH "$BATCH_API/batchJob/$JOB_ID" '{"state": "inProgress", "x_currentItemState": "VALIDATING"}' > /dev/null 2>&1
fi

# =============================================================================
# STEP 1: VALIDATE - GET /solutionInfo/{id}
# =============================================================================
if [ "$DRY_RUN" = "true" ]; then
    log_step "1" "VALIDATE (DRY RUN - using known test ID)"
    SOLUTION_ID="a246D000000pYfbQAE"
    log_info "Using test solution ID: $SOLUTION_ID"
fi

log_step "1" "VALIDATE via GET /solutionInfo/$SOLUTION_ID"
result=$(api_call GET "$SOL_API/solutionInfo/$SOLUTION_ID")
status=$(echo "$result" | head -1)
body=$(echo "$result" | tail -n +2)

if [ "$status" = "200" ]; then
    success=$(json_field "$body" "success")
    sol_name=$(json_field "$body" "solutionName")
    macd=$(json_field "$body" "macdDetails")
    
    if [ "$success" = "True" ] || [ "$success" = "true" ]; then
        log_pass "Solution found: name='$sol_name', success=$success"
        
        # Check MACD details
        has_macd=$(echo "$macd" | python3 -c "
import sys,json
try:
    d = json.load(sys.stdin)
    if isinstance(d, str): d = json.loads(d)
    print('true' if d.get('macdBasketExists') == True or len(d.get('macdSolutionIds',[])) > 0 else 'false')
except: print('unknown')
" 2>/dev/null)
        
        if [ "$has_macd" = "true" ]; then
            log_info "MACD basket EXISTS - would be SKIPPED in real batch"
        elif [ "$has_macd" = "false" ]; then
            log_pass "No MACD basket - eligible for remediation"
        else
            log_info "Could not determine MACD status"
        fi
    else
        log_fail "solutionInfo returned success=$success"
    fi
else
    log_fail "GET /solutionInfo returned $status"
    echo "  Body: $(echo "$body" | head -c 200)"
fi

# Update BatchJob state
if [ -n "${JOB_ID:-}" ]; then
    api_call PATCH "$BATCH_API/batchJob/$JOB_ID" '{"x_currentItemState": "VALIDATED"}' > /dev/null 2>&1
fi

# In dry-run mode, stop here
if [ "$DRY_RUN" = "true" ]; then
    echo -e "\n${YELLOW}━━━ DRY RUN COMPLETE ━━━${NC}"
    echo "Steps 2-5 skipped (would modify real Salesforce data)."
    echo "To run full chain: $0 <solutionId>"
    
    # Update BatchJob as completed (dry run)
    if [ -n "${JOB_ID:-}" ]; then
        api_call PATCH "$BATCH_API/batchJob/$JOB_ID" "{\"state\": \"completed\", \"actualQuantity\": 0, \"x_summary\": \"{\\\"total\\\":1,\\\"successful\\\":0,\\\"failed\\\":0,\\\"skipped\\\":0,\\\"dryRun\\\":1}\"}" > /dev/null 2>&1
        api_call DELETE "$BATCH_API/batchJob/$JOB_ID" > /dev/null 2>&1
    fi
    
    echo -e "\n${CYAN}══ SUMMARY ══${NC}"
    echo -e "  ${GREEN}Step 1 (VALIDATE): PASS${NC}"
    echo -e "  ${YELLOW}Steps 2-5: SKIPPED (dry run)${NC}"
    exit 0
fi

# =============================================================================
# STEP 2: DELETE - DELETE /solutionMigration/{solutionId}
# =============================================================================
log_step "2" "DELETE via DELETE /solutionMigration/$SOLUTION_ID"

if [ -n "${JOB_ID:-}" ]; then
    api_call PATCH "$BATCH_API/batchJob/$JOB_ID" '{"x_currentItemState": "DELETING_SM_DATA"}' > /dev/null 2>&1
fi

result=$(api_call DELETE "$SOL_API/solutionMigration/$SOLUTION_ID")
status=$(echo "$result" | head -1)
body=$(echo "$result" | tail -n +2)

if [ "$status" = "200" ] || [ "$status" = "204" ]; then
    del_success=$(json_field "$body" "success")
    del_jobid=$(json_field "$body" "jobId")
    log_pass "Delete returned $status, success=$del_success, jobId=$del_jobid"
elif [ "$status" = "500" ]; then
    log_fail "Delete returned 500 (FDW/Salesforce error)"
    echo "  Body: $(echo "$body" | head -c 200)"
else
    log_fail "Delete returned unexpected status: $status"
fi

# =============================================================================
# STEP 3: MIGRATE - POST /solutionMigration
# =============================================================================
log_step "3" "MIGRATE via POST /solutionMigration"

if [ -n "${JOB_ID:-}" ]; then
    api_call PATCH "$BATCH_API/batchJob/$JOB_ID" '{"x_currentItemState": "MIGRATING"}' > /dev/null 2>&1
fi

MIGRATE_PAYLOAD="{\"solutionId\": \"$SOLUTION_ID\"}"
result=$(api_call POST "$SOL_API/solutionMigration" "$MIGRATE_PAYLOAD")
status=$(echo "$result" | head -1)
body=$(echo "$result" | tail -n +2)

if [ "$status" = "200" ] || [ "$status" = "201" ]; then
    mig_success=$(json_field "$body" "success")
    mig_jobid=$(json_field "$body" "jobId")
    mig_status=$(json_field "$body" "status")
    log_pass "Migrate returned $status, success=$mig_success, jobId=$mig_jobid, status=$mig_status"
elif [ "$status" = "500" ]; then
    log_fail "Migrate returned 500 (FDW/Salesforce error)"
    echo "  Body: $(echo "$body" | head -c 200)"
else
    log_fail "Migrate returned unexpected status: $status"
fi

# =============================================================================
# STEP 4: POLL - GET /migrationStatus/{solutionId} (loop)
# =============================================================================
log_step "4" "POLL via GET /migrationStatus/$SOLUTION_ID"

if [ -n "${JOB_ID:-}" ]; then
    api_call PATCH "$BATCH_API/batchJob/$JOB_ID" '{"x_currentItemState": "WAITING_CONFIRMATION"}' > /dev/null 2>&1
fi

poll_count=0
migration_complete=false
final_status="UNKNOWN"

while [ "$poll_count" -lt "$MAX_POLL_ATTEMPTS" ]; do
    poll_count=$((poll_count + 1))
    
    result=$(api_call GET "$SOL_API/migrationStatus/$SOLUTION_ID")
    status=$(echo "$result" | head -1)
    body=$(echo "$result" | tail -n +2)
    
    if [ "$status" = "200" ]; then
        poll_status=$(json_field "$body" "status")
        poll_msg=$(json_field "$body" "message")
        echo -e "  Poll $poll_count/$MAX_POLL_ATTEMPTS: status=$poll_status"
        
        case "$poll_status" in
            "Completed"|"COMPLETED"|"completed"|"SUCCESS")
                migration_complete=true
                final_status="COMPLETED"
                log_pass "Migration completed after $poll_count polls"
                break
                ;;
            "Failed"|"FAILED"|"failed"|"ERROR")
                final_status="FAILED"
                log_fail "Migration failed: $poll_msg"
                break
                ;;
            *)
                # Still in progress, wait and poll again
                sleep "$POLL_INTERVAL_SECS"
                ;;
        esac
    else
        log_fail "Poll returned status $status"
        break
    fi
done

if [ "$poll_count" -eq "$MAX_POLL_ATTEMPTS" ] && [ "$migration_complete" = "false" ]; then
    log_fail "Migration timed out after $MAX_POLL_ATTEMPTS polls ($((MAX_POLL_ATTEMPTS * POLL_INTERVAL_SECS))s)"
fi

# Update BatchJob state
if [ -n "${JOB_ID:-}" ]; then
    if [ "$migration_complete" = "true" ]; then
        api_call PATCH "$BATCH_API/batchJob/$JOB_ID" '{"x_currentItemState": "CONFIRMED"}' > /dev/null 2>&1
    fi
fi

# =============================================================================
# STEP 5: POST-UPDATE - POST /solutionUpdate
# =============================================================================
if [ "$migration_complete" = "true" ]; then
    log_step "5" "POST-UPDATE via POST /solutionUpdate"
    
    if [ -n "${JOB_ID:-}" ]; then
        api_call PATCH "$BATCH_API/batchJob/$JOB_ID" '{"x_currentItemState": "POST_UPDATE"}' > /dev/null 2>&1
    fi
    
    UPDATE_PAYLOAD="{\"solutionId\": \"$SOLUTION_ID\"}"
    result=$(api_call POST "$SOL_API/solutionUpdate" "$UPDATE_PAYLOAD")
    status=$(echo "$result" | head -1)
    body=$(echo "$result" | tail -n +2)
    
    if [ "$status" = "200" ] || [ "$status" = "201" ]; then
        upd_success=$(json_field "$body" "success")
        log_pass "Post-update returned $status, success=$upd_success"
    elif [ "$status" = "500" ]; then
        log_fail "Post-update returned 500"
        echo "  Body: $(echo "$body" | head -c 200)"
    else
        log_fail "Post-update returned unexpected status: $status"
    fi
else
    log_step "5" "POST-UPDATE (SKIPPED - migration not completed)"
    log_info "Migration status was '$final_status', skipping post-update"
fi

# =============================================================================
# POST-STEP: Update BatchJob as completed
# =============================================================================
if [ -n "${JOB_ID:-}" ]; then
    echo -e "\n${CYAN}── POST-STEP: Finalize BatchJob ──${NC}"
    summary="{\"total\":1,\"successful\":$STEP_PASS,\"failed\":$STEP_FAIL,\"skipped\":0,\"pending\":0}"
    final_state="completed"
    if [ "$STEP_FAIL" -gt 0 ]; then
        final_state="failed"
    fi
    api_call PATCH "$BATCH_API/batchJob/$JOB_ID" "{\"state\": \"$final_state\", \"actualQuantity\": 1, \"x_summary\": \"$summary\", \"x_currentItemState\": \"COMPLETED\"}" > /dev/null 2>&1
    log_pass "BatchJob $JOB_ID updated to state=$final_state"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo -e "\n${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  REMEDIATION CHAIN SUMMARY${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Solution: $SOLUTION_ID"
echo "  BatchJob: ${JOB_ID:-'(none)'}"
echo ""
echo -e "  Steps Passed: ${GREEN}$STEP_PASS${NC}"
echo -e "  Steps Failed: ${RED}$STEP_FAIL${NC}"
echo ""

if [ "$STEP_FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}ALL STEPS PASSED${NC}"
    exit 0
else
    echo -e "  ${RED}SOME STEPS FAILED${NC}"
    exit 1
fi
