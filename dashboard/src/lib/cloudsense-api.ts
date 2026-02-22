/**
 * CloudSense JS API Gateway Client
 * Uses /api/gateway-cloudsense proxy which routes to the actual gateway
 * (localhost:8080 in container, or remote URL in production)
 */

// Use the Next.js API proxy route instead of direct localhost
const CLOUDSENSE_API = '/api/gateway-cloudsense';

// Types
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
  solution_name: string;
  timestamp: string;
  solution?: {
    id: string;
    name: string;
    guid: string | null;
  };
  count: number;
  configurations: Configuration[];
  detail?: string;
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
    result: { success: boolean; result?: unknown };
  }>;
  persist: { success: boolean; error?: string };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

// Key OE fields for 1867 detection
export const KEY_OE_FIELDS = [
  'billing account',
  'billingaccount',
  'reserved',
  'reservednumber',
  'msisdn',
  'currentmsisdn',
  'iccid',
  'email',
  'picemail',
  'external',
  'externalid',
];

export function isKeyField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase().replace(/\s+/g, '');
  return KEY_OE_FIELDS.some(key => lower.includes(key.replace(/\s+/g, '')));
}

// API Functions
export async function checkHealth(): Promise<HealthResponse> {
  try {
    // /api/gateway-cloudsense/health -> proxied to /health on gateway
    const response = await fetch(`${CLOUDSENSE_API}/health`);
    if (!response.ok) {
      throw new Error('Gateway not responding');
    }
    return response.json();
  } catch {
    throw new Error('CloudSense Gateway not running or not connected');
  }
}

export async function getConfigurations(
  basketId: string,
  solutionName: string
): Promise<ConfigurationsResponse> {
  // /api/gateway-cloudsense/configurations -> proxied to /api/configurations on gateway
  const response = await fetch(`${CLOUDSENSE_API}/configurations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ basket_id: basketId, solution_name: solutionName })
  });
  
  const data = await response.json();
  
  if (!response.ok || data.detail) {
    const baseMsg = data.detail || `Failed to get configurations: ${response.statusText}`;
    // Common Playwright failure mode: service is up but it can't open Solution Console / find the solution.
    // Give a more actionable hint so users know where to look next (gateway terminal logs, credentials, UI changes).
    if (typeof baseMsg === 'string' && baseMsg.includes('Failed to load Solution Console')) {
      throw new Error(
        `${baseMsg}\n\nTroubleshooting:\n- Confirm CloudSense gateway is logged in and can open Solution Console in a browser\n- Check the gateway terminal logs for the real Playwright error (selectors/login/timeouts)\n- Try restarting the gateway (Playwright session can get stuck)\n- Verify basket_id and solution_name exist in the same Salesforce org the gateway is using`
      );
    }
    throw new Error(baseMsg);
  }
  
  return data;
}

export async function updateOEAttributes(
  basketId: string,
  attributes: Array<{ name: string; value: string; displayValue?: string }>,
  configGuid?: string,
  oeGuid?: string
): Promise<OEUpdateResponse> {
  // /api/gateway-cloudsense/oe/update -> proxied to /api/oe/update on gateway
  const response = await fetch(`${CLOUDSENSE_API}/oe/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      basket_id: basketId,
      config_guid: configGuid,
      oe_guid: oeGuid,
      attributes
    })
  });
  
  const data = await response.json();
  
  if (!response.ok || data.detail) {
    throw new Error(data.detail || `Failed to update OE attributes: ${response.statusText}`);
  }
  
  return data;
}

// Helper to analyze OE data and find missing fields
export interface OEAnalysis {
  configName: string;
  configGuid: string;
  oeName: string;
  oeGuid: string;
  keyFields: Array<{
    name: string;
    value: string;
    displayValue: string;
    isMissing: boolean;
  }>;
  missingCount: number;
}

export function analyzeConfigurations(data: ConfigurationsResponse): OEAnalysis[] {
  const results: OEAnalysis[] = [];
  
  for (const config of data.configurations) {
    for (const oe of config.orderEnrichmentList) {
      const keyFields: OEAnalysis['keyFields'] = [];
      
      for (const attr of oe.attributes) {
        const name = attr.name?.trim() || '';
        if (isKeyField(name)) {
          const value = String(attr.value || '');
          keyFields.push({
            name,
            value,
            displayValue: attr.displayValue || value,
            isMissing: !value || value.trim() === ''
          });
        }
      }
      
      if (keyFields.length > 0) {
        results.push({
          configName: config.name,
          configGuid: config.guid,
          oeName: oe.name,
          oeGuid: oe.guid,
          keyFields,
          missingCount: keyFields.filter(f => f.isMissing).length
        });
      }
    }
  }
  
  return results;
}
