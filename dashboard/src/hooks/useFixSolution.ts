/**
 * useFixSolution Hook
 *
 * Delegates the 5-step remediation to the Batch Orchestrator's unified API:
 *   POST /api/orchestrator/remediate/{solutionId}
 *
 * The frontend only manages the TMF656 ServiceProblem lifecycle (create/update).
 * All remediation logic (VALIDATE → DELETE → MIGRATE → POLL → POST_UPDATE)
 * is executed server-side by the RemediationEngine.
 *
 * Architecture:
 *   Frontend → CloudFront → ALB:8082 → Batch Orchestrator → RemediationEngine
 *           → TMFClient → ALB:8000 → TMF Runtime → REST FDW → Salesforce Apex REST
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { remediateSolution } from '@/services/salesforce/client';
import type { UnifiedRemediateResponse } from '@/services/salesforce/types';

// Configuration
const API_KEY = process.env.NEXT_PUBLIC_BSSMAGIC_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';

// TMF API base path for ServiceProblem management
const TMF_API_PATH = '/tmf-api/serviceProblemManagement/v5/serviceProblem';

// Generate a unique ID for ServiceProblem
function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `sp-${timestamp}-${random}`;
}

interface FixSolutionParams {
  solutionId: string;
  solutionName?: string;
}

interface ServiceProblemResult {
  id: string;
  status: 'pending' | 'inProgress' | 'resolved' | 'rejected';
  category: string;
  description: string;
  remediationResponse?: UnifiedRemediateResponse;
  errorMessage?: Array<{ code: string; message: string; timestamp: string }>;
}

export function useFixSolution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ solutionId, solutionName }: FixSolutionParams): Promise<ServiceProblemResult> => {
      const now = new Date().toISOString();
      const spId = generateId();
      const displayName = solutionName || solutionId;
      const isProduction = process.env.NODE_ENV === 'production';
      const description = `Solution ${displayName} data needs re-synchronization with SM Service`;

      // Headers for TMF ServiceProblem API calls
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isProduction) {
        headers['X-API-Key'] = API_KEY;
      }

      console.group('%c Fix Solution (Unified API)', 'color: #6366f1; font-weight: bold; font-size: 14px');
      console.log('%cSolution ID:', 'color: #dc2626; font-weight: bold', solutionId);
      console.log('%cSolution Name:', 'color: #dc2626; font-weight: bold', displayName);
      console.log('%cServiceProblem ID:', 'color: #059669; font-weight: bold', spId);
      console.log('%cFlow:', 'color: #7c3aed; font-weight: bold',
        'Create SP → POST /remediate/{id} → Update SP');
      console.groupEnd();

      // ====== 1. Create ServiceProblem ======
      let serviceProblemCreated = false;
      try {
        const createResponse = await fetch(TMF_API_PATH, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            '@type': 'ServiceProblem',
            '@baseType': 'Entity',
            id: spId,
            name: `SolutionEmpty - ${displayName}`,
            description,
            category: 'SolutionEmpty',
            status: 'pending',
            priority: 1,
            reason: 'SolutionEmpty issue detected',
            statusChangeReason: 'Issue detected - remediation pending',
            creationDate: now,
            lastUpdate: now,
            originatingSystem: 'BSS Magic Dashboard',
            affectedResource: [{
              '@type': 'ResourceRef',
              '@referredType': 'Product',
              id: solutionId,
              name: displayName,
            }],
            externalIdentifier: [{
              id: solutionId,
              externalIdentifierType: 'SolutionId',
              owner: 'CloudSense',
              '@type': 'ExternalIdentifier',
            }],
            characteristic: [
              { name: 'solutionName', value: displayName, '@type': 'StringCharacteristic' },
              { name: 'solutionId', value: solutionId, '@type': 'StringCharacteristic' },
            ],
          }),
        });
        serviceProblemCreated = createResponse.ok;
        console.log(
          serviceProblemCreated
            ? '%c ServiceProblem created'
            : '%c ServiceProblem creation failed',
          serviceProblemCreated ? 'color: #059669; font-weight: bold' : 'color: #f59e0b; font-weight: bold',
          spId,
        );
      } catch (error) {
        console.warn('ServiceProblem creation error:', error);
      }

      // ====== 2. Transition to inProgress ======
      if (serviceProblemCreated) {
        try {
          await fetch(`${TMF_API_PATH}/${spId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: 'inProgress',
              statusChangeReason: 'Remediation in progress',
              statusChangeDate: new Date().toISOString(),
              lastUpdate: new Date().toISOString(),
            }),
          });
        } catch (e) {
          console.warn('Failed to update SP to inProgress:', e);
        }
      }

      // ====== 3. Call Unified Remediation API ======
      console.log('%c Calling unified remediation endpoint...', 'color: #6366f1; font-weight: bold');

      const response = await remediateSolution(solutionId, {
        service_problem_id: serviceProblemCreated ? spId : undefined,
      });

      console.group('%c Remediation Result', 'color: #6366f1; font-weight: bold');
      console.log('%cSuccess:', response.success ? 'color: #059669; font-weight: bold' : 'color: #dc2626; font-weight: bold', response.success);
      console.log('%cDuration:', 'color: #7c3aed; font-weight: bold', `${response.total_duration_ms}ms`);
      console.log('%cSteps:', 'color: #7c3aed; font-weight: bold', response.steps);
      if (response.failed_at) {
        console.log('%cFailed at:', 'color: #dc2626; font-weight: bold', response.failed_at);
      }
      console.log('%cMessage:', 'color: #0891b2; font-weight: bold', response.message);
      console.groupEnd();

      // ====== 4. Update ServiceProblem with result ======
      if (serviceProblemCreated && !response.service_problem_updated) {
        const finalStatus = response.success ? 'resolved' : 'rejected';
        try {
          await fetch(`${TMF_API_PATH}/${spId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: finalStatus,
              statusChangeReason: response.message,
              ...(response.success ? { resolutionDate: new Date().toISOString() } : {}),
              lastUpdate: new Date().toISOString(),
              characteristic: [
                { name: 'remediationState', value: response.success ? 'COMPLETED' : 'FAILED', '@type': 'StringCharacteristic' },
                { name: 'totalDurationMs', value: String(response.total_duration_ms), '@type': 'StringCharacteristic' },
              ],
            }),
          });
          console.log(`%c ServiceProblem updated to ${finalStatus}`, 'color: #059669; font-weight: bold');
        } catch (e) {
          console.warn('Failed to update SP status:', e);
        }
      }

      // ====== 5. Return result ======
      if (!response.success) {
        const errorMsg = response.failed_at
          ? `Remediation failed at ${response.failed_at}: ${response.message}`
          : `Remediation failed: ${response.message}`;

        throw new Error(errorMsg);
      }

      return {
        id: spId,
        status: 'resolved' as const,
        category: 'SolutionEmpty',
        description,
        remediationResponse: response,
      };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solutionEmpty'] });
      queryClient.invalidateQueries({ queryKey: ['serviceProblem'] });
    },
  });
}
