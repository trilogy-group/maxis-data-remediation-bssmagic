// Health Metrics API Client
// For pilot: Uses mock data with realistic patterns
// Future: Connect to TMF656 ServiceProblem API aggregations

import type {
  HealthDashboardData,
  CategoryHealthMetrics,
  HealthCategory,
  PreviousMetrics,
  TrendDirection,
} from './types';
import { CATEGORY_CONFIGS, calculateTrend, shouldShowAlert } from '../../types/health-metrics';

// Storage key for previous metrics (used for trend comparison)
const PREVIOUS_METRICS_KEY = 'bss-magic-health-previous-metrics';

/**
 * Generate realistic mock data for development
 * Simulates varying issue counts with some randomness
 */
function generateMockMetrics(): CategoryHealthMetrics[] {
  const baseMetrics: Record<HealthCategory, { active: number; rate: number }> = {
    'order-not-generated': { active: 12, rate: 0.15 },
    'partial-data-missing': { active: 156, rate: 0.08 },
    'solution-empty': { active: 8, rate: 0.12 },
    'iot-qbs-issues': { active: 3, rate: 0.05 },
  };

  // Load previous metrics for trend comparison
  const previousMetrics = loadPreviousMetrics();

  const metrics: CategoryHealthMetrics[] = CATEGORY_CONFIGS.map(config => {
    const base = baseMetrics[config.id];
    
    // Add some randomness to simulate real data changes
    const variance = () => Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    
    const activeCount = Math.max(0, base.active + variance());
    const detected24h = Math.max(0, Math.floor(base.active * base.rate * 24) + variance());
    const detected7d = Math.floor(detected24h * 6.5);
    const detected30d = Math.floor(detected7d * 4.2);
    
    // Resolution rate is typically 70-90% of detection rate
    const resolutionRate = 0.7 + Math.random() * 0.2;
    const resolved24h = Math.floor(detected24h * resolutionRate);
    const resolved7d = Math.floor(detected7d * resolutionRate);
    const resolved30d = Math.floor(detected30d * resolutionRate);

    // Get previous values for this category
    const prev = previousMetrics.find(p => p.categoryId === config.id);
    const prevActive = prev?.activeCount ?? activeCount;
    const prevDetected24h = prev?.detected24h ?? detected24h;

    // Calculate trends
    const activeTrend = calculateTrend(activeCount, prevActive);
    const detected24hTrend = calculateTrend(detected24h, prevDetected24h);
    const hasAlert = shouldShowAlert(activeCount, prevActive, detected24h, prevDetected24h);

    return {
      categoryId: config.id,
      activeCount,
      detected: {
        last24h: detected24h,
        last7d: detected7d,
        last30d: detected30d,
      },
      resolved: {
        last24h: resolved24h,
        last7d: resolved7d,
        last30d: resolved30d,
      },
      activeTrend,
      detected24hTrend,
      hasAlert,
    };
  });

  // Save current metrics as previous for next comparison
  savePreviousMetrics(metrics);

  return metrics;
}

/**
 * Load previous metrics from localStorage
 */
function loadPreviousMetrics(): PreviousMetrics[] {
  try {
    const stored = localStorage.getItem(PREVIOUS_METRICS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load previous metrics:', e);
  }
  return [];
}

/**
 * Save current metrics as previous for next comparison
 */
function savePreviousMetrics(metrics: CategoryHealthMetrics[]): void {
  try {
    const previous: PreviousMetrics[] = metrics.map(m => ({
      categoryId: m.categoryId,
      activeCount: m.activeCount,
      detected24h: m.detected.last24h,
      timestamp: new Date().toISOString(),
    }));
    localStorage.setItem(PREVIOUS_METRICS_KEY, JSON.stringify(previous));
  } catch (e) {
    console.warn('Failed to save previous metrics:', e);
  }
}

/**
 * Determine overall system status based on metrics
 */
function calculateOverallStatus(metrics: CategoryHealthMetrics[]): 'healthy' | 'warning' | 'critical' {
  const alertCount = metrics.filter(m => m.hasAlert).length;
  const highActiveCount = metrics.some(m => m.activeCount > 50);
  
  if (alertCount >= 3 || highActiveCount) return 'critical';
  if (alertCount >= 1) return 'warning';
  return 'healthy';
}

/**
 * Fetch health dashboard data
 * For pilot: Returns mock data
 * Future: Call TMF656 API with aggregation
 */
export async function fetchHealthDashboardData(): Promise<HealthDashboardData> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const categories = generateMockMetrics();
  
  return {
    categories,
    lastUpdated: new Date().toISOString(),
    overallStatus: calculateOverallStatus(categories),
  };
}

/**
 * Reset previous metrics (useful for testing)
 */
export function resetPreviousMetrics(): void {
  localStorage.removeItem(PREVIOUS_METRICS_KEY);
}

// Future API implementation placeholder
// When ready to connect to real API:
/*
export async function fetchHealthDashboardDataFromAPI(): Promise<HealthDashboardData> {
  const response = await fetch(
    `${TMF_BASE_URL}/tmf-api/serviceProblemManagement/v5/healthMetrics`,
    {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Health metrics API error: ${response.status}`);
  }
  
  return response.json();
}
*/
