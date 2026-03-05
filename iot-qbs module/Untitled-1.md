
[WIP]Low Level Design (LLD): IoT QBS Issue (QBS Index / Service↔PC Mismatch) Remediation & Automation



By Ashish Agarwal

5 min

8

Add a reaction
Karma Page Builder
Karma Page Builder
1. Purpose
2. Problem Statement
2.1 When it happens
2.2 What breaks
2.3 Observed symptoms
2.4 Current operational workaround
3. Scope
3.1 In Scope
3.2 Out Of Scope
4. High-Level Architecture
Components
5. Detection Logic (Two Options)
Option 1 — Scheduled SOQL Polling (Interval-Based Detection)
Description
SOQL (Held orchestration detection)
Pros / Cons
Option 2 — Event-Driven Detection (Flow Publishes Event)
Description
Recommended Event Mechanism: Platform Events
Platform Event Requirements
JSON Payload Contract (Required)
Recommendation
6. IoT Service Remediation Workflow
6.1 High-Level Flow
6.2 Apex REST API–Based Implementation Details
6.2.1 Base Path & Versioning
Endpoints used by this capability
6.2.2 Design Principles
1. Purpose
Design an automated detection + remediation capability for IoT MACD orders that intermittently suffer from QBS index mismatch during service splitting, causing wrong Service ↔ Product Configuration (PC) linkage (and sometimes unexpected counts/duplication). The automation should reduce manual operations work (currently ~45–90 mins/order, ~2–3 orders/day) and shorten customer-impacting delays caused by “hold + manual patch + release”.

This automation (via BSS Magic) aims to:

Detect IoT MACD orders that are automatically placed on Hold

Validate whether services were mapped to the correct Product Configurations (PCs)

Patch incorrect mappings and required service fields

Automatically release orchestration holds when safe

Escalate unknown patterns/anomalies for manual intervention

2. Problem Statement
2.1 When it happens
New IoT activations: “no issue”.

Existing IoT MACD (modifications on an existing solution with many services): issue occurs when a user splits a basket to modify only a subset of services (e.g., from 100 services modify 10).

2.2 What breaks
A “QBS index” used for mapping services during split can shift or mismatch.

Result: the system applies changes intended for one set of services to the wrong services.

2.3 Observed symptoms
Wrong linkage: Services that the user selected for change end up linked to the wrong PC after order generation.

Intermittent/random: “picking some random numbers.”

Cascading effect: later MACD can cause previously untouched PCs/services to reappear in the basket after “calculate total”.

Count anomalies (seen in FDR org): sometimes PC1/PC2 service counts become 9/91, 11/89 etc; also possibility of extra/duplicate services.

2.4 Current operational workaround
A backend Flow / Orchestration Process automatically sets qualifying IoT MACD orchestration processes to Hold immediately after creation.

Ops (Maxis) periodically runs a query (every 1–2 hours during business hours) to find impacted holds.

Ops manually opens the basket/order, compares details (sometimes with Kenan), patches Salesforce/CPQ records, then unholds orchestration.

3. Scope
3.1 In Scope
Automatically:

detect impacted IoT MACD orders placed on hold

determine expected “which services should be modified” from the basket intent

validate Service ↔ PC mapping and key attributes for modified services (and optionally all services)

patch incorrect mappings/fields in Salesforce/CPQ

unhold orchestration when safe

escalate/retain hold when unsafe/unknown scenarios exist

Provide metrics: volume, time saved, delay reduction.

3.2 Out Of Scope
Fixing QBS indexing logic in the product (already resolved in higher versions via GUID)

Modifying upstream CPQ split logic

Full automation of duplicate/orphan service creation scenarios (only escalation)

Non-IoT or New Activation orders

4. High-Level Architecture
Components
Salesforce Orchestration Flow (Existing)

Flow Name: On Hold IoT MACD Order Fulfillment Process

Detects IoT MACD orchestration creation

Sets CSPOFA__Process_On_Hold__c = true for qualifying orchestration processes.

Detection Layer (2 supported options)

Option 1: Scheduled SOQL polling

Option 2: Event-driven: Flow publishes a generic Platform Event; BSS Magic subscribes

BSS Magic Remediation Engine (IOT QBS Remediation)

Loads order/services

Validates service↔PC mapping

Patches safe mismatches

Unholds orchestration

Escalates unsafe anomalies

Salesforce/CPQ Data Access

Reads/writes: orchestration process, services, product configurations, related fields

Escalation + Notification

Creates Case/Task and notifies ops when automation cannot safely fix.

5. Detection Logic (Two Options)
BSS Magic supports two detection options. Both result in the same downstream remediation workflow.

Option 1 — Scheduled SOQL Polling (Interval-Based Detection)
Description
BSS Magic runs on a predefined interval (e.g., 5–15 minutes).

It executes SOQL to locate orchestration processes on hold.

For each new orchestration ID, it triggers remediation (idempotent).

SOQL (Held orchestration detection)


select createddate, Id, Name, Order__c, Order__r.csord__Account__r.name
from CSPOFA__Orchestration_Process__c
where CSPOFA__Orchestration_Process_Template__r.name =
      'Order Fulfillment Process IoT'
and CSPOFA__Process_On_Hold__c = true
and Order__r.csord__Status2__c <> 'Cancelled'
IOT QBS issue

Pros / Cons
Aspect

Pros

Cons

Simplicity

Easy to implement

Not real-time (delay up to interval)

Reliability

Self-healing if BSS Magic is down

Needs careful “already processed” tracking

Operational Coupling

No event infrastructure needed

Higher API consumption (repeated polling + reads)

Scale

Fine for low volumes (2–3/day)

Expensive at scale if scanning grows

Debugging

Simple replay by rerunning query

Needs “already processed” tracking

Option 2 — Event-Driven Detection (Flow Publishes Event)
Description
When Flow places orchestration on hold, it also publishes a generic Platform Event.

BSS Magic subscribes and triggers remediation immediately.

Recommended Event Mechanism: Platform Events
Platform Events are the best fit because:

They represent explicit business signals (e.g. “IoT QBS Hold triggered”)

Payload can be customized

External systems can subscribe reliably

Platform Event Requirements
Create Platform Event object:



BSS_Remediation_Request__e
Minimum payload fields:

Field

Type

Description

Payload__c

Long Text

JSON payload

Remediation_Type__c

Text

Remediation Type For BSS Magic to route the request to right remediation flow

EventTimestamp__c

DateTime (optional)

Publish timestamp

JSON Payload Contract (Required)
Required keys



{
  "references": {
    "orderId": "a0Oxx00000ABC",
    "orchestrationProcessId": "a1Bxx00000XYZ"
  },
  "hints": {
    "templateName": "Order Fulfillment Process IoT",
    "priority": "NORMAL"
  }
}
 

Rules

references must contain at least orderId or orchestrationProcessId

hints is optional and must remain small

Pros / Cons

Aspect

Pros

Cons

Latency

Near real-time

Requires event setup + subscriber replay

Flexibility

Future-proof (payload evolves without schema changes)

JSON contract/versioning must be enforced

Efficiency

No repeated scans

Subscriber must parse/validate JSON

Scale

Better than polling

Payload size limits (avoid large ID lists)

Reliability

Very fast when healthy

Needs polling fallback to guarantee catch-up

Recommendation
Primary: Option 2 (Platform Event, payload-only)

Fallback: Option 1 (Polling) for missed events / downtime recovery

6. IoT Service Remediation Workflow
6.1 High-Level Flow
Step 1: Detect held orchestration

Event or poll provides an orchestration record to process

Extract orderId and orchestrationProcessId from JSON references

Step 2: Load order services

Query service records for the order



select createddate, Id, csord__Status__c, csord__Subscription__c,
       Contract_Term__c, Name,
       External_ID__c, SIM_Serial_Number__c,
       APN_Name__c, APN_Adress_Type__c,
       Commitment__c, Commitment__r.name,
       csordtelcoa__Replaced_Service__r.SIM_Serial_Number__c,
       csord__Identification__c,
       csordtelcoa__Product_Configuration__c,
       csordtelcoa__Product_Configuration__r.Type__c,
       Billing_Account__c, Commercial_Product__c
from csord__Service__c
where csord__Order__c = 'Order id'
and csordtelcoa__Product_Configuration__r.Type__c <> null
This provides the full remediation dataset.

Step 3: Validate mapping + integrity

For each service:

Identify SIM Serial Number (SIM_Serial_Number__c)

Verify correct Product Configuration assignment (csordtelcoa__Product_Configuration__c)

Ensure modified services are mapped to intended PC group

Core validation checks:

Wrong Service→PC linkage

Unexpected PC counts

Extra/missing services (escalate)

Step 4: Patch safe mismatches

Update Service → PC lookup csordtelcoa__Product_Configuration__c

Patch required service fields for the specific MACD request

Step 5: Revalidate

Confirm fixes and no unsafe anomalies remain

Step 6: Release orchestration

Set CSPOFA__Process_On_Hold__c = false

Step 7: Escalate if unsafe

Keep hold, create Case/Task, notify ops, attach diagnostics

6.2 Apex REST API–Based Implementation Details
6.2.1 Base Path & Versioning
Salesforce org base URL: https://<your-instance>.salesforce.com

Apex REST base path: /services/apexrest/api/v1/iot-qbs-order/

Endpoints used by this capability
Endpoint

Method

Purpose

/validate/

POST

Validate service↔PC linkage integrity

/patch/

POST

Patch incorrect service mappings + business fields

/release/

POST

Unhold orchestration process

/escalate/

POST

Create Case/Task + notify operations

6.2.2 Design Principles
Remediation is triggered via Platform Event subscription
IoT MACD orchestration holds publish a remediation request event, which BSS Magic subscribes to and processes in near real-time.

Platform Event payload carries remediation context
All required identifiers (such as Order ID and Orchestration Process ID) are provided through a versioned JSON payload to keep the event contract generic and stable.

Salesforce APIs are step-level only
Apex REST endpoints support only focused remediation actions: Validate, Patch, Release, and Escalate.

BSS Magic owns orchestration and routing
The subscriber is responsible for parsing the payload, applying idempotency checks, coordinating execution steps, and tracking outcomes.

APIs remain deterministic and idempotent
All remediation operations are safe under retries, ensuring duplicate event deliveries do not result in inconsistent updates or repeated patching

Related content



