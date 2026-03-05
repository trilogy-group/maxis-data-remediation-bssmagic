// React Query hooks for health metrics
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { fetchHealthDashboardData, resetPreviousMetrics } from './client';
import type { HealthDashboardData } from './types';

// Query key for health dashboard data
const HEALTH_DASHBOARD_KEY = ['healthDashboard'];

// Auto-refresh interval (15 minutes)
const REFRESH_INTERVAL = 15 * 60 * 1000;

/**
 * Hook to fetch health dashboard data with auto-refresh
 */
export function useHealthDashboard() {
  const query = useQuery<HealthDashboardData>({
    queryKey: HEALTH_DASHBOARD_KEY,
    queryFn: fetchHealthDashboardData,
    refetchInterval: REFRESH_INTERVAL,
    staleTime: REFRESH_INTERVAL / 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    lastUpdated: query.data?.lastUpdated,
    refetch: query.refetch,
  };
}

/**
 * Hook to manually refresh health data
 */
export function useRefreshHealthData() {
  const queryClient = useQueryClient();
  
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: HEALTH_DASHBOARD_KEY });
  }, [queryClient]);

  return refresh;
}

/**
 * Hook for countdown timer to next refresh
 */
export function useRefreshCountdown() {
  const queryClient = useQueryClient();
  
  // Get the last fetch time from query state
  const state = queryClient.getQueryState(HEALTH_DASHBOARD_KEY);
  const lastFetchTime = state?.dataUpdatedAt ?? Date.now();
  
  const getSecondsUntilRefresh = useCallback(() => {
    const elapsed = Date.now() - lastFetchTime;
    const remaining = Math.max(0, REFRESH_INTERVAL - elapsed);
    return Math.ceil(remaining / 1000);
  }, [lastFetchTime]);

  return { getSecondsUntilRefresh, refreshInterval: REFRESH_INTERVAL };
}

/**
 * Hook to reset metrics history (for testing/demo)
 */
export function useResetMetricsHistory() {
  const queryClient = useQueryClient();
  
  const reset = useCallback(() => {
    resetPreviousMetrics();
    queryClient.invalidateQueries({ queryKey: HEALTH_DASHBOARD_KEY });
  }, [queryClient]);

  return reset;
}
