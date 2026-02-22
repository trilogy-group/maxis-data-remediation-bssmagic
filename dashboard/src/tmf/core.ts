import type {
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';

export type TmfQueryKey = QueryKey;

export function key(...parts: readonly unknown[]): readonly unknown[] {
  return ['tmf', ...parts] as const;
}

export function wrapQuery<TData>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<
    UseQueryOptions<TData, Error, TData, QueryKey>,
    'queryKey' | 'queryFn'
  >,
): UseQueryResult<TData, Error> {
  return useQuery<TData, Error, TData, QueryKey>({
    queryKey,
    queryFn,
    ...(options || {}),
  });
}

export function wrapMutation<TData, TVariables>(
  mutateFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<
    UseMutationOptions<TData, Error, TVariables, unknown>,
    'mutationFn'
  >,
): UseMutationResult<TData, Error, TVariables, unknown> {
  return useMutation<TData, Error, TVariables, unknown>({
    mutationFn: mutateFn,
    onSuccess: () => {
      // Caller should invalidate with a specific key where needed
    },
    ...(options || {}),
  });
}
