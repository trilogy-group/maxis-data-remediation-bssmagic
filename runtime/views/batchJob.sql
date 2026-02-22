-- ============================================================================
-- Custom Batch Processing Schema for Batch Remediation
-- Created: 2026-02-02
-- Updated: 2026-02-09 (Renamed from TMF697 WorkOrder to custom BatchJob/BatchSchedule)
-- Purpose: Track scheduled and recurrent batch remediation jobs
-- Note: TMF697 WorkOrder is for business tasks (dispatch technician, create order).
--        Batch processing is an operational concern - TMF has no standard API for it.
--        This is a custom API per architectural guidance.
-- ============================================================================

-- Drop existing objects if they exist (both old and new names for clean migration)
DROP TABLE IF EXISTS tmf."batchJob" CASCADE;
DROP TABLE IF EXISTS tmf."batchSchedule" CASCADE;
DROP TABLE IF EXISTS tmf."workOrder" CASCADE;
DROP TABLE IF EXISTS tmf."workOrderSchedule" CASCADE;
DROP TYPE IF EXISTS tmf."BatchJobStateType" CASCADE;
DROP TYPE IF EXISTS tmf."WorkOrderStateType" CASCADE;
DROP TYPE IF EXISTS tmf."RecurrencePatternType" CASCADE;

-- ============================================================================
-- ENUM: BatchJob State
-- ============================================================================
CREATE TYPE tmf."BatchJobStateType" AS ENUM (
    'pending',          -- Scheduled but not started
    'open',             -- Acknowledged, ready to execute  
    'inProgress',       -- Currently processing
    'completed',        -- All items processed successfully
    'cancelled',        -- User cancelled
    'failed'            -- Batch-level failure (extension)
);

-- ============================================================================
-- ENUM: Recurrence Pattern Type
-- ============================================================================
CREATE TYPE tmf."RecurrencePatternType" AS ENUM (
    'once',             -- One-time execution
    'daily',            -- Every day
    'weekdays',         -- Monday to Friday
    'weekly',           -- Once per week
    'custom'            -- Custom cron-like pattern
);

-- ============================================================================
-- TABLE: BatchJob
-- Represents a batch remediation job (scheduled or immediate)
-- ============================================================================
CREATE TABLE tmf."batchJob" (
    -- Standard Fields
    "id" text PRIMARY KEY,
    "href" text,
    "name" text,                            -- "Remediation Batch 2026-02-03"
    "description" text,
    "state" tmf."BatchJobStateType" NOT NULL DEFAULT 'pending',
    "category" text NOT NULL,               -- 'SolutionEmpty', 'PartialDataMissing'
    "priority" integer DEFAULT 5,           -- 1-9 (1=highest)
    
    -- Scheduling Fields
    "scheduledStartDate" timestamp(0) with time zone,
    "startDate" timestamp(0) with time zone,
    "completionDate" timestamp(0) with time zone,
    "expectedCompletionDate" timestamp(0) with time zone,
    
    -- Execution Window (for recurrent jobs)
    "executionWindowStart" time,            -- e.g., 00:00:00 (midnight)
    "executionWindowEnd" time,              -- e.g., 06:00:00 (6 AM)
    
    -- Batch specifics
    "requestedQuantity" integer NOT NULL,   -- Max batch size
    "actualQuantity" integer DEFAULT 0,     -- Items processed
    
    -- Standard fields  
    "relatedParty" jsonb DEFAULT '[]'::jsonb,  -- [{ "id": "user@email", "role": "Requester" }]
    "note" jsonb DEFAULT '[]'::jsonb,          -- Execution notes/log
    "characteristic" jsonb DEFAULT '[]'::jsonb,
    
    -- Summary (extension)
    "x_summary" jsonb DEFAULT '{"total":0,"successful":0,"failed":0,"skipped":0,"pending":0}'::jsonb,
    "x_currentItemId" text,                 -- Currently processing item
    "x_currentItemState" text,              -- Current item's state
    "x_configuration" jsonb DEFAULT '{}'::jsonb,  -- Selection criteria, etc.
    "x_lastError" text,                     -- Last error message
    
    -- Recurrence Fields (extension)
    "x_recurrencePattern" tmf."RecurrencePatternType" DEFAULT 'once',
    "x_recurrenceDays" integer[],           -- Days of week (1=Mon, 7=Sun) for 'weekly'/'custom'
    "x_isRecurrent" boolean DEFAULT false,
    "x_parentScheduleId" text,              -- Link to schedule for recurrent jobs
    "x_executionNumber" integer DEFAULT 1,  -- Which execution number (for recurrent)
    
    -- Audit
    "creationDate" timestamp(0) with time zone DEFAULT NOW(),
    "lastUpdate" timestamp(0) with time zone DEFAULT NOW(),
    
    "@type" text DEFAULT 'BatchJob',
    "@baseType" text DEFAULT 'Entity'
);

-- Indexes for common queries
CREATE INDEX idx_batchjob_state ON tmf."batchJob"("state");
CREATE INDEX idx_batchjob_category ON tmf."batchJob"("category");
CREATE INDEX idx_batchjob_scheduled ON tmf."batchJob"("scheduledStartDate") 
    WHERE "state" = 'pending';
CREATE INDEX idx_batchjob_parent ON tmf."batchJob"("x_parentScheduleId") 
    WHERE "x_parentScheduleId" IS NOT NULL;

-- ============================================================================
-- TABLE: BatchSchedule
-- Represents a recurrent schedule that spawns BatchJobs
-- ============================================================================
CREATE TABLE tmf."batchSchedule" (
    "id" text PRIMARY KEY,
    "href" text,
    "name" text NOT NULL,                   -- "Nightly 1147 Remediation"
    "description" text,
    "isActive" boolean DEFAULT true,
    "category" text NOT NULL,               -- 'SolutionEmpty'
    
    -- Recurrence Pattern
    "recurrencePattern" tmf."RecurrencePatternType" NOT NULL DEFAULT 'daily',
    "recurrenceDays" integer[],             -- Days of week for custom patterns
    
    -- Execution Window
    "windowStartTime" time NOT NULL,        -- e.g., 00:00:00
    "windowEndTime" time NOT NULL,          -- e.g., 06:00:00
    "timezone" text DEFAULT 'UTC',
    
    -- Batch Configuration
    "maxBatchSize" integer NOT NULL,        -- Max solutions per execution
    "selectionCriteria" jsonb DEFAULT '{"remediationState": "DETECTED"}'::jsonb,
    
    -- Validity Period
    "validFrom" timestamp(0) with time zone,
    "validTo" timestamp(0) with time zone,
    
    -- Related Party
    "createdBy" text,
    "relatedParty" jsonb DEFAULT '[]'::jsonb,
    
    -- Statistics
    "totalExecutions" integer DEFAULT 0,
    "successfulExecutions" integer DEFAULT 0,
    "failedExecutions" integer DEFAULT 0,
    "lastExecutionId" text,
    "lastExecutionDate" timestamp(0) with time zone,
    "nextExecutionDate" timestamp(0) with time zone,
    
    -- Audit
    "creationDate" timestamp(0) with time zone DEFAULT NOW(),
    "lastUpdate" timestamp(0) with time zone DEFAULT NOW(),
    
    "@type" text DEFAULT 'BatchSchedule',
    "@baseType" text DEFAULT 'Entity'
);

-- Index for active schedules
CREATE INDEX idx_batchschedule_active ON tmf."batchSchedule"("isActive", "nextExecutionDate") 
    WHERE "isActive" = true;

-- ============================================================================
-- SAMPLE DATA: Example schedules for testing
-- ============================================================================

-- Insert a sample nightly schedule
INSERT INTO tmf."batchSchedule" (
    "id", 
    "href",
    "name", 
    "description",
    "category",
    "recurrencePattern",
    "windowStartTime",
    "windowEndTime",
    "maxBatchSize",
    "selectionCriteria",
    "validFrom",
    "createdBy",
    "nextExecutionDate"
) VALUES (
    'sched-nightly-1147-001',
    '/tmf-api/batchProcessing/v1/batchSchedule/sched-nightly-1147-001',
    'Nightly 1147 Remediation',
    'Automatic remediation of Solution Empty issues every night from midnight to 6 AM',
    'SolutionEmpty',
    'daily',
    '00:00:00',
    '06:00:00',
    100,
    '{"remediationState": "DETECTED", "useCase": "1147"}',
    NOW(),
    'system',
    (CURRENT_DATE + 1 + TIME '00:00:00')::timestamp with time zone
);

-- Insert a sample immediate (one-time) batch job
INSERT INTO tmf."batchJob" (
    "id",
    "href",
    "name",
    "description",
    "state",
    "category",
    "scheduledStartDate",
    "requestedQuantity",
    "relatedParty",
    "x_recurrencePattern",
    "x_isRecurrent",
    "x_configuration"
) VALUES (
    'bj-sample-001',
    '/tmf-api/batchProcessing/v1/batchJob/bj-sample-001',
    'Sample Immediate Batch',
    'Sample immediate execution for testing',
    'pending',
    'SolutionEmpty',
    NOW() + INTERVAL '1 hour',
    50,
    '[{"id": "vlad.sorici@totogi.com", "role": "Requester", "@type": "RelatedParty"}]',
    'once',
    false,
    '{"remediationState": "DETECTED", "useCase": "1147"}'
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE tmf."batchJob" IS 'BatchJob - Represents a batch remediation job';
COMMENT ON TABLE tmf."batchSchedule" IS 'BatchSchedule - Recurrent schedule configuration that spawns BatchJobs';

COMMENT ON COLUMN tmf."batchJob"."executionWindowStart" IS 'Start time of execution window (for time-bounded batches)';
COMMENT ON COLUMN tmf."batchJob"."executionWindowEnd" IS 'End time of execution window - batch stops when window ends';
COMMENT ON COLUMN tmf."batchJob"."x_recurrencePattern" IS 'Pattern: once, daily, weekdays, weekly, custom';
COMMENT ON COLUMN tmf."batchSchedule"."recurrenceDays" IS 'Array of weekday numbers (1=Mon, 7=Sun) for weekly/custom patterns';


-- ============================================================================
-- TMF VIEWS for API exposure
-- These views are picked up by the TMF Runtime and exposed as REST endpoints
-- ============================================================================

-- Drop existing views if they exist (both old and new names for clean migration)
DROP VIEW IF EXISTS salesforce_server."batchJob";
DROP VIEW IF EXISTS salesforce_server."batchSchedule";
DROP VIEW IF EXISTS salesforce_server."workOrder";
DROP VIEW IF EXISTS salesforce_server."workOrderSchedule";

-- ============================================================================
-- VIEW: batchJob
-- Exposes tmf.batchJob as /tmf-api/batchProcessing/v1/batchJob
-- ============================================================================
-- IMPORTANT: relatedParty, note, characteristic arrays REMOVED due to 
-- TMF server JSONB parsing issues (same as batchSchedule)
-- x_summary and x_configuration returned as text for client-side parsing
-- ============================================================================
CREATE OR REPLACE VIEW salesforce_server."batchJob" AS
SELECT
    t0."id"::text AS "id",
    COALESCE(t0."href", '/tmf-api/batchProcessing/v1/batchJob/' || t0."id")::text AS "href",
    t0."name"::text AS "name",
    t0."description"::text AS "description",
    t0."state"::text AS "state",
    t0."category"::text AS "category",
    t0."priority"::integer AS "priority",
    t0."scheduledStartDate"::text AS "scheduledStartDate",
    t0."startDate"::text AS "startDate",
    t0."completionDate"::text AS "completionDate",
    t0."expectedCompletionDate"::text AS "expectedCompletionDate",
    t0."executionWindowStart"::text AS "executionWindowStart",
    t0."executionWindowEnd"::text AS "executionWindowEnd",
    COALESCE(t0."requestedQuantity", 0)::integer AS "requestedQuantity",
    COALESCE(t0."actualQuantity", 0)::integer AS "actualQuantity",
    -- relatedParty, note, characteristic REMOVED - cause JSONB parsing crash
    -- x_summary simplified to text (can be parsed client-side)
    t0."x_summary"::text AS "x_summary",
    t0."x_currentItemId"::text AS "x_currentItemId",
    t0."x_currentItemState"::text AS "x_currentItemState",
    -- x_configuration simplified to text
    t0."x_configuration"::text AS "x_configuration",
    t0."x_lastError"::text AS "x_lastError",
    t0."x_recurrencePattern"::text AS "x_recurrencePattern",
    t0."x_isRecurrent"::boolean AS "x_isRecurrent",
    t0."x_parentScheduleId"::text AS "x_parentScheduleId",
    t0."x_executionNumber"::integer AS "x_executionNumber",
    t0."creationDate"::text AS "creationDate",
    t0."lastUpdate"::text AS "lastUpdate",
    'BatchJob'::text AS "@type",
    'Entity'::text AS "@baseType"
FROM tmf."batchJob" t0;

COMMENT ON VIEW salesforce_server."batchJob" IS 'BatchJob - complex arrays removed for JSONB parsing';

-- ============================================================================
-- VIEW: batchSchedule  
-- Exposes tmf.batchSchedule as /tmf-api/batchProcessing/v1/batchSchedule
-- ============================================================================
-- IMPORTANT: relatedParty field REMOVED due to TMF server JSONB parsing issues
-- The TMF server's JsonbRowMapper fails on array<RelatedPartyRefOrPartyRoleRef> type
-- Same pattern as service.sql which also removes complex arrays
-- ============================================================================
CREATE OR REPLACE VIEW salesforce_server."batchSchedule" AS
SELECT
    t0."id"::text AS "id",
    COALESCE(t0."href", '/tmf-api/batchProcessing/v1/batchSchedule/' || t0."id")::text AS "href",
    t0."name"::text AS "name",
    t0."description"::text AS "description",
    t0."isActive"::boolean AS "isActive",
    t0."category"::text AS "category",
    t0."recurrencePattern"::text AS "recurrencePattern",
    t0."windowStartTime"::text AS "windowStartTime",
    t0."windowEndTime"::text AS "windowEndTime",
    t0."timezone"::text AS "timezone",
    t0."maxBatchSize"::integer AS "maxBatchSize",
    -- selectionCriteria as text to avoid complex JSONB parsing
    t0."selectionCriteria"::text AS "selectionCriteria",
    t0."validFrom"::text AS "validFrom",
    t0."validTo"::text AS "validTo",
    t0."createdBy"::text AS "createdBy",
    -- relatedParty REMOVED - causes TMF server JSONB parsing crash
    COALESCE(t0."totalExecutions", 0)::integer AS "totalExecutions",
    COALESCE(t0."successfulExecutions", 0)::integer AS "successfulExecutions",
    COALESCE(t0."failedExecutions", 0)::integer AS "failedExecutions",
    t0."lastExecutionId"::text AS "lastExecutionId",
    t0."lastExecutionDate"::text AS "lastExecutionDate",
    t0."nextExecutionDate"::text AS "nextExecutionDate",
    t0."creationDate"::text AS "creationDate",
    t0."lastUpdate"::text AS "lastUpdate",
    'BatchSchedule'::text AS "@type",
    'Entity'::text AS "@baseType"
FROM tmf."batchSchedule" t0;

COMMENT ON VIEW salesforce_server."batchSchedule" IS 'Recurrent schedule for batch remediation jobs - relatedParty removed due to JSONB parsing issues';

-- ============================================================================
-- COMPOSITE TYPES for json_populate_record (MUST be in salesforce_server schema!)
-- These are REQUIRED for TMF Runtime POST operations
-- Column order MUST match the view column order EXACTLY
-- ============================================================================

-- ============================================================================
-- COMPOSITE TYPES for json_populate_record
-- CRITICAL: Must be in salesforce_server schema because JDBC URL uses:
--   currentSchema=${TMF_SCHEMA:salesforce_server},tmf
-- This OVERRIDES any role search_path setting!
-- ============================================================================

-- Drop existing types if they exist (both old and new names for clean migration)
DROP TYPE IF EXISTS public."BatchSchedule" CASCADE;
DROP TYPE IF EXISTS public."BatchJob" CASCADE;
DROP TYPE IF EXISTS public."WorkOrderSchedule" CASCADE;
DROP TYPE IF EXISTS public."WorkOrder" CASCADE;
DROP TYPE IF EXISTS salesforce_server."BatchSchedule" CASCADE;
DROP TYPE IF EXISTS salesforce_server."BatchJob" CASCADE;
DROP TYPE IF EXISTS salesforce_server."WorkOrderSchedule" CASCADE;
DROP TYPE IF EXISTS salesforce_server."WorkOrder" CASCADE;

-- Type for BatchSchedule - matches view column order exactly
-- Must be in salesforce_server schema for JDBC to find it!
-- relatedParty field REMOVED to avoid JSONB parsing crash
CREATE TYPE salesforce_server."BatchSchedule" AS (
    "id" text,
    "href" text,
    "name" text,
    "description" text,
    "isActive" boolean,
    "category" text,
    "recurrencePattern" text,
    "windowStartTime" text,
    "windowEndTime" text,
    "timezone" text,
    "maxBatchSize" integer,
    "selectionCriteria" text,  -- Changed to text to avoid JSONB parsing issues
    "validFrom" text,
    "validTo" text,
    "createdBy" text,
    -- relatedParty REMOVED
    "totalExecutions" integer,
    "successfulExecutions" integer,
    "failedExecutions" integer,
    "lastExecutionId" text,
    "lastExecutionDate" text,
    "nextExecutionDate" text,
    "creationDate" text,
    "lastUpdate" text,
    "@type" text,
    "@baseType" text
);

-- Type for BatchJob - matches view column order exactly
-- Must be in salesforce_server schema for JDBC to find it!
-- relatedParty, note, characteristic REMOVED to avoid JSONB parsing crash
CREATE TYPE salesforce_server."BatchJob" AS (
    "id" text,
    "href" text,
    "name" text,
    "description" text,
    "state" text,
    "category" text,
    "priority" integer,
    "scheduledStartDate" text,
    "startDate" text,
    "completionDate" text,
    "expectedCompletionDate" text,
    "executionWindowStart" text,
    "executionWindowEnd" text,
    "requestedQuantity" integer,
    "actualQuantity" integer,
    -- relatedParty, note, characteristic REMOVED
    "x_summary" text,
    "x_currentItemId" text,
    "x_currentItemState" text,
    "x_configuration" text,
    "x_lastError" text,
    "x_recurrencePattern" text,
    "x_isRecurrent" boolean,
    "x_parentScheduleId" text,
    "x_executionNumber" integer,
    "creationDate" text,
    "lastUpdate" text,
    "@type" text,
    "@baseType" text
);

-- ============================================================================
-- INSTEAD OF INSERT TRIGGER for batchSchedule
-- Handles POST requests from TMF Runtime
-- ============================================================================

DROP FUNCTION IF EXISTS salesforce_server.batchSchedule_insert() CASCADE;

CREATE OR REPLACE FUNCTION salesforce_server.batchSchedule_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tmf."batchSchedule" (
        "id", "href", "name", "description", "isActive", "category", 
        "recurrencePattern", "windowStartTime", "windowEndTime", 
        "timezone", "maxBatchSize", "selectionCriteria", "validFrom", "validTo",
        "createdBy", "relatedParty", "totalExecutions", "successfulExecutions",
        "failedExecutions", "lastExecutionId", "lastExecutionDate", "nextExecutionDate",
        "creationDate", "lastUpdate"
    ) VALUES (
        COALESCE(NEW."id", 'sched-' || extract(epoch from now())::bigint::text),
        '/tmf-api/batchProcessing/v1/batchSchedule/' || COALESCE(NEW."id", 'sched-' || extract(epoch from now())::bigint::text),
        NEW."name",
        NEW."description",
        COALESCE(NEW."isActive", true),
        COALESCE(NEW."category", 'Unknown'),
        COALESCE(NEW."recurrencePattern", 'daily')::tmf."RecurrencePatternType",
        COALESCE(NEW."windowStartTime"::time, '00:00:00'::time),
        COALESCE(NEW."windowEndTime"::time, '06:00:00'::time),
        COALESCE(NEW."timezone", 'UTC'),
        COALESCE(NEW."maxBatchSize", 100),
        COALESCE(NEW."selectionCriteria"::jsonb, '{}'::jsonb),  -- Parse text back to jsonb for storage
        NEW."validFrom"::timestamp with time zone,
        NEW."validTo"::timestamp with time zone,
        NEW."createdBy",
        '[]'::jsonb,  -- Always empty array for relatedParty (removed from API)
        COALESCE(NEW."totalExecutions", 0),
        COALESCE(NEW."successfulExecutions", 0),
        COALESCE(NEW."failedExecutions", 0),
        NEW."lastExecutionId",
        NEW."lastExecutionDate"::timestamp with time zone,
        NEW."nextExecutionDate"::timestamp with time zone,
        COALESCE(NEW."creationDate"::timestamp with time zone, NOW()),
        COALESCE(NEW."lastUpdate"::timestamp with time zone, NOW())
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batchSchedule_insert_trigger
    INSTEAD OF INSERT ON salesforce_server."batchSchedule"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server.batchSchedule_insert();

-- ============================================================================
-- INSTEAD OF INSERT TRIGGER for batchJob
-- Handles POST requests from TMF Runtime
-- ============================================================================

DROP FUNCTION IF EXISTS salesforce_server.batchJob_insert() CASCADE;

CREATE OR REPLACE FUNCTION salesforce_server.batchJob_insert()
RETURNS TRIGGER AS $$
DECLARE
    new_id text;
BEGIN
    new_id := COALESCE(NEW."id", 'bj-' || extract(epoch from now())::bigint::text);
    
    INSERT INTO tmf."batchJob" (
        "id", "href", "name", "description", "state", "category", "priority",
        "scheduledStartDate", "startDate", "completionDate", "expectedCompletionDate",
        "executionWindowStart", "executionWindowEnd", "requestedQuantity", "actualQuantity",
        "relatedParty", "note", "characteristic", "x_summary", "x_currentItemId",
        "x_currentItemState", "x_configuration", "x_lastError", "x_recurrencePattern",
        "x_isRecurrent", "x_parentScheduleId", "x_executionNumber",
        "creationDate", "lastUpdate"
    ) VALUES (
        new_id,
        '/tmf-api/batchProcessing/v1/batchJob/' || new_id,
        NEW."name",
        NEW."description",
        COALESCE(NEW."state", 'pending')::tmf."BatchJobStateType",
        COALESCE(NEW."category", 'Unknown'),
        COALESCE(NEW."priority", 5),
        NEW."scheduledStartDate"::timestamp with time zone,
        NEW."startDate"::timestamp with time zone,
        NEW."completionDate"::timestamp with time zone,
        NEW."expectedCompletionDate"::timestamp with time zone,
        NEW."executionWindowStart"::time,
        NEW."executionWindowEnd"::time,
        COALESCE(NEW."requestedQuantity", 0),
        COALESCE(NEW."actualQuantity", 0),
        '[]'::jsonb,  -- relatedParty: removed from view, always empty
        '[]'::jsonb,  -- note: removed from view, always empty
        '[]'::jsonb,  -- characteristic: removed from view, always empty
        COALESCE(NEW."x_summary"::jsonb, '{"total":0,"successful":0,"failed":0,"skipped":0,"pending":0}'::jsonb),
        NEW."x_currentItemId",
        NEW."x_currentItemState",
        COALESCE(NEW."x_configuration"::jsonb, '{}'::jsonb),
        NEW."x_lastError",
        COALESCE(NEW."x_recurrencePattern", 'once')::tmf."RecurrencePatternType",
        COALESCE(NEW."x_isRecurrent", false),
        NEW."x_parentScheduleId",
        COALESCE(NEW."x_executionNumber", 1),
        COALESCE(NEW."creationDate"::timestamp with time zone, NOW()),
        COALESCE(NEW."lastUpdate"::timestamp with time zone, NOW())
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batchJob_insert_trigger
    INSTEAD OF INSERT ON salesforce_server."batchJob"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server.batchJob_insert();

-- ============================================================================
-- INSTEAD OF UPDATE TRIGGER for batchSchedule
-- Handles PATCH requests from TMF Runtime
-- ============================================================================

DROP FUNCTION IF EXISTS salesforce_server.batchSchedule_update() CASCADE;

CREATE OR REPLACE FUNCTION salesforce_server.batchSchedule_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tmf."batchSchedule" SET
        "name" = COALESCE(NEW."name", OLD."name"),
        "description" = COALESCE(NEW."description", OLD."description"),
        "isActive" = COALESCE(NEW."isActive", OLD."isActive"),
        "category" = COALESCE(NEW."category", OLD."category"),
        "recurrencePattern" = COALESCE(NEW."recurrencePattern", OLD."recurrencePattern")::tmf."RecurrencePatternType",
        -- recurrenceDays: removed from view, preserve existing
        "windowStartTime" = COALESCE(NEW."windowStartTime"::time, OLD."windowStartTime"::time),
        "windowEndTime" = COALESCE(NEW."windowEndTime"::time, OLD."windowEndTime"::time),
        "timezone" = COALESCE(NEW."timezone", OLD."timezone"),
        "maxBatchSize" = COALESCE(NEW."maxBatchSize", OLD."maxBatchSize"),
        "selectionCriteria" = COALESCE(NEW."selectionCriteria"::jsonb, OLD."selectionCriteria"::jsonb),
        "validFrom" = COALESCE(NEW."validFrom"::timestamp with time zone, OLD."validFrom"::timestamp with time zone),
        "validTo" = COALESCE(NEW."validTo"::timestamp with time zone, OLD."validTo"::timestamp with time zone),
        "createdBy" = COALESCE(NEW."createdBy", OLD."createdBy"),
        -- relatedParty removed from view, preserve existing
        "totalExecutions" = COALESCE(NEW."totalExecutions", OLD."totalExecutions"),
        "successfulExecutions" = COALESCE(NEW."successfulExecutions", OLD."successfulExecutions"),
        "failedExecutions" = COALESCE(NEW."failedExecutions", OLD."failedExecutions"),
        "lastExecutionId" = COALESCE(NEW."lastExecutionId", OLD."lastExecutionId"),
        "lastExecutionDate" = COALESCE(NEW."lastExecutionDate"::timestamp with time zone, OLD."lastExecutionDate"::timestamp with time zone),
        "nextExecutionDate" = COALESCE(NEW."nextExecutionDate"::timestamp with time zone, OLD."nextExecutionDate"::timestamp with time zone),
        "lastUpdate" = NOW()
    WHERE "id" = OLD."id";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batchSchedule_update_trigger
    INSTEAD OF UPDATE ON salesforce_server."batchSchedule"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server.batchSchedule_update();

-- ============================================================================
-- INSTEAD OF UPDATE TRIGGER for batchJob
-- Handles PATCH requests from TMF Runtime
-- ============================================================================

DROP FUNCTION IF EXISTS salesforce_server.batchJob_update() CASCADE;

CREATE OR REPLACE FUNCTION salesforce_server.batchJob_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tmf."batchJob" SET
        "name" = COALESCE(NEW."name", OLD."name"),
        "description" = COALESCE(NEW."description", OLD."description"),
        "state" = COALESCE(NEW."state", OLD."state")::tmf."BatchJobStateType",
        "category" = COALESCE(NEW."category", OLD."category"),
        "priority" = COALESCE(NEW."priority", OLD."priority"),
        "scheduledStartDate" = COALESCE(NEW."scheduledStartDate"::timestamp with time zone, OLD."scheduledStartDate"::timestamp with time zone),
        "startDate" = COALESCE(NEW."startDate"::timestamp with time zone, OLD."startDate"::timestamp with time zone),
        "completionDate" = COALESCE(NEW."completionDate"::timestamp with time zone, OLD."completionDate"::timestamp with time zone),
        "expectedCompletionDate" = COALESCE(NEW."expectedCompletionDate"::timestamp with time zone, OLD."expectedCompletionDate"::timestamp with time zone),
        "executionWindowStart" = COALESCE(NEW."executionWindowStart"::time, OLD."executionWindowStart"::time),
        "executionWindowEnd" = COALESCE(NEW."executionWindowEnd"::time, OLD."executionWindowEnd"::time),
        "requestedQuantity" = COALESCE(NEW."requestedQuantity", OLD."requestedQuantity"),
        "actualQuantity" = COALESCE(NEW."actualQuantity", OLD."actualQuantity"),
        -- relatedParty, note, characteristic: removed from view, preserve existing values
        "x_summary" = COALESCE(NEW."x_summary"::jsonb, OLD."x_summary"::jsonb),
        "x_currentItemId" = COALESCE(NEW."x_currentItemId", OLD."x_currentItemId"),
        "x_currentItemState" = COALESCE(NEW."x_currentItemState", OLD."x_currentItemState"),
        "x_configuration" = COALESCE(NEW."x_configuration"::jsonb, OLD."x_configuration"::jsonb),
        "x_lastError" = COALESCE(NEW."x_lastError", OLD."x_lastError"),
        "x_recurrencePattern" = COALESCE(NEW."x_recurrencePattern", OLD."x_recurrencePattern")::tmf."RecurrencePatternType",
        "x_isRecurrent" = COALESCE(NEW."x_isRecurrent", OLD."x_isRecurrent"),
        "x_parentScheduleId" = COALESCE(NEW."x_parentScheduleId", OLD."x_parentScheduleId"),
        "x_executionNumber" = COALESCE(NEW."x_executionNumber", OLD."x_executionNumber"),
        "lastUpdate" = NOW()
    WHERE "id" = OLD."id";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batchJob_update_trigger
    INSTEAD OF UPDATE ON salesforce_server."batchJob"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server.batchJob_update();

-- ============================================================================
-- INSTEAD OF DELETE TRIGGER for batchSchedule
-- Handles DELETE requests from TMF Runtime
-- ============================================================================

DROP FUNCTION IF EXISTS salesforce_server.batchSchedule_delete() CASCADE;

CREATE OR REPLACE FUNCTION salesforce_server.batchSchedule_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM tmf."batchSchedule" WHERE "id" = OLD."id";
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batchSchedule_delete_trigger
    INSTEAD OF DELETE ON salesforce_server."batchSchedule"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server.batchSchedule_delete();

-- ============================================================================
-- INSTEAD OF DELETE TRIGGER for batchJob
-- Handles DELETE requests from TMF Runtime
-- ============================================================================

DROP FUNCTION IF EXISTS salesforce_server.batchJob_delete() CASCADE;

CREATE OR REPLACE FUNCTION salesforce_server.batchJob_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM tmf."batchJob" WHERE "id" = OLD."id";
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batchJob_delete_trigger
    INSTEAD OF DELETE ON salesforce_server."batchJob"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server.batchJob_delete();

-- ============================================================================
-- Drop old workOrder trigger functions for clean migration
-- ============================================================================
DROP FUNCTION IF EXISTS salesforce_server.workOrderSchedule_insert() CASCADE;
DROP FUNCTION IF EXISTS salesforce_server.workOrder_insert() CASCADE;
DROP FUNCTION IF EXISTS salesforce_server.workOrderSchedule_update() CASCADE;
DROP FUNCTION IF EXISTS salesforce_server.workOrder_update() CASCADE;
DROP FUNCTION IF EXISTS salesforce_server.workOrderSchedule_delete() CASCADE;
DROP FUNCTION IF EXISTS salesforce_server.workOrder_delete() CASCADE;

-- ============================================================================
-- VERIFICATION: Check type/view column alignment
-- ============================================================================
-- Run this to verify columns match:
-- SELECT 
--     t.attname as type_column,
--     t.attnum as type_order
-- FROM pg_attribute t
-- WHERE t.attrelid = 'salesforce_server."BatchSchedule"'::regtype 
--   AND t.attnum > 0
-- ORDER BY t.attnum;
--
-- SELECT column_name, ordinal_position 
-- FROM information_schema.columns 
-- WHERE table_schema = 'salesforce_server' AND table_name = 'batchSchedule'
-- ORDER BY ordinal_position;
