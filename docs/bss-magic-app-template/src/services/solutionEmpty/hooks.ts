// React Query hooks for Solution Empty data
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { fetchSolutionEmptyData } from './client';
import type { SolutionEmptyData } from '../../types/solution-empty';

// Query key
const SOLUTION_EMPTY_KEY = ['solutionEmpty'];

// Auto-refresh interval (30 seconds)
const REFRESH_INTERVAL = 30 * 1000;

/**
 * Hook to fetch Solution Empty drill-down data
 */
export function useSolutionEmptyData() {
  const query = useQuery<SolutionEmptyData>({
    queryKey: SOLUTION_EMPTY_KEY,
    queryFn: fetchSolutionEmptyData,
    refetchInterval: REFRESH_INTERVAL,
    staleTime: REFRESH_INTERVAL / 2,
  });

  return {
    data: query.data,
    summary: query.data?.summary,
    issues: query.data?.issues ?? [],
    serviceProblems: query.data?.serviceProblems ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    lastUpdated: query.data?.lastUpdated,
    refetch: query.refetch,
  };
}

/**
 * Hook to manually refresh data
 */
export function useRefreshSolutionEmptyData() {
  const queryClient = useQueryClient();
  
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SOLUTION_EMPTY_KEY });
  }, [queryClient]);
}
