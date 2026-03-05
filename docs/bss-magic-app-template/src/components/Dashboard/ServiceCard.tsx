// Service Card Component (TMF638)
import { useState } from 'react';
import type { Service, Product } from '../../types/tmf-api';
import { StatusBadge } from './StatusBadge';
import { Spinner } from './Loader';
import { cn } from '../../lib/utils';

interface ServiceCardProps {
  service: Service;
  onLoadSolution?: (solutionId: string) => Promise<Product | undefined>;
  className?: string;
}

export function ServiceCard({ service, onLoadSolution, className }: ServiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [solution, setSolution] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleExpand = async () => {
    if (!expanded && !solution && service.x_solutionId && onLoadSolution) {
      setLoading(true);
      setError(null);
      try {
        const result = await onLoadSolution(service.x_solutionId);
        if (result) {
          setSolution(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load solution');
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };
  
  return (
    <div className={cn('rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow', className)}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {service.name}
            </h3>
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate mt-1">
              {service.id}
            </p>
          </div>
          <StatusBadge status={service.state || 'Unknown'} />
        </div>
        
        {/* Service Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Type:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
              {service.x_serviceType || service.serviceType || 'N/A'}
            </span>
          </div>
          {service.startDate && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Start:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {new Date(service.startDate).toLocaleDateString()}
              </span>
            </div>
          )}
          {service.x_externalId && (
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">External ID:</span>
              <span className="ml-2 font-mono text-sm text-gray-900 dark:text-gray-100">
                {service.x_externalId}
              </span>
            </div>
          )}
        </div>
        
        {/* 1867 Detection Flags */}
        {service.x_has1867Issue && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            {service.x_fibreVoiceOE && (
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">
                Fibre+Voice OE
              </span>
            )}
            {service.x_fibreFibreOE && (
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">
                Fibre-Only OE
              </span>
            )}
            {service.x_mobileESMSOE && (
              <span className="text-xs px-2 py-0.5 rounded bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400">
                Mobile+ESMS OE
              </span>
            )}
            {service.x_accessVoiceOE && (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                Access+Voice OE
              </span>
            )}
          </div>
        )}
        
        {/* Solution Section (Expandable) */}
        {service.x_solutionId && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleExpand}
              className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <span>{expanded ? '▼' : '▶'}</span>
              <span>Solution: {service.x_solutionName || service.x_solutionId}</span>
            </button>
            
            {expanded && (
              <div className="mt-3 p-3 rounded bg-gray-50 dark:bg-gray-900">
                {loading && (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" className="text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Loading solution...</span>
                  </div>
                )}
                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                )}
                {solution && (
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Name:</span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">{solution.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">ID:</span>
                      <span className="ml-2 font-mono text-xs text-gray-900 dark:text-gray-100">{solution.id}</span>
                    </div>
                    {solution.status && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Status:</span>
                        <StatusBadge status={solution.status} className="ml-2" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
