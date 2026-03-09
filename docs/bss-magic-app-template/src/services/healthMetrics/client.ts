import type {
  HealthDashboardData,
  CategoryHealthMetrics,
  HealthCategory,
  PreviousMetrics,
} from './types';
import { CATEGORY_CONFIGS, calculateTrend, shouldShowAlert } from '../../types/health-metrics';
import { isHealthCategoryEnabled } from '../../stores/featureFlags';

const PREVIOUS_METRICS_KEY = 'bss-magic-health-previous-metrics';

const HEALTH_TO_TMF_CATEGORY: Record<HealthCategory, string[]> = {
  'order-not-generated': ['OrderNotGenerated', 'FailedMigration'],
  'partial-data-missing': ['PartialDataMissing'],
  'solution-empty': ['SolutionEmpty'],
  'iot-qbs-issues': ['IoTQBS', 'IoT-QBS'],
};

function matchesCategory(problemCategory: string | undefined, healthCategory: HealthCategory): boolean {
  if (!problemCategory) return false;
  const tmfCategories = HEALTH_TO_TMF_CATEGORY[healthCategory] || [];
  return tmfCategories.some(tc => tc.toLowerCase() === problemCategory.toLowerCase());
}

interface TMFServiceProblem {
  id?: string;
  status: string;
  category?: string;
  creationDate?: string;
  resolutionDate?: string;
  lastUpdate?: string;
  statusChangeDate?: string;
  [key: string]: unknown;
}

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

function calculateOverallStatus(metrics: CategoryHealthMetrics[]): 'healthy' | 'warning' | 'critical' {
  const alertCount = metrics.filter(m => m.hasAlert).length;
  const highActiveCount = metrics.some(m => m.activeCount > 50);

  if (alertCount >= 3 || highActiveCount) return 'critical';
  if (alertCount >= 1) return 'warning';
  return 'healthy';
}

function buildMetricsFromProblems(
  problems: TMFServiceProblem[],
  enabledConfigs: typeof CATEGORY_CONFIGS,
): CategoryHealthMetrics[] {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const previousMetrics = loadPreviousMetrics();

  return enabledConfigs.map(config => {
    const categoryProblems = problems.filter(p => matchesCategory(p.category, config.id));

    const activeCount = categoryProblems.filter(
      p => p.status === 'pending' || p.status === 'inProgress',
    ).length;

    const resolvedProblems = categoryProblems.filter(p => p.status === 'resolved');

    const detected24h = categoryProblems.filter(
      p => p.creationDate && now - new Date(p.creationDate).getTime() < DAY,
    ).length;
    const detected7d = categoryProblems.filter(
      p => p.creationDate && now - new Date(p.creationDate).getTime() < 7 * DAY,
    ).length;
    const detected30d = categoryProblems.filter(
      p => p.creationDate && now - new Date(p.creationDate).getTime() < 30 * DAY,
    ).length;

    const getResolutionTime = (p: TMFServiceProblem) =>
      p.resolutionDate || p.statusChangeDate || p.lastUpdate || '';

    const resolved24h = resolvedProblems.filter(p => {
      const t = getResolutionTime(p);
      return t && now - new Date(t).getTime() < DAY;
    }).length;
    const resolved7d = resolvedProblems.filter(p => {
      const t = getResolutionTime(p);
      return t && now - new Date(t).getTime() < 7 * DAY;
    }).length;
    const resolved30d = resolvedProblems.filter(p => {
      const t = getResolutionTime(p);
      return t && now - new Date(t).getTime() < 30 * DAY;
    }).length;

    const prev = previousMetrics.find(pm => pm.categoryId === config.id);
    const prevActive = prev?.activeCount ?? activeCount;
    const prevDetected24h = prev?.detected24h ?? detected24h;

    const activeTrend = calculateTrend(activeCount, prevActive);
    const detected24hTrend = calculateTrend(detected24h, prevDetected24h);
    const hasAlert = shouldShowAlert(activeCount, prevActive, detected24h, prevDetected24h);

    return {
      categoryId: config.id,
      activeCount,
      detected: { last24h: detected24h, last7d: detected7d, last30d: detected30d },
      resolved: { last24h: resolved24h, last7d: resolved7d, last30d: resolved30d },
      activeTrend,
      detected24hTrend,
      hasAlert,
    };
  });
}

export async function fetchHealthDashboardData(): Promise<HealthDashboardData> {
  const enabledConfigs = CATEGORY_CONFIGS.filter(c => isHealthCategoryEnabled(c.id));
  const API_KEY = import.meta.env.VITE_BSSMAGIC_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (import.meta.env.PROD) headers['X-API-Key'] = API_KEY;

    const response = await fetch('/tmf-api/serviceProblemManagement/v5/serviceProblem?limit=1000', {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Health metrics API error: ${response.status}`);
    }

    const problems: TMFServiceProblem[] = await response.json();
    const categories = buildMetricsFromProblems(problems, enabledConfigs);
    savePreviousMetrics(categories);

    return {
      categories,
      lastUpdated: new Date().toISOString(),
      overallStatus: calculateOverallStatus(categories),
    };
  } catch (error) {
    console.warn('Failed to fetch live health data, using fallback:', error);
    return generateFallbackData(enabledConfigs);
  }
}

function generateFallbackData(enabledConfigs: typeof CATEGORY_CONFIGS): HealthDashboardData {
  const previousMetrics = loadPreviousMetrics();

  const categories: CategoryHealthMetrics[] = enabledConfigs.map(config => {
    const prev = previousMetrics.find(p => p.categoryId === config.id);

    return {
      categoryId: config.id,
      activeCount: prev?.activeCount ?? 0,
      detected: { last24h: prev?.detected24h ?? 0, last7d: 0, last30d: 0 },
      resolved: { last24h: 0, last7d: 0, last30d: 0 },
      activeTrend: 'stable' as const,
      detected24hTrend: 'stable' as const,
      hasAlert: false,
    };
  });

  return {
    categories,
    lastUpdated: new Date().toISOString(),
    overallStatus: 'healthy',
  };
}

export function resetPreviousMetrics(): void {
  localStorage.removeItem(PREVIOUS_METRICS_KEY);
}
