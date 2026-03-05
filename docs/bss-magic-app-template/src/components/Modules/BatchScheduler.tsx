// BatchScheduler Component
// Manages batch remediation schedules and displays execution history
// Uses batchProcessing/v1 API (BatchJob + BatchSchedule)

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Play,
  Plus,
  X,
  RefreshCw,
  Trash2,
  Edit,
  Pause,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Timer,
  CalendarDays,
  CalendarClock,
  BarChart3,
  XCircle,
  SkipForward,
  Loader2,
  Search,
  Wrench,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { downloadCSV } from '../../lib/csv-export';
import {
  listWorkOrderSchedules,
  createWorkOrderSchedule,
  updateWorkOrderSchedule,
  deleteWorkOrderSchedule,
  listWorkOrders,
  createWorkOrder,
  type WorkOrderSchedule as TMFWorkOrderSchedule,
  type WorkOrder as TMFWorkOrder,
  type RecurrencePattern as TMFRecurrencePattern,
} from '../../services/tmf/client';
import {
  getOrchestratorConfig,
  updateOrchestratorConfig,
  remediateOEBatch,
  type BatchConfig,
} from '../../services/salesforce/client';

// Re-export types for convenience
export type RecurrencePattern = TMFRecurrencePattern;
export type BatchJobState = 'pending' | 'open' | 'inProgress' | 'completed' | 'cancelled' | 'failed';

export interface WorkOrderSchedule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  category: string;
  recurrencePattern: RecurrencePattern;
  recurrenceDays?: number[];
  windowStartTime: string;
  windowEndTime: string;
  maxBatchSize: number;
  selectionCriteria: Record<string, unknown> | string;
  validFrom?: string;
  validTo?: string;
  createdBy?: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutionDate?: string;
  lastExecutionId?: string;
  nextExecutionDate?: string;
  creationDate: string;
}

export interface BatchJobSummary {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface WorkOrder {
  id: string;
  name: string;
  state: BatchJobState;
  category: string;
  description?: string;
  scheduledStartDate?: string;
  startDate?: string;
  completionDate?: string;
  requestedQuantity: number;
  actualQuantity: number;
  x_summary: BatchJobSummary | string;
  x_currentItemId?: string;
  x_currentItemState?: string;
  x_recurrencePattern: RecurrencePattern;
  x_isRecurrent: boolean;
  x_parentScheduleId?: string;
  x_executionNumber?: number;
  x_configuration?: Record<string, unknown> | string;
  creationDate: string;
  lastUpdate?: string;
}

interface BatchSchedulerProps {
  category: string;
  useCase: string;
  onScheduleCreated?: (schedule: WorkOrderSchedule) => void;
  onImmediateStart?: (config: { batchSize: number }) => void;
}

// =============================================================================
// Helpers
// =============================================================================

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

// Convert a UTC HH:MM(:SS) time string to local 12h display
const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const now = new Date();
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes)));
  return utc.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// Convert a local HH:MM time string to UTC HH:MM
const localTimeToUtc = (localTime: string): string => {
  if (!localTime) return localTime;
  const [h, m] = localTime.split(':').map(Number);
  const now = new Date();
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
};

// Convert a UTC HH:MM(:SS) time string to local HH:MM for <input type="time">
const utcTimeToLocal = (utcTime: string): string => {
  if (!utcTime) return utcTime;
  const [h, m] = utcTime.split(':').map(Number);
  const now = new Date();
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), h, m));
  return `${String(utc.getHours()).padStart(2, '0')}:${String(utc.getMinutes()).padStart(2, '0')}`;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '\u2014';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const formatDuration = (start?: string, end?: string) => {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
};

const getRecurrenceLabel = (pattern: RecurrencePattern, days?: number[]) => {
  switch (pattern) {
    case 'once': return 'One-time';
    case 'daily': return 'Every day';
    case 'weekdays': return 'Mon \u2013 Fri';
    case 'weekly': return days?.length
      ? `Weekly: ${days.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(', ')}`
      : 'Weekly';
    case 'custom': return 'Custom';
    default: return pattern;
  }
};

const parseSummary = (raw: BatchJobSummary | string | undefined): BatchJobSummary => {
  const empty: BatchJobSummary = { total: 0, successful: 0, failed: 0, skipped: 0, pending: 0 };
  if (!raw) return empty;
  let parsed: Record<string, number>;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return empty; }
  } else {
    parsed = raw as unknown as Record<string, number>;
  }
  return {
    total: parsed.total ?? 0,
    successful: (parsed.successful ?? 0) + (parsed.remediated ?? 0),
    failed: parsed.failed ?? 0,
    skipped: (parsed.skipped ?? 0) + (parsed.not_impacted ?? 0),
    pending: (parsed.pending ?? 0) + (parsed.partially_remediated ?? 0) + (parsed.enrichment_unavailable ?? 0) + (parsed.attachment_corrupt ?? 0),
  };
};

const stateConfig = (state: BatchJobState) => {
  switch (state) {
    case 'completed': return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
    case 'failed': return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    case 'inProgress': return { icon: Loader2, color: 'text-blue-500 animate-spin', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'pending': return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    case 'cancelled': return { icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400' };
    default: return { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-200 text-slate-600' };
  }
};

// =============================================================================
// BatchJob Card (execution result with expandable details)
// =============================================================================

function BatchJobCard({ job, expanded, onToggle }: { job: WorkOrder; expanded: boolean; onToggle: () => void }) {
  const summary = parseSummary(job.x_summary);
  const total = summary.total || job.actualQuantity || 0;
  const config = stateConfig(job.state);
  const StateIcon = config.icon;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-600">
      {/* Clickable header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <StateIcon className={cn('w-5 h-5 flex-shrink-0', config.color)} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{job.name}</span>
              <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', config.bg)}>
                {job.state}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formatDate(job.creationDate)}
              {job.lastUpdate && job.creationDate !== job.lastUpdate && (
                <span className="ml-2 text-slate-400">
                  ({formatDuration(job.creationDate, job.lastUpdate)})
                </span>
              )}
              {job.x_parentScheduleId && (
                <span className="ml-2 text-violet-500 dark:text-violet-400">
                  Execution #{job.x_executionNumber || '?'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {total > 0 && (
            <>
              {summary.successful > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
                  {summary.successful} ok
                </span>
              )}
              {summary.skipped > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                  {summary.skipped} skip
                </span>
              )}
              {summary.failed > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                  {summary.failed} fail
                </span>
              )}
            </>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
              {/* Summary grid */}
              <div className="grid grid-cols-5 gap-3 mt-3 text-center">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-100 dark:border-slate-700">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{total}</div>
                  <div className="text-xs text-slate-500">Total</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-emerald-100 dark:border-emerald-900/30">
                  <div className="text-2xl font-bold text-emerald-600">{summary.successful}</div>
                  <div className="text-xs text-slate-500">Successful</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-red-100 dark:border-red-900/30">
                  <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                  <div className="text-xs text-slate-500">Failed</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-amber-100 dark:border-amber-900/30">
                  <div className="text-2xl font-bold text-amber-600">{summary.skipped}</div>
                  <div className="text-xs text-slate-500">Skipped</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-100 dark:border-slate-700">
                  <div className="text-2xl font-bold text-slate-400">{summary.pending}</div>
                  <div className="text-xs text-slate-500">Pending</div>
                </div>
              </div>

              {/* Progress bar */}
              {total > 0 && (
                <div className="mt-3 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  {summary.successful > 0 && (
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(summary.successful / total) * 100}%` }} />
                  )}
                  {summary.skipped > 0 && (
                    <div className="bg-amber-400 h-full transition-all" style={{ width: `${(summary.skipped / total) * 100}%` }} />
                  )}
                  {summary.failed > 0 && (
                    <div className="bg-red-500 h-full transition-all" style={{ width: `${(summary.failed / total) * 100}%` }} />
                  )}
                  {summary.pending > 0 && (
                    <div className="bg-slate-300 dark:bg-slate-600 h-full transition-all" style={{ width: `${(summary.pending / total) * 100}%` }} />
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <div>Requested: <span className="text-slate-700 dark:text-slate-300">{job.requestedQuantity}</span></div>
                {job.lastUpdate && (
                  <div>Last Update: <span className="text-slate-700 dark:text-slate-300">{formatDate(job.lastUpdate)}</span></div>
                )}
                {job.description && (
                  <div className="col-span-2">Note: <span className="text-slate-700 dark:text-slate-300">{job.description}</span></div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Schedule Card
// =============================================================================

function ScheduleCard({
  schedule,
  onEdit,
  onToggle,
  onDelete,
}: {
  schedule: WorkOrderSchedule;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const successRate = schedule.totalExecutions > 0
    ? Math.round((schedule.successfulExecutions / schedule.totalExecutions) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'border rounded-xl p-4 transition-all',
        schedule.isActive
          ? 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CalendarClock className={cn('w-5 h-5', schedule.isActive ? 'text-violet-500' : 'text-slate-400')} />
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">{schedule.name}</h4>
            {schedule.isActive ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">Active</span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded-full">Paused</span>
            )}
          </div>
          {schedule.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{schedule.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggle} className={cn('p-1.5 rounded-lg transition-colors',
            schedule.isActive ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600' : 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600'
          )} title={schedule.isActive ? 'Pause' : 'Activate'}>
            {schedule.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Pattern</div>
          <div className="font-medium text-slate-700 dark:text-slate-300">
            {getRecurrenceLabel(schedule.recurrencePattern, schedule.recurrenceDays)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Window</div>
          <div className="font-medium text-slate-700 dark:text-slate-300">
            {formatTime(schedule.windowStartTime)} - {formatTime(schedule.windowEndTime)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Max Batch</div>
          <div className="font-medium text-slate-700 dark:text-slate-300">{schedule.maxBatchSize} solutions</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Success Rate</div>
          <div className="font-medium text-slate-700 dark:text-slate-300">
            {successRate}% ({schedule.successfulExecutions}/{schedule.totalExecutions})
          </div>
        </div>
      </div>

      {schedule.isActive && schedule.nextExecutionDate && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
              <Timer className="w-4 h-4" />
              <span>Next: {formatDate(schedule.nextExecutionDate)}</span>
            </div>
            {schedule.lastExecutionDate && (
              <span className="text-slate-500 dark:text-slate-400">Last: {formatDate(schedule.lastExecutionDate)}</span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// Create/Edit Schedule Modal
// =============================================================================

function ScheduleModal({
  schedule,
  category,
  useCase,
  onSave,
  onClose,
}: {
  schedule?: WorkOrderSchedule;
  category: string;
  useCase: string;
  onSave: (data: Partial<WorkOrderSchedule>) => void;
  onClose: () => void;
}) {
  const isEdit = !!schedule;
  const existingCriteria = typeof schedule?.selectionCriteria === 'object' ? schedule.selectionCriteria as Record<string, unknown> : {};
  const [name, setName] = useState(schedule?.name || `${useCase} Nightly Batch`);
  const [description, setDescription] = useState(schedule?.description || '');
  const [jobType, setJobType] = useState<'detection' | 'remediation'>((existingCriteria.jobType as string) === 'detection' ? 'detection' : 'remediation');
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>(schedule?.recurrencePattern || 'daily');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(schedule?.recurrenceDays || [1, 2, 3, 4, 5]);
  const [windowStartTime, setWindowStartTime] = useState(schedule?.windowStartTime ? utcTimeToLocal(schedule.windowStartTime) : '00:00');
  const [windowEndTime, setWindowEndTime] = useState(schedule?.windowEndTime ? utcTimeToLocal(schedule.windowEndTime) : '06:00');
  const [maxBatchSize, setMaxBatchSize] = useState(schedule?.maxBatchSize || 100);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('00:00');

  const handleSubmit = () => {
    const data: Partial<WorkOrderSchedule> = {
      name, description, category, recurrencePattern,
      recurrenceDays: recurrencePattern === 'weekly' || recurrencePattern === 'custom' ? recurrenceDays : undefined,
      windowStartTime: localTimeToUtc(windowStartTime),
      windowEndTime: localTimeToUtc(windowEndTime),
      maxBatchSize,
      selectionCriteria: { remediationState: 'DETECTED', useCase, jobType },
    };
    if (recurrencePattern === 'once' && scheduledDate) {
      const localDate = new Date(`${scheduledDate}T${scheduledTime}:00`);
      const scheduledISO = localDate.toISOString();
      data.validFrom = scheduledISO;
      data.nextExecutionDate = scheduledISO;
    }
    onSave(data);
  };

  const toggleDay = (day: number) => {
    setRecurrenceDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort());
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-violet-500" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{isEdit ? 'Edit Schedule' : 'Create Batch Schedule'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Schedule Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
          </div>
          {category === 'PartialDataMissing' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Job Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setJobType('detection')}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm',
                    jobType === 'detection' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' : 'border-slate-200 dark:border-slate-600')}>
                  <Search className="w-4 h-4" /> Detection
                </button>
                <button type="button" onClick={() => setJobType('remediation')}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm',
                    jobType === 'remediation' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-600')}>
                  <Wrench className="w-4 h-4" /> Remediation
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {jobType === 'detection' ? 'Scans all service types for missing OE fields and creates ServiceProblems' : 'Fixes pending ServiceProblems by patching OE attachments'}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Recurrence Pattern</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'once', label: 'One-time', icon: Calendar },
                { value: 'daily', label: 'Daily', icon: CalendarDays },
                { value: 'weekdays', label: 'Weekdays', icon: CalendarDays },
                { value: 'weekly', label: 'Weekly', icon: CalendarClock },
              ].map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" onClick={() => setRecurrencePattern(value as RecurrencePattern)}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm',
                    recurrencePattern === value ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'border-slate-200 dark:border-slate-600')}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>
          </div>
          {(recurrencePattern === 'weekly' || recurrencePattern === 'custom') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Days</label>
              <div className="flex gap-1">
                {WEEKDAYS.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => toggleDay(value)}
                    className={cn('flex-1 py-2 text-xs font-medium rounded-lg border transition-all',
                      recurrenceDays.includes(value) ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-200 dark:border-slate-600')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {recurrencePattern === 'once' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
                <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
            </div>
          )}
          {recurrencePattern !== 'once' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Execution Window <span className="text-xs text-slate-400 font-normal">(your local time)</span></label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Start Time</label>
                  <input type="time" value={windowStartTime} onChange={(e) => setWindowStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">End Time</label>
                  <input type="time" value={windowEndTime} onChange={(e) => setWindowEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Batch Size</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={maxBatchSize}
              onChange={(e) => setMaxBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full py-2 px-3 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
              placeholder="Number of solutions"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg">
            {isEdit ? 'Save Changes' : 'Create Schedule'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// Main BatchScheduler Component
// =============================================================================

export function BatchScheduler({ category, useCase, onScheduleCreated, onImmediateStart }: BatchSchedulerProps) {
  const [schedules, setSchedules] = useState<WorkOrderSchedule[]>([]);
  const [jobs, setJobs] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkOrderSchedule | undefined>();
  const [expandedSection, setExpandedSection] = useState<'schedules' | 'history' | null>('schedules');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobsLimit, setJobsLimit] = useState(10);

  // Error toast state
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 5000);
  };

  // Parallel execution config
  const [batchConfig, setBatchConfig] = useState<BatchConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [runNowSize, setRunNowSize] = useState(50);

  const fetchConfig = useCallback(async () => {
    try {
      const config = await getOrchestratorConfig();
      setBatchConfig(config);
    } catch (err) {
      console.warn('Failed to fetch orchestrator config:', err);
    }
  }, []);

  const handleConfigUpdate = async (patch: Partial<BatchConfig>) => {
    setConfigLoading(true);
    try {
      const updated = await updateOrchestratorConfig(patch);
      setBatchConfig(updated);
    } catch (err) {
      showError('Failed to update batch config');
      console.error('Failed to update config:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      fetchConfig();

      try {
        const schedulesData = await listWorkOrderSchedules({ category });
        setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
      } catch (err) {
        console.warn('Failed to fetch schedules:', err);
        setSchedules([]);
      }

      try {
        const jobsData = await listWorkOrders({ category, limit: jobsLimit });
        const jobList = Array.isArray(jobsData) ? jobsData : [];
        jobList.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
        setJobs(jobList);
      } catch (err) {
        console.warn('Failed to fetch jobs:', err);
        setJobs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [category, jobsLimit, fetchConfig]);

  // Initial load + auto-refresh every 15 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSaveSchedule = async (data: Partial<WorkOrderSchedule>) => {
    try {
      let saved: WorkOrderSchedule;
      if (editingSchedule) {
        saved = await updateWorkOrderSchedule(editingSchedule.id, data);
        setSchedules((prev) => prev.map((s) => s.id === editingSchedule.id ? saved : s));
      } else {
        saved = await createWorkOrderSchedule(data);
        setSchedules((prev) => [...prev, saved]);
        onScheduleCreated?.(saved);
      }
    } catch (error) {
      showError('Failed to save schedule');
      console.error('Failed to save schedule:', error);
    } finally {
      setShowCreateModal(false);
      setEditingSchedule(undefined);
    }
  };

  const handleToggleSchedule = async (schedule: WorkOrderSchedule) => {
    try {
      await updateWorkOrderSchedule(schedule.id, { isActive: !schedule.isActive });
      setSchedules((prev) => prev.map((s) => s.id === schedule.id ? { ...s, isActive: !s.isActive } : s));
    } catch (e) { showError('Failed to toggle schedule'); console.error(e); }
  };

  const handleDeleteSchedule = async (schedule: WorkOrderSchedule) => {
    if (!confirm(`Delete schedule "${schedule.name}"?`)) return;
    try {
      await deleteWorkOrderSchedule(schedule.id);
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (e) { showError('Failed to delete schedule'); console.error(e); }
  };

  const [runNowExecuting, setRunNowExecuting] = useState(false);

  const handleRunNow = async (batchSize: number = 50) => {
    setRunNowExecuting(true);
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const jobName = `${useCase} Remediation · ${timestamp}`;
    try {
      if (category === 'PartialDataMissing') {
        const result = await remediateOEBatch({
          max_count: batchSize,
          job_name: jobName,
        });
        console.log(`[BatchScheduler] OE batch result:`, result);
      } else {
        const wo = await createWorkOrder({
          name: jobName,
          category,
          requestedQuantity: batchSize,
          x_recurrencePattern: 'once',
          x_isRecurrent: false,
        });
        setJobs((prev) => [wo, ...prev]);
        onImmediateStart?.({ batchSize });
      }
      await fetchData();
    } catch (e) {
      showError('Failed to start batch');
      console.error(e);
    } finally {
      setRunNowExecuting(false);
    }
  };

  const activeSchedules = schedules.filter((s) => s.isActive);

  return (
    <div className="space-y-4">
      {/* Error Toast */}
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{errorToast}</span>
            <button onClick={() => setErrorToast(null)} className="ml-2 hover:text-red-900 dark:hover:text-red-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <BarChart3 className="w-5 h-5 text-violet-500" />
          <span className="font-semibold">Batch Processing</span>
          {activeSchedules.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 rounded-full">
              {activeSchedules.length} active
            </span>
          )}
          {jobs.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded-full">
              {jobs.length} jobs
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData()} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={10000}
              value={runNowSize}
              onChange={(e) => setRunNowSize(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 py-1.5 px-2 text-sm text-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              title="Batch size"
            />
            <button onClick={() => handleRunNow(runNowSize)} disabled={runNowExecuting}
              className="px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-lg flex items-center gap-1.5">
              {runNowExecuting ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</> : <><Play className="w-4 h-4" /> Run Now</>}
            </button>
          </div>
          <button onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New Schedule
          </button>
        </div>
      </div>

      {/* Parallel Execution Config Panel */}
      {batchConfig && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowConfig((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Timer className="w-4 h-4 text-violet-500" />
              Execution Mode
              <span className={cn(
                'px-2 py-0.5 text-xs font-semibold rounded-full',
                batchConfig.batch_parallel
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              )}>
                {batchConfig.batch_parallel ? `Parallel (${batchConfig.batch_concurrency} streams)` : 'Sequential'}
              </span>
            </div>
            {showConfig ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          <AnimatePresence>
            {showConfig && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-3 space-y-3 border-t border-slate-200 dark:border-slate-700">
                  {/* Parallel toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Parallel Execution</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Process multiple solutions concurrently</div>
                    </div>
                    <button
                      onClick={() => handleConfigUpdate({ batch_parallel: !batchConfig.batch_parallel })}
                      disabled={configLoading}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors duration-200',
                        batchConfig.batch_parallel ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
                        configLoading && 'opacity-50'
                      )}
                    >
                      <span className={cn(
                        'block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200',
                        batchConfig.batch_parallel ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'
                      )} style={{ marginTop: '2px', marginLeft: batchConfig.batch_parallel ? '22px' : '2px' }} />
                    </button>
                  </div>

                  {/* Concurrency slider (only when parallel) */}
                  {batchConfig.batch_parallel && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Concurrency Streams</label>
                        <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">{batchConfig.batch_concurrency}</span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 3, 5, 10, 20].map((n) => (
                          <button
                            key={n}
                            onClick={() => handleConfigUpdate({ batch_concurrency: n })}
                            disabled={configLoading}
                            className={cn(
                              'flex-1 py-1.5 text-sm font-medium rounded-lg border transition-all',
                              batchConfig.batch_concurrency === n
                                ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                        Estimated throughput: ~{Math.round(batchConfig.batch_concurrency * 180)} solutions/hour
                        {batchConfig.batch_concurrency >= 5 && ' (1000+ solutions/night)'}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Schedules section */}
          <div>
            <button onClick={() => setExpandedSection(s => s === 'schedules' ? null : 'schedules')}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 mb-3">
              {expandedSection === 'schedules' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <CalendarClock className="w-4 h-4" />
              Schedules ({schedules.length})
            </button>

            <AnimatePresence>
              {expandedSection === 'schedules' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-3">
                    {schedules.length > 0 ? (
                      schedules.map((schedule) => (
                        <ScheduleCard key={schedule.id} schedule={schedule}
                          onEdit={() => { setEditingSchedule(schedule); setShowCreateModal(true); }}
                          onToggle={() => handleToggleSchedule(schedule)}
                          onDelete={() => handleDeleteSchedule(schedule)} />
                      ))
                    ) : (
                      <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl">
                        <CalendarClock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-500 dark:text-slate-400">No schedules configured</p>
                        <button onClick={() => setShowCreateModal(true)}
                          className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400">
                          <Plus className="w-4 h-4 inline mr-1" /> Create First Schedule
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Execution History section */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setExpandedSection(s => s === 'history' ? null : 'history')}
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400">
                {expandedSection === 'history' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <BarChart3 className="w-4 h-4" />
                Execution History ({jobs.length})
              </button>
              {jobs.length > 0 && expandedSection === 'history' && (
                <button
                  onClick={() => {
                    const parseSummary = (s: BatchJobSummary | string): BatchJobSummary | null => {
                      if (typeof s === 'string') { try { return JSON.parse(s); } catch { return null; } }
                      return s;
                    };
                    const rows = jobs.map(j => {
                      const summary = parseSummary(j.x_summary);
                      return {
                        id: j.id,
                        name: j.name,
                        state: j.state,
                        category: j.category,
                        startDate: j.startDate ?? j.scheduledStartDate ?? '',
                        completionDate: j.completionDate ?? '',
                        requestedQuantity: j.requestedQuantity,
                        actualQuantity: j.actualQuantity,
                        successful: summary?.successful ?? '',
                        failed: summary?.failed ?? '',
                        skipped: summary?.skipped ?? '',
                        parentScheduleId: j.x_parentScheduleId ?? '',
                        executionNumber: j.x_executionNumber ?? '',
                        creationDate: j.creationDate,
                      };
                    });
                    const ts = new Date().toISOString().slice(0, 10);
                    downloadCSV(rows, `batch-execution-history-${ts}.csv`);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export CSV
                </button>
              )}
            </div>

            <AnimatePresence>
              {expandedSection === 'history' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-2">
                    {jobs.length > 0 ? (
                      <>
                        {jobs.map((job) => (
                          <BatchJobCard key={job.id} job={job}
                            expanded={expandedJobId === job.id}
                            onToggle={() => setExpandedJobId(prev => prev === job.id ? null : job.id)} />
                        ))}
                        {jobs.length >= jobsLimit && (
                          <button onClick={() => setJobsLimit((prev) => prev + 20)}
                            className="w-full py-2 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 rounded-lg transition-colors">
                            Load more...
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                        No batch executions yet
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <ScheduleModal schedule={editingSchedule} category={category} useCase={useCase}
            onSave={handleSaveSchedule}
            onClose={() => { setShowCreateModal(false); setEditingSchedule(undefined); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default BatchScheduler;
