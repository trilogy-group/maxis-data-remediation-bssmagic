/**
 * React Query hooks for CloudSense JS API Gateway
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  checkHealth, 
  getConfigurations, 
  updateOEAttributes,
  analyzeConfigurations,
  type ConfigurationsResponse,
  type OEAnalysis 
} from '@/lib/cloudsense-api';

// Health check hook
export function useCloudSenseHealth() {
  return useQuery({
    queryKey: ['cloudsense-health'],
    queryFn: checkHealth,
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1,
  });
}

// Get configurations hook
export function useConfigurations(basketId: string, solutionName: string, fallbackSolutionName?: string) {
  return useQuery({
    queryKey: ['cloudsense-configurations', basketId, solutionName, fallbackSolutionName],
    queryFn: async () => {
      try {
        return await getConfigurations(basketId, solutionName);
      } catch (e) {
        // Some Solution Console flows require the Solution *record name* (e.g. "Biz Fibre ..."),
        // while others work with the Solution *definition name* (e.g. "Fibre Solution").
        // If a fallback name is provided, retry once.
        if (fallbackSolutionName && fallbackSolutionName !== solutionName) {
          return await getConfigurations(basketId, fallbackSolutionName);
        }
        throw e;
      }
    },
    enabled: !!basketId && !!solutionName,
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });
}

// Analyzed configurations hook (with missing field detection)
export function useAnalyzedConfigurations(basketId: string, solutionName: string, fallbackSolutionName?: string) {
  const query = useConfigurations(basketId, solutionName, fallbackSolutionName);
  
  const analysis: OEAnalysis[] = query.data?.success 
    ? analyzeConfigurations(query.data) 
    : [];
  
  const totalMissing = analysis.reduce((sum, a) => sum + a.missingCount, 0);
  const hasIssues = totalMissing > 0;
  
  return {
    ...query,
    analysis,
    totalMissing,
    hasIssues,
  };
}

// Update OE attributes mutation
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
    
    onSuccess: (_data, variables) => {
      // Invalidate configurations cache to refetch fresh data
      queryClient.invalidateQueries({ 
        queryKey: ['cloudsense-configurations', variables.basketId] 
      });
    }
  });
}

// Preview patch - fetches attachment data to show what would be patched
export function usePatchPreview(serviceId: string | undefined) {
  return useQuery({
    queryKey: ['patch-preview', serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      
      // Proxy through Next.js API to reach 1147-gateway
      const response = await fetch(`/api/gateway-1147/1867/service/${serviceId}/attachment`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch attachment');
      }
      
      return response.json();
    },
    enabled: !!serviceId,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Patch 1867 OE data for a service (WITH attachment update)
// UI sends the patch data directly from service x_ fields
export function usePatchOEService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      serviceId,
      serviceType,
      fieldsToPatch,
      dryRun = false 
    }: { 
      serviceId: string;
      serviceType: string;
      fieldsToPatch: Array<{fieldName: string; value: string; label?: string}>;
      dryRun?: boolean 
    }) => {
      console.group('%c🔧 1867 Complete OE Patcher', 'color: #f59e0b; font-weight: bold; font-size: 14px');
      console.log('%cService ID:', 'color: #059669; font-weight: bold', serviceId);
      console.log('%cService Type:', 'color: #0891b2; font-weight: bold', serviceType);
      console.log('%cFields to Patch:', 'color: #7c3aed; font-weight: bold', fieldsToPatch);
      console.log('%cMethod:', 'color: #7c3aed; font-weight: bold', 'Enhanced Apex (updates CloudSense DB + Attachment)');
      console.groupEnd();
      
      // Send patch data from UI (no Salesforce fetch needed!)
      // Proxy through Next.js API to reach 1147-gateway
      // Use COMPLETE endpoint that updates BOTH CloudSense DB and attachment
      const response = await fetch('/api/gateway-1147/1867/patch-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          serviceId, 
          serviceType,
          fieldsToPatch,  // Send patch data from UI!
          dryRun 
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('%c❌ Patch Failed:', 'color: #dc2626; font-weight: bold', error);
        throw new Error(error.detail || 'Failed to patch OE');
      }
      
      const result = await response.json();
      
      console.group('%c📋 Patch Result', 'color: #059669; font-weight: bold; font-size: 14px');
      console.log('%cPatched Fields:', 'color: #059669; font-weight: bold', result.patchedFields?.length || 0);
      result.patchedFields?.forEach((field: any) => {
        console.log(`  ✅ ${field.fieldName}: ${field.newValue || field.value} (from ${field.source || 'UI'})`);
      });
      if (result.cloudsenseDBUpdated) {
        console.log('%c✅ CloudSense DB Updated:', 'color: #059669; font-weight: bold', 'Internal database (order processing)');
      }
      if (result.attachmentUpdated) {
        console.log('%c✅ Attachment Updated:', 'color: #059669; font-weight: bold', 'ProductAttributeDetails.json (backup created)');
      }
      if (result.remainingMissingFields?.length > 0) {
        console.log('%cStill Missing:', 'color: #f59e0b; font-weight: bold', result.remainingMissingFields);
      }
      console.groupEnd();
      
      // VERIFICATION: Double-check the CloudSense internal DB was updated
      if (!dryRun && result.success) {
        console.group('%c🔍 Verifying CloudSense OE Database...', 'color: #0891b2; font-weight: bold; font-size: 14px');
        
        try {
          // Build field names to verify (extract field names from patched fields)
          const fieldsToVerify = fieldsToPatch.map(f => f.fieldName).join(',');
          
          const verifyResponse = await fetch(
            `/api/gateway-1147/1867/service/${serviceId}/verify-oe?fields=${fieldsToVerify}`
          );
          
          if (verifyResponse.ok) {
            const verifyResult = await verifyResponse.json();
            
            console.log('%cOE Data Found:', 'color: #059669; font-weight: bold', verifyResult.oeDataFound ? 'Yes' : 'No');
            console.log('%cComponents:', 'color: #0891b2', verifyResult.componentsCount);
            console.log('%cAttributes:', 'color: #0891b2', verifyResult.attributesCount);
            
            // Check each verified field
            if (verifyResult.fields) {
              console.log('%cVerified Fields:', 'color: #7c3aed; font-weight: bold');
              Object.entries(verifyResult.fields).forEach(([fieldName, fieldData]: [string, any]) => {
                const status = fieldData.found ? '✅' : '❌';
                console.log(`  ${status} ${fieldName}: ${fieldData.value || 'NOT FOUND'} (display: ${fieldData.displayValue || 'N/A'})`);
              });
            }
            
            if (verifyResult.allFieldsPresent) {
              console.log('%c✅ VERIFICATION PASSED: All fields confirmed in CloudSense DB!', 'color: #059669; font-weight: bold; font-size: 12px');
            } else {
              console.warn('%c⚠️ VERIFICATION WARNING: Some fields may not be present in CloudSense DB', 'color: #f59e0b; font-weight: bold');
            }
            
            // Add verification result to the return value
            result.verification = verifyResult;
          } else {
            console.warn('%c⚠️ Verification request failed:', 'color: #f59e0b', await verifyResponse.text());
          }
        } catch (verifyError) {
          console.warn('%c⚠️ Verification skipped due to error:', 'color: #f59e0b', verifyError);
        }
        
        console.groupEnd();
      }
      
      return result;
    },
    
    onSuccess: () => {
      // Invalidate service queries to refresh
      queryClient.invalidateQueries({ 
        queryKey: ['TMF638', 'service'] 
      });
      // Invalidate patch preview
      queryClient.invalidateQueries({
        queryKey: ['patch-preview']
      });
    }
  });
}

// Fix failed migration solution mutation using TMF656 ServiceProblem API
export function useFixSolution() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ solutionId, solutionName }: { solutionId: string; solutionName?: string }) => {
      // Build request payload
      const requestPayload = {
        '@type': 'ServiceProblem',
        category: 'SolutionEmpty',
        description: `Solution ${solutionName || solutionId} data needs re-synchronization with SM Service`,
        priority: 1,  // Integer required by TMF schema
        status: 'pending',  // Valid ServiceProblemStateType enum value
        affectedResource: [{
          id: solutionId,
          name: solutionName || solutionId,
          '@referredType': 'Product',
          '@type': 'ResourceRef',
        }],
        extensionInfo: [{
          name: 'remediationAction',
          value: 'resync',
        }],
      };

      // Log TMF API call
      console.group('%c🔧 TMF656 ServiceProblem API - Fix Solution', 'color: #6366f1; font-weight: bold; font-size: 14px');
      console.log('%cEndpoint:', 'color: #059669; font-weight: bold', 'POST /tmf-api/serviceProblemManagement/v5/serviceProblem');
      console.log('%cRequest Payload:', 'color: #0891b2; font-weight: bold');
      console.log(JSON.stringify(requestPayload, null, 2));
      console.log('%cSolution ID:', 'color: #dc2626; font-weight: bold', solutionId);
      console.log('%cSolution Name:', 'color: #dc2626; font-weight: bold', solutionName || 'N/A');
      console.groupEnd();

      // Create a TMF656 ServiceProblem that triggers remediation.
      // The endpoint creates the ServiceProblem, calls 1147-gateway, and returns the final state.
      const createRes = await fetch('/tmf-api/serviceProblemManagement/v5/serviceProblem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });
      
      if (!createRes.ok) {
        const error = await createRes.json();
        console.error('%c❌ TMF656 API Error:', 'color: #dc2626; font-weight: bold', error);
        throw new Error(error.message || 'Failed to create ServiceProblem');
      }
      
      const serviceProblem = await createRes.json();
      
      // Log response
      console.group('%c📋 TMF656 ServiceProblem Response', 'color: #6366f1; font-weight: bold; font-size: 14px');
      console.log('%cServiceProblem ID:', 'color: #059669; font-weight: bold', serviceProblem.id);
      console.log('%cStatus:', 'color: #0891b2; font-weight: bold', serviceProblem.status);
      console.log('%cCategory:', 'color: #0891b2; font-weight: bold', serviceProblem.category);
      console.log('%cTracking Records:', 'color: #7c3aed; font-weight: bold');
      serviceProblem.trackingRecord?.forEach((record: { description: string; time: string; user: string }, i: number) => {
        console.log(`  ${i + 1}. [${record.time}] ${record.description} (${record.user})`);
      });
      if (serviceProblem.extensionInfo) {
        console.log('%cExtension Info:', 'color: #ea580c; font-weight: bold');
        serviceProblem.extensionInfo.forEach((ext: { name: string; value: string }) => {
          console.log(`  - ${ext.name}: ${ext.value}`);
        });
      }
      console.log('%cFull Response:', 'color: #64748b; font-weight: bold');
      console.log(serviceProblem);
      console.groupEnd();
      
      // Check if remediation failed
      if (serviceProblem?.status === 'rejected') {
        const errorMsg = serviceProblem.errorMessage?.[0]?.message 
          || serviceProblem.trackingRecord?.slice(-1)[0]?.description 
          || 'Remediation failed';
        console.error('%c❌ Remediation Failed:', 'color: #dc2626; font-weight: bold', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('%c✅ Remediation Completed Successfully!', 'color: #059669; font-weight: bold; font-size: 14px');
      return serviceProblem;
    },
    
    onSuccess: () => {
      // Invalidate product and serviceProblem queries to refresh the lists
      queryClient.invalidateQueries({ 
        queryKey: ['TMF637', 'product'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['serviceProblem'] 
      });
    }
  });
}
