// 1147-Gateway API Client (Port 8081)
import type { PatchCompleteRequest, PatchCompleteResponse } from '../../types/tmf-api';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_1147_URL || 'http://localhost:8081';

interface AttachmentResponse {
  attachmentId: string;
  fileName: string;
  attachmentData: {
    ProductAttributes: unknown[];
    ServiceAttributes: unknown[];
  };
}

interface VerifyOEResponse {
  oeDataFound: boolean;
  componentsCount: number;
  attributesCount: number;
  fields: Record<string, {
    found: boolean;
    value: string;
    displayValue?: string;
  }>;
  allFieldsPresent: boolean;
}

interface PatchAttachmentRequest {
  fieldsToPatch: Array<{
    fieldName: string;
    value: string;
    label: string;
  }>;
  dryRun?: boolean;
}

interface PatchAttachmentResponse {
  success: boolean;
  attachmentUpdated: boolean;
  backupAttachmentId?: string;
}

// Health check
export async function checkHealth(): Promise<{ 
  status: string; 
  service: string; 
  version: string;
}> {
  const response = await fetch(`${GATEWAY_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

// Get service attachment
export async function getServiceAttachment(serviceId: string): Promise<AttachmentResponse> {
  const response = await fetch(`${GATEWAY_URL}/api/1867/service/${serviceId}/attachment`);
  
  if (!response.ok) {
    throw new Error(`Failed to get service attachment: ${response.statusText}`);
  }
  
  return response.json();
}

// Patch complete (CloudSense DB + Attachment)
export async function patchComplete(request: PatchCompleteRequest): Promise<PatchCompleteResponse> {
  const response = await fetch(`${GATEWAY_URL}/api/1867/patch-complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to patch complete: ${response.statusText} - ${errorText}`);
  }
  
  return response.json();
}

// Verify OE fields exist
export async function verifyOE(serviceId: string, fields: string[]): Promise<VerifyOEResponse> {
  const url = new URL(`${GATEWAY_URL}/api/1867/service/${serviceId}/verify-oe`);
  url.searchParams.append('fields', fields.join(','));
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Failed to verify OE: ${response.statusText}`);
  }
  
  return response.json();
}

// Patch attachment only
export async function patchAttachment(
  serviceId: string,
  request: PatchAttachmentRequest
): Promise<PatchAttachmentResponse> {
  const response = await fetch(`${GATEWAY_URL}/api/1867/service/${serviceId}/patch-attachment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to patch attachment: ${response.statusText}`);
  }
  
  return response.json();
}

// Query solutions (1147 candidates)
export async function querySolutions(scenario: string, limit = 100): Promise<{ solutions: unknown[] }> {
  const response = await fetch(`${GATEWAY_URL}/api/1867/query-solutions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scenario, limit }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to query solutions: ${response.statusText}`);
  }
  
  return response.json();
}
