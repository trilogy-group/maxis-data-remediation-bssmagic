// Solution Empty (1147) Data Service
// Connects to TMF Product API for detection

import type {
  SolutionEmptyData,
  SolutionEmptyIssue,
  SolutionEmptySummary,
  ServiceProblem,
  FixabilityReasonCode,
  RemediationOutcome,
} from '../../types/solution-empty';
import { FIXABILITY_REASONS } from '../../types/solution-empty';

// API Configuration
// Use relative path to leverage Vite proxy (avoids CORS issues)
// Proxy adds X-API-Key and X-Environment headers automatically
const TMF_BASE_URL = '';
const API_KEY = import.meta.env.VITE_BSSMAGIC_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';
const ENVIRONMENT = import.meta.env.VITE_TMF_ENVIRONMENT || 'sandbox';

/**
 * TMF Product response type (simplified)
 */
interface TMFProduct {
  id: string;
  name?: string;
  status?: string;
  productSpecification?: {
    id?: string;
    name?: string;
  };
  relatedParty?: Array<{
    id?: string;
    name?: string;
    role?: string;
    partyOrPartyRole?: {
      id?: string;
      name?: string;
    };
  }>;
  // TMF API returns productCharacteristic (TMF standard name)
  productCharacteristic?: Array<{
    '@type'?: string;
    name: string;
    value: string | number | boolean;
    valueType?: string;
  }>;
  '@type'?: string;
  createdDate?: string;
  lastUpdate?: string;
}

/**
 * Fetch products with failed migration status from TMF API
 * API: /tmf-api/productInventory/v5/product
 * 
 * The ts-dashboard routes this query to the local 1147-gateway for
 * Solution Empty detection, which maps the TMF query to SOQL:
 *   SELECT Id, Name, csord__External_Identifier__c FROM csord__Solution__c 
 *   WHERE CreatedBy.Name = 'Migration User' 
 *   AND csord__External_Identifier__c = 'Not Migrated Successfully'
 */
async function fetchFailedMigrationProducts(): Promise<TMFProduct[]> {
  const params = new URLSearchParams({
    limit: '100',
    status: 'Not Migrated Successfully',
    'relatedParty.partyOrPartyRole.name': 'Migration User',
  });

  // Use direct TMF API path (CloudFront routes to ALB → TMF Runtime)
  const url = `/tmf-api/productInventory/v5/product?${params.toString()}`;
  
  console.log('[SolutionEmpty] Fetching from TMF API:', url);
  
  // Build headers - API Key only (X-Environment not needed as CloudFront routes to correct runtime)
  const headers: Record<string, string> = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error('[SolutionEmpty] TMF API failed:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[SolutionEmpty] TMF API error:', error);
    return [];
  }
}

/**
 * Transform TMF Product to SolutionEmptyIssue
 */
function transformProductToIssue(product: TMFProduct): SolutionEmptyIssue {
  // Determine fixability based on product characteristics
  const fixability = determineFixability(product);
  
  // Get remediation status from characteristics if available
  const remediation = getRemediationStatus(product);

  return {
    solutionId: product.id,
    solutionName: product.name || product.productSpecification?.name || null,
    sfEnvironment: import.meta.env.VITE_SF_ENVIRONMENT_NAME || 'Sandbox',
    detectedAt: product.lastUpdate || product.createdDate || new Date().toISOString(),
    useCase: '1147',
    detectionSource: 'BSS Magic – Solution Validator',
    fixability,
    remediation,
  };
}

/**
 * Determine fixability based on product data
 * Uses validationStatus characteristic from TMF Product API:
 * - "valid" = Solution can be safely remediated (no dependencies)
 * - "referenced" = Solution is referenced by another solution (MACD dependency, cannot fix)
 */
function determineFixability(product: TMFProduct): SolutionEmptyIssue['fixability'] {
  // TMF API returns productCharacteristic (not characteristic)
  const characteristics = product.productCharacteristic || [];
  
  // PRIMARY CHECK: Use validationStatus characteristic
  // This is populated by the product.sql view based on cssdm__replaced_solution__c references
  const validationStatus = characteristics.find(c => c.name === 'validationStatus')?.value as string | undefined;
  
  if (validationStatus === 'referenced') {
    // Solution is referenced by another solution via cssdm__replaced_solution__c
    // This indicates a MACD relationship - cannot safely remediate
    return {
      isFixable: false,
      reasonCode: 'MACD_EXISTS',
      reasonDescription: 'Solution is referenced by another solution (MACD dependency). Cannot safely remediate.',
    };
  }
  
  // SECONDARY CHECKS: Legacy validation logic
  
  // Note: hasMacdBasket check removed — MACD eligibility is now determined at
  // remediation time using granular basketDetails from the solutionInfo API.
  // Solutions with old (≥60 days) baskets not in sensitive stages are eligible.
  // The real check happens in useBatchRemediation.ts → VALIDATE step.

  // Check for post-migration activity
  const hasPostMigrationActivity = characteristics.some(
    c => c.name === 'hasPostMigrationActivity' && c.value === true
  );
  if (hasPostMigrationActivity) {
    return {
      isFixable: false,
      reasonCode: 'POST_MIGRATION_ACTIVITY_DETECTED',
      reasonDescription: FIXABILITY_REASONS['POST_MIGRATION_ACTIVITY_DETECTED'],
    };
  }

  // Check for previous remediation failure
  const remediationStatus = characteristics.find(c => c.name === 'remediationStatus')?.value;
  if (remediationStatus === 'failed') {
    const failureReason = characteristics.find(c => c.name === 'failureReasonCode')?.value as string;
    if (failureReason && ['REMIGRATION_FAILED', 'DELETE_FAILED', 'MIGRATION_FAILED', 'POST_UPDATE_FAILED'].includes(failureReason)) {
      return {
        isFixable: false,
        reasonCode: failureReason as FixabilityReasonCode,
        reasonDescription: FIXABILITY_REASONS[failureReason as FixabilityReasonCode] || 'Previous remediation failed',
      };
    }
  }

  // validationStatus is "valid" or not present - eligible for remediation
  return {
    isFixable: true,
    reasonCode: 'ELIGIBLE',
    reasonDescription: validationStatus === 'valid' 
      ? 'Solution has no dependencies. Safe to remediate.'
      : FIXABILITY_REASONS['ELIGIBLE'],
  };
}

/**
 * Extract remediation status from product characteristics
 */
function getRemediationStatus(product: TMFProduct): SolutionEmptyIssue['remediation'] {
  // TMF API returns productCharacteristic (not characteristic)
  const characteristics = product.productCharacteristic || [];
  
  const lastAttempt = characteristics.find(c => c.name === 'lastRemediationAttempt')?.value as string | undefined;
  const outcome = characteristics.find(c => c.name === 'remediationStatus')?.value as string | undefined;
  const failureStage = characteristics.find(c => c.name === 'failureStage')?.value as string | undefined;
  const failureReason = characteristics.find(c => c.name === 'failureReason')?.value as string | undefined;
  const jobId = characteristics.find(c => c.name === 'remediationJobId')?.value as string | undefined;

  return {
    lastAttempt: lastAttempt || null,
    outcome: (outcome as RemediationOutcome) || 'not_attempted',
    failureStage: failureStage || null,
    failureReason: failureReason || null,
    jobId: jobId || null,
  };
}

/**
 * Fetch ServiceProblem records filtered by category=SolutionEmpty
 * API: /tmf-api/serviceProblemManagement/v5/serviceProblem
 * 
 * ServiceProblems are stored in the TMF runtime's native PostgreSQL table.
 * Uses same environment (sandbox/production) as other TMF APIs.
 */
async function fetchServiceProblems(): Promise<ServiceProblem[]> {
  const params = new URLSearchParams({
    limit: '50',
    category: 'SolutionEmpty',
  });

  // Use relative path - Vite proxy handles headers (X-API-Key, X-Environment)
  const url = `/tmf-api/serviceProblemManagement/v5/serviceProblem?${params.toString()}`;
  
  console.log('[SolutionEmpty] Fetching service problems from:', url);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error('Failed to fetch service problems:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    console.log('[SolutionEmpty] Fetched', Array.isArray(data) ? data.length : 0, 'service problems');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching service problems:', error);
    return [];
  }
}

/**
 * Calculate summary metrics from issues list
 * For pilot: simplified calculation based on available data
 */
function calculateSummary(issues: SolutionEmptyIssue[]): SolutionEmptySummary {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Count active issues
  const activeCount = issues.length;

  // Count detected within time windows
  const detected24h = issues.filter(i => new Date(i.detectedAt) >= h24).length;
  const detected7d = issues.filter(i => new Date(i.detectedAt) >= d7).length;
  const detected30d = issues.filter(i => new Date(i.detectedAt) >= d30).length;

  // For resolved, we'd need historical data - using estimates for now
  // In production, this would come from a dedicated metrics endpoint
  const resolutionRate = 0.85;
  const resolved24h = Math.floor(detected24h * resolutionRate * 0.9);
  const resolved7d = Math.floor(detected7d * resolutionRate);
  const resolved30d = Math.floor(detected30d * resolutionRate);

  return {
    activeCount,
    detected24h,
    detected7d,
    detected30d,
    resolved24h,
    resolved7d,
    resolved30d,
  };
}

/**
 * Fetch Solution Empty data for the drill-down screen
 * Uses TMF Product API with status filter for detection
 * Uses TMF ServiceProblem API for problem tracking
 */
export async function fetchSolutionEmptyData(): Promise<SolutionEmptyData> {
  try {
    // Fetch products and service problems in parallel
    const [products, serviceProblems] = await Promise.all([
      fetchFailedMigrationProducts(),
      fetchServiceProblems(),
    ]);
    
    // Transform products to SolutionEmptyIssue format
    const issues = products.map(transformProductToIssue);
    
    // Sort by detected timestamp (newest first)
    issues.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    
    // Calculate summary from issues
    const summary = calculateSummary(issues);
    
    return {
      summary,
      issues,
      serviceProblems,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching Solution Empty data:', error);
    
    // Return empty state on error
    return {
      summary: {
        activeCount: 0,
        detected24h: 0,
        detected7d: 0,
        detected30d: 0,
        resolved24h: 0,
        resolved7d: 0,
        resolved30d: 0,
      },
      issues: [],
      serviceProblems: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * API endpoint reference:
 * GET /tmf-api/productInventory/v5/product
 * Query params:
 *   - limit=50
 *   - status=Not+Migrated+Successfully
 *   - relatedParty.partyOrPartyRole.name=Migration+User
 * 
 * This returns products that:
 * 1. Have status "Not Migrated Successfully"
 * 2. Were created by Migration User
 * 
 * These are the candidates for 1147 Solution Empty remediation.
 */
