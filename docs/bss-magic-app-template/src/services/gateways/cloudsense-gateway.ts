// CloudSense JS Gateway API Client (Port 8080)
import type { ConfigurationsResponse } from '../../types/tmf-api';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_CLOUDSENSE_URL || 'http://localhost:8080';

interface VerifyOEResponse {
  oeDataFound: boolean;
  componentsCount: number;
  attributesCount: number;
  attributes: Array<{
    name: string;
    value: string;
    displayValue?: string;
  }>;
}

interface UpdateOERequest {
  basketId: string;
  configGuid?: string;
  oeGuid?: string;
  attributes: Array<{
    name: string;
    value: string;
    displayValue?: string;
  }>;
}

interface UpdateOEResponse {
  success: boolean;
  message: string;
}

// Health check
export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch(`${GATEWAY_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

// Get configurations (OE data) for a basket
export async function getConfigurations(
  basketId: string,
  solutionName: string
): Promise<ConfigurationsResponse> {
  const url = new URL(`${GATEWAY_URL}/api/configurations`);
  url.searchParams.append('basket_id', basketId);
  url.searchParams.append('solution_name', solutionName);
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Failed to get configurations: ${response.statusText}`);
  }
  
  return response.json();
}

// Verify OE data exists
export async function verifyOE(
  basketId: string,
  solutionName: string
): Promise<VerifyOEResponse> {
  const url = new URL(`${GATEWAY_URL}/api/verify-oe`);
  url.searchParams.append('basket_id', basketId);
  url.searchParams.append('solution_name', solutionName);
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Failed to verify OE: ${response.statusText}`);
  }
  
  return response.json();
}

// Update OE attributes
export async function updateOEAttributes(request: UpdateOERequest): Promise<UpdateOEResponse> {
  const response = await fetch(`${GATEWAY_URL}/api/oe/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update OE attributes: ${response.statusText}`);
  }
  
  return response.json();
}
