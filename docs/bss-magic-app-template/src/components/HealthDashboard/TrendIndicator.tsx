// TrendIndicator Component
// Shows directional trend with arrow and color coding

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TrendDirection } from '../../types/health-metrics';
import { cn } from '../../lib/utils';

interface TrendIndicatorProps {
  direction: TrendDirection;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether this is for "bad" metrics (up = bad, down = good) */
  invertColors?: boolean;
  /** Show label text */
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function TrendIndicator({
  direction,
  size = 'md',
  invertColors = true, // For issues, up is bad
  showLabel = false,
  className,
}: TrendIndicatorProps) {
  const iconSize = sizeClasses[size];

  // Determine colors based on direction and inversion
  const getColors = () => {
    if (direction === 'stable') {
      return 'text-slate-400';
    }
    
    if (invertColors) {
      // For issues: up = bad (red), down = good (green)
      return direction === 'up' 
        ? 'text-red-500' 
        : 'text-emerald-500';
    } else {
      // Normal: up = good (green), down = bad (red)
      return direction === 'up' 
        ? 'text-emerald-500' 
        : 'text-red-500';
    }
  };

  const getLabel = () => {
    switch (direction) {
      case 'up': return invertColors ? 'Increasing' : 'Improving';
      case 'down': return invertColors ? 'Decreasing' : 'Declining';
      case 'stable': return 'Stable';
    }
  };

  const Icon = direction === 'up' 
    ? TrendingUp 
    : direction === 'down' 
      ? TrendingDown 
      : Minus;

  return (
    <span 
      className={cn(
        'inline-flex items-center gap-1',
        getColors(),
        className
      )}
      title={getLabel()}
    >
      <Icon className={iconSize} />
      {showLabel && (
        <span className="text-xs font-medium">{getLabel()}</span>
      )}
    </span>
  );
}
