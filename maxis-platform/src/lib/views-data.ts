export interface ViewField {
  csField: string;
  tmfField: string;
  type: string;
  pushdown?: boolean;
}

export interface ViewDefinition {
  id: number;
  name: string;
  file: string;
  group: 'rest-fdw' | 'core' | 'detection' | 'remediation';
  tmfEntity: string;
  tmfApi: string;
  tmfEndpoint?: string;
  description: string;
  sourceObject: string;
  csFieldCount?: number;
  mappedFieldCount?: number;
  joins: number;
  whereFilter?: string;
  direction?: 'Read' | 'Write' | 'Read/Write';
  fields: ViewField[];
  sqlSnippet?: string;
  performanceNote?: string;
}

export const VIEWS: ViewDefinition[] = [
  // === CORE ENTITY VIEWS ===
  {
    id: 1, name: 'Organization', file: 'organization.sql', group: 'core',
    sqlSnippet: `CREATE VIEW salesforce_server."organization" AS
SELECT
    t0."Id"::text                          AS "id",
    '...' || t0."Id"                       AS "href",
    t0."Name"::text                        AS "name",
    t0."Name"::text                        AS "tradingName",
    t0."Type"::text                        AS "organizationType",
    'validated'::tmf."OrganizationStateType" AS "status",

    -- External Reference (AccountNumber)
    CASE WHEN t0."AccountNumber" IS NOT NULL THEN
        ARRAY[
            ROW(
                NULL::text,                -- externalIdentifierType
                t0."AccountNumber"::text,  -- id
                NULL::text,                -- owner
                NULL::tmf."TimePeriod",    -- validFor
                'ExternalIdentifier'::text,
                NULL::text
            )::tmf."ExternalIdentifier"
        ]::tmf."ExternalIdentifier"[]
    ELSE NULL::tmf."ExternalIdentifier"[]
    END AS "externalReference",

    'Organization'::text AS "@type",
    'Party'::text        AS "@baseType"
FROM salesforce_server."Account" t0;`,
    performanceNote: 'Zero JOINs. All fields from Account object directly. FDW pushes all WHERE/LIMIT to SOQL.',
    tmfEntity: 'organization', tmfApi: 'TMF632', tmfEndpoint: '/tmf-api/partyManagement/v5/organization',
    description: 'Accounts mapped to TMF Organization. Used by relatedParty[customer] in Product view.',
    sourceObject: 'Account', csFieldCount: undefined, mappedFieldCount: 9, joins: 0,
    fields: [
      { csField: 'Id', tmfField: 'id', type: 'text', pushdown: true },
      { csField: 'Name', tmfField: 'name / tradingName', type: 'text', pushdown: true },
      { csField: 'Type', tmfField: 'organizationType', type: 'text', pushdown: true },
      { csField: "static 'validated'", tmfField: 'status', type: 'OrganizationStateType' },
      { csField: 'AccountNumber', tmfField: 'externalReference[].id', type: 'text' },
      { csField: 'generated', tmfField: 'href', type: 'text' },
    ],
  },
  {
    id: 2, name: 'Individual', file: 'individual.sql', group: 'core',
    sqlSnippet: `CREATE VIEW salesforce_server."individual" AS
SELECT
    t0."Name"::text      AS "name",
    t0."Name"::text      AS "formattedName",
    t0."LastName"::text  AS "familyName",
    t0."FirstName"::text AS "givenName",
    NULL::text           AS "gender",
    NULL::date           AS "birthDate",
    NULL::text           AS "status",

    -- relatedParty: Account (Organization) + CreatedBy (User)
    ARRAY_REMOVE(ARRAY[
        CASE WHEN t0."AccountId" IS NOT NULL THEN
            ROW('account', ROW(
                ROW(t0."AccountId", '...', NULL, 'Organization',
                    'PartyRef', NULL, NULL)::tmf."PartyRef",
                NULL
            )::tmf."OneOfPartyRefOrPartyRoleRef",
            NULL, NULL, NULL)::tmf."RelatedPartyRefOrPartyRoleRef"
        ELSE NULL END,
        -- ... creator entry similar pattern
    ], NULL) AS "relatedParty",

    t0."Id"::text        AS "id",
    '...' || t0."Id"     AS "href",
    'Individual'::text   AS "@type",
    'Party'::text        AS "@baseType"
FROM salesforce_server."Contact" t0;`,
    performanceNote: 'Zero JOINs. Direct Contact fields. relatedParty built from Account__c lookup field.',
    tmfEntity: 'individual', tmfApi: 'TMF632', tmfEndpoint: '/tmf-api/partyManagement/v5/individual',
    description: 'Contacts mapped to TMF Individual with relatedParty (account + creator).',
    sourceObject: 'Contact', mappedFieldCount: 14, joins: 0,
    fields: [
      { csField: 'Id', tmfField: 'id', type: 'text', pushdown: true },
      { csField: 'Name', tmfField: 'name', type: 'text', pushdown: true },
      { csField: 'FirstName', tmfField: 'givenName', type: 'text', pushdown: true },
      { csField: 'LastName', tmfField: 'familyName', type: 'text', pushdown: true },
      { csField: 'Email', tmfField: 'contactMedium[].email', type: 'text', pushdown: true },
      { csField: 'Phone', tmfField: 'contactMedium[].phoneNumber', type: 'text', pushdown: true },
    ],
  },
  {
    id: 3, name: 'Billing Account', file: 'billingAccount.sql', group: 'core',
    sqlSnippet: `CREATE VIEW salesforce_server."billingAccount" AS
SELECT
    ba."Id"::text                            AS id,
    '...' || ba."Id"                         AS href,
    ba."Name"::text                          AS name,
    ba."csconta__Status__c"::text            AS state,
    ba."Billing_Account_Type__c"::text       AS "accountType",
    ba."Account_Payment_Type__c"::text       AS "paymentStatus",
    ba."LastModifiedDate"::timestamptz       AS "lastUpdate",

    -- relatedParty: customer + contact (PIC Email) + creator
    ARRAY_REMOVE(ARRAY[
        -- Customer (Organization/Account)
        CASE WHEN ba."csconta__Account__c" IS NOT NULL THEN
            ROW('customer', ROW(ROW(
                ba."csconta__Account__c", '...', NULL,
                'Organization', 'PartyRef', NULL, NULL
            )::tmf."PartyRef", NULL)::tmf."OneOfPartyRefOrPartyRoleRef",
            NULL, NULL, NULL)::tmf."RelatedPartyRefOrPartyRoleRef"
        ELSE NULL END,
        -- Contact (Individual) — for PIC Email lookup
        CASE WHEN ba."Contact__c" IS NOT NULL THEN
            ROW('contact', ...)::tmf."RelatedPartyRefOrPartyRoleRef"
        ELSE NULL END,
        -- Creator (User)
        CASE WHEN ba."CreatedById" IS NOT NULL THEN
            ROW('creator', ...)::tmf."RelatedPartyRefOrPartyRoleRef"
        ELSE NULL END
    ], NULL) AS "relatedParty",

    'BillingAccount'::text AS "@type",
    'Entity'::text         AS "@baseType"
FROM salesforce_server."csconta__Billing_Account__c" ba;`,
    performanceNote: 'Zero JOINs. Complex relatedParty array built from direct lookup fields on the BA object.',
    tmfEntity: 'billingAccount', tmfApi: 'TMF666', tmfEndpoint: '/tmf-api/accountManagement/v5/billingAccount',
    description: 'CloudSense Billing Accounts with relatedParty (customer, contact for PIC Email, creator).',
    sourceObject: 'csconta__Billing_Account__c', csFieldCount: 50, mappedFieldCount: 9, joins: 0,
    fields: [
      { csField: 'Id', tmfField: 'id', type: 'text', pushdown: true },
      { csField: 'Name', tmfField: 'name', type: 'text', pushdown: true },
      { csField: 'Billing_Account_Type__c', tmfField: 'accountType', type: 'text', pushdown: true },
      { csField: 'Account_Payment_Type__c', tmfField: 'paymentStatus', type: 'text', pushdown: true },
      { csField: 'LastModifiedDate', tmfField: 'lastUpdate', type: 'timestamp' },
      { csField: 'csconta__Account__c', tmfField: 'relatedParty[customer]', type: 'reference' },
      { csField: 'csconta__Account__c (Contact)', tmfField: 'relatedParty[contact] (PIC Email)', type: 'reference' },
    ],
  },
  {
    id: 4, name: 'Shopping Cart', file: 'shoppingCart.sql', group: 'core',
    sqlSnippet: `CREATE VIEW salesforce_server."shoppingCart" AS
SELECT
    t0."Id"::text                                 AS id,
    '...' || t0."Id"                              AS href,
    t0."CreatedDate"::timestamptz                 AS "creationDate",
    t0."LastModifiedDate"::timestamptz            AS "lastUpdate",
    t0."csordtelcoa__Basket_Stage__c"::text       AS "status",

    -- cartTotalPrice (MYR currency)
    CASE WHEN t0."cscfga__Total_Price__c" IS NOT NULL THEN
        ARRAY[ROW('Cart Total', 'Total', 'total', NULL, NULL, NULL,
            ROW(NULL, NULL,
                ROW('MYR', t0."cscfga__Total_Price__c"::float)::tmf."Money",
                NULL, 'Price', 'Price', NULL
            )::tmf."Price",
            NULL, 'CartPrice', 'CartPrice', NULL
        )::tmf."CartPrice"]::tmf."CartPrice"[]
    ELSE NULL END AS "cartTotalPrice",

    -- cartItem[] via ARRAY_AGG
    ARRAY_AGG(
        ROW('add', t1."Id", t1."cscfga__Quantity__c"::int,
            CASE WHEN t1."cscfga__Configuration_Status__c" = 'Valid'
                 THEN 'active' ELSE 'active' END,
            NULL, NULL, NULL,
            -- itemPrice (TCV, RC, OTC per item)
            ARRAY[...]::tmf."CartPrice"[],
            NULL, NULL, t1."Id", 'CartItem', 'CartItem', NULL
        )::tmf."CartItem"
    ) FILTER (WHERE t1."Id" IS NOT NULL) AS "cartItem",

    -- relatedParty: customer + creator
    ARRAY_REMOVE(ARRAY[...], NULL) AS "relatedParty",

    'ShoppingCart'::text AS "@type"
FROM salesforce_server."cscfga__Product_Basket__c" t0
LEFT JOIN salesforce_server."cscfga__Product_Configuration__c" t1
    ON t1."cscfga__Product_Basket__c" = t0."Id"
GROUP BY t0."Id", t0."CreatedDate", t0."LastModifiedDate",
         t0."csordtelcoa__Basket_Stage__c", ...;`,
    performanceNote: 'Uses LEFT JOIN to Product_Configuration (618K records). JOIN is necessary for cartItem[] aggregation. Use LIMIT to avoid full scan.',
    tmfEntity: 'shoppingCart', tmfApi: 'TMF663', tmfEndpoint: '/tmf-api/shoppingCart/v5/shoppingCart',
    description: 'Product Basket with Cart Items (Product Configurations). Uses ARRAY_AGG for cartItem array. Includes relatedParty (customer, billing account, creator).',
    sourceObject: 'cscfga__Product_Basket__c JOIN cscfga__Product_Configuration__c', csFieldCount: 166, mappedFieldCount: 12, joins: 1,
    fields: [
      { csField: 'Id', tmfField: 'id', type: 'text', pushdown: true },
      { csField: 'csordtelcoa__Basket_Stage__c', tmfField: 'status', type: 'text', pushdown: true },
      { csField: 'CreatedDate', tmfField: 'creationDate', type: 'timestamp' },
      { csField: 'LastModifiedDate', tmfField: 'lastUpdate', type: 'timestamp' },
      { csField: 'cscfga__Total_Price__c', tmfField: 'cartTotalPrice.value', type: 'numeric' },
      { csField: 'ARRAY_AGG(Product_Configuration)', tmfField: 'cartItem[]', type: 'CartItem[]' },
      { csField: 'PC.Id', tmfField: 'cartItem[].id', type: 'text' },
      { csField: 'PC.cscfga__Quantity__c', tmfField: 'cartItem[].quantity', type: 'integer' },
      { csField: 'PC.cscfga__Configuration_Status__c', tmfField: 'cartItem[].status', type: 'text' },
      { csField: 'PC.cscfga__total_contract_value__c', tmfField: 'cartItem[].itemTotalPrice', type: 'Money (MYR)' },
      { csField: 'csordtelcoa__Account__c', tmfField: 'relatedParty[customer]', type: 'Organization' },
      { csField: 'Billing_Account__c', tmfField: 'relatedParty[billingAccount]', type: 'PartyRoleRef' },
    ],
  },
  {
    id: 5, name: 'Product Order', file: 'productOrder.sql', group: 'core',
    sqlSnippet: `CREATE VIEW salesforce_server."productOrder" AS
SELECT
    -- State mapping: Status2__c (NOT Status__c!)
    CASE
        WHEN t0."csord__Status2__c" = 'Draft'           THEN 'draft'
        WHEN t0."csord__Status2__c" = 'Submitted'       THEN 'acknowledged'
        WHEN t0."csord__Status2__c" = 'In Progress'     THEN 'inProgress'
        WHEN t0."csord__Status2__c" = 'Completed'       THEN 'completed'
        WHEN t0."csord__Status2__c" = 'Cancelled'       THEN 'cancelled'
        WHEN t0."csord__Status2__c" = 'Rejected'        THEN 'rejected'
        WHEN t0."csord__Status2__c" = 'On Hold'         THEN 'held'
        WHEN t0."csord__Status2__c" = 'Failed'          THEN 'failed'
        WHEN t0."csord__Status2__c" = 'Partial'         THEN 'partial'
        WHEN t0."csord__Status2__c" = 'Order Submitted' THEN 'acknowledged'
        ELSE 'pending'
    END::tmf."ProductOrderStateType" AS "state",

    COALESCE(t0."csord__Order_Type__c", 'standard') AS "category",
    t0."Comments__c"::text                          AS "description",
    t0."csord__End_Date__c"::timestamptz            AS "expectedCompletionDate",
    t0."CreatedDate"::timestamptz                   AS "creationDate",
    t0."Order_Completed_Date__c"::timestamptz       AS "completionDate",

    -- External identifiers
    CASE WHEN t0."csord__Customer_Order_Number__c" IS NOT NULL THEN
        ARRAY[
            ROW(NULL, 'CustomerOrderNumber',
                t0."csord__Customer_Order_Number__c", NULL, NULL, NULL
            )::tmf."ExternalIdentifier",
            ROW(NULL, 'OrderNumber',
                COALESCE(t0."csord__Order_Number__c", t0."Name"),
                NULL, NULL, NULL
            )::tmf."ExternalIdentifier"
        ]::tmf."ExternalIdentifier"[]
    ELSE
        ARRAY[ROW(NULL, 'OrderNumber',
            COALESCE(t0."csord__Order_Number__c", t0."Name"),
            NULL, NULL, NULL)::tmf."ExternalIdentifier"
        ]::tmf."ExternalIdentifier"[]
    END AS "externalId",

    -- relatedParty from Account JOIN
    CASE WHEN t1."Id" IS NOT NULL THEN
        ARRAY[ROW(NULL, ROW(ROW(t1."Id", '...', t1."Name",
            'Party', NULL, NULL, NULL)::tmf."PartyRef", NULL
        )::tmf."OneOfPartyRefOrPartyRoleRef",
        NULL, NULL, NULL)::tmf."RelatedPartyRefOrPartyRoleRef"
        ]::tmf."RelatedPartyRefOrPartyRoleRef"[]
    ELSE NULL END AS "relatedParty",

    t0."Id"::text          AS "id",
    '...' || t0."Id"       AS "href",
    'ProductOrder'::text   AS "@type"
FROM salesforce_server."csord__Order__c" t0
LEFT JOIN salesforce_server."Account" t1
    ON t0."csord__Account__c" = t1."Id";`,
    performanceNote: 'LEFT JOIN to Account for customer name. CASE statement maps Status2__c (not Status__c!) to TMF state enum. CASE is client-side evaluation.',
    tmfEntity: 'productOrder', tmfApi: 'TMF622', tmfEndpoint: '/tmf-api/productOrderingManagement/v5/productOrder',
    description: 'CloudSense Orders. Uses csord__Status2__c (NOT Status__c) as the authoritative status field.',
    sourceObject: 'csord__Order__c JOIN Account', csFieldCount: 111, mappedFieldCount: 18, joins: 1,
    fields: [
      { csField: 'Id', tmfField: 'id', type: 'text', pushdown: true },
      { csField: 'csord__Status2__c (NOT Status__c!)', tmfField: 'state', type: 'ProductOrderStateType', pushdown: true },
      { csField: 'csord__Order_Type__c', tmfField: 'category', type: 'text' },
      { csField: 'Comments__c', tmfField: 'description', type: 'text' },
      { csField: 'csord__Customer_Order_Number__c', tmfField: 'externalId[CustomerOrderNumber]', type: 'text' },
      { csField: 'csord__Start_Date__c', tmfField: 'requestedStartDate', type: 'timestamp' },
      { csField: 'csord__End_Date__c', tmfField: 'expectedCompletionDate', type: 'timestamp' },
      { csField: 'Order_Completed_Date__c', tmfField: 'completionDate', type: 'timestamp' },
      { csField: 'CreatedDate', tmfField: 'creationDate', type: 'timestamp' },
      { csField: 'Account.Id + Account.Name (JOIN)', tmfField: 'relatedParty', type: 'PartyRef' },
    ],
  },
  {
    id: 6, name: 'Product (Solution)', file: 'product.sql', group: 'core',
    sqlSnippet: `CREATE VIEW salesforce_server."product" AS
SELECT
    -- Billing Account (from Account JOIN)
    CASE WHEN t0."csord__Account__c" IS NOT NULL THEN
        ROW(NULL, t0."csord__Account__c", '...',
            acct."Name", 'BillingAccount', NULL, NULL, NULL
        )::tmf."BillingAccountRef"
    ELSE NULL END AS "billingAccount",

    -- Dates
    t0."CreatedDate"::timestamptz                       AS "creationDate",
    COALESCE(t0."Bundle_Start_Date__c", t0."CreatedDate") AS "startDate",
    COALESCE(t0."Product_Name__c", t0."Name")::text     AS "description",
    t0."Name"::text                                     AS "name",
    true::boolean                                       AS "isBundle",

    -- Status (direct field — enables FDW pushdown filtering)
    t0."csord__External_Identifier__c"::tmf."ProductStatusType" AS "status",

    -- Pricing (3 separate price tiers)
    ARRAY_REMOVE(ARRAY[
        CASE WHEN t0."cssdm__total_contract_value__c" IS NOT NULL THEN
            ROW('Total Contract Value', 'TCV', NULL, NULL, NULL, NULL,
                ROW(NULL, NULL, ROW('MYR',
                    t0."cssdm__total_contract_value__c"::float)::tmf."Money",
                NULL, 'Price', 'Price', NULL)::tmf."Price",
                NULL, NULL, NULL, NULL)::tmf."ProductPrice"
        ELSE NULL END,
        -- ... RC and OTC similar pattern
    ], NULL) AS "productPrice",

    -- Characteristics (migration flags, validation)
    ARRAY[
        ROW('solutionStatus', t0."csord__Status__c",
            'SolutionStatusType', NULL, NULL)::tmf."Characteristic",
        ROW('isMigratedToHeroku',
            t0."Is_Migrated_To_Heroku__c"::text,
            'Boolean', NULL, NULL)::tmf."Characteristic"
    ]::tmf."Characteristic"[] AS "productCharacteristic",

    -- relatedParty: customer (Account JOIN) + creator
    ARRAY_REMOVE(ARRAY[...], NULL) AS "relatedParty",

    t0."Id"::text       AS "id",
    '...' || t0."Id"    AS "href",
    'Product'::text     AS "@type"
FROM salesforce_server."csord__Solution__c" t0
LEFT JOIN salesforce_server."Account" acct
    ON t0."csord__Account__c" = acct."Id";`,
    performanceNote: 'Solution mapped as TMF Product (not Agreement). LEFT JOIN to Account for customer name. productPrice uses 3 separate price fields (TCV/RC/OTC).',
    tmfEntity: 'product', tmfApi: 'TMF637', tmfEndpoint: '/tmf-api/productInventory/v5/product',
    description: 'Solutions mapped to TMF Product. Only 1 JOIN (Account) for FDW rate limiting. Includes pricing (TCV/RC/OTC), contract terms, MACD relationships. Creator resolved via known User ID CASE lookup (no JOIN).',
    sourceObject: 'csord__Solution__c JOIN Account', csFieldCount: 136, mappedFieldCount: 29, joins: 1,
    fields: [
      { csField: 'Id', tmfField: 'id', type: 'text', pushdown: true },
      { csField: 'Name', tmfField: 'name', type: 'text', pushdown: true },
      { csField: 'Product_Name__c / Name', tmfField: 'description', type: 'text' },
      { csField: 'csord__External_Identifier__c', tmfField: 'status', type: 'ProductStatusType', pushdown: true },
      { csField: 'CreatedDate', tmfField: 'creationDate', type: 'timestamp' },
      { csField: 'cssdm__total_contract_value__c', tmfField: 'productPrice[TCV].value', type: 'Money (MYR)' },
      { csField: 'cssdm__total_recurring_charge__c', tmfField: 'productPrice[RC].value', type: 'Money (MYR)' },
      { csField: 'cssdm__total_one_off_charge__c', tmfField: 'productPrice[OTC].value', type: 'Money (MYR)' },
      { csField: 'csord__Status__c', tmfField: 'characteristic[solutionStatus]', type: 'string' },
      { csField: 'Is_Migrated_to_Heroku__c', tmfField: 'characteristic[isMigratedToHeroku]', type: 'boolean' },
      { csField: 'csord__External_Identifier__c', tmfField: 'characteristic[migrationStatus]', type: 'string' },
      { csField: 'cssdm__replaced_solution__c', tmfField: 'productRelationship[replaces]', type: 'reference' },
      { csField: 'Solution_Number__c', tmfField: 'productSerialNumber', type: 'text' },
      { csField: 'Contract_Term__c', tmfField: 'productTerm (months)', type: 'Duration' },
      { csField: 'Account.Id + Account.Name', tmfField: 'relatedParty[customer]', type: 'Organization' },
      { csField: 'CreatedById + CASE lookup', tmfField: 'relatedParty[creator]', type: 'Individual' },
    ],
  },
  {
    id: 7, name: 'Service', file: 'service.sql', group: 'core',
    sqlSnippet: `CREATE VIEW salesforce_server."service" AS
SELECT
    -- Core TMF Service fields
    svc."Id"::text                                AS id,
    svc."Name"::text                              AS "name",
    svc."Service_Type__c"::text                   AS "serviceType",
    svc."csord__Status__c"::text                  AS "state",
    svc."CreatedDate"::timestamptz                AS "startDate",
    '...' || svc."Id"                             AS href,

    -- Custom x_* fields for detection (all direct — NO JOINs!)
    svc."Service_Type__c"::text                   AS "x_serviceType",
    svc."External_ID__c"::text                    AS "x_externalId",
    svc."Billing_Account__c"::text                AS "x_billingAccountId",
    svc."cssdm__solution_association__c"::text     AS "x_solutionId",
    svc."csord__Subscription__c"::text            AS "x_subscriptionId",
    svc."Account__c"::text                        AS "x_accountId",
    svc."Migrated_Data__c"::boolean               AS "x_migratedData",
    svc."Migrated_To_Heroku__c"::boolean          AS "x_migratedToHeroku",
    svc."csordtelcoa__Replacement_Service__c"     AS "x_replacementServiceId",
    svc."Authorized_PIC_Email__c"::text           AS "x_picEmail",
    svc."csordtelcoa__Product_Configuration__c"   AS "x_productConfigurationId",

    -- 1867 Detection flag (computed, client-side evaluation)
    CASE
        WHEN svc."Migrated_Data__c" = true
         AND svc."Service_Type__c" IN (
             'Voice', 'Fibre Service', 'eSMS Service', 'Access Service')
         AND svc."csordtelcoa__Replacement_Service__c" IS NULL
        THEN true ELSE false
    END::boolean AS "x_has1867Issue",

    svc."csordtelcoa__Parent_Product_Configuration__c" AS "x_parentBundleId",
    'Service'::text AS "@type",
    'Entity'::text  AS "@baseType"
FROM salesforce_server."csord__Service__c" svc;
-- Zero JOINs — 321K records, max FDW performance`,
    performanceNote: 'Zero JOINs (321K records). Deliberately avoids Subscription/Attribute JOINs. CASE for x_has1867Issue is client-side but all direct fields push to SOQL.',
    tmfEntity: 'service', tmfApi: 'TMF638', tmfEndpoint: '/tmf-api/serviceInventoryManagement/v5/service',
    description: 'CloudSense Services with 1867 detection fields. Zero JOINs for maximum FDW performance. Only 20 of 293 CS fields mapped (6.8%) - only fields needed for detection, remediation, and filtering.',
    sourceObject: 'csord__Service__c', csFieldCount: 293, mappedFieldCount: 20, joins: 0,
    fields: [
      { csField: 'Id', tmfField: 'id', type: 'text', pushdown: true },
      { csField: 'Name', tmfField: 'name', type: 'text', pushdown: true },
      { csField: 'Service_Type__c', tmfField: 'serviceType / x_serviceType', type: 'text', pushdown: true },
      { csField: 'csord__Status__c', tmfField: 'state', type: 'text', pushdown: true },
      { csField: 'CreatedDate', tmfField: 'startDate', type: 'timestamp', pushdown: true },
      { csField: 'External_ID__c', tmfField: 'x_externalId', type: 'text', pushdown: true },
      { csField: 'Billing_Account__c', tmfField: 'x_billingAccountId', type: 'text', pushdown: true },
      { csField: 'cssdm__solution_association__c', tmfField: 'x_solutionId', type: 'text', pushdown: true },
      { csField: 'csord__Subscription__c', tmfField: 'x_subscriptionId', type: 'text', pushdown: true },
      { csField: 'Account__c', tmfField: 'x_accountId', type: 'text', pushdown: true },
      { csField: 'Migrated_Data__c', tmfField: 'x_migratedData', type: 'boolean', pushdown: true },
      { csField: 'Migrated_To_Heroku__c', tmfField: 'x_migratedToHeroku', type: 'boolean', pushdown: true },
      { csField: 'csordtelcoa__Replacement_Service__c', tmfField: 'x_replacementServiceId', type: 'text', pushdown: true },
      { csField: 'Authorized_PIC_Email__c', tmfField: 'x_picEmail', type: 'text', pushdown: true },
      { csField: 'csordtelcoa__Product_Configuration__c', tmfField: 'x_productConfigurationId', type: 'text', pushdown: true },
      { csField: 'CASE expression (computed)', tmfField: 'x_has1867Issue', type: 'boolean', pushdown: false },
      { csField: 'csordtelcoa__Parent_Product_Configuration__c', tmfField: 'x_parentBundleId', type: 'text', pushdown: true },
    ],
  },

  // === DETECTION VIEWS ===
  // These are the active detection mechanisms. The base service view (above) carries
  // x_has1867Issue and x_* fields that enable filtering via the TMF API directly.
  // Separate per-service-type SQL views existed during development but are NOT deployed
  // to the API — detection is done via the unified x_has1867Issue flag instead.
  {
    id: 8, name: 'Migrated Services - Missing Data', file: 'service.sql (x_has1867Issue)', group: 'detection',
    tmfEntity: 'service', tmfApi: 'TMF638',
    tmfEndpoint: '/tmf-api/serviceInventoryManagement/v5/service?x_has1867Issue=true',
    description: 'Primary detection mechanism. The base service view computes x_has1867Issue as a CASE expression: Migrated_Data__c=true AND Service_Type__c IN (Voice, Fibre, eSMS, Access) AND no replacement service. Filter via ?x_has1867Issue=true on the standard service endpoint.',
    sourceObject: 'csord__Service__c', joins: 0,
    performanceNote: 'Uses the base service view — no separate SQL view needed. The x_has1867Issue CASE is client-side evaluation but all underlying fields push to SOQL.',
    sqlSnippet: `-- Detection is a computed field on the base service view:
CASE
    WHEN svc."Migrated_Data__c" = true
     AND svc."Service_Type__c" IN (
         'Voice', 'Fibre Service', 'eSMS Service', 'Access Service')
     AND svc."csordtelcoa__Replacement_Service__c" IS NULL
    THEN true ELSE false
END::boolean AS "x_has1867Issue"

-- Query: GET /service?x_has1867Issue=true&limit=100
-- Scoping by type: &x_serviceType=Voice (or Fibre Service, etc.)`,
    whereFilter: "x_has1867Issue = true (computed CASE on Migrated_Data__c + Service_Type__c + no Replacement)",
    fields: [
      { csField: 'Migrated_Data__c', tmfField: 'x_migratedData', type: 'boolean', pushdown: true },
      { csField: 'Service_Type__c', tmfField: 'x_serviceType', type: 'text', pushdown: true },
      { csField: 'csordtelcoa__Replacement_Service__c', tmfField: 'x_replacementServiceId', type: 'text', pushdown: true },
      { csField: 'CASE expression', tmfField: 'x_has1867Issue', type: 'boolean', pushdown: false },
      { csField: 'Billing_Account__c', tmfField: 'x_billingAccountId', type: 'text', pushdown: true },
      { csField: 'Authorized_PIC_Email__c', tmfField: 'x_picEmail', type: 'text', pushdown: true },
    ],
  },
  {
    id: 9, name: 'Failed Migration Solutions', file: 'failedMigrationProduct.sql', group: 'detection',
    tmfEntity: 'failedMigrationProduct', tmfApi: 'TMF637 (filtered)',
    description: "Deployed view filtering solutions where csord__External_Identifier__c = 'Not Migrated Successfully'. Identifies solutions that failed the Heroku migration process. Includes a LEFT JOIN to User for createdByName. Currently deployed to DB but not yet mapped to a TMF API endpoint.",
    sourceObject: 'csord__Solution__c LEFT JOIN User', joins: 1,
    performanceNote: 'WHERE clause pushes to SOQL (efficient). LEFT JOIN to User adds creator name. A second view (failedMigrationSolutions) is identical but with a different href pattern.',
    whereFilter: "csord__External_Identifier__c = 'Not Migrated Successfully'",
    sqlSnippet: `CREATE VIEW salesforce_server."failedMigrationProduct" AS
SELECT
    t0."Name"::text                          AS name,
    CONCAT('Solution Type: ',
        COALESCE(t0."csord__Type__c", 'Unknown')
    )::text                                  AS description,
    t0."csord__Type__c"::text                AS "solutionType",
    t0."csord__Status__c"::text              AS status,
    t0."csord__External_Identifier__c"::text AS "migrationStatus",
    t1."Name"::text                          AS "createdByName",
    t0."CreatedDate"::timestamptz            AS "createdDate",
    '...' || t0."Id"                         AS href,
    t0."Id"::text                            AS id,
    'FailedMigrationProduct'::text           AS "@type",
    'Product'::text                          AS "@baseType"
FROM salesforce_server."csord__Solution__c" t0
LEFT JOIN salesforce_server."User" t1
    ON t0."CreatedById" = t1."Id"
WHERE t0."csord__External_Identifier__c" = 'Not Migrated Successfully';

-- Status: Deployed to DB, NOT yet mapped to API
-- Workaround: GET /product?status=Not Migrated Successfully`,
    fields: [
      { csField: 'Name', tmfField: 'name', type: 'text', pushdown: true },
      { csField: 'csord__Type__c', tmfField: 'solutionType', type: 'text', pushdown: true },
      { csField: 'csord__Status__c', tmfField: 'status', type: 'text', pushdown: true },
      { csField: 'csord__External_Identifier__c', tmfField: 'migrationStatus', type: 'text', pushdown: true },
      { csField: 'User.Name (JOIN)', tmfField: 'createdByName', type: 'text', pushdown: false },
      { csField: 'CreatedDate', tmfField: 'createdDate', type: 'timestamp', pushdown: true },
    ],
  },
  {
    id: 10, name: 'Solution Missing Product Basket', file: '(runtime detection logic)', group: 'detection',
    tmfEntity: 'product', tmfApi: 'TMF637',
    tmfEndpoint: '/tmf-api/productInventory/v5/product',
    description: 'Identifies solutions where cssdm__product_basket__c IS NULL — indicating the product basket link is broken. This is the 1147 issue detection. Detection is done at query time via the product view characteristics or at remediation time by the batch orchestrator.',
    sourceObject: 'csord__Solution__c', joins: 0,
    performanceNote: 'No separate SQL view — detection logic runs in the batch orchestrator VALIDATE step (GET /solutionInfo/{id} checks basket linkage).',
    sqlSnippet: `-- No separate SQL view for this detection.
-- Detection happens in the remediation workflow:
--
-- Step 1 (VALIDATE): GET /solutionInfo/{solutionId}
--   → Apex checks cssdm__product_basket__c
--   → Returns validation result
--
-- The product view exposes solution status via
-- productCharacteristic[].name = 'validationStatus'
-- which is set to 'valid' by default (performance optimization)
-- and validated on-demand by the remediation API.`,
    fields: [
      { csField: 'cssdm__product_basket__c', tmfField: '(checked by Apex API)', type: 'reference' },
    ],
  },

  // === REMEDIATION & OPERATIONS VIEWS ===
  {
    id: 18, name: 'Service Problem', file: 'serviceProblem.sql', group: 'remediation',
    tmfEntity: 'serviceProblem', tmfApi: 'TMF656', tmfEndpoint: '/tmf-api/serviceProblemManagement/v5/serviceProblem',
    description: 'Confirmed issues & remediation tracking. Internal PostgreSQL table exposed via TMF API. Categories: SolutionEmpty, PartialDataMissing. Lifecycle: pending -> inProgress -> resolved/rejected.',
    sourceObject: 'tmf."serviceProblem" (internal table)', joins: 0,
    fields: [
      { csField: 'id (uuid)', tmfField: 'id', type: 'uuid' },
      { csField: 'category', tmfField: 'category', type: 'text' },
      { csField: 'status', tmfField: 'status', type: 'text' },
      { csField: 'characteristic (jsonb)', tmfField: 'characteristic[]', type: 'jsonb' },
      { csField: 'statusChangeDate', tmfField: 'statusChangeDate', type: 'timestamp' },
      { csField: 'resolutionDate', tmfField: 'resolutionDate', type: 'timestamp' },
      { csField: 'firstAlert', tmfField: 'firstAlert', type: 'timestamp' },
      { csField: 'description', tmfField: 'description', type: 'text' },
    ],
  },
  {
    id: 19, name: 'Service Problem Event Record', file: 'serviceProblemEventRecord.sql', group: 'remediation',
    tmfEntity: 'serviceProblemEventRecord', tmfApi: 'TMF656',
    description: 'Apex batch job execution records as service problem events. Maps AsyncApexJob joined with ApexClass.',
    sourceObject: 'AsyncApexJob JOIN ApexClass', joins: 1,
    fields: [
      { csField: 'AsyncApexJob.Id', tmfField: 'id', type: 'text' },
      { csField: 'CreatedDate', tmfField: 'eventTime', type: 'timestamp' },
      { csField: 'ApexClass.Name + Status', tmfField: 'eventType', type: 'text' },
      { csField: 'NumberOfErrors', tmfField: 'notification (error count)', type: 'integer' },
    ],
  },
  {
    id: 20, name: 'Batch Job', file: 'batchJob.sql', group: 'remediation',
    tmfEntity: 'batchJob', tmfApi: 'Custom Batch', tmfEndpoint: '/tmf-api/batchProcessing/v1/batchJob',
    description: 'Batch remediation job tracking. Internal PostgreSQL table for scheduled & immediate batch runs.',
    sourceObject: 'tmf."batchJob" (internal table)', joins: 0,
    fields: [
      { csField: 'id (uuid)', tmfField: 'id', type: 'uuid' },
      { csField: 'status', tmfField: 'status', type: 'text' },
      { csField: 'type', tmfField: 'type', type: 'text' },
      { csField: 'progress (jsonb)', tmfField: 'progress', type: 'jsonb' },
    ],
  },

  // === REST FDW VIEWS (Write Operations) ===
  {
    id: 22, name: 'Solution Info (GET)', file: 'rest_foreign_tables.sql', group: 'rest-fdw',
    tmfEntity: 'solutionInfo', tmfApi: 'Custom Solution Mgmt',
    tmfEndpoint: '/tmf-api/solutionManagement/v5/solutionInfo/{id}',
    description: 'Step 1 of 5-step remediation: VALIDATE. Checks MACD eligibility, basket details, migration state.',
    sourceObject: 'Apex REST: GET /api/v1/solutions/{id}', joins: 0, direction: 'Read',
    fields: [
      { csField: 'solutionId', tmfField: 'id', type: 'text' },
      { csField: 'success', tmfField: 'success', type: 'boolean' },
      { csField: 'basketDetails', tmfField: 'basketDetails (MACD check)', type: 'json' },
    ],
  },
  {
    id: 23, name: 'Migration Status (GET)', file: 'rest_foreign_tables.sql', group: 'rest-fdw',
    tmfEntity: 'migrationStatus', tmfApi: 'Custom Solution Mgmt',
    tmfEndpoint: '/tmf-api/solutionManagement/v5/migrationStatus/{id}',
    description: 'Step 4 of 5-step remediation: POLL. Exponential backoff until migration completes.',
    sourceObject: 'Apex REST: GET /api/v1/solutions/{id}/migrations/status', joins: 0, direction: 'Read',
    fields: [
      { csField: 'solutionId', tmfField: 'id', type: 'text' },
      { csField: 'status', tmfField: 'status (Completed/InProgress)', type: 'text' },
      { csField: 'jobId', tmfField: 'jobId', type: 'text' },
    ],
  },
  {
    id: 24, name: 'Solution Migration (POST)', file: 'rest_foreign_tables.sql', group: 'rest-fdw',
    tmfEntity: 'solutionMigration', tmfApi: 'Custom Solution Mgmt',
    tmfEndpoint: '/tmf-api/solutionManagement/v5/solutionMigration',
    description: 'Step 3 of 5-step remediation: MIGRATE. Triggers re-migration, returns jobId for polling.',
    sourceObject: 'Apex REST: POST /api/v1/solutions/{id}/migrations', joins: 0, direction: 'Write',
    fields: [
      { csField: 'solutionId (in body)', tmfField: 'id', type: 'text' },
      { csField: 'jobId (response)', tmfField: 'jobId', type: 'text' },
    ],
  },
  {
    id: 25, name: 'Solution Delete (DELETE)', file: 'rest_foreign_tables.sql', group: 'rest-fdw',
    tmfEntity: 'solutionMigration (DELETE)', tmfApi: 'Custom Solution Mgmt',
    tmfEndpoint: '/tmf-api/solutionManagement/v5/solutionMigration/{id}',
    description: 'Step 2 of 5-step remediation: DELETE. Cleans up existing SM artifacts before re-migration.',
    sourceObject: 'Apex REST: DELETE /api/v1/solutions/{id}', joins: 0, direction: 'Write',
    fields: [{ csField: 'solutionId (in path)', tmfField: 'id', type: 'text' }],
  },
  {
    id: 26, name: 'Solution Post Update (PATCH)', file: 'rest_foreign_tables.sql', group: 'rest-fdw',
    tmfEntity: 'solutionPostUpdate', tmfApi: 'Custom Solution Mgmt',
    tmfEndpoint: '/tmf-api/solutionManagement/v5/solutionPostUpdate',
    description: 'Step 5 of 5-step remediation: POST_UPDATE. Sets isMigratedToHeroku, isConfigurationUpdatedToHeroku, clears externalIdentifier.',
    sourceObject: 'Apex REST: PATCH /api/v1/solutions/{id}', joins: 0, direction: 'Write',
    fields: [
      { csField: 'solutionId', tmfField: 'id', type: 'text' },
      { csField: 'isMigratedToHeroku: true', tmfField: 'sfdcUpdates.isMigratedToHeroku', type: 'boolean' },
      { csField: 'isConfigurationUpdatedToHeroku: true', tmfField: 'sfdcUpdates.isConfigUpdated', type: 'boolean' },
      { csField: 'externalIdentifier: ""', tmfField: 'sfdcUpdates.externalIdentifier', type: 'text' },
    ],
  },
  {
    id: 27, name: 'OE Service Info (GET)', file: 'oe_foreign_tables.sql', group: 'rest-fdw',
    tmfEntity: 'oeServiceInfo', tmfApi: 'Custom OE Remediation',
    description: 'Step 1 of 4-step OE remediation: FETCH. Gets migrated service details and OE data.',
    sourceObject: 'Apex REST: GET /api/v1/migrated-services/{id}', joins: 0, direction: 'Read',
    fields: [{ csField: 'serviceId', tmfField: 'id', type: 'text' }],
  },
  {
    id: 28, name: 'OE Service Attachment (PUT)', file: 'oe_foreign_tables.sql', group: 'rest-fdw',
    tmfEntity: 'oeServiceAttachment', tmfApi: 'Custom OE Remediation',
    description: 'Step 3 of 4-step OE remediation: PATCH. Updates ProductAttributeDetails.json attachment.',
    sourceObject: 'Apex REST: PUT /api/v1/migrated-services/{id}/attachment', joins: 0, direction: 'Write',
    fields: [{ csField: 'serviceId', tmfField: 'id', type: 'text' }],
  },
  {
    id: 29, name: 'OE Service Remediation (POST)', file: 'oe_foreign_tables.sql', group: 'rest-fdw',
    tmfEntity: 'oeServiceRemediation', tmfApi: 'Custom OE Remediation',
    description: 'Step 4 of 4-step OE remediation: SYNC. Triggers full OE data synchronization.',
    sourceObject: 'Apex REST: POST /api/v1/migrated-services/{id}/remediations', joins: 0, direction: 'Write',
    fields: [{ csField: 'serviceId', tmfField: 'id', type: 'text' }],
  },
];

export const VIEW_GROUPS = {
  'core': { label: 'Core TMF Entity Views', description: '7 views mapping CloudSense objects to TM Forum standard entities', count: 7 },
  'detection': { label: 'Data Quality & Detection', description: 'Detection mechanisms for migrated service issues (1867) and failed migrations — using x_* flags and status filters', count: 3 },
  'remediation': { label: 'Remediation & Operations Views', description: '3 internal PostgreSQL tables exposed as TMF APIs for issue tracking', count: 3 },
  'rest-fdw': { label: 'REST FDW Write Operations', description: '8 foreign tables for Salesforce Apex REST API calls (Solution + OE remediation)', count: 8 },
};
