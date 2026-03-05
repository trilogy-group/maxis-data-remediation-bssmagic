// Health Metrics Types for Data Integrity Dashboard
// User Story 1: Data Integrity Health Trends Dashboard (Pilot)

/**
 * The four fixed categories for the pilot dashboard.
 * These are the only supported use cases for this sprint.
 */
export type HealthCategory = 
  | 'order-not-generated'
  | 'partial-data-missing'
  | 'solution-empty'
  | 'iot-qbs-issues';

/**
 * Display configuration for each category
 */
export interface CategoryConfig {
  id: HealthCategory;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
}

/**
 * Sliding window metrics for a single time period
 */
export interface SlidingWindowMetrics {
  /** Count for last 24 hours */
  last24h: number;
  /** Count for last 7 days */
  last7d: number;
  /** Count for last 30 days */
  last30d: number;
}

/**
 * Trend direction indicator
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Complete metrics for a single health category
 */
export interface CategoryHealthMetrics {
  /** Category identifier */
  categoryId: HealthCategory;
  
  /** Count of detected issues that are not yet resolved */
  activeCount: number;
  
  /** Issues detected within sliding windows */
  detected: SlidingWindowMetrics;
  
  /** Issues resolved within sliding windows */
  resolved: SlidingWindowMetrics;
  
  /** Trend direction for active issues (compared to previous evaluation) */
  activeTrend: TrendDirection;
  
  /** Trend direction for 24h detections (compared to previous evaluation) */
  detected24hTrend: TrendDirection;
  
  /** Whether this category has an active alert */
  hasAlert: boolean;
}

/**
 * Complete health dashboard response
 */
export interface HealthDashboardData {
  /** Metrics for all categories */
  categories: CategoryHealthMetrics[];
  
  /** Timestamp of last data update */
  lastUpdated: string;
  
  /** Overall system health status */
  overallStatus: 'healthy' | 'warning' | 'critical';
}

/**
 * Previous values stored for trend comparison
 */
export interface PreviousMetrics {
  categoryId: HealthCategory;
  activeCount: number;
  detected24h: number;
  timestamp: string;
}

/**
 * Category display configurations - fixed order for pilot
 */
export const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: 'order-not-generated',
    name: 'Order Not Generated',
    description: 'Orders that failed to generate after basket submission',
    icon: 'FileX',
    color: 'red',
  },
  {
    id: 'partial-data-missing',
    name: 'Partial Data Missing',
    description: 'Orders with incomplete or missing data fields (1867)',
    icon: 'AlertTriangle',
    color: 'orange',
  },
  {
    id: 'solution-empty',
    name: 'Solution Empty',
    description: 'Solutions with no products or services attached (1147)',
    icon: 'Package',
    color: 'yellow',
  },
  {
    id: 'iot-qbs-issues',
    name: 'IoT QBS Issues',
    description: 'IoT Quick Bill Start provisioning failures',
    icon: 'Wifi',
    color: 'purple',
  },
];

/**
 * Get category config by ID
 */
export function getCategoryConfig(categoryId: HealthCategory): CategoryConfig | undefined {
  return CATEGORY_CONFIGS.find(c => c.id === categoryId);
}

/**
 * Calculate trend direction based on current vs previous value
 */
export function calculateTrend(current: number, previous: number): TrendDirection {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'stable';
}

/**
 * Determine if an alert should be shown
 * Alert when: active issues increase OR 24h detections increase
 */
export function shouldShowAlert(
  currentActive: number,
  previousActive: number,
  currentDetected24h: number,
  previousDetected24h: number
): boolean {
  return currentActive > previousActive || currentDetected24h > previousDetected24h;
}
