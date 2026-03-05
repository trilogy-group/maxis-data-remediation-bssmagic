// Category Badge Component for Service Problems
import { cn } from '../../lib/utils';

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

const categoryStyles: Record<string, string> = {
  SolutionEmpty: 'bg-violet-500/20 text-violet-300 dark:bg-violet-500/10 dark:text-violet-400',
  PartialDataMissing: 'bg-amber-500/20 text-amber-300 dark:bg-amber-500/10 dark:text-amber-400',
  PartialDataMissing_Voice: 'bg-amber-500/20 text-amber-300 dark:bg-amber-500/10 dark:text-amber-400',
  PartialDataMissing_Fibre: 'bg-cyan-500/20 text-cyan-300 dark:bg-cyan-500/10 dark:text-cyan-400',
  PartialDataMissing_eSMS: 'bg-pink-500/20 text-pink-300 dark:bg-pink-500/10 dark:text-pink-400',
  PartialDataMissing_Access: 'bg-blue-500/20 text-blue-300 dark:bg-blue-500/10 dark:text-blue-400',
};

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const styles = categoryStyles[category] || 'bg-gray-500/20 text-gray-300 dark:bg-gray-500/10 dark:text-gray-400';
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-medium',
        styles,
        className
      )}
    >
      {category}
    </span>
  );
}
