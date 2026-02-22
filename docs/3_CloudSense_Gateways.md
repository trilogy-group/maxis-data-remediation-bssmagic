# CloudSense JavaScript API Gateway

**Last Updated**: December 16, 2025  
**Purpose**: Access CloudSense OE (Order Enrichment) data via REST API

---

## Overview

The CloudSense JS API Gateway is a local FastAPI service that exposes CloudSense JavaScript APIs (which only work inside the browser) as REST endpoints. It uses headless Playwright to authenticate with Salesforce and execute JS APIs like `solution.getAllConfigurations()` and `solution.updateOrderEnrichmentConfigurationAttribute()`.

### Why This Gateway?

CloudSense stores Order Enrichment (OE) data in Heroku PostgreSQL, **not** in Salesforce. The only way to access this data is through the CloudSense Solution Console JavaScript API, which requires a browser session. This gateway provides REST access to that data.

---

## Service Details

| Property | Value |
|----------|-------|
| **Base URL** | `http://localhost:8080` |
| **Swagger UI** | `http://localhost:8080/docs` |
| **Technology** | FastAPI + Playwright (headless Chrome) |
| **Response Time** | 30-60 seconds (browser automation overhead) |

---

## Starting the Gateway

### Prerequisites
- Python 3.9+
- Virtual environment with dependencies
- Playwright browser installed

### Start Command

```bash
cd "/Users/vladsorici/Downloads/Maxis/bss magic PoC"
source venv/bin/activate
python cloudsense_api_service/main.py
```

### Stop Command

```bash
lsof -ti:8080 | xargs kill -9
```

---

## API Endpoints

### 1. Health Check

```bash
GET http://localhost:8080/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-04T18:17:41.863621"
}
```

---

### 2. Get Configurations (with OE data)

Retrieves all configurations and Order Enrichment data for a product basket.

```bash
POST http://localhost:8080/api/configurations
Content-Type: application/json

{
  "basket_id": "a0uMS000001KiqnYAC"
}
```

**Response:**
```json
{
  "success": true,
  "basket_id": "a0uMS000001KiqnYAC",
  "timestamp": "2025-12-04T18:20:11.990006",
  "count": 3,
  "configurations": [
    {
      "guid": "2b52dcc2-f64a-0464-8b58-05fd241f617e",
      "name": "IoT Solution",
      "productConfigurationId": null,
      "productDefinition": null,
      "serviceId": null,
      "status": true,
      "orderEnrichmentCount": 0,
      "orderEnrichmentList": []
    },
    {
      "guid": "0219bb6c-e585-7373-0468-a00a85845394",
      "name": "IoT Service",
      "productConfigurationId": null,
      "productDefinition": null,
      "serviceId": null,
      "status": true,
      "orderEnrichmentCount": 6,
      "orderEnrichmentList": [
        {
          "guid": "fcaff15d-c1f8-e85b-15bb-f96ff0c5dbff",
          "name": "IOT Service OE 5",
          "attributeCount": 42,
          "attributes": [
            {
              "name": "Billing Account",
              "value": "300019011",
              "displayValue": "BA-0238392",
              "readonly": null,
              "required": false
            },
            {
              "name": "MSISDN",
              "value": "",
              "displayValue": "",
              "readonly": null,
              "required": false
            },
            {
              "name": "ICCID",
              "value": "8960011001218723670",
              "displayValue": "8960011001218723670",
              "readonly": null,
              "required": false
            }
          ]
        }
      ]
    }
  ]
}
```

---

### 3. Update OE Attributes

Updates Order Enrichment attributes for a basket.

```bash
POST http://localhost:8080/api/oe/update
Content-Type: application/json

{
  "basket_id": "a0uMS000001KiqnYAC",
  "attributes": [
    {
      "name": "Billing Account",
      "value": "300019099",
      "displayValue": "BA-TEST"
    }
  ]
}
```

**Optional targeting fields:**
- `config_guid`: Update only a specific configuration (by GUID)
- `oe_guid`: Update only a specific OE item (by GUID)

**Example with targeting:**
```json
{
  "basket_id": "a0uMS000001KiqnYAC",
  "config_guid": "0219bb6c-e585-7373-0468-a00a85845394",
  "oe_guid": "fcaff15d-c1f8-e85b-15bb-f96ff0c5dbff",
  "attributes": [
    {"name": "Billing Account", "value": "300019099", "displayValue": "BA-TEST"}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "basket_id": "a0uMS000001KiqnYAC",
  "timestamp": "2025-12-04T18:21:23.101102",
  "updates": [
    {
      "config_name": "IoT Service",
      "config_guid": "0219bb6c-e585-7373-0468-a00a85845394",
      "oe_name": "IOT Service OE 5",
      "oe_guid": "fcaff15d-c1f8-e85b-15bb-f96ff0c5dbff",
      "result": {"success": true, "result": {}}
    }
  ],
  "persist": {"success": true}
}
```

---

## TypeScript Integration

### Types Definition

```typescript
// src/types/cloudsense.ts

export interface OEAttribute {
  name: string;
  value: string | boolean;
  displayValue?: string;
  readonly?: boolean | null;
  required?: boolean;
}

export interface OrderEnrichment {
  guid: string;
  name: string;
  attributeCount: number;
  attributes: OEAttribute[];
}

export interface Configuration {
  guid: string;
  name: string;
  productConfigurationId: string | null;
  productDefinition: string | null;
  serviceId: string | null;
  status: boolean;
  orderEnrichmentCount: number;
  orderEnrichmentList: OrderEnrichment[];
}

export interface ConfigurationsResponse {
  success: boolean;
  basket_id: string;
  timestamp: string;
  count: number;
  configurations: Configuration[];
}

export interface OEUpdateResponse {
  success: boolean;
  basket_id: string;
  timestamp: string;
  updates: Array<{
    config_name: string;
    config_guid: string;
    oe_name: string;
    oe_guid: string;
    result: { success: boolean; result?: any };
  }>;
  persist: { success: boolean; error?: string };
}
```

### API Client

```typescript
// src/lib/cloudsense-api.ts

const CLOUDSENSE_API = process.env.NEXT_PUBLIC_CLOUDSENSE_API || 'http://localhost:8080';

export async function checkCloudSenseHealth(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch(`${CLOUDSENSE_API}/health`);
  if (!response.ok) {
    throw new Error('CloudSense Gateway is not available');
  }
  return response.json();
}

export async function getConfigurations(basketId: string): Promise<ConfigurationsResponse> {
  const response = await fetch(`${CLOUDSENSE_API}/api/configurations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ basket_id: basketId })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get configurations: ${response.statusText}`);
  }
  
  return response.json();
}

export async function updateOEAttributes(
  basketId: string,
  attributes: Array<{ name: string; value: string; displayValue?: string }>,
  configGuid?: string,
  oeGuid?: string
): Promise<OEUpdateResponse> {
  const response = await fetch(`${CLOUDSENSE_API}/api/oe/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      basket_id: basketId,
      config_guid: configGuid,
      oe_guid: oeGuid,
      attributes
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update OE attributes: ${response.statusText}`);
  }
  
  return response.json();
}
```

### React Query Hooks

```typescript
// src/hooks/useCloudSense.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  checkCloudSenseHealth, 
  getConfigurations, 
  updateOEAttributes 
} from '@/lib/cloudsense-api';

export function useCloudSenseHealth() {
  return useQuery({
    queryKey: ['cloudsense-health'],
    queryFn: checkCloudSenseHealth,
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1
  });
}

export function useConfigurations(basketId: string | null) {
  return useQuery({
    queryKey: ['configurations', basketId],
    queryFn: () => getConfigurations(basketId!),
    enabled: !!basketId,
    staleTime: 60000, // Cache for 1 minute
    retry: 1
  });
}

export function useUpdateOEAttributes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      basketId,
      attributes,
      configGuid,
      oeGuid
    }: {
      basketId: string;
      attributes: Array<{ name: string; value: string; displayValue?: string }>;
      configGuid?: string;
      oeGuid?: string;
    }) => updateOEAttributes(basketId, attributes, configGuid, oeGuid),
    
    onSuccess: (data, variables) => {
      // Invalidate configurations cache to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['configurations', variables.basketId] });
    }
  });
}
```

---

## Use Case: 1867 OE Patcher Module

The CloudSense Gateway is essential for the **1867 OE Patcher** module, which patches missing Order Enrichment attributes on MACD (Move, Add, Change, Delete) baskets.

### Workflow

1. **Detect Missing Attributes**: Query SOQL to find baskets with missing OE data
2. **Fetch OE Data**: Use `/api/configurations` to get current OE attributes
3. **Identify Gaps**: Compare with expected values (from migrated services)
4. **Patch Data**: Use `/api/oe/update` to fix missing values

### Example: Fix Missing Billing Account

```typescript
async function patchMissingBillingAccount(basketId: string, billingAccountId: string) {
  // 1. Get current configurations
  const configs = await getConfigurations(basketId);
  
  // 2. Find OEs with missing Billing Account
  for (const config of configs.configurations) {
    for (const oe of config.orderEnrichmentList) {
      const billingAttr = oe.attributes.find(a => a.name === 'Billing Account');
      
      if (!billingAttr?.value) {
        // 3. Patch the missing value
        await updateOEAttributes(
          basketId,
          [{ name: 'Billing Account', value: billingAccountId, displayValue: `BA-${billingAccountId}` }],
          config.guid,
          oe.guid
        );
        console.log(`Patched Billing Account for ${oe.name}`);
      }
    }
  }
}
```

---

## Environment Configuration

### Salesforce Credentials

The gateway uses these environment variables (defaults to FDRv2 sandbox):

```bash
export SF_USERNAME="your.user@maxis.com.fdrv2"
export SF_PASSWORD="your_password"
export SF_TOKEN="security_token"
export SF_DOMAIN="test"  # "test" for sandbox, "login" for production
```

### CORS Configuration

CORS is enabled for all origins. The gateway accepts requests from any localhost port.

---

## Important Notes

1. **Response Time**: Expect 30-60 seconds per request due to browser automation
2. **Sequential Processing**: One request at a time (single browser instance)
3. **Session Management**: Browser session persists between requests for efficiency
4. **Data Source**: OE data comes from Heroku PostgreSQL, not Salesforce
5. **Maxis Environment**: Currently configured for FDRv2 sandbox

---

## File Locations

| File | Purpose |
|------|---------|
| `/Users/vladsorici/Downloads/Maxis/bss magic PoC/cloudsense_api_service/main.py` | Main service |
| `/Users/vladsorici/Downloads/Maxis/bss magic PoC/cloudsense_api_service/requirements.txt` | Python dependencies |
| `/Users/vladsorici/Downloads/Maxis/bss magic PoC/venv/` | Virtual environment |

---

## cURL Examples

### Test Health
```bash
curl http://localhost:8080/health
```

### Get Configurations
```bash
curl -X POST http://localhost:8080/api/configurations \
  -H "Content-Type: application/json" \
  -d '{"basket_id": "a0uMS000001KiqnYAC"}'
```

### Update Billing Account (all OEs)
```bash
curl -X POST http://localhost:8080/api/oe/update \
  -H "Content-Type: application/json" \
  -d '{
    "basket_id": "a0uMS000001KiqnYAC",
    "attributes": [
      {"name": "Billing Account", "value": "300019011", "displayValue": "BA-0238392"}
    ]
  }'
```

### Update Specific OE
```bash
curl -X POST http://localhost:8080/api/oe/update \
  -H "Content-Type: application/json" \
  -d '{
    "basket_id": "a0uMS000001KiqnYAC",
    "config_guid": "0219bb6c-e585-7373-0468-a00a85845394",
    "oe_guid": "fcaff15d-c1f8-e85b-15bb-f96ff0c5dbff",
    "attributes": [
      {"name": "Billing Account", "value": "300019011", "displayValue": "BA-0238392"}
    ]
  }'
```

---

## Troubleshooting

### Gateway Not Starting

```bash
# Check if port is in use
lsof -i:8080

# Kill existing process
lsof -ti:8080 | xargs kill -9

# Check Python environment
which python
pip list | grep -E "fastapi|playwright"
```

### Playwright Browser Issues

```bash
# Reinstall browsers
playwright install chromium

# Check browser installation
playwright install --help
```

### Authentication Failures

1. Verify Salesforce credentials in environment variables
2. Check if user has access to CloudSense Solution Console
3. Verify security token is correct

### Slow Response Times

- Normal: 30-60 seconds (browser rendering)
- If >2 minutes: Check network, Salesforce load, or browser issues










