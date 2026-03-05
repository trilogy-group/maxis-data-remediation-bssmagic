// Loader Components
import { cn } from '../../lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };
  
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface CardLoaderProps {
  message?: string;
  className?: string;
}

export function CardLoader({ message = 'Loading...', className }: CardLoaderProps) {
  return (
    <div className={cn('flex items-center justify-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-8', className)}>
      <Spinner size="md" className="text-indigo-600 dark:text-indigo-400" />
      <span className="text-sm text-gray-600 dark:text-gray-400">{message}</span>
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-lg bg-white dark:bg-gray-900 p-6 shadow-xl">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{message}</p>
        </div>
      </div>
    </div>
  );
}
