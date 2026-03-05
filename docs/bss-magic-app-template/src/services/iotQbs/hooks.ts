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
  remediateIoTQBSOrchestration,
  remediateIoTQBSBatch,
} from './client';
import type {
  IoTQBSDetectResponse,
  IoTQBSSingleRemediateResponse,
  IoTQBSBatchRemediateResponse,
} from '../../types/iot-qbs';

export const iotQbsKeys = {
  all: ['iot-qbs'] as const,
  detect: () => [...iotQbsKeys.all, 'detect'] as const,
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
