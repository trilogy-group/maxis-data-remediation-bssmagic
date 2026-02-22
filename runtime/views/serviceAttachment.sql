-- serviceAttachment.sql
-- View to expose attachment metadata for services (ProductAttributeDetails.json)
-- This view allows querying which services have OE attachment data

DROP VIEW IF EXISTS salesforce_server."serviceAttachment";
CREATE VIEW salesforce_server."serviceAttachment" AS
SELECT
    att."Id"::text AS id,
    att."Name"::text AS name,
    att."ParentId"::text AS "serviceId",
    svc."Name"::text AS "serviceName",
    svc."Service_Type__c"::text AS "serviceType",
    att."BodyLength"::integer AS "bodyLength",
    att."CreatedDate"::timestamp with time zone AS "createdDate",
    att."LastModifiedDate"::timestamp with time zone AS "lastModifiedDate",
    -- Construct the Salesforce REST API path for fetching the body
    ('/services/data/v59.0/sobjects/Attachment/' || att."Id" || '/Body')::text AS "bodyPath",
    -- TMF standard fields
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/serviceAttachment/' || att."Id")::text AS href,
    'ServiceAttachment'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."Attachment" att
INNER JOIN salesforce_server."csord__Service__c" svc ON att."ParentId" = svc."Id"
WHERE att."Name" = 'ProductAttributeDetails.json';





