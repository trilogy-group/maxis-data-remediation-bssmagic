-- Task View (TMF653)
-- Maps: AsyncApexJob -> Task
-- Exposes Salesforce batch job execution details as TMF653 Task API

DROP VIEW IF EXISTS salesforce_server."task";

CREATE VIEW salesforce_server."task" AS
SELECT
    t0."Id"::text AS "id",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/taskManagement/v4/task/' || t0."Id")::text AS "href",
    
    -- Name from ApexClass
    t1."Name"::text AS "name",
    
    -- Category = JobType (BatchApex, ScheduledApex, etc.)
    t0."JobType"::text AS "category",
    
    -- Status mapping: Salesforce -> TMF TaskStateType
    CASE 
        WHEN t0."Status" = 'Queued' THEN 'pending'
        WHEN t0."Status" = 'Holding' THEN 'pending'
        WHEN t0."Status" = 'Preparing' THEN 'pending'
        WHEN t0."Status" = 'Processing' THEN 'inProgress'
        WHEN t0."Status" = 'Completed' THEN 'completed'
        WHEN t0."Status" = 'Aborted' THEN 'cancelled'
        WHEN t0."Status" = 'Failed' THEN 'failed'
        ELSE 'pending'
    END::text AS "status",
    
    -- Timing
    t0."CreatedDate"::timestamp with time zone AS "startDate",
    t0."CompletedDate"::timestamp with time zone AS "completionDate",
    
    -- Progress as characteristic (TMF doesn't have direct fields for this)
    -- Store in description for now
    CONCAT(
        'Items: ', COALESCE(t0."JobItemsProcessed"::text, '0'), 
        '/', COALESCE(t0."TotalJobItems"::text, '0'),
        CASE WHEN t0."NumberOfErrors" > 0 THEN CONCAT(' (', t0."NumberOfErrors", ' errors)') ELSE '' END
    )::text AS "description",
    
    -- Extended status for errors
    t0."ExtendedStatus"::text AS "statusChangeReason",
    
    -- Created by
    t0."CreatedById"::text AS "x_createdById",
    
    -- Parent Job ID (for chained jobs)
    t0."ParentJobId"::text AS "x_parentJobId",
    
    -- Method name for future jobs
    t0."MethodName"::text AS "x_methodName",
    
    -- Standard TMF fields
    'Task'::text AS "@type",
    'Entity'::text AS "@baseType",
    'https://tmf-open-api.org/TMF653-TaskManagement/v4.0.0'::text AS "@schemaLocation"
    
FROM salesforce_server."AsyncApexJob" t0
LEFT JOIN salesforce_server."ApexClass" t1 ON t0."ApexClassId" = t1."Id"
WHERE t0."JobType" IN ('BatchApex', 'ScheduledApex', 'Queueable');


