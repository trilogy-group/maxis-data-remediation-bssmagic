# BSS Magic TypeScript Dashboard - Complete Requirements Specification

**Version:** 2.0  
**Date:** January 21, 2026  
**Purpose:** Complete technical requirements for rebuilding the BSS Magic Dashboard

---

## Executive Summary

The BSS Magic TypeScript Dashboard is a Next.js 15-based web application that provides a unified interface for monitoring and remediating data migration issues in the Maxis CloudSense-to-TMF ecosystem. The application integrates with TMF APIs, CloudSense JavaScript Gateway (Playwright), and the 1147-Gateway (Python/FastAPI) to provide real-time visibility and automated remediation capabilities.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [TMF API Integration](#tmf-api-integration)
4. [Module Requirements](#module-requirements)
5. [UI Components](#ui-components)
6. [Gateway Integrations](#gateway-integrations)
7. [Data Models](#data-models)
8. [API Endpoints](#api-endpoints)
9. [Configuration](#configuration)
10. [Deployment](#deployment)

---

## 1. System Architecture

### 1.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   TypeScript Dashboard                      │
│                  (Next.js 15 + React 19)                    │
│                     Port: 3000                              │
└──────────────┬────────────────┬────────────────────────────┘
               │                │
       ┌───────┴────────┐   ┌──┴──────────────┐
       │                │   │                  │
┌──────▼──────┐  ┌─────▼─────┐  ┌─────────────▼──────────┐
│  CloudSense │  │  1147-     │  │  BSS Magic Runtime     │
│ JS Gateway  │  │  Gateway   │  │  (TMF API Server)      │
│  Port: 8080 │  │ Port: 8081 │  │  AWS ECS/PostgreSQL    │
│ (Playwright)│  │  (FastAPI) │  │  + Salesforce FDW      │
└─────────────┘  └────────────┘  └────────────────────────┘
       │                │                     │
       └────────────────┴─────────────────────┘
                        │
              ┌─────────▼──────────┐
              │  Salesforce (FDRV2)│
              │  CloudSense Objects│
              └────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Port | Purpose | Technology |
|-----------|------|---------|------------|
| **TypeScript Dashboard** | 3000 | Main UI, module dashboard, data visualization | Next.js 15, React 19, TailwindCSS |
| **CloudSense JS Gateway** | 8080 | Basket OE data retrieval via Playwright automation | Python/FastAPI, Playwright |
| **1147-Gateway** | 8081 | 1867 OE patching, Apex script execution, attachment updates | Python/FastAPI, simple-salesforce |
| **BSS Magic Runtime** | 8000 (ALB) | TMF API server with PostgreSQL + Salesforce FDW | Java Spring Boot, PostgreSQL, FDW |

---

## 2. Technology Stack

### 2.1 Frontend Framework

```json
{
  "framework": "Next.js 15.6.0-canary.57",
  "react": "19.1.0",
  "typescript": "5.9.3",
  "rendering": "App Router + Server Components + Client Components"
}
```

### 2.2 Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-query` | ^5.59.0 | Data fetching, caching, state management |
| `@tanstack/react-table` | ^8.20.5 | Advanced table functionality |
| `@tanstack/react-form` | ^1.23.7 | Form handling |
| `tailwindcss` | ^3.4.18 | Styling |
| `lucide-react` | ^0.447.0 | Icons |
| `recharts` | ^2.12.7 | Data visualization/charts |
| `zustand` | ^5.0.8 | Global state management |
| `zod` | ^3.23.8 | Schema validation |
| `date-fns` | ^4.1.0 | Date manipulation |
| `clsx` + `tailwind-merge` | Latest | Conditional CSS classes |

### 2.3 Development Tools

- **Linter/Formatter:** Biome 2.2.2
- **Testing:** Vitest + Playwright + Testing Library
- **Mock Data:** MSW (Mock Service Worker) 2.11.5

---

## 3. TMF API Integration

### 3.1 TMF Standards Used

| TMF Standard | Entity | CloudSense Source | Purpose |
|--------------|--------|-------------------|---------|
| **TMF637** | Product | `csord__Solution__c` | Solutions, subscriptions, bundles |
| **TMF638** | Service | `csord__Service__c` | Active services, 1867 detection |
| **TMF622** | ProductOrder | `csord__Order__c` | Order tracking, MACD operations |
| **TMF663** | ShoppingCart | `cscfga__Product_Basket__c` | Basket monitoring, order generation |
| **TMF666** | BillingAccount | `csconta__Billing_Account__c` | Billing account info, PIC email lookup |
| **TMF632** | Individual | `Contact` | Contact info, email lookup |
| **TMF632** | Organization | `Account` | Account/customer info |
| **TMF656** | ServiceProblem | `tmf.serviceProblem` (custom table) | Issue tracking, remediation |
| **TMF656** | ServiceProblemEventRecord | `AsyncApexJob` | Apex batch job tracking |
| **TMF653** | Task/TaskFlow | `CSPOFA__Orchestration_Process__c` + `CSPOFA__Orchestration_Step__c` | Orchestration tracking (future) |
| **TMF620** | ProductOffering | `csord__Product_Definition__c` | Product catalog |

### 3.2 TMF API Endpoints

#### 3.2.1 Base Configuration

```json
{
  "baseUrl": "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com",
  "headers": {
    "X-API-Key": "bssmagic-d58d6761265b01accc13e8b21bae8282",
    "X-Environment": "sandbox | production"
  }
}
```

#### 3.2.2 Product Inventory (TMF637)

**Endpoint:** `/tmf-api/productInventory/v5/product`

**Operations:**
- `GET /product` - List all products/solutions
- `GET /product?limit={n}` - Paginated list
- `GET /product?status=Not Migrated Successfully` - Failed migrations
- `GET /product?relatedParty.partyOrPartyRole.name=Migration User` - Migration user filter
- `GET /product/{id}` - Get single product details

**Custom Views (Extensions):**
- `/product` - Full TMF637 mapping from `csord__Solution__c`
- `/solution1867FibreVoice` - Fibre + Voice solutions with 1867 candidates
- `/solution1867FibreOnly` - Fibre-only solutions with 1867 candidates
- `/solution1867MobileEsms` - Mobile + ESMS solutions with 1867 candidates
- `/solution1867AccessVoice` - Access & Voice solutions with 1867 candidates
- `/failedMigrationProduct` - Products with failed migration status

**Key Fields Required:**
```typescript
{
  id: string;                    // Solution ID
  name: string;                  // Solution name
  status: string;                // Migration status (custom field)
  isBundle: boolean;             // Is solution a bundle
  productSerialNumber: string;   // Solution_Number__c
  productSpecification: {
    id: string;
    name: string;                // Solution Definition name
  };
  productCharacteristic: [{
    name: string;
    value: string | boolean;
    valueType: string;
  }];
  productPrice: [{
    name: string;
    priceType: string;
    price: {
      taxIncludedAmount: {
        value: number;
        unit: string;              // Currency (MYR)
      }
    };
    recurringChargePeriod: string;
  }];
  productTerm: [{
    duration: {
      amount: number;
      units: string;               // months, years
    }
  }];
  product: [{                     // Child products (subscriptions)
    productRef: {
      id: string;
      name: string;
      href: string;
    }
  }];
  productRelationship: [{         // MACD relationship
    relationshipType: string;      // ADD, MODIFY, DELETE
    id: string;                    // Target solution ID
  }];
  relatedParty: [{
    role: string;                  // customer, creator
    partyOrPartyRole: {
      id: string;
      name: string;
      "@referredType": string;     // Organization, User
    }
  }];
  billingAccount: {
    id: string;
    name: string;
  };
  creationDate: string;
  startDate: string;
  terminationDate: string;
}
```

#### 3.2.3 Service Inventory (TMF638)

**Endpoint:** `/tmf-api/serviceInventoryManagement/v5/service`

**Operations:**
- `GET /service?limit={n}` - List services
- `GET /service?x_serviceType=Voice` - Filter by service type
- `GET /service?x_serviceType=Fibre Service` - Fibre services
- `GET /service?x_serviceType=eSMS Service` - ESMS services
- `GET /service?x_serviceType=Access Service` - Access services
- `GET /service?x_migratedData=true` - Migrated services only
- `GET /service?x_has1867Issue=true` - Services with 1867 issues
- `GET /service/{id}` - Get single service

**Key Fields Required:**
```typescript
{
  id: string;                    // Service ID
  name: string;                  // Service name
  state: string;                 // Active, Inactive
  serviceType: string;           // Service type
  startDate: string;
  endDate: string;
  
  // Custom 1867 detection fields
  x_serviceType: string;         // Voice, Fibre Service, eSMS Service, Access Service
  x_externalId: string;          // External_ID__c (MSISDN, Circuit ID)
  x_billingAccountId: string;    // Billing_Account__c
  x_billingAccountName: string;  // BA name
  x_picEmail: string;            // PIC Email (Contact.Email)
  x_subscriptionId: string;      // Parent subscription ID
  x_subscriptionName: string;    // Parent subscription name
  x_accountId: string;           // Account ID
  x_accountName: string;         // Account name
  x_solutionId: string;          // Parent solution ID
  x_solutionName: string;        // Parent solution name
  x_migratedData: boolean;       // Is migrated data
  x_migratedToHeroku: boolean;   // Migrated to Heroku flag
  x_has1867Issue: boolean;       // Has 1867 OE missing data issue
  x_missingBillingAccount: boolean;
  x_missingPicEmail: boolean;
  x_missingExternalId: boolean;
  x_fibreVoiceOE: boolean;       // Has Fibre+Voice OE scenario
  x_fibreFibreOE: boolean;       // Has Fibre+Fibre OE scenario
  x_mobileESMSOE: boolean;       // Has Mobile+ESMS OE scenario
  x_accessVoiceOE: boolean;      // Has Access+Voice OE scenario
  
  // TMF standard fields
  relatedEntity: [{
    role: string;                 // supportingProduct, productConfiguration
    entity: {
      id: string;
      "@referredType": string;    // Product, ProductConfiguration
    }
  }];
  relatedParty: [{
    role: string;                 // customer, creator
    partyOrPartyRole: {
      id: string;
      name: string;
      "@referredType": string;
    }
  }];
}
```

#### 3.2.4 Shopping Cart (TMF663)

**Endpoint:** `/tmf-api/shoppingCart/v5/shoppingCart`

**Operations:**
- `GET /shoppingCart?limit={n}` - List carts
- `GET /shoppingCart?status=Order Generation` - Stuck baskets
- `GET /shoppingCart/{id}` - Get single cart

**Key Fields Required:**
```typescript
{
  id: string;                    // Basket ID
  name: string;                  // Basket name
  status: string;                // Order Generation, Order Submitted, etc.
  creationDate: string;
  lastUpdate: string;
  "@type": "ShoppingCart"
}
```

#### 3.2.5 Product Ordering (TMF622)

**Endpoint:** `/tmf-api/productOrderingManagement/v5/productOrder`

**Operations:**
- `GET /productOrder?limit={n}` - List orders
- `GET /productOrder?state=inProgress` - In-progress orders
- `GET /productOrder/{id}` - Get single order

**Key Fields Required:**
```typescript
{
  id: string;                    // Order ID
  state: string;                 // inProgress, completed, pending, failed
  category: string;              // Order category
  externalId: [{
    id: string;                  // External order number
    externalIdentifierType: string;
  }];
  relatedParty: [{
    role: string;                // customer
    partyOrPartyRole: {
      id: string;
      name: string;
      "@referredType": string;
    }
  }];
  requestedStartDate: string;
  requestedCompletionDate: string;
  completionDate: string;
  creationDate: string;
}
```

#### 3.2.6 Account Management (TMF666)

**Endpoint:** `/tmf-api/accountManagement/v5/billingAccount`

**Operations:**
- `GET /billingAccount?limit={n}` - List billing accounts
- `GET /billingAccount/{id}` - Get single account

**Key Fields Required:**
```typescript
{
  id: string;                    // Billing Account ID
  name: string;                  // BA name (e.g., BA-0140269)
  accountType: string;
  state: string;                 // Active, New
  paymentStatus: string;
  lastUpdate: string;
  relatedParty: [{
    role: string;                // customer, contact, creator
    partyOrPartyRole: {
      id: string;
      name: string;
      href: string;
      "@referredType": string;   // Organization, Individual, User
    }
  }];
}
```

#### 3.2.7 Party Management (TMF632)

**Endpoint:** `/tmf-api/partyManagement/v5/individual`

**Operations:**
- `GET /individual/{id}` - Get contact/individual (for PIC Email lookup)

**Key Fields Required:**
```typescript
{
  id: string;                    // Contact ID
  name: string;
  familyName: string;
  givenName: string;
  contactMedium: [{
    contactType: string;         // email, phone
    emailAddress: string;        // PIC Email
    phoneNumber: string;
  }];
}
```

#### 3.2.8 Service Problem Management (TMF656)

**Endpoint:** `/tmf-api/serviceProblemManagement/v5/serviceProblem`

**Operations:**
- `GET /serviceProblem?limit={n}` - List all service problems
- `GET /serviceProblem?category=SolutionEmpty` - Filter by category
- `GET /serviceProblem?status=pending` - Filter by status
- `POST /serviceProblem` - Create new service problem (triggers remediation)
- `GET /serviceProblem/{id}` - Get single problem

**Key Fields Required:**
```typescript
{
  id: string;                    // ServiceProblem ID
  category: string;              // SolutionEmpty, PartialDataMissing, etc.
  description: string;
  priority: number;              // 1-5 (1 = highest)
  status: string;                // pending, acknowledged, inProgress, resolved, rejected
  reason: string;
  impactImportanceFactor: string;
  affectedResource: [{
    id: string;                  // Solution/Service ID
    name: string;
    "@referredType": string;     // Product, Service
  }];
  trackingRecord: [{
    description: string;
    time: string;
    user: string;
  }];
  extensionInfo: [{
    name: string;                // remediationAction, apexJobId, etc.
    value: string;
  }];
  creationDate: string;
  lastUpdate: string;
}
```

**ServiceProblemEventRecord Sub-resource:**

**Endpoint:** `/tmf-api/serviceProblemManagement/v5/serviceProblemEventRecord/{jobId}`

**Key Fields:**
```typescript
{
  id: string;                    // AsyncApexJob ID
  eventType: string;             // BatchApex, Queueable, Future
  eventTime: string;             // Job start time
  recordTime: string;            // Record creation time
  notification: {
    "@type": string;             // Enhanced summary with job details
    "@baseType": string;         // Job type
    "@schemaLocation": string;   // CreatedById
  }
}
```

---

## 4. Module Requirements

### 4.1 Module Overview

The dashboard consists of 5 distinct remediation modules:

| Module ID | Name | Icon | Purpose | Primary TMF API |
|-----------|------|------|---------|-----------------|
| `oe-patcher` | 1867 OE Data Patcher | 🔧 | Patch missing OE attributes on MACD baskets | TMF638, TMF666 |
| `solution-empty` | 1147 Solution Empty | 📦 | Re-migrate solutions with empty configurations | TMF637 |
| `order-not-gen` | Order Not Generated | ⚠️ | Fix baskets stuck due to high async count | TMF663, TMF622 |
| `iot-qbs` | IoT QBS Remediator | 🔌 | Repair corrupted PC linkages in IoT solutions | TMF638, TMF622, TMF653 |
| `remediation-history` | Service Problems (TMF656) | 📋 | Track confirmed issues and remediation progress | TMF656 |

### 4.2 Module 1: 1867 OE Data Patcher

#### 4.2.1 Purpose
Detect and patch missing Order Enrichment (OE) attributes on services within MACD baskets that prevent successful order generation in CloudSense.

#### 4.2.2 Detection Logic

**Four Scenarios:**

1. **Fibre + Voice Solution** (`fibre-voice`)
   - Solution Definition: "Fibre Solution"
   - Required Services: Fibre Service + Voice Service
   - Missing OE Fields:
     - `Reserved Number` (from Voice service External_ID__c)
     - `ResourceSystemGroupID` (constant: "Migrated")
     - `NumberStatus` (constant: "Reserved")
     - `PIC Email` (from Billing Account → Contact → Email)

2. **Fibre Only Solution** (`fibre-only`)
   - Solution Definition: "Fibre Solution"
   - Required Services: Fibre Service only
   - Missing OE Fields:
     - `Billing Account` (from Fibre service Billing_Account__c)

3. **Mobile + ESMS Solution** (`mobile-esms`)
   - Solution Definition: "Mobile Solution"
   - Required Services: Mobile + eSMS Service
   - Missing OE Fields:
     - `ReservedNumber` (from ESMS service External_ID__c)
     - `eSMSUserName` (from ESMS service External_ID__c)

4. **Access & Voice Solution** (`access-voice`)
   - Solution Definition: "Access & Voice Solution" or "SIP2 Access and Voice Solution"
   - Required Services: Access Service + Voice Service
   - Missing OE Fields:
     - `Reserved Number` (from Voice service External_ID__c)
     - `PIC Email` (from Billing Account → Contact → Email)

#### 4.2.3 TMF API Queries

```
GET /tmf-api/serviceInventoryManagement/v5/service?x_serviceType=Voice&x_migratedData=true&limit=300
GET /tmf-api/serviceInventoryManagement/v5/service?x_serviceType=Fibre Service&x_migratedData=true&limit=300
GET /tmf-api/serviceInventoryManagement/v5/service?x_serviceType=eSMS Service&x_migratedData=true&limit=300
GET /tmf-api/serviceInventoryManagement/v5/service?x_serviceType=Access Service&x_migratedData=true&limit=300

GET /tmf-api/partyManagement/v5/individual/{contactId}  // For PIC Email lookup
```

#### 4.2.4 Remediation Flow

1. **Detection:**
   - Query services by type (Voice, Fibre, ESMS, Access) with `x_migratedData=true`
   - Identify services with `x_has1867Issue=true`
   - Group by solution and detect scenario type

2. **OE Analysis:**
   - Call CloudSense JS Gateway: `GET /api/configurations?basket_id={basketId}&solution_name={solutionName}`
   - Compare expected vs actual OE attributes
   - Identify missing fields

3. **Patching:**
   - Call 1147-Gateway: `POST /api/1867/patch-complete`
   - Payload:
     ```json
     {
       "serviceId": "a236D000...",
       "serviceType": "Voice",
       "fieldsToPatch": [
         {"fieldName": "Reserved Number", "value": "0123456789", "label": "Reserved Number"},
         {"fieldName": "PIC Email", "value": "pic@example.com", "label": "PIC Email"}
       ],
       "dryRun": false
     }
     ```
   - Gateway updates both CloudSense internal DB and attachment JSON

4. **Verification:**
   - Call 1147-Gateway: `GET /api/1867/service/{serviceId}/verify-oe?fields=Reserved Number,PIC Email`
   - Confirm fields exist in CloudSense OE database

#### 4.2.5 UI Requirements

**Service Card Component:**
- Display service name, ID, state, start date
- Show service type badge
- Expandable section showing solution details (lazy-loaded via TMF637)
- Color-coded state badges (active=green, inactive=gray, pending=amber)

**1867 Scenario Card:**
- Display scenario type (Fibre+Voice, Fibre-Only, etc.)
- List candidate services with 1867 detection flags
- Show expected vs actual OE attributes in table format
- Real-time OE analysis from CloudSense JS Gateway
- Patch button with dry-run option
- Verification status display

**PIC Email Lookup:**
- Service → Billing Account ID → Individual ID → Contact Email
- Caching with React Query
- Fallback for missing email

### 4.3 Module 2: 1147 Solution Empty

#### 4.3.1 Purpose
Detect and remediate solutions where Product Configuration was not successfully migrated to Heroku, resulting in empty/incomplete solution data.

#### 4.3.2 Detection Logic

**Query:**
```
GET /tmf-api/productInventory/v5/product?status=Not Migrated Successfully&relatedParty.partyOrPartyRole.name=Migration User&limit=50
```

**Criteria:**
- `status = "Not Migrated Successfully"` (from csord__External_Identifier__c)
- `relatedParty.partyOrPartyRole.name = "Migration User"` (created by migration)
- Product Characteristic: `isMigratedToHeroku = false`

#### 4.3.3 Remediation Flow

1. **Detection:**
   - Query failed migration products via TMF637
   - Display count and list of affected solutions

2. **Fix Action:**
   - User clicks "Fix" button on solution card
   - App creates TMF656 ServiceProblem:
     ```json
     {
       "@type": "ServiceProblem",
       "category": "SolutionEmpty",
       "description": "Solution {name} data needs re-synchronization with SM Service",
       "priority": 1,
       "status": "pending",
       "affectedResource": [{
         "id": "{solutionId}",
         "name": "{solutionName}",
         "@referredType": "Product"
       }],
       "extensionInfo": [{
         "name": "remediationAction",
         "value": "resync"
       }]
     }
     ```

3. **Backend Processing:**
   - TMF656 API handler receives ServiceProblem POST
   - Calls 1147-Gateway to execute Heroku migration scripts
   - Updates ServiceProblem status to "resolved" or "rejected"
   - Adds tracking records with timestamps

4. **UI Feedback:**
   - Success message: "Fix operation initiated. Migration will be re-triggered."
   - Error message with details
   - Refresh button to check updated status

#### 4.3.4 UI Requirements

**Solution Card Component:**
- Display solution name, ID, serial number
- Show migration status badge (red for failed)
- Show solution status from characteristic (Active, Completed, Unknown)
- Show "Migrated to Heroku" flag (✅/❌)
- Show remediation status (not_processed, acknowledged, resolved)
- Display child products count (subscriptions)
- Show product pricing (contract value) if available
- Expandable "Show More Details" section with:
  - Customer and creator names
  - Billing account
  - MACD relationship (if applicable)
  - Contract term
  - Creation/start/termination dates
  - Child products list with IDs
- "See OE Data" button → Shows BasketOEAnalysis component
- "Fix" button → Triggers TMF656 ServiceProblem creation

**Statistics Grid:**
- Total Products count
- Failed Migrations count (red)
- Completed count (green)
- In Progress count (amber)

**Detection Alert Box:**
- Show count of failed migrations
- Display detection query used
- Color-coded (red if issues found, green if none)

**Remediation Steps Box:**
- Show Maxis SOP steps
- SOQL queries for detection
- Manual steps reference

**Service Problems Section:**
- Integrated ServiceProblemModule filtered by `category=SolutionEmpty`

### 4.4 Module 3: Order Not Generated

#### 4.4.1 Purpose
Detect and remediate baskets stuck in "Order Generation" stage due to high AsyncApexJob queue count in Salesforce.

#### 4.4.2 Detection Logic

**Query:**
```
GET /tmf-api/shoppingCart/v5/shoppingCart?status=Order Generation&limit=20
```

**Root Cause:**
- AsyncApexJob queue > 100 pending jobs
- CloudSense can't queue new order generation job
- Basket stuck with `csordtelcoa__Order_Generation_Batch_Job_Id__c` populated

#### 4.4.3 Remediation Steps (Manual)

1. Check Salesforce AsyncApexJob queue:
   ```sql
   SELECT COUNT() FROM AsyncApexJob WHERE Status IN ('Queued', 'Processing')
   ```

2. If > 100 pending jobs:
   - Wait for queue to clear, OR
   - Clear stale/old jobs (if safe)

3. Reset basket field to trigger new job:
   ```
   UPDATE cscfga__Product_Basket__c
   SET csordtelcoa__Order_Generation_Batch_Job_Id__c = NULL
   WHERE Id = '{basketId}'
   ```

#### 4.4.4 UI Requirements

**Detection Alert:**
- Show count of stuck baskets
- Explain root cause (high async count)
- Display query used

**Cart Card Component:**
- Display cart name, ID
- Show status badge (color-coded by status)
- Show creation date

**Remediation Box:**
- Display manual steps
- Show field update command
- Explanation of trigger mechanism

### 4.5 Module 4: IoT QBS Remediator

#### 4.5.1 Purpose
Detect and repair corrupted Product Configuration linkages in IoT QBS solutions where ICCID, MSISDN, or Commitment attributes point to wrong PC records, causing orchestration process to be stuck.

#### 4.5.2 Detection Logic (Requires TMF653)

**Missing TMF653 Mapping:**
- `CSPOFA__Orchestration_Process__c` → TMF653 TaskFlow
- `CSPOFA__Orchestration_Step__c` → TMF653 Task

**Detection Query (when TMF653 available):**
```
GET /tmf-api/taskFlow?CSPOFA__Process_On_Hold__c=true&CSPOFA__Process_Status__c=In Progress
```

**Current Workaround:**
- Display active services and in-progress orders
- Note in UI that full detection requires TMF653

#### 4.5.3 Remediation Steps (Manual - Requires TMF653)

1. Identify stuck orchestration processes
2. Check PC linkage integrity:
   - ICCID attribute → correct PC record
   - MSISDN attribute → correct PC record
   - Commitment attribute → correct PC record
3. Update corrupted `cscfga__Product_Configuration__c` records
4. Resume orchestration process

#### 4.5.4 UI Requirements

**Detection Info Box:**
- Explain need for TMF653
- Show placeholder query

**Services Display:**
- List active services (from TMF638)
- Show service type and state
- Explain PC linkage verification

**Orders Display:**
- List in-progress orders (from TMF622)
- Show order state and category

**Warning Box:**
- Explain TMF653 requirement
- List needed Salesforce objects

**Remediation Steps:**
- Manual steps for PC linkage repair

### 4.6 Module 5: Service Problems (TMF656)

#### 4.6.1 Purpose
Centralized tracking and monitoring of all confirmed data issues and their remediation status across all modules.

#### 4.6.2 Features

**List Service Problems:**
```
GET /tmf-api/serviceProblemManagement/v5/serviceProblem?limit=50
GET /tmf-api/serviceProblemManagement/v5/serviceProblem?category={category}
GET /tmf-api/serviceProblemManagement/v5/serviceProblem?status={status}
```

**Service Problem Categories:**
- `SolutionEmpty` - 1147 empty solutions
- `PartialDataMissing` - 1867 general OE issues
- `PartialDataMissing_Voice` - Voice-specific OE issues
- `PartialDataMissing_Fibre` - Fibre-specific OE issues
- `PartialDataMissing_eSMS` - ESMS-specific OE issues

**Service Problem Statuses (TMF656 ServiceProblemStateType):**
- `pending` - Newly created, awaiting processing
- `acknowledged` - Issue confirmed, queued for remediation
- `inProgress` - Currently being remediated
- `resolved` - Successfully fixed
- `rejected` - Remediation failed
- `held` - Blocked/on hold
- `cancelled` - Cancelled
- `closed` - Completed and closed

#### 4.6.3 UI Requirements

**Service Problem Card:**
- Display problem ID, category badge, status badge
- Show affected resource (solution/service name and ID)
- Display priority indicator
- Show description
- Display creation date and last update
- Expandable tracking records section
- Link to view Apex job details (if available)

**Apex Job Modal:**
- Display job ID, class name, status
- Show processed/failed items count
- Display error messages (if any)
- Show job details from AsyncApexJob
- Creation and completion times

**Category Filters:**
- Allow filtering by category
- Show counts per category

**Status Filters:**
- Filter by status (pending, resolved, etc.)
- Show counts per status

**Refresh Button:**
- Manual refresh with loading state

---

## 5. UI Components

### 5.1 Layout Components

#### 5.1.1 App Header
```typescript
// Props
interface AppHeaderProps {
  // No props - displays static info
}

// Features
- Display "Maxis BSS Magic" title with gradient
- Subtitle: "Module Dashboard - CloudSense → TMF APIs"
- Runtime status indicator (green dot + "AWS Singapore")
- Sticky header (stays at top on scroll)
- Glass-morphism effect (backdrop-blur)
```

#### 5.1.2 Stats Banner
```typescript
// Features
- Gradient background (indigo-violet-purple)
- Module icon buttons in grid (2 cols mobile, 5 cols desktop)
- Active module highlighted with white ring
- Click to switch modules
- Responsive grid layout
```

#### 5.1.3 Module Tabs
```typescript
// Features
- Horizontal scrollable tab bar
- Active tab: indigo background
- Inactive tabs: gray hover effect
- Module icon + name
- Sticky below header
```

### 5.2 Entity Card Components

#### 5.2.1 Service Card

**Display Fields:**
- Service name (truncated)
- Service ID (monospace, truncated)
- State badge (color-coded)
- Start date
- Expandable solution section (lazy-loaded)

**Solution Expansion:**
- Solution name, ID
- Solution status
- Loading state with spinner
- Error state

**Styling:**
- White background, rounded corners
- Border with hover shadow effect
- Responsive truncation

#### 5.2.2 Product/Solution Card

**Display Fields:**
- Solution name
- Solution ID (monospace)
- Serial number badge (if present)
- Migration status badge (color-coded)
- 2x2 grid of key info:
  - Migration Status
  - Solution Status
  - Migrated to Heroku (✅/❌)
  - Remediation Status
  - Child Products count
  - Is Bundle flag
- Product pricing section (if available):
  - Contract value display
  - Currency and amount
  - Recurring charge period
- Expandable "Show More Details":
  - Customer and creator names
  - Billing account
  - MACD relationship (if applicable)
  - Contract term
  - Creation/start/termination dates
  - Child products list (scrollable)

**Actions:**
- "See OE Data" button → BasketOEAnalysis component
- "Fix" button (for failed migrations) → TMF656 ServiceProblem creation
- Confirmation dialog before fix
- Loading state with spinner
- Success/error feedback messages

**Failed Migration Styling:**
- Red background tint
- Red border
- Red status badge
- Alert icon

#### 5.2.3 Shopping Cart Card

**Display Fields:**
- Cart name or ID
- Cart ID (monospace, smaller)
- Status badge (color-coded)
- Creation date

**Status Colors:**
- "Order Generation" - amber (stuck state)
- "Order Submitted" - green (success)
- Other - gray

#### 5.2.4 Product Order Card

**Display Fields:**
- Order number (from externalId or ID)
- Customer name (from relatedParty)
- State badge (color-coded)
- Category
- Creation date
- Completion date (if completed, green text)

**State Colors:**
- completed - emerald/green
- inProgress - blue
- acknowledged - violet
- pending - amber
- failed - red
- cancelled - gray

#### 5.2.5 Billing Account Card

**Display Fields:**
- "BA" icon badge (blue circle)
- Account name
- Account ID (monospace)
- Minimal design

### 5.3 Module-Specific Components

#### 5.3.1 OEPatcherModule

**Sub-components:**
1. **Scenario Tabs:**
   - 4 tabs for each 1867 scenario
   - "Manual" tab for custom basket input
   - Count badges showing candidate count
   - Color-coded tabs

2. **Service Table:**
   - Columns: Service Name, Type, Solution, Basket, Status, Actions
   - Expandable rows showing OE checklist
   - "Analyze OE" button per service
   - "Patch OE" button with dry-run option
   - Loading states

3. **OE Checklist Component:**
   - List of expected OE attributes
   - Check/X icons for present/missing
   - Actual values display
   - Source field explanation
   - Color-coded rows (green=ok, red=missing)

4. **BasketOEAnalysis Component:**
   - Triggered from "See OE Data" button
   - Fetches data from CloudSense JS Gateway
   - Displays all OE configurations
   - Shows OE attributes with values
   - Missing fields highlighted in red
   - Total missing count

#### 5.3.2 ServiceProblemModule

**Features:**
- Optional category filter prop
- List all service problems (or filtered by category)
- Group by status
- Status filter buttons
- Refresh button

**Service Problem Card:**
- Problem ID
- Category badge (color-coded by category)
- Status badge with animated dot
- Description
- Affected resource (solution/service)
- Priority indicator
- Creation date, last update
- Expandable tracking records
- "View Apex Job" link (if job ID present)

**Apex Job Modal:**
- Modal overlay (dark background)
- Job ID header
- Fetch job details from TMF656 serviceProblemEventRecord
- Parse notification field for job details
- Display:
  - Job class name
  - Status
  - Items processed/failed
  - Error messages
  - Creation/completion times
- Close button

### 5.4 Utility Components

#### 5.4.1 Loader Components

**Spinner:**
```typescript
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```
- Animated circular spinner
- Size variants (16px, 24px, 32px)
- Customizable colors via className

**CardLoader:**
```typescript
interface CardLoaderProps {
  message?: string;
}
```
- Full-width loading card
- Spinner + message
- Gray background

#### 5.4.2 Status Badges

**StatusBadge:**
- Rounded pill shape
- Color-coded background and text
- Animated dot indicator
- Font size: xs (12px)
- Variants for each status

**CategoryBadge:**
- Monospace font
- Color-coded by category
- Rounded corners
- Font size: xs

---

## 6. Gateway Integrations

### 6.1 CloudSense JS Gateway (Port 8080)

#### 6.1.1 Purpose
Retrieve Order Enrichment (OE) attribute data from CloudSense internal database using Playwright browser automation. Required because CloudSense OE data is NOT exposed via standard Salesforce APIs.

#### 6.1.2 Technology
- Python 3.9+
- FastAPI framework
- Playwright for browser automation
- simple-salesforce for authentication

#### 6.1.3 API Endpoints

**Health Check:**
```
GET /health
Response: { "status": "healthy", "timestamp": "2026-01-21T..." }
```

**Get Configurations:**
```
GET /api/configurations?basket_id={basketId}&solution_name={solutionName}
Response: {
  "success": true,
  "basketId": "a0u...",
  "basketName": "New Basket...",
  "solutionName": "Fibre Solution",
  "configurations": [{
    "guid": "config-guid",
    "name": "Fibre Service",
    "orderEnrichmentList": [{
      "guid": "oe-guid",
      "name": "OE Name",
      "attributes": [
        {"name": "Reserved Number", "value": "0123456789", "displayValue": "..."}
      ]
    }]
  }]
}
```

**Update OE Attributes:**
```
POST /api/oe/update
Body: {
  "basketId": "a0u...",
  "configGuid": "optional-config-guid",
  "oeGuid": "optional-oe-guid",
  "attributes": [
    {"name": "Reserved Number", "value": "0123456789", "displayValue": "..."}
  ]
}
Response: { "success": true, "message": "OE attributes updated" }
```

**Verify OE Data:**
```
GET /api/verify-oe?basket_id={basketId}&solution_name={solutionName}
Response: {
  "oeDataFound": true,
  "componentsCount": 2,
  "attributesCount": 15,
  "attributes": [...]
}
```

#### 6.1.4 Authentication
Uses Salesforce credentials from environment variables:
- `SF_USERNAME` - Salesforce username
- `SF_PASSWORD` - Salesforce password
- `SF_SECURITY_TOKEN` - Salesforce security token
- `SF_LOGIN_URL` - https://test.salesforce.com (sandbox) or https://login.salesforce.com (prod)
- `SF_DOMAIN` - "test" for sandbox, "login" for production

#### 6.1.5 Performance Notes
- Each request takes 30-60 seconds (browser automation)
- Runs headless Chromium
- Navigates to CloudSense Solution Console
- Extracts OE data from DOM

### 6.2 1147-Gateway (Port 8081)

#### 6.2.1 Purpose
Execute Apex REST API calls to patch missing OE data directly in CloudSense internal database and update attachment JSON files. Provides faster alternative to Playwright for 1867 OE patching.

#### 6.2.2 Technology
- Python 3.9+
- FastAPI framework
- simple-salesforce for Apex REST API
- Pydantic for data validation

#### 6.2.3 API Endpoints

**Health Check:**
```
GET /health
Response: { "status": "healthy", "service": "1147-gateway", "version": "1.0.0" }
```

**Get Service Attachment:**
```
GET /api/1867/service/{serviceId}/attachment
Response: {
  "attachmentId": "00PMS...",
  "fileName": "ProductAttributeDetails.json",
  "attachmentData": {
    "ProductAttributes": [...],
    "ServiceAttributes": [...]
  }
}
```

**Patch Complete (CloudSense DB + Attachment):**
```
POST /api/1867/patch-complete
Body: {
  "serviceId": "a236D000...",
  "serviceType": "Voice",
  "fieldsToPatch": [
    {"fieldName": "Reserved Number", "value": "0123456789", "label": "Reserved Number"},
    {"fieldName": "PIC Email", "value": "pic@example.com", "label": "PIC Email"}
  ],
  "dryRun": false
}
Response: {
  "success": true,
  "serviceId": "a236D000...",
  "patchedFields": [...],
  "cloudsenseDBUpdated": true,
  "attachmentUpdated": true,
  "backupAttachmentId": "00PMS...",
  "remainingMissingFields": []
}
```

**Verify OE:**
```
GET /api/1867/service/{serviceId}/verify-oe?fields=Reserved Number,PIC Email
Response: {
  "oeDataFound": true,
  "componentsCount": 2,
  "attributesCount": 15,
  "fields": {
    "Reserved Number": {
      "found": true,
      "value": "0123456789",
      "displayValue": "..."
    }
  },
  "allFieldsPresent": true
}
```

**Patch Attachment Only:**
```
POST /api/1867/service/{serviceId}/patch-attachment
Body: {
  "fieldsToPatch": [...],
  "dryRun": false
}
Response: {
  "success": true,
  "attachmentUpdated": true,
  "backupAttachmentId": "00PMS..."
}
```

**Query Solutions (1147 Candidates):**
```
POST /api/1867/query-solutions
Body: {
  "scenario": "solution-empty",
  "limit": 100
}
Response: {
  "solutions": [...]
}
```

#### 6.2.4 Apex REST Endpoints Called

The 1147-Gateway calls custom Apex REST endpoints in Salesforce:

**Complete Patcher Endpoint:**
```
POST /services/apexrest/BSSMagic/V1/CompletePatcher

Body: {
  "serviceId": "a236D000...",
  "serviceType": "Voice",
  "fieldsToPatch": [...]
}
```

**Attachment Patcher Endpoint:**
```
POST /services/apexrest/BSSMagic/V1/AttachmentPatcher

Body: {
  "serviceId": "a236D000...",
  "fieldsToPatch": [...]
}
```

**Solution Query Endpoint:**
```
POST /services/apexrest/BSSMagic/V1/SolutionQuery

Body: {
  "scenario": "solution-empty",
  "limit": 100
}
```

---

## 7. Data Models

### 7.1 Core TypeScript Interfaces

All interfaces are defined in `/src/tmf/working-apis/api.ts`:

#### Service (TMF638)
```typescript
interface Service {
  id: string;
  name: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  serviceType?: string;
  '@type'?: string;
  relatedEntity?: RelatedEntity[];
  relatedParty?: RelatedParty[];
  
  // Custom 1867 detection fields
  x_serviceType?: string;
  x_externalId?: string;
  x_billingAccountId?: string;
  x_billingAccountName?: string;
  x_picEmail?: string;
  x_subscriptionId?: string;
  x_subscriptionName?: string;
  x_accountId?: string;
  x_accountName?: string;
  x_solutionId?: string;
  x_solutionName?: string;
  x_migratedData?: boolean;
  x_migratedToHeroku?: boolean;
  x_has1867Issue?: boolean;
  x_missingBillingAccount?: boolean;
  x_missingPicEmail?: boolean;
  x_missingExternalId?: boolean;
  x_fibreVoiceOE?: boolean;
  x_fibreFibreOE?: boolean;
  x_mobileESMSOE?: boolean;
  x_accessVoiceOE?: boolean;
}
```

#### Product (TMF637)
```typescript
interface Product {
  id: string;
  name?: string;
  status?: string;                // Migration status (custom)
  description?: string;
  isBundle?: boolean;
  isCustomerVisible?: boolean;
  productSerialNumber?: string;   // Solution_Number__c
  orderDate?: string;
  
  productSpecification?: {
    id?: string;
    name?: string;                // Solution Definition name
    brand?: string;
    description?: string;
    productSpecCharacteristic?: ProductSpecCharacteristic[];
  };
  
  productCharacteristic?: Characteristic[];  // solutionStatus, isMigratedToHeroku, etc.
  
  productPrice?: [{
    name?: string;
    priceType?: string;
    price?: {
      taxIncludedAmount?: {
        value?: number;
        unit?: string;            // MYR
      };
    };
    recurringChargePeriod?: string;
  }];
  
  productTerm?: [{
    duration?: {
      amount?: number;
      units?: string;             // months, years
    };
    validFor?: {
      startDateTime?: string;
      endDateTime?: string;
    };
  }];
  
  product?: [{                    // Child products/subscriptions
    productRef?: {
      id?: string;
      name?: string;
      href?: string;
    };
  }];
  
  productRelationship?: [{        // MACD relationships
    relationshipType?: string;    // ADD, MODIFY, DELETE
    id?: string;
    href?: string;
    product?: {
      id?: string;
      name?: string;
    };
  }];
  
  relatedParty?: [{
    role?: string;                // customer, creator
    partyOrPartyRole?: {
      id?: string;
      name?: string;
      href?: string;
      '@referredType'?: string;   // Organization, User
    };
  }];
  
  billingAccount?: {
    id?: string;
    name?: string;
    href?: string;
  };
  
  realizingService?: [{           // Service references
    id?: string;
    name?: string;
    href?: string;
  }];
  
  creationDate?: string;
  startDate?: string;
  terminationDate?: string;
  lastUpdate?: string;
}
```

#### BillingAccount (TMF666)
```typescript
interface BillingAccount {
  id: string;
  href?: string;
  name?: string;
  accountType?: string;
  state?: string;                 // Active, New
  description?: string;
  paymentStatus?: string;
  lastUpdate?: string;
  
  relatedParty?: [{
    role?: string;                // customer, contact, creator
    partyOrPartyRole?: {
      id?: string;
      href?: string;
      name?: string;
      '@type'?: string;
      '@referredType'?: string;   // Organization, Individual, User
    };
  }];
  
  '@type'?: string;
  '@baseType'?: string;
}
```

#### Individual (TMF632)
```typescript
interface Individual {
  id: string;
  href?: string;
  name?: string;
  familyName?: string;
  givenName?: string;
  formattedName?: string;
  
  contactMedium?: [{
    contactType?: string;         // email, phone
    emailAddress?: string;        // PIC Email
    phoneNumber?: string;
  }];
  
  '@type'?: string;
  '@baseType'?: string;
}
```

#### ProductOrder (TMF622)
```typescript
interface ProductOrder {
  id: string;
  href?: string;
  state?: string;                 // inProgress, completed, pending, failed
  category?: string;
  
  externalId?: [{
    id?: string;                  // External order number
    externalIdentifierType?: string;
  }];
  
  relatedParty?: [{
    role?: string;                // customer
    partyOrPartyRole?: {
      id?: string;
      name?: string;
      href?: string;
      '@referredType'?: string;
    };
  }];
  
  requestedStartDate?: string;
  requestedCompletionDate?: string;
  completionDate?: string;
  creationDate?: string;
}
```

#### ShoppingCart (TMF663)
```typescript
interface ShoppingCart {
  id: string;
  href?: string;
  status?: string;                // Order Generation, Order Submitted
  name?: string;
  creationDate?: string;
  lastUpdate?: string;
  '@type'?: string;
}
```

#### ServiceProblem (TMF656)
```typescript
interface ServiceProblem {
  id: string;
  href?: string;
  category?: string;              // SolutionEmpty, PartialDataMissing, etc.
  description?: string;
  priority?: number;              // 1-5 (1 = highest)
  status?: string;                // pending, acknowledged, inProgress, resolved, rejected
  reason?: string;
  impactImportanceFactor?: string;
  
  affectedResource?: [{
    id?: string;                  // Solution/Service ID
    name?: string;
    href?: string;
    '@referredType'?: string;     // Product, Service
    '@type'?: string;
  }];
  
  trackingRecord?: [{
    description?: string;
    time?: string;
    user?: string;
    '@type'?: string;
  }];
  
  errorMessage?: [{
    code?: string;
    message?: string;
    reason?: string;
  }];
  
  extensionInfo?: [{
    name?: string;                // remediationAction, apexJobId, etc.
    value?: string;
    valueType?: string;
  }];
  
  creationDate?: string;
  lastUpdate?: string;
  resolutionDate?: string;
}
```

### 7.2 Configuration Models

#### CloudSense Configuration Response
```typescript
interface ConfigurationsResponse {
  success: boolean;
  basketId: string;
  basketName?: string;
  solutionName?: string;
  configurations?: [{
    guid: string;
    name: string;
    orderEnrichmentList?: [{
      guid: string;
      name: string;
      attributes?: [{
        name: string;
        value: string;
        displayValue?: string;
      }];
    }];
  }];
}
```

#### OE Analysis Model
```typescript
interface OEAnalysis {
  configName: string;
  oeName: string;
  attributes: Array<{
    name: string;
    value: string;
    displayValue?: string;
  }>;
  missingFields: string[];
  missingCount: number;
}
```

---

## 8. API Endpoints

### 8.1 Next.js API Routes

#### 8.1.1 TMF API Proxy

**Route:** `/api/tmf-api/[...slug]`

**Purpose:** Proxy all TMF API requests to BSS Magic Runtime

**Features:**
- Dynamic routing to match TMF entity paths
- Adds `X-API-Key` header
- Adds `X-Environment` header (if sandbox mode)
- Maps entity names to TMF server URLs via `app.config.json`
- Filters unsupported query parameters per entity

**Example Mapping:**
```
Request:  GET /api/tmf-api/product?limit=10
Entity:   entities.product.serverUrl = "/tmf-api/productInventory/v5/"
Source:   sources["AWS Runtime (Singapore)"].baseUrl
Upstream: http://bssmagic-alb-.../tmf-api/productInventory/v5/product?limit=10
Headers:  X-API-Key, X-Environment (optional)
```

**Configuration File:** `src/lib/app.config.json`
```json
{
  "sources": {
    "AWS Runtime (Singapore)": {
      "type": "api",
      "baseUrl": "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com"
    }
  },
  "entities": {
    "product": {
      "source": "AWS Runtime (Singapore)",
      "serverUrl": "/tmf-api/productInventory/v5/",
      "standard": "TMF637"
    },
    "service": {
      "source": "AWS Runtime (Singapore)",
      "serverUrl": "/tmf-api/serviceInventoryManagement/v5/",
      "standard": "TMF638"
    }
    // ... more entities
  }
}
```

#### 8.1.2 CloudSense Gateway Proxy

**Route:** `/api/gateway-cloudsense/[...path]`

**Purpose:** Proxy requests to CloudSense JS Gateway (localhost:8080)

**Methods:** GET, POST, PUT, PATCH, DELETE

**Example:**
```
Client:   POST /api/gateway-cloudsense/api/oe/update
Proxy to: POST http://localhost:8080/api/oe/update
```

#### 8.1.3 1147-Gateway Proxy

**Route:** `/api/gateway-1147/[...path]`

**Purpose:** Proxy requests to 1147-Gateway (localhost:8081)

**Methods:** GET, POST, PUT, PATCH, DELETE

**Example:**
```
Client:   POST /api/gateway-1147/1867/patch-complete
Proxy to: POST http://localhost:8081/api/1867/patch-complete
```

#### 8.1.4 Service Problem Management

**Route:** `/tmf-api/serviceProblemManagement/v5/serviceProblem`

**Purpose:** Enhanced TMF656 endpoint with remediation logic

**POST Handler:**
1. Receives ServiceProblem creation request
2. Validates payload
3. Calls 1147-Gateway to execute remediation (if applicable)
4. Updates ServiceProblem status based on result
5. Adds tracking records
6. Returns final ServiceProblem object

**Integration with 1147-Gateway:**
- For `category=SolutionEmpty`: Calls Apex scripts to re-migrate solution
- For `category=PartialDataMissing`: Can call OE patching endpoints
- Updates `extensionInfo` with job IDs and results

---

## 9. Configuration

### 9.1 Environment Variables

#### Production Configuration

```bash
# No .env.local file needed - uses defaults from app.config.json
# Connects to production AWS runtime (no X-Environment header)
```

#### Sandbox Configuration

Create `ts-dashboard/.env.local`:
```bash
# Sandbox Runtime - uses X-Environment header for routing
NEXT_PUBLIC_TMF_API_URL=http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com
NEXT_PUBLIC_TMF_ENVIRONMENT=sandbox

# API Key
BSSMAGIC_API_KEY=bssmagic-d58d6761265b01accc13e8b21bae8282

# Local Gateways
GATEWAY_1147_URL=http://localhost:8081
GATEWAY_CLOUDSENSE_URL=http://localhost:8080
```

#### Mock Data Mode

```bash
NEXT_PUBLIC_USE_MOCK_DATA=true
```
- Uses MSW (Mock Service Worker) to intercept API calls
- Returns mock data from `/src/mocks/msw/handlers.ts`
- Useful for development without backend

#### Preview Mode

```bash
NEXT_PUBLIC_BUILD_FOR_PREVIEW=true
NEXT_PUBLIC_PREVIEW_BASE_PATH=/preview
```
- For deployment in App Builder preview environment

### 9.2 App Configuration File

**Location:** `src/lib/app.config.json`

**Purpose:** Maps TMF entity names to runtime endpoints

**Structure:**
```json
{
  "sources": {
    "AWS Runtime (Singapore)": {
      "type": "api",
      "baseUrl": "http://bssmagic-alb-..."
    }
  },
  "entities": {
    "shoppingCart": {
      "source": "AWS Runtime (Singapore)",
      "serverUrl": "/tmf-api/shoppingCart/v5/",
      "standard": "TMF663",
      "notes": "ShoppingCart mapping"
    },
    "service": {
      "source": "AWS Runtime (Singapore)",
      "serverUrl": "/tmf-api/serviceInventoryManagement/v5/",
      "standard": "TMF638"
    },
    "product": {
      "source": "AWS Runtime (Singapore)",
      "serverUrl": "/tmf-api/productInventory/v5/",
      "standard": "TMF637"
    },
    "solution1867FibreVoice": {
      "source": "AWS Runtime (Singapore)",
      "serverUrl": "/tmf-api/productInventory/v5/",
      "standard": "TMF637",
      "notes": "Custom view: solution1867FibreVoice"
    },
    "serviceProblem": {
      "source": "AWS Runtime (Singapore)",
      "serverUrl": "/tmf-api/serviceProblemManagement/v5/",
      "standard": "TMF656"
    }
    // ... more entities
  }
}
```

---

## 10. Deployment

### 10.1 Local Development

**Prerequisites:**
- Node.js 18+
- npm or pnpm
- Python 3.9+ (for gateways)

**Steps:**
1. Install dependencies:
   ```bash
   cd ts-dashboard
   npm install
   ```

2. Configure environment (optional - for sandbox):
   ```bash
   cp env.example .env.local
   # Edit .env.local with appropriate values
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Opens at http://localhost:3000

**Start Gateways (optional):**
```bash
# CloudSense JS Gateway (port 8080)
cd cloudsense-js-gateway
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# 1147-Gateway (port 8081)
cd 1147-gateway
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
```

### 10.2 Production Build

```bash
npm run build
npm run start
```

### 10.3 Preview Build

```bash
npm run build:preview
npm run start:preview
```

### 10.4 Mock Mode (Demo)

```bash
npm run dev:mocked
```

---

## 11. Detailed Feature Requirements

### 11.1 Dashboard Home Page

**Route:** `/` (or `/dashboard`)

**Layout:**
- **Header:** Sticky header with title and runtime status
- **Stats Banner:** Module selector with gradient background
- **Module Tabs:** Secondary navigation below stats
- **Module Content Area:** Dynamic content based on active module
- **Footer:** Runtime connection info

**State Management:**
- Active module selection (useState)
- Query states managed by React Query

**Default Module:** `order-not-gen` (most critical)

### 11.2 Common UI Patterns

#### 11.2.1 Loading States

**On Initial Load:**
- Show CardLoader with message
- Spinner + "Loading {entity}..." text

**On Refetch:**
- Disable refresh button
- Show spinner in button
- Keep existing data visible

#### 11.2.2 Error States

**On Error:**
- Red background alert box
- Error message display
- Retry button (via refetch)

#### 11.2.3 Empty States

**No Data:**
- Green success box for "no issues found"
- Or gray neutral box for "no data available"
- Helpful message explaining what this means

#### 11.2.4 Refresh Buttons

**All entity lists must have:**
- Manual refresh button
- Disabled state during fetch
- Spinner indicator when loading
- Success feedback (data updates)

### 11.3 Data Fetching Strategy

#### 11.3.1 React Query Configuration

**Global Config:**
```typescript
{
  defaultOptions: {
    queries: {
      staleTime: 30000,      // 30 seconds
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
}
```

**Per-Query Overrides:**
- Health checks: `refetchInterval: 30000` (poll every 30s)
- Service problems: `staleTime: 60000` (1 minute)
- OE configurations: `staleTime: 60000` (1 minute)

#### 11.3.2 Query Keys

**Pattern:** `[TMF_STANDARD, entity, params]`

Examples:
```typescript
['TMF638', 'service', { limit: 20 }]
['TMF637', 'product', { status: 'Not Migrated Successfully' }]
['TMF656', 'serviceProblem', { category: 'SolutionEmpty' }]
['cloudsense-configurations', basketId, solutionName]
```

#### 11.3.3 Mutation Invalidation

**On successful mutation:**
- Invalidate related query keys
- Triggers automatic refetch
- Updates UI with fresh data

Example:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['TMF638', 'service'] });
  queryClient.invalidateQueries({ queryKey: ['TMF656', 'serviceProblem'] });
}
```

### 11.4 Responsive Design

#### 11.4.1 Breakpoints (Tailwind)

```css
sm:  640px   /* Small tablets */
md:  768px   /* Tablets */
lg:  1024px  /* Small desktop */
xl:  1280px  /* Desktop */
2xl: 1536px  /* Large desktop */
```

#### 11.4.2 Grid Layouts

**Module Icons (Stats Banner):**
- Mobile: 2 columns
- Desktop: 5 columns

**Entity Cards:**
- Mobile: 1 column
- Tablet (md): 2 columns
- Desktop (lg): 3 columns
- Large Desktop (xl): 4 columns

**Statistics Grid:**
- Mobile: 2 columns
- Desktop (md): 4 columns

#### 11.4.3 Text Truncation

**Long Text:**
- Use `truncate` class for single-line overflow
- Use `max-h-32 overflow-y-auto` for scrollable sections
- Show tooltips on hover (optional enhancement)

---

## 12. Color System

### 12.1 Status Colors

```typescript
const statusColors = {
  // Success states
  'active': 'bg-emerald-100 text-emerald-700',
  'completed': 'bg-emerald-100 text-emerald-700',
  'resolved': 'bg-emerald-500/10 text-emerald-400 dot:bg-emerald-400',
  
  // In-progress states
  'inProgress': 'bg-blue-100 text-blue-700',
  'acknowledged': 'bg-blue-500/10 text-blue-400 dot:bg-blue-400',
  
  // Warning states
  'pending': 'bg-amber-100 text-amber-700',
  
  // Error states
  'failed': 'bg-red-100 text-red-700',
  'rejected': 'bg-red-500/10 text-red-400 dot:bg-red-400',
  
  // Neutral states
  'inactive': 'bg-gray-100 text-gray-600',
  'cancelled': 'bg-gray-100 text-gray-600',
  'closed': 'bg-slate-500/10 text-slate-400 dot:bg-slate-400',
};
```

### 12.2 Module Colors

```typescript
const moduleColors = {
  'oe-patcher': 'blue',
  'solution-empty': 'violet',
  'order-not-gen': 'amber',
  'iot-qbs': 'emerald',
  'remediation-history': 'slate',
};
```

### 12.3 Category Colors

```typescript
const categoryColors = {
  'SolutionEmpty': 'bg-violet-500/20 text-violet-300',
  'PartialDataMissing': 'bg-amber-500/20 text-amber-300',
  'PartialDataMissing_Voice': 'bg-amber-500/20 text-amber-300',
  'PartialDataMissing_Fibre': 'bg-cyan-500/20 text-cyan-300',
  'PartialDataMissing_eSMS': 'bg-pink-500/20 text-pink-300',
};
```

---

## 13. Custom SQL Views Required

The BSS Magic Runtime must have these custom PostgreSQL views deployed:

### 13.1 Core TMF Views

1. **product.sql** - TMF637 Product mapping from `csord__Solution__c`
2. **service.sql** - TMF638 Service mapping from `csord__Service__c` with 1867 detection fields
3. **shoppingCart.sql** - TMF663 ShoppingCart mapping from `cscfga__Product_Basket__c`
4. **productOrder.sql** - TMF622 ProductOrder mapping from `csord__Order__c`
5. **billingAccount.sql** - TMF666 BillingAccount mapping from `csconta__Billing_Account__c`
6. **individual.sql** - TMF632 Individual mapping from `Contact`
7. **organization.sql** - TMF632 Organization mapping from `Account`

### 13.2 Migration & Remediation Views

8. **failedMigrationProduct.sql** - Products with failed migration status
9. **failedMigrationSolutions.sql** - Solutions with failed migrations
10. **serviceProblem.sql** - TMF656 ServiceProblem tracking table
11. **serviceProblemEventRecord.sql** - TMF656 EventRecord mapping from `AsyncApexJob`
12. **task.sql** - Task tracking view
13. **serviceAttachment.sql** - Service attachment view

### 13.3 1867 Solution Detection Views

14. **solution1867FibreVoice.sql** - Fibre + Voice solutions with 1867 candidates
15. **solution1867FibreOnly.sql** - Fibre-only solutions
16. **solution1867MobileEsms.sql** - Mobile + ESMS solutions
17. **solution1867AccessVoice.sql** - Access & Voice solutions

**Common Fields in 1867 Views:**
```sql
SELECT
  t0."Id" AS "solutionId",
  t0."Name" AS "solutionName",
  sd."Name" AS "solutionDefinitionName",
  t0."cssdm__product_basket__c" AS "basketId",
  b."Name" AS "basketName",
  b."Basket_Stage_UI__c" AS "basketStageUI",
  b."cscfga__Basket_Status__c" AS "basketStatus",
  t0."isFibreService__c" AS "isFibreService",
  t0."isVoiceService__c" AS "isVoiceService",
  t0."hasESMS__c" AS "hasESMS",
  -- ... more fields
FROM salesforce_server."csord__Solution__c" t0
LEFT JOIN salesforce_server."cssdm__Solution_Definition__c" sd
  ON t0."cssdm__solution_definition__c" = sd."Id"
LEFT JOIN salesforce_server."cscfga__Product_Basket__c" b
  ON t0."cssdm__product_basket__c" = b."Id"
WHERE t0."cssdm__product_basket__c" IS NOT NULL
  AND sd."Name" = '{scenario_specific_condition}'
```

---

## 14. Key Business Logic

### 14.1 1867 Scenario Detection Algorithm

**Input:** Service data from TMF638

**Algorithm:**
```typescript
function detect1867Scenario(service: Service): ScenarioType | null {
  // Must be migrated data
  if (!service.x_migratedData) return null;
  
  // Get solution definition from x_solutionName or service.relatedEntity
  const solutionDefinition = getSolutionDefinition(service);
  
  // Scenario 1: Fibre + Voice
  if (solutionDefinition === 'Fibre Solution') {
    if (service.x_serviceType === 'Voice') {
      return 'fibre-voice';
    }
    if (service.x_serviceType === 'Fibre Service') {
      return 'fibre-only';
    }
  }
  
  // Scenario 2: Mobile + ESMS
  if (solutionDefinition === 'Mobile Solution') {
    if (service.x_serviceType === 'eSMS Service') {
      return 'mobile-esms';
    }
  }
  
  // Scenario 3: Access + Voice
  if (solutionDefinition === 'Access & Voice Solution' || 
      solutionDefinition === 'SIP2 Access and Voice Solution') {
    if (service.x_serviceType === 'Voice') {
      return 'access-voice';
    }
  }
  
  return null;
}
```

### 14.2 OE Attribute Validation

**Fibre + Voice Scenario:**
```typescript
function validateFibreVoiceOE(oeAttributes: OEAttribute[]): ValidationResult {
  const checks = [
    {
      field: 'Reserved Number',
      validator: (val) => val && val.trim().length > 0,
      source: 'csord__Service__c.External_ID__c (Voice)',
    },
    {
      field: 'ResourceSystemGroupID',
      validator: (val) => val === 'Migrated',
      source: "Constant: 'Migrated'",
    },
    {
      field: 'NumberStatus',
      validator: (val) => val === 'Reserved',
      source: "Constant: 'Reserved'",
    },
    {
      field: 'PIC Email',
      validator: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      source: 'Service → BA → Contact → Email',
    },
  ];
  
  return checks.map(check => ({
    field: check.field,
    expected: check.validator,
    actual: findAttributeValue(oeAttributes, check.field),
    ok: check.validator(findAttributeValue(oeAttributes, check.field)),
    source: check.source,
  }));
}
```

### 14.3 PIC Email Lookup Chain

**Logic:**
```typescript
async function lookupPicEmail(serviceId: string): Promise<string | null> {
  // 1. Get service (includes x_billingAccountId)
  const service = await getService(serviceId);
  if (!service.x_billingAccountId) return null;
  
  // 2. Get billing account (includes contact in relatedParty)
  const billingAccount = await getBillingAccount(service.x_billingAccountId);
  const contactParty = billingAccount.relatedParty?.find(p => p.role === 'contact');
  if (!contactParty?.partyOrPartyRole?.id) return null;
  
  // 3. Get individual (contact)
  const individual = await getIndividual(contactParty.partyOrPartyRole.id);
  const emailMedium = individual.contactMedium?.find(m => m.contactType === 'email');
  
  return emailMedium?.emailAddress || null;
}
```

**Optimization:** Service view includes `x_picEmail` directly to avoid multiple API calls.

### 14.4 ServiceProblem Creation Flow

**Frontend:**
```typescript
// User clicks "Fix" on failed migration solution
const handleFix = async (solutionId: string, solutionName: string) => {
  const payload = {
    '@type': 'ServiceProblem',
    category: 'SolutionEmpty',
    description: `Solution ${solutionName} data needs re-synchronization with SM Service`,
    priority: 1,
    status: 'pending',
    affectedResource: [{
      id: solutionId,
      name: solutionName,
      '@referredType': 'Product',
    }],
    extensionInfo: [{
      name: 'remediationAction',
      value: 'resync',
    }],
  };
  
  const response = await fetch('/tmf-api/serviceProblemManagement/v5/serviceProblem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  return response.json();
};
```

**Backend Handler (conceptual - actual implementation in BSS Magic Runtime):**
```typescript
// POST /tmf-api/serviceProblemManagement/v5/serviceProblem
async function handleServiceProblemCreate(payload: ServiceProblem) {
  // 1. Create ServiceProblem record in database
  const problem = await createServiceProblem(payload);
  
  // 2. Execute remediation based on category
  if (payload.category === 'SolutionEmpty') {
    // Call 1147-gateway to execute Apex scripts
    const result = await fetch('http://localhost:8081/api/1867/query-solutions', {
      method: 'POST',
      body: JSON.stringify({
        scenario: 'solution-empty',
        solutionIds: [payload.affectedResource[0].id]
      })
    });
    
    // 3. Update problem with result
    if (result.success) {
      problem.status = 'resolved';
      problem.trackingRecord.push({
        description: 'Remediation completed successfully',
        time: new Date().toISOString(),
        user: 'system',
      });
    } else {
      problem.status = 'rejected';
      problem.errorMessage.push({
        message: result.error,
        reason: 'Apex execution failed',
      });
    }
  }
  
  // 4. Return updated problem
  return problem;
}
```

---

## 15. Testing Requirements

### 15.1 Unit Tests (Vitest)

**Test Files:**
- `/src/lib/__tests__/utils.test.ts` - Utility functions
- Component tests for all reusable components

**Coverage Requirements:**
- Utility functions: 100%
- Components: >80%
- Hooks: >70%

### 15.2 E2E Tests (Playwright)

**Test Scenarios:**
1. Load dashboard and verify all modules render
2. Switch between modules
3. Load entity lists (products, services, etc.)
4. Open and close expandable sections
5. Trigger refresh actions
6. Mock API responses for error states

### 15.3 Mock Data (MSW)

**Location:** `/src/mocks/msw/handlers.ts`

**Mock Endpoints:**
- All TMF API endpoints
- Gateway endpoints
- Sample data for each entity type

---

## 16. Performance Requirements

### 16.1 Load Time Targets

- Initial page load: < 2 seconds
- Module switch: < 500ms
- API response display: < 1 second (after data received)

### 16.2 Optimization Strategies

**Code Splitting:**
- Modules loaded dynamically
- React.lazy for heavy components

**API Optimization:**
- Pagination with limit parameter
- Avoid duplicate queries (React Query caching)
- Conditional queries (enabled: !!condition)

**Rendering Optimization:**
- Memoize expensive computations
- Virtualize long lists (if > 100 items)
- Throttle scroll events

### 16.3 Bundle Size

**Target:** < 500KB (gzipped)
- Next.js automatic code splitting
- Tree-shaking for unused code
- Dynamic imports for heavy libraries

---

## 17. Security Requirements

### 17.1 API Authentication

**Headers:**
```typescript
{
  'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
  'X-Environment': 'sandbox' | 'production',  // Optional
  'Content-Type': 'application/json'
}
```

**Storage:**
- API key stored in environment variable (server-side only)
- Never exposed to client-side code
- Injected by Next.js API routes

### 17.2 CORS

**Configuration:**
- Next.js API routes handle CORS automatically
- No client-side CORS issues (same-origin)

### 17.3 Data Validation

**Input Validation:**
- Zod schemas for form inputs
- TypeScript type checking
- API response validation

**XSS Prevention:**
- React automatic escaping
- No dangerouslySetInnerHTML usage
- Sanitize user inputs

---

## 18. Logging and Monitoring

### 18.1 Console Logging

**Standards:**
- Color-coded console groups
- Structured log format
- Log levels: info, warn, error

**Example:**
```typescript
console.group('%c🔧 1867 Complete OE Patcher', 'color: #f59e0b; font-weight: bold');
console.log('%cService ID:', 'color: #059669; font-weight: bold', serviceId);
console.log('%cFields to Patch:', 'color: #7c3aed; font-weight: bold', fields);
console.groupEnd();
```

### 18.2 Error Tracking

**User-Facing Errors:**
- Display in UI with red alert boxes
- Show actionable error messages
- Provide retry options

**Network Errors:**
- Distinguish between network and API errors
- Show connection status
- Retry with exponential backoff (React Query)

---

## 19. Browser Compatibility

### 19.1 Supported Browsers

- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions

### 19.2 Required Features

- ES2020+ support
- Fetch API
- WebSocket (for future real-time features)
- LocalStorage

---

## 20. Accessibility (WCAG 2.1)

### 20.1 Requirements

- Semantic HTML5 elements
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus indicators visible
- Color contrast ratios: 4.5:1 minimum
- Screen reader friendly

### 20.2 Implementation

**Interactive Elements:**
```tsx
<button
  aria-label="Refresh service list"
  onClick={handleRefresh}
>
  Refresh
</button>
```

**Status Indicators:**
```tsx
<span 
  role="status" 
  aria-label={`Service status: ${service.state}`}
  className="status-badge"
>
  {service.state}
</span>
```

---

## 21. Future Enhancements

### 21.1 TMF653 TaskFlow Integration

**When Available:**
- Add taskFlow and task mappings
- Implement IoT QBS full detection
- Add orchestration process monitoring
- Task status tracking

### 21.2 Real-Time Updates

**WebSocket Integration:**
- Subscribe to ServiceProblem updates
- Real-time remediation status
- Live job progress tracking

### 21.3 Bulk Operations

**Batch Actions:**
- Select multiple solutions
- Bulk fix operation
- Progress bar for batch remediation

### 21.4 Advanced Filtering

**Enhanced Filters:**
- Date range picker
- Customer name search
- Multi-select status filters
- Saved filter presets

### 21.5 Export Functionality

**Data Export:**
- Export to CSV
- Export to Excel
- PDF reports
- API endpoint for programmatic access

---

## 22. Development Guidelines

### 22.1 Code Style

**Linting:**
- Biome configuration in `biome.jsonc`
- Run `npm run lint` before commit
- Auto-format with `npm run format`

**TypeScript:**
- Strict mode enabled
- No implicit any
- Explicit return types for functions

### 22.2 Component Structure

**Pattern:**
```typescript
// 1. Imports
import { useState } from 'react';
import type { Entity } from '@/types';

// 2. Types/Interfaces
interface ComponentProps {
  data: Entity;
}

// 3. Sub-components (if any)
function SubComponent() { ... }

// 4. Main component
export default function MainComponent({ data }: ComponentProps) {
  // State
  const [state, setState] = useState();
  
  // Hooks
  const query = useQuery(...);
  
  // Handlers
  const handleAction = () => { ... };
  
  // Render
  return (...);
}
```

### 22.3 API Client Structure

**Pattern:**
```typescript
// 1. Define API function
export async function listEntity(params?: ListParams): Promise<Entity[]> {
  const url = buildUrl('/api/tmf-api/entity', params);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

// 2. Define React Query hook
export function useEntityList(params?: ListParams) {
  return wrapQuery(
    key('TMF###', 'entity', params),
    () => listEntity(params),
    options
  );
}

// 3. Use in component
function Component() {
  const { data, isLoading, error, refetch } = useEntityList({ limit: 20 });
  // ...
}
```

### 22.4 Naming Conventions

**Files:**
- Components: PascalCase (e.g., `ServiceCard.tsx`)
- Utilities: camelCase (e.g., `utils.ts`)
- Types: kebab-case with .ts extension (e.g., `cloudsense.ts`)

**Variables:**
- Constants: UPPER_SNAKE_CASE
- Functions: camelCase
- Components: PascalCase
- Types/Interfaces: PascalCase

**CSS Classes:**
- Tailwind utility classes
- Conditional classes via `cn()` helper
- No custom CSS files (except globals.css)

---

## 23. Deployment Checklist

### 23.1 Pre-Deployment

- [ ] Run `npm run build` successfully
- [ ] Run `npm run lint` - no errors
- [ ] Run `npm run test` - all tests pass
- [ ] Verify all environment variables set
- [ ] Test against production runtime
- [ ] Test against sandbox runtime
- [ ] Verify gateway connectivity (8080, 8081)

### 23.2 Runtime Requirements

**BSS Magic Runtime Must Have:**
- [ ] All custom SQL views deployed (17 views)
- [ ] TMF custom types applied (`tmf.sql`)
- [ ] Salesforce foreign tables imported
- [ ] API key configured
- [ ] Environment routing working (X-Environment header)

**Gateways Must Be Running:**
- [ ] CloudSense JS Gateway on port 8080
- [ ] 1147-Gateway on port 8081
- [ ] Both health endpoints returning 200 OK

### 23.3 Post-Deployment

- [ ] Verify all modules load correctly
- [ ] Test at least one remediation flow end-to-end
- [ ] Check browser console for errors
- [ ] Verify network requests succeed
- [ ] Test responsive layouts (mobile, tablet, desktop)

---

## 24. API Request/Response Examples

### 24.1 Example: Get Services with 1867 Issues

**Request:**
```http
GET /tmf-api/serviceInventoryManagement/v5/service?x_serviceType=Voice&x_migratedData=true&limit=10
Headers:
  X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282
  X-Environment: sandbox
```

**Response:**
```json
[
  {
    "id": "a236D0000008bMhQAI",
    "name": "Converged UC and Voice Solutions",
    "state": "Active",
    "serviceType": "MES Solution",
    "@type": "Service",
    "startDate": "2022-05-19T01:27:14+00:00",
    "x_serviceType": "Voice",
    "x_externalId": "0123456789",
    "x_billingAccountId": "a386D000000B1WxQAK",
    "x_billingAccountName": "BA-0140269",
    "x_picEmail": "pic@customer.com",
    "x_subscriptionId": "a266D0000004OFVQA2",
    "x_solutionId": "a246D0000008SzIQAU",
    "x_solutionName": "Fibre Solution",
    "x_accountId": "0016D00000SJobPQAT",
    "x_migratedData": true,
    "x_has1867Issue": true,
    "x_missingBillingAccount": false,
    "x_missingPicEmail": false,
    "x_missingExternalId": false,
    "x_fibreVoiceOE": true,
    "relatedEntity": [
      {
        "role": "supportingProduct",
        "entity": {
          "id": "a246D0000008SzIQAU",
          "@referredType": "Product"
        }
      }
    ],
    "relatedParty": [
      {
        "role": "customer",
        "partyOrPartyRole": {
          "id": "0016D00000SJobPQAT",
          "name": "Example Corp",
          "@referredType": "Organization"
        }
      }
    ],
    "href": "http://bssmagic-alb-.../tmf-api/serviceInventoryManagement/v5/service/a236D0000008bMhQAI"
  }
]
```

### 24.2 Example: Create ServiceProblem

**Request:**
```http
POST /tmf-api/serviceProblemManagement/v5/serviceProblem
Headers:
  Content-Type: application/json
  X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282
  X-Environment: sandbox

Body:
{
  "@type": "ServiceProblem",
  "category": "SolutionEmpty",
  "description": "Solution Biz Fibre 100Mbps needs re-synchronization",
  "priority": 1,
  "status": "pending",
  "affectedResource": [{
    "id": "a246D0000008SzIQAU",
    "name": "Biz Fibre 100Mbps",
    "@referredType": "Product",
    "@type": "ResourceRef"
  }],
  "extensionInfo": [{
    "name": "remediationAction",
    "value": "resync"
  }]
}
```

**Response:**
```json
{
  "id": "SP-001",
  "@type": "ServiceProblem",
  "href": "http://bssmagic-alb-.../tmf-api/serviceProblemManagement/v5/serviceProblem/SP-001",
  "category": "SolutionEmpty",
  "description": "Solution Biz Fibre 100Mbps needs re-synchronization",
  "priority": 1,
  "status": "resolved",
  "reason": "Empty solution configuration detected during migration",
  "affectedResource": [{
    "id": "a246D0000008SzIQAU",
    "name": "Biz Fibre 100Mbps",
    "@referredType": "Product"
  }],
  "trackingRecord": [
    {
      "description": "ServiceProblem created",
      "time": "2026-01-21T13:00:00Z",
      "user": "system",
      "@type": "TrackingRecord"
    },
    {
      "description": "Remediation initiated - calling Apex scripts",
      "time": "2026-01-21T13:00:01Z",
      "user": "system"
    },
    {
      "description": "Apex job 707MS0000... completed successfully",
      "time": "2026-01-21T13:00:15Z",
      "user": "system"
    },
    {
      "description": "Remediation completed successfully",
      "time": "2026-01-21T13:00:15Z",
      "user": "system"
    }
  ],
  "extensionInfo": [
    {
      "name": "remediationAction",
      "value": "resync"
    },
    {
      "name": "apexJobId",
      "value": "707MS000000abcDEF"
    }
  ],
  "creationDate": "2026-01-21T13:00:00Z",
  "lastUpdate": "2026-01-21T13:00:15Z",
  "resolutionDate": "2026-01-21T13:00:15Z"
}
```

### 24.3 Example: Patch OE Complete

**Request:**
```http
POST /api/gateway-1147/1867/patch-complete
Headers:
  Content-Type: application/json

Body:
{
  "serviceId": "a236D0000008bMhQAI",
  "serviceType": "Voice",
  "fieldsToPatch": [
    {
      "fieldName": "Reserved Number",
      "value": "0123456789",
      "label": "Reserved Number"
    },
    {
      "fieldName": "PIC Email",
      "value": "pic@example.com",
      "label": "PIC Email"
    },
    {
      "fieldName": "ResourceSystemGroupID",
      "value": "Migrated",
      "label": "Resource System Group ID"
    },
    {
      "fieldName": "NumberStatus",
      "value": "Reserved",
      "label": "Number Status"
    }
  ],
  "dryRun": false
}
```

**Response:**
```json
{
  "success": true,
  "serviceId": "a236D0000008bMhQAI",
  "patchedFields": [
    {
      "fieldName": "Reserved Number",
      "value": "0123456789",
      "source": "UI",
      "newValue": "0123456789"
    },
    {
      "fieldName": "PIC Email",
      "value": "pic@example.com",
      "source": "UI",
      "newValue": "pic@example.com"
    },
    {
      "fieldName": "ResourceSystemGroupID",
      "value": "Migrated",
      "source": "UI",
      "newValue": "Migrated"
    },
    {
      "fieldName": "NumberStatus",
      "value": "Reserved",
      "source": "UI",
      "newValue": "Reserved"
    }
  ],
  "cloudsenseDBUpdated": true,
  "attachmentUpdated": true,
  "backupAttachmentId": "00PMS000000xyz123",
  "remainingMissingFields": []
}
```

---

## 25. Database Schema (Runtime)

### 25.1 Custom Tables

**tmf.serviceProblem:**
```sql
CREATE TABLE tmf.serviceProblem (
  id SERIAL PRIMARY KEY,
  category TEXT,
  description TEXT,
  priority INTEGER,
  status TEXT,
  reason TEXT,
  affectedResource JSONB,
  trackingRecord JSONB,
  errorMessage JSONB,
  extensionInfo JSONB,
  creationDate TIMESTAMP DEFAULT NOW(),
  lastUpdate TIMESTAMP DEFAULT NOW(),
  resolutionDate TIMESTAMP
);
```

**Indexes:**
```sql
CREATE INDEX idx_serviceproblem_status ON tmf.serviceProblem(status);
CREATE INDEX idx_serviceproblem_category ON tmf.serviceProblem(category);
CREATE INDEX idx_serviceproblem_created ON tmf.serviceProblem(creationDate DESC);
```

### 25.2 Foreign Data Wrapper Setup

**Salesforce FDW Configuration:**
```sql
CREATE EXTENSION IF NOT EXISTS multicorn;

CREATE SERVER salesforce_server
  FOREIGN DATA WRAPPER multicorn
  OPTIONS (
    wrapper 'salesforce_fdw.SalesforceFDW',
    username 'vinay.jagwani@trilogy.com.fdrv2',
    password 'Nov@2025CtsJTMUYyg8bRtXWGCHgvCOf',
    security_token 'CtsJTMUYyg8bRtXWGCHgvCOf',
    client_id '3MVG9z6NAroNkeMmnl9r_...',
    client_secret '5BECD33105C3FEC6699A0028BB9F891F...',
    login_url 'https://test.salesforce.com'
  );

-- Import all CloudSense tables
IMPORT FOREIGN SCHEMA public
  FROM SERVER salesforce_server
  INTO salesforce_server;
```

---

## 26. Quick Start Guide

### 26.1 For New Developers

**Step 1: Clone and Setup**
```bash
git clone <repo>
cd ts-dashboard
npm install
```

**Step 2: Configure Environment**
```bash
# For production
# No configuration needed - uses defaults

# For sandbox
cp env.example .env.local
# Edit .env.local:
# - Set NEXT_PUBLIC_TMF_ENVIRONMENT=sandbox
# - Set gateway URLs if local
```

**Step 3: Start Development**
```bash
npm run dev
# Opens at http://localhost:3000
```

**Step 4: Explore Code**
- Main page: `src/app/page.tsx`
- TMF API hooks: `src/tmf/working-apis/hooks.ts`
- Components: `src/components/`
- Configuration: `src/lib/app.config.json`

### 26.2 Key Files Reference

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main dashboard page with all modules |
| `src/tmf/working-apis/api.ts` | TMF API client functions and types |
| `src/tmf/working-apis/hooks.ts` | React Query hooks for all APIs |
| `src/components/modules/OEPatcherModule.tsx` | 1867 OE patcher module |
| `src/components/modules/ServiceProblemModule.tsx` | TMF656 service problems |
| `src/hooks/useCloudSense.ts` | CloudSense gateway hooks |
| `src/lib/cloudsense-api.ts` | CloudSense gateway API client |
| `src/lib/app.config.json` | TMF entity configuration |
| `src/app/api/tmf-api/[...slug]/route.ts` | TMF API proxy handler |

---

## 27. Appendix: TMF Standard References

### 27.1 TMF API Standards

- **TMF620** - Product Catalog Management API
- **TMF622** - Product Ordering Management API
- **TMF632** - Party Management API
- **TMF637** - Product Inventory Management API
- **TMF638** - Service Inventory Management API
- **TMF653** - Service Test Management API (future)
- **TMF656** - Service Problem Management API
- **TMF663** - Shopping Cart Management API
- **TMF666** - Account Management API

### 27.2 CloudSense Object Reference

| CloudSense Object | TMF Entity | TMF Standard | Purpose |
|-------------------|------------|--------------|---------|
| `csord__Solution__c` | Product | TMF637 | Solutions, bundles |
| `csord__Subscription__c` | Product | TMF637 | Subscriptions |
| `csord__Service__c` | Service | TMF638 | Services (Voice, Fibre, etc.) |
| `csord__Order__c` | ProductOrder | TMF622 | Orders |
| `cscfga__Product_Basket__c` | ShoppingCart | TMF663 | Baskets |
| `csconta__Billing_Account__c` | BillingAccount | TMF666 | Billing accounts |
| `Contact` | Individual | TMF632 | Contacts |
| `Account` | Organization | TMF632 | Accounts/Organizations |
| `csord__Product_Definition__c` | ProductOffering | TMF620 | Product catalog |
| `cscfga__Product_Configuration__c` | ProductConfiguration | N/A | Product config |
| `cscfga__Attribute__c` | Characteristic | N/A | Attributes/OE |
| `AsyncApexJob` | ServiceProblemEventRecord | TMF656 | Batch job tracking |
| `CSPOFA__Orchestration_Process__c` | TaskFlow | TMF653 | Orchestration (future) |
| `CSPOFA__Orchestration_Step__c` | Task | TMF653 | Orchestration steps (future) |
| `Attachment` | N/A | N/A | File attachments |

---

## 28. Summary

This requirements specification provides everything needed to rebuild the BSS Magic TypeScript Dashboard from scratch, including:

✅ **Complete TMF API integration** - All 9 TMF standards used  
✅ **5 remediation modules** - Full feature specifications  
✅ **Gateway integrations** - CloudSense JS and 1147-Gateway  
✅ **Data models** - TypeScript interfaces for all entities  
✅ **UI components** - Card components, loaders, badges  
✅ **Configuration** - Environment setup, app config  
✅ **Deployment guide** - Local dev, production build  
✅ **Business logic** - Detection algorithms, validation rules  
✅ **API examples** - Request/response samples  
✅ **SQL views** - All 17 custom views required  

**Key Success Factors:**
1. Understanding the 1867 OE data patching scenarios
2. Proper TMF API integration with custom x_ fields
3. Gateway connectivity for OE retrieval and patching
4. TMF656 ServiceProblem for remediation tracking
5. Custom SQL views with proper foreign table mappings

---

**Document Version:** 2.0  
**Last Updated:** January 21, 2026  
**Maintained By:** BSS Magic Team
