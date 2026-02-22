/**
 * CloudSense API Gateway Types
 * For Order Enrichment (OE) data
 */

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

export interface OEUpdateRequest {
  basket_id: string;
  config_guid?: string;
  oe_guid?: string;
  attributes: Array<{ name: string; value: string; displayValue?: string }>;
}

export interface OEUpdateResult {
  config_name: string;
  config_guid: string;
  oe_name: string;
  oe_guid: string;
  result: { success: boolean; result?: any; error?: string };
}

export interface OEUpdateResponse {
  success: boolean;
  basket_id: string;
  timestamp: string;
  updates: OEUpdateResult[];
  persist: { success: boolean; error?: string };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

