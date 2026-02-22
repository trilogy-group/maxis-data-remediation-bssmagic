-- RemediationTask View
-- Maps: AsyncApexJob -> RemediationTask
-- Repurposing existing RemediationTask type to expose Apex batch job details

DROP VIEW IF EXISTS salesforce_server."remediationTask";

CREATE VIEW salesforce_server."remediationTask" AS
SELECT
    t0."Id"::text AS "id",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/remediationTask/' || t0."Id")::text AS "href",
    'RemediationTask'::text AS "@type",
    'Entity'::text AS "@baseType",
    'https://bssmagic.io/schema/RemediationTask'::text AS "@schemaLocation",
    
    -- Map ApexClass name to module
    t1."Name"::text AS "module",
    
    -- Map Status to status
    CASE 
        WHEN t0."Status" = 'Completed' THEN 'completed'
        WHEN t0."Status" = 'Failed' THEN 'failed'
        WHEN t0."Status" = 'Processing' THEN 'inProgress'
        WHEN t0."Status" = 'Queued' THEN 'pending'
        WHEN t0."Status" = 'Holding' THEN 'pending'
        WHEN t0."Status" = 'Preparing' THEN 'pending'
        WHEN t0."Status" = 'Aborted' THEN 'cancelled'
        ELSE 'pending'
    END::text AS "status",
    
    -- Job ID is the AsyncApexJob ID itself
    t0."Id"::text AS "jobId",
    
    -- Timing
    t0."CreatedDate"::text AS "createdAt",
    t0."CompletedDate"::text AS "updatedAt",
    
    -- Result message from ExtendedStatus or build from counts
    COALESCE(
        t0."ExtendedStatus",
        CONCAT(
            'Items: ', COALESCE(t0."JobItemsProcessed"::text, '0'), 
            '/', COALESCE(t0."TotalJobItems"::text, '0'),
            CASE WHEN t0."NumberOfErrors" > 0 THEN CONCAT(' (', t0."NumberOfErrors", ' errors)') ELSE ' (success)' END
        )
    )::text AS "resultMessage",
    
    -- These would be NULL since AsyncApexJob doesn't have solution info directly
    -- But we could join to other tables if needed
    NULL::text AS "solutionId",
    NULL::text AS "solutionName"
    
FROM salesforce_server."AsyncApexJob" t0
LEFT JOIN salesforce_server."ApexClass" t1 ON t0."ApexClassId" = t1."Id"
WHERE t0."JobType" IN ('BatchApex', 'ScheduledApex', 'Queueable');


