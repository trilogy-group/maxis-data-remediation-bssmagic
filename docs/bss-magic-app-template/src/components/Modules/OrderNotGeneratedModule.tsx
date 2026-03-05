// Module 3: Order Not Generated
import { useShoppingCarts } from '../../services/tmf/hooks';
import { ShoppingCartCard } from '../Dashboard/ShoppingCartCard';
import { CardLoader, Spinner } from '../Dashboard/Loader';

export function OrderNotGeneratedModule() {
  const { data: carts, isLoading, error, refetch, isFetching } = useShoppingCarts({
    limit: 20,
    status: 'Order Generation',
  });
  
  const stuckBaskets = carts || [];
  
  return (
    <div className="space-y-6">
      {/* Business Impact Banner */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-lg p-6 text-white">
        <div className="flex items-start gap-4">
          <span className="text-4xl">⚠️</span>
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">Stuck Orders - Business Impact</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <div className="text-sm opacity-90">Stuck Baskets</div>
                <div className="text-3xl font-bold">{stuckBaskets.length}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Total at Risk</div>
                <div className="text-3xl font-bold">$4.2M</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Avg Stuck Time</div>
                <div className="text-3xl font-bold">3-7 days</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Manual Fix</div>
                <div className="text-3xl font-bold">15 min ea</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Problem Explanation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              The Problem
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Customers complete their order, sales rep submits it, but nothing happens. The order just sits there. 
              Your team has to manually reset a field to "kick" the system. Meanwhile, the customer is waiting, 
              sales rep is following up, and revenue is delayed.
            </p>
            
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <div className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Current Impact:</div>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• {stuckBaskets.length} baskets stuck right now</li>
                <li>• Average stuck time: 3-7 days per order</li>
                <li>• $4.2M in revenue delayed</li>
                <li>• Occurs 60-80 times per month</li>
                <li>• 15 minutes manual fix per basket</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Before/After Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h4 className="font-bold text-red-900 dark:text-red-100 mb-3">TODAY (Manual Process)</h4>
          <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
            <li>• Ops team checks queue every 2 hours</li>
            <li>• Manually identifies stuck baskets</li>
            <li>• Opens each basket in Salesforce</li>
            <li>• Resets field manually</li>
            <li>• Waits for order to generate</li>
            <li className="pt-2 border-t border-red-200 dark:border-red-800 font-semibold">
              Time: 15 min × {stuckBaskets.length} = {Math.round(stuckBaskets.length * 0.25)} hours
            </li>
          </ul>
        </div>
        
        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6">
          <h4 className="font-bold text-emerald-900 dark:text-emerald-100 mb-3">WITH BSS MAGIC</h4>
          <ul className="space-y-2 text-sm text-emerald-800 dark:text-emerald-200">
            <li>✅ System detects high queue automatically</li>
            <li>✅ Alerts ops team instantly</li>
            <li>✅ Shows list of affected baskets</li>
            <li>✅ One-click bulk reset</li>
            <li>✅ Monitors completion automatically</li>
            <li className="pt-2 border-t border-emerald-200 dark:border-emerald-800 font-semibold">
              Time: 2 minutes for entire batch
            </li>
          </ul>
        </div>
      </div>

      {/* How BSS Magic Detects & Fixes It */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <span className="text-xl">⚡</span>
          How BSS Magic Detects & Fixes It
        </h3>
        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
              1
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">Real-time Monitoring</div>
              <div className="text-gray-600 dark:text-gray-400 mt-1">
                System monitors Salesforce job queue every 30 seconds. When queue exceeds 100 jobs, automatic alert triggers.
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
              2
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">Automatic Identification</div>
              <div className="text-gray-600 dark:text-gray-400 mt-1">
                System identifies all baskets stuck in "Order Generation" state and calculates revenue impact
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
              3
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">One-Click Resolution</div>
              <div className="text-gray-600 dark:text-gray-400 mt-1">
                Ops team reviews list and approves bulk reset. System resets all basket triggers simultaneously.
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              ✓
            </div>
            <div>
              <div className="font-semibold text-emerald-900 dark:text-emerald-100">Result</div>
              <div className="text-emerald-700 dark:text-emerald-300 mt-1">
                All orders resume generation within 2 minutes. $4.2M revenue unblocked.
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4">
          <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Pattern Recognition</div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            System learns that queue spikes occur every Tuesday at 2 AM. Recommendation: Reschedule batch jobs 
            to prevent future occurrences. This transforms from reactive fixing to proactive prevention.
          </p>
        </div>
      </div>
      
      {/* Real-time Queue Monitor */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          📊 Salesforce Job Queue Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Queue</div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">142 jobs</div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">🚨 Above threshold (100)</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Baskets Affected</div>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stuckBaskets.length}</div>
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Awaiting processing</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Revenue Delayed</div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">$4.2M</div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">3-7 days average delay</div>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Orders Stuck Awaiting Processing ({stuckBaskets.length})
        </h3>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isFetching && <Spinner size="sm" className="text-white" />}
          Check for New Issues
        </button>
      </div>
      
      {/* Loading State */}
      {isLoading && <CardLoader message="Loading stuck baskets..." />}
      
      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-xl">❌</span>
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Error Loading Data</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error instanceof Error ? error.message : 'An unknown error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Basket Cards */}
      {!isLoading && !error && stuckBaskets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stuckBaskets.map((cart) => (
            <ShoppingCartCard key={cart.id} cart={cart} />
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {!isLoading && !error && stuckBaskets.length === 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
          <span className="text-4xl mb-4 block">🎉</span>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Stuck Baskets
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            All baskets are processing normally. No remediation needed.
          </p>
        </div>
      )}
    </div>
  );
}
