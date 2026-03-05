/**
 * IoT QBS TanStack Query Hooks
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  detectIoTQBSOrchestrations,
  validateIoTQBSOrchestration,
  remediateIoTQBSOrchestration,
  remediateIoTQBSBatch,
} from './client';
import type {
  IoTQBSDetectResponse,
  IoTQBSValidateResponse,
  IoTQBSSingleRemediateResponse,
  IoTQBSBatchRemediateResponse,
} from '../../types/iot-qbs';

export const iotQbsKeys = {
  all: ['iot-qbs'] as const,
  detect: () => [...iotQbsKeys.all, 'detect'] as const,
  validate: (id: string) => [...iotQbsKeys.all, 'validate', id] as const,
  remediate: (id: string) => [...iotQbsKeys.all, 'remediate', id] as const,
};

export function useIoTQBSDetect(): UseMutationResult<
  IoTQBSDetectResponse,
  Error,
  { max_count?: number }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opts) => detectIoTQBSOrchestrations(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: iotQbsKeys.all });
    },
  });
}

export function useIoTQBSValidate(): UseMutationResult<
  IoTQBSValidateResponse,
  Error,
  { orchestrationProcessId: string }
> {
  return useMutation({
    mutationFn: ({ orchestrationProcessId }) =>
      validateIoTQBSOrchestration(orchestrationProcessId),
  });
}

export function useIoTQBSRemediateSingle(): UseMutationResult<
  IoTQBSSingleRemediateResponse,
  Error,
  { orchestrationProcessId: string; dry_run?: boolean }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orchestrationProcessId, dry_run }) =>
      remediateIoTQBSOrchestration(orchestrationProcessId, { dry_run }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: iotQbsKeys.all });
    },
  });
}

export function useIoTQBSRemediateBatch(): UseMutationResult<
  IoTQBSBatchRemediateResponse,
  Error,
  { orchestration_ids?: string[]; max_count?: number; dry_run?: boolean }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opts) => remediateIoTQBSBatch(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: iotQbsKeys.all });
    },
  });
}
