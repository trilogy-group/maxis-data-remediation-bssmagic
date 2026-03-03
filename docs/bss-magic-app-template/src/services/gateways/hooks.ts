// React Query Hooks for Gateway APIs
import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import type { ConfigurationsResponse, PatchCompleteRequest, PatchCompleteResponse } from '../../types/tmf-api';
import * as CloudSenseGateway from './cloudsense-gateway';
import * as Gateway1147 from './gateway-1147';
import {
  remediateOEService,
  remediateOEBatch,
  discoverOEServices,
  batchCheckOEServices,
  fetchCheckProgress,
  fetchOEServiceProblems,
  fetchOERulesConfig,
  saveOERulesConfig,
  fetchAvailableFields,
  type OERemediateResponse,
  type OEBatchResponse,
  type OEDiscoverResponse,
  type OEBatchCheckResponse,
  type OECheckProgress,
  type OEServiceProblem,
  type OERulesConfig,
  type AvailableFields,
} from '../salesforce/client';

// Query key factories
export const gatewayKeys = {
  cloudsense: {
    all: ['cloudsense-gateway'] as const,
    health: () => [...gatewayKeys.cloudsense.all, 'health'] as const,
    configurations: (basketId: string, solutionName: string) => 
      [...gatewayKeys.cloudsense.all, 'configurations', basketId, solutionName] as const,
    verifyOE: (basketId: string, solutionName: string) => 
      [...gatewayKeys.cloudsense.all, 'verify-oe', basketId, solutionName] as const,
  },
  gateway1147: {
    all: ['gateway-1147'] as const,
    health: () => [...gatewayKeys.gateway1147.all, 'health'] as const,
    attachment: (serviceId: string) => 
      [...gatewayKeys.gateway1147.all, 'attachment', serviceId] as const,
    verifyOE: (serviceId: string, fields: string[]) => 
      [...gatewayKeys.gateway1147.all, 'verify-oe', serviceId, fields] as const,
  },
};

// CloudSense Gateway Hooks
export function useCloudSenseHealth(): UseQueryResult<{ status: string; timestamp: string }, Error> {
  return useQuery({
    queryKey: gatewayKeys.cloudsense.health(),
    queryFn: CloudSenseGateway.checkHealth,
    staleTime: 30000,
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useConfigurations(
  basketId: string,
  solutionName: string,
  enabled = true
): UseQueryResult<ConfigurationsResponse, Error> {
  return useQuery({
    queryKey: gatewayKeys.cloudsense.configurations(basketId, solutionName),
    queryFn: () => CloudSenseGateway.getConfigurations(basketId, solutionName),
    enabled: enabled && !!basketId && !!solutionName,
    staleTime: 60000, // 1 minute
    retry: 1, // Only retry once (these calls are slow)
  });
}

export function useVerifyCloudSenseOE(
  basketId: string,
  solutionName: string,
  enabled = true
): UseQueryResult<{
  oeDataFound: boolean;
  componentsCount: number;
  attributesCount: number;
  attributes: Array<{ name: string; value: string; displayValue?: string }>;
}, Error> {
  return useQuery({
    queryKey: gatewayKeys.cloudsense.verifyOE(basketId, solutionName),
    queryFn: () => CloudSenseGateway.verifyOE(basketId, solutionName),
    enabled: enabled && !!basketId && !!solutionName,
    staleTime: 60000,
    retry: 1,
  });
}

export function useUpdateOEAttributes(): UseMutationResult<
  { success: boolean; message: string },
  Error,
  {
    basketId: string;
    configGuid?: string;
    oeGuid?: string;
    attributes: Array<{ name: string; value: string; displayValue?: string }>;
  }
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: CloudSenseGateway.updateOEAttributes,
    onSuccess: (_, variables) => {
      // Invalidate configurations cache
      queryClient.invalidateQueries({ 
        queryKey: gatewayKeys.cloudsense.all 
      });
    },
  });
}

// 1147 Gateway Hooks
export function useGateway1147Health(): UseQueryResult<{ 
  status: string; 
  service: string; 
  version: string;
}, Error> {
  return useQuery({
    queryKey: gatewayKeys.gateway1147.health(),
    queryFn: Gateway1147.checkHealth,
    staleTime: 30000,
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useServiceAttachment(
  serviceId: string,
  enabled = true
): UseQueryResult<{
  attachmentId: string;
  fileName: string;
  attachmentData: {
    ProductAttributes: unknown[];
    ServiceAttributes: unknown[];
  };
}, Error> {
  return useQuery({
    queryKey: gatewayKeys.gateway1147.attachment(serviceId),
    queryFn: () => Gateway1147.getServiceAttachment(serviceId),
    enabled: enabled && !!serviceId,
    staleTime: 60000,
  });
}

export function usePatchComplete(): UseMutationResult<
  PatchCompleteResponse,
  Error,
  PatchCompleteRequest
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: Gateway1147.patchComplete,
    onSuccess: (data, variables) => {
      // Invalidate related caches
      queryClient.invalidateQueries({ 
        queryKey: gatewayKeys.gateway1147.all 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tmf', 'services'] 
      });
    },
  });
}

export function useVerify1147OE(
  serviceId: string,
  fields: string[],
  enabled = true
): UseQueryResult<{
  oeDataFound: boolean;
  componentsCount: number;
  attributesCount: number;
  fields: Record<string, {
    found: boolean;
    value: string;
    displayValue?: string;
  }>;
  allFieldsPresent: boolean;
}, Error> {
  return useQuery({
    queryKey: gatewayKeys.gateway1147.verifyOE(serviceId, fields),
    queryFn: () => Gateway1147.verifyOE(serviceId, fields),
    enabled: enabled && !!serviceId && fields.length > 0,
    staleTime: 60000,
  });
}

export function usePatchAttachment(): UseMutationResult<
  { success: boolean; attachmentUpdated: boolean; backupAttachmentId?: string },
  Error,
  {
    serviceId: string;
    fieldsToPatch: Array<{ fieldName: string; value: string; label: string }>;
    dryRun?: boolean;
  }
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ serviceId, ...request }) => 
      Gateway1147.patchAttachment(serviceId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: gatewayKeys.gateway1147.all 
      });
    },
  });
}

// =============================================================================
// OE Remediation Hooks (Module 1867 - Batch Orchestrator)
// =============================================================================

export const oeKeys = {
  all: ['oe-remediation'] as const,
  batch: () => [...oeKeys.all, 'batch'] as const,
  discover: () => [...oeKeys.all, 'discover'] as const,
  single: (serviceId: string) => [...oeKeys.all, 'single', serviceId] as const,
  problems: () => [...oeKeys.all, 'problems'] as const,
};

export function useOEServiceProblems(fastPoll = false): UseQueryResult<OEServiceProblem[], Error> {
  return useQuery({
    queryKey: oeKeys.problems(),
    queryFn: fetchOEServiceProblems,
    staleTime: fastPoll ? 3000 : 30000,
    refetchInterval: fastPoll ? 5000 : 30000,
  });
}

export function useOECheckProgress(
  serviceType: string,
  enabled: boolean,
): UseQueryResult<OECheckProgress, Error> {
  return useQuery({
    queryKey: [...oeKeys.all, 'check-progress', serviceType] as const,
    queryFn: () => fetchCheckProgress(serviceType),
    enabled,
    refetchInterval: enabled ? 2000 : false,
    staleTime: 1000,
  });
}

export function useOERemediateSingle(): UseMutationResult<
  OERemediateResponse,
  Error,
  { serviceId: string; dry_run?: boolean; service_problem_id?: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serviceId, ...opts }) => remediateOEService(serviceId, opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tmf', 'services'] });
      queryClient.invalidateQueries({ queryKey: oeKeys.all });
    },
  });
}

export function useOERemediateBatch(): UseMutationResult<
  OEBatchResponse,
  Error,
  { max_count?: number; dry_run?: boolean; job_name?: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts) => remediateOEBatch(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tmf', 'services'] });
      queryClient.invalidateQueries({ queryKey: oeKeys.all });
    },
  });
}

export function useOEDiscover(): UseMutationResult<
  OEDiscoverResponse,
  Error,
  { max_count?: number }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts) => discoverOEServices(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oeKeys.all });
    },
  });
}

export function useOEBatchCheck(): UseMutationResult<
  OEBatchCheckResponse,
  Error,
  { service_type?: string; max_count?: number; dry_run?: boolean }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts) => batchCheckOEServices(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oeKeys.all });
      queryClient.invalidateQueries({ queryKey: oeKeys.problems() });
      queryClient.invalidateQueries({ queryKey: ['tmf', 'services'] });
    },
  });
}

// ============================================================
// OE Rules Configuration Hooks
// ============================================================

export function useOERulesConfig(): UseQueryResult<OERulesConfig, Error> {
  return useQuery({
    queryKey: [...oeKeys.all, 'rules-config'] as const,
    queryFn: fetchOERulesConfig,
    staleTime: 60000,
  });
}

export function useSaveOERulesConfig(): UseMutationResult<
  { status: string; service_types: number; total_fields: number },
  Error,
  OERulesConfig
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config) => saveOERulesConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...oeKeys.all, 'rules-config'] });
    },
  });
}

export function useAvailableFields(): UseQueryResult<AvailableFields, Error> {
  return useQuery({
    queryKey: [...oeKeys.all, 'available-fields'] as const,
    queryFn: fetchAvailableFields,
    staleTime: 120000,
  });
}
