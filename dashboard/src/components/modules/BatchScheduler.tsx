'use client';

// BatchScheduler Component for ts-dashboard
// Manages batch remediation schedules and displays execution history
// Uses batchProcessing/v1 API (BatchJob + BatchSchedule)

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type RecurrencePattern = 'once' | 'daily' | 'weekdays' | 'weekly' | 'custom';
export type BatchJobState = 'pending' | 'open' | 'inProgress' | 'completed' | 'cancelled' | 'failed';

export interface BatchSchedule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  category: string;
  recurrencePattern: RecurrencePattern;
  recurrenceDays?: number[];
  windowStartTime: string;
  windowEndTime: string;
  timezone?: string;
  maxBatchSize: number;
  selectionCriteria: Record<string, unknown> | string;
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

export interface BatchJob {
  id: string;
  name: string;
  state: BatchJobState;
  category: string;
  description?: string;
  requestedQuantity: number;
  actualQuantity: number;
  x_summary: BatchJobSummary | string;
  x_currentItemId?: string;
  x_currentItemState?: string;
  x_parentScheduleId?: string;
  x_executionNumber?: number;
  x_isRecurrent?: boolean;
  x_configuration?: string;
  creationDate: string;
  lastUpdate?: string;
}

interface BatchSchedulerProps {
  category: string;
  useCase: string;
  onScheduleCreated?: (schedule: BatchSchedule) => void;
  onImmediateStart?: (config: { batchSize: number }) => void;
}

// =============================================================================
// API paths (proxied through Next.js API routes)
// =============================================================================

const API = {
  schedules: (category?: string) =>
    `/api/tmf-api/batchSchedule${category ? `?category=${category}` : ''}`,
  schedule: (id: string) => `/api/tmf-api/batchSchedule/${id}`,
  jobs: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return `/api/tmf-api/batchJob${q ? `?${q}` : ''}`;
  },
  job: (id: string) => `/api/tmf-api/batchJob/${id}`,
};

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

const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
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
    case 'weekly': return days?.length ? `Weekly: ${days.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(', ')}` : 'Weekly';
    default: return pattern;
  }
};

const parseSummary = (raw: BatchJobSummary | string | undefined): BatchJobSummary => {
  if (!raw) return { total: 0, successful: 0, failed: 0, skipped: 0, pending: 0 };
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return { total: 0, successful: 0, failed: 0, skipped: 0, pending: 0 }; }
  }
  return raw;
};

const stateIcon = (state: BatchJobState) => {
  switch (state) {
    case 'completed': return '\u2705';
    case 'failed': return '\u274C';
    case 'inProgress': return '\u23F3';
    case 'pending': return '\uD83D\uDD50';
    case 'cancelled': return '\u26D4';
    default: return '\u2B55';
  }
};

const stateColor = (state: BatchJobState) => {
  switch (state) {
    case 'completed': return 'bg-emerald-100 text-emerald-700';
    case 'failed': return 'bg-red-100 text-red-700';
    case 'inProgress': return 'bg-blue-100 text-blue-700';
    case 'pending': return 'bg-gray-100 text-gray-600';
    case 'cancelled': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

// =============================================================================
// BatchJob Card (execution result)
// =============================================================================

function BatchJobCard({ job, expanded, onToggle }: { job: BatchJob; expanded: boolean; onToggle: () => void }) {
  const summary = parseSummary(job.x_summary);
  const total = summary.total || job.actualQuantity || 0;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden transition-all hover:border-gray-300">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-lg flex-shrink-0">{stateIcon(job.state)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 truncate">{job.name}</span>
              <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', stateColor(job.state))}>
                {job.state}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {formatDate(job.creationDate)}
              {job.lastUpdate && job.creationDate !== job.lastUpdate && (
                <span className="ml-2 text-gray-400">
                  ({formatDuration(job.creationDate, job.lastUpdate)})
                </span>
              )}
              {job.x_parentScheduleId && (
                <span className="ml-2 text-violet-500">
                  #{job.x_executionNumber || '?'}
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
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                  {summary.successful} ok
                </span>
              )}
              {summary.skipped > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                  {summary.skipped} skip
                </span>
              )}
              {summary.failed > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                  {summary.failed} fail
                </span>
              )}
            </>
          )}
          <span className="text-xs text-gray-400 ml-1">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 bg-gray-50/50">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 text-center">
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <div className="text-2xl font-bold text-gray-900">{total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="bg-white rounded-lg p-2 border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-600">{summary.successful}</div>
              <div className="text-xs text-gray-500">Successful</div>
            </div>
            <div className="bg-white rounded-lg p-2 border border-red-100">
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
            <div className="bg-white rounded-lg p-2 border border-amber-100">
              <div className="text-2xl font-bold text-amber-600">{summary.skipped}</div>
              <div className="text-xs text-gray-500">Skipped</div>
            </div>
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <div className="text-2xl font-bold text-gray-400">{summary.pending}</div>
              <div className="text-xs text-gray-500">Pending</div>
            </div>
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden flex">
              {summary.successful > 0 && (
                <div className="bg-emerald-500 h-full" style={{ width: `${(summary.successful / total) * 100}%` }} />
              )}
              {summary.skipped > 0 && (
                <div className="bg-amber-400 h-full" style={{ width: `${(summary.skipped / total) * 100}%` }} />
              )}
              {summary.failed > 0 && (
                <div className="bg-red-500 h-full" style={{ width: `${(summary.failed / total) * 100}%` }} />
              )}
              {summary.pending > 0 && (
                <div className="bg-gray-300 h-full" style={{ width: `${(summary.pending / total) * 100}%` }} />
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
            <div>ID: <span className="font-mono text-gray-700">{job.id}</span></div>
            <div>Requested: <span className="text-gray-700">{job.requestedQuantity}</span></div>
            {job.x_parentScheduleId && (
              <div>Schedule: <span className="font-mono text-gray-700">{job.x_parentScheduleId}</span></div>
            )}
            {job.description && (
              <div className="col-span-2">Note: <span className="text-gray-700">{job.description}</span></div>
            )}
          </div>
        </div>
      )}
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
  schedule: BatchSchedule;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const successRate = schedule.totalExecutions > 0
    ? Math.round((schedule.successfulExecutions / schedule.totalExecutions) * 100)
    : 0;

  return (
    <div className={cn(
      'border rounded-xl p-4 transition-all',
      schedule.isActive
        ? 'border-violet-300 bg-violet-50/50'
        : 'border-gray-200 bg-gray-50/50 opacity-60'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{'\uD83D\uDCC5'}</span>
            <h4 className="font-semibold text-gray-900">{schedule.name}</h4>
            {schedule.isActive ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Active</span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">Paused</span>
            )}
          </div>
          {schedule.description && (
            <p className="text-sm text-gray-500 mt-1">{schedule.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggle} className={cn(
            'p-1.5 rounded-lg transition-colors',
            schedule.isActive ? 'hover:bg-amber-100 text-amber-600' : 'hover:bg-emerald-100 text-emerald-600'
          )} title={schedule.isActive ? 'Pause' : 'Activate'}>
            {schedule.isActive ? '\u23F8\uFE0F' : '\u25B6\uFE0F'}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Edit">{'\u270F\uFE0F'}</button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500" title="Delete">{'\uD83D\uDDD1\uFE0F'}</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-500">Pattern</div>
          <div className="font-medium text-gray-700">{getRecurrenceLabel(schedule.recurrencePattern, schedule.recurrenceDays)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Window</div>
          <div className="font-medium text-gray-700">{formatTime(schedule.windowStartTime)} - {formatTime(schedule.windowEndTime)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Max Batch</div>
          <div className="font-medium text-gray-700">{schedule.maxBatchSize} solutions</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Success Rate</div>
          <div className="font-medium text-gray-700">{successRate}% ({schedule.successfulExecutions}/{schedule.totalExecutions})</div>
        </div>
      </div>

      {schedule.isActive && schedule.nextExecutionDate && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-violet-600">
              <span>{'\u23F0'}</span>
              <span>Next: {formatDate(schedule.nextExecutionDate)}</span>
            </div>
            {schedule.lastExecutionDate && (
              <span className="text-gray-500">Last: {formatDate(schedule.lastExecutionDate)}</span>
            )}
          </div>
        </div>
      )}
    </div>
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
  schedule?: BatchSchedule;
  category: string;
  useCase: string;
  onSave: (data: Partial<BatchSchedule>) => void;
  onClose: () => void;
}) {
  const isEdit = !!schedule;
  const [name, setName] = useState(schedule?.name || `${useCase} Nightly Batch`);
  const [description, setDescription] = useState(schedule?.description || '');
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>(schedule?.recurrencePattern || 'daily');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(schedule?.recurrenceDays || [1, 2, 3, 4, 5]);
  const [windowStartTime, setWindowStartTime] = useState(schedule?.windowStartTime || '00:00');
  const [windowEndTime, setWindowEndTime] = useState(schedule?.windowEndTime || '06:00');
  const [maxBatchSize, setMaxBatchSize] = useState(schedule?.maxBatchSize || 100);

  const handleSubmit = () => {
    onSave({
      name,
      description,
      category,
      recurrencePattern,
      recurrenceDays: recurrencePattern === 'weekly' ? recurrenceDays : undefined,
      windowStartTime,
      windowEndTime,
      maxBatchSize,
      selectionCriteria: { remediationState: 'DETECTED', useCase },
    });
  };

  const toggleDay = (day: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Schedule' : 'Create Batch Schedule'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recurrence Pattern</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['once', 'daily', 'weekdays', 'weekly'] as RecurrencePattern[]).map((p) => (
                <button key={p} type="button" onClick={() => setRecurrencePattern(p)}
                  className={cn('px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                    recurrencePattern === p ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 hover:border-gray-300')}>
                  {p === 'once' ? 'One-time' : p === 'daily' ? 'Daily' : p === 'weekdays' ? 'Weekdays' : 'Weekly'}
                </button>
              ))}
            </div>
          </div>
          {recurrencePattern === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Days</label>
              <div className="flex gap-1">
                {WEEKDAYS.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => toggleDay(value)}
                    className={cn('flex-1 py-2 text-xs font-medium rounded-lg border transition-all',
                      recurrenceDays.includes(value) ? 'border-violet-500 bg-violet-500 text-white' : 'border-gray-200 hover:border-gray-300')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {recurrencePattern !== 'once' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Execution Window</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                  <input type="time" value={windowStartTime} onChange={(e) => setWindowStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Time</label>
                  <input type="time" value={windowEndTime} onChange={(e) => setWindowEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Batch Size</label>
            <div className="flex gap-2">
              {[50, 100, 200, 500].map((size) => (
                <button key={size} type="button" onClick={() => setMaxBatchSize(size)}
                  className={cn('flex-1 py-2 text-sm font-medium rounded-lg border transition-all',
                    maxBatchSize === size ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200')}>
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg">
            {isEdit ? 'Save Changes' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main BatchScheduler Component
// =============================================================================

export function BatchScheduler({ category, useCase, onScheduleCreated, onImmediateStart }: BatchSchedulerProps) {
  const [schedules, setSchedules] = useState<BatchSchedule[]>([]);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BatchSchedule | undefined>();
  const [expandedSection, setExpandedSection] = useState<'schedules' | 'history' | 'both'>('both');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobsLimit, setJobsLimit] = useState(10);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch schedules
      try {
        const res = await fetch(API.schedules(category));
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.id ? [data] : []);
          setSchedules(list);
        }
      } catch { setSchedules([]); }

      // Fetch jobs
      try {
        const res = await fetch(API.jobs({ category, limit: String(jobsLimit) }));
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.id ? [data] : []);
          // Sort by creation date descending (most recent first)
          list.sort((a: BatchJob, b: BatchJob) =>
            new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
          );
          setJobs(list);
        }
      } catch { setJobs([]); }
    } finally {
      setLoading(false);
    }
  }, [category, jobsLimit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveSchedule = async (data: Partial<BatchSchedule>) => {
    try {
      const url = editingSchedule ? API.schedule(editingSchedule.id) : API.schedules();
      const method = editingSchedule ? 'PATCH' : 'POST';

      const payload = {
        ...data,
        id: editingSchedule?.id || `sched-${Date.now()}`,
        isActive: true,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        selectionCriteria: typeof data.selectionCriteria === 'object'
          ? JSON.stringify(data.selectionCriteria)
          : data.selectionCriteria,
        nextExecutionDate: new Date().toISOString(),
        creationDate: new Date().toISOString(),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchData(); // Refresh all data
        const saved = await res.json().catch(() => payload);
        if (!editingSchedule) onScheduleCreated?.(saved as BatchSchedule);
      } else {
        const err = await res.text();
        console.error('[BatchScheduler] Save failed:', res.status, err);
        alert(`Failed to save schedule: ${res.status}`);
      }
    } catch (error) {
      console.error('[BatchScheduler] Error saving:', error);
      alert('Error saving schedule');
    } finally {
      setShowCreateModal(false);
      setEditingSchedule(undefined);
    }
  };

  const handleToggleSchedule = async (schedule: BatchSchedule) => {
    try {
      await fetch(API.schedule(schedule.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !schedule.isActive }),
      });
      setSchedules((prev) => prev.map((s) => s.id === schedule.id ? { ...s, isActive: !s.isActive } : s));
    } catch (e) { console.error(e); }
  };

  const handleDeleteSchedule = async (schedule: BatchSchedule) => {
    if (!confirm(`Delete schedule "${schedule.name}"?`)) return;
    try {
      await fetch(API.schedule(schedule.id), { method: 'DELETE' });
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (e) { console.error(e); }
  };

  const handleRunNow = async (batchSize: number = 50) => {
    try {
      await fetch(API.jobs(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Immediate ${useCase} Batch`,
          category,
          requestedQuantity: batchSize,
          x_isRecurrent: false,
        }),
      });
      onImmediateStart?.({ batchSize });
      // Refresh after a short delay to see the new job
      setTimeout(fetchData, 1000);
    } catch (e) { console.error(e); }
  };

  const activeSchedules = schedules.filter((s) => s.isActive);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">{'\uD83D\uDCC5'}</span>
          <span className="font-semibold text-gray-900">Batch Processing</span>
          {activeSchedules.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full">
              {activeSchedules.length} active
            </span>
          )}
          {jobs.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              {jobs.length} jobs
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData()}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-sm" title="Refresh">
            {'\uD83D\uDD04'}
          </button>
          <button onClick={() => handleRunNow(50)}
            className="px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
            Run Now
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg">
            + New Schedule
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="animate-spin text-2xl">{'\u23F3'}</span>
        </div>
      ) : (
        <div>
          {/* Schedules section */}
          <div className="p-4">
            <button onClick={() => setExpandedSection(s => s === 'schedules' ? 'both' : s === 'both' ? 'history' : 'both')}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-violet-600 mb-3">
              <span>{expandedSection !== 'history' ? '\u25BC' : '\u25B6'}</span>
              Schedules ({schedules.length})
            </button>

            {expandedSection !== 'history' && (
              <div className="space-y-3">
                {schedules.length > 0 ? (
                  schedules.map((schedule) => (
                    <ScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      onEdit={() => { setEditingSchedule(schedule); setShowCreateModal(true); }}
                      onToggle={() => handleToggleSchedule(schedule)}
                      onDelete={() => handleDeleteSchedule(schedule)}
                    />
                  ))
                ) : (
                  <div className="text-center py-6 border border-dashed border-gray-300 rounded-xl">
                    <p className="text-gray-500">No schedules configured</p>
                    <button onClick={() => setShowCreateModal(true)}
                      className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-700">
                      + Create First Schedule
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Execution History section */}
          <div className="border-t border-gray-100 p-4">
            <button onClick={() => setExpandedSection(s => s === 'history' ? 'both' : s === 'both' ? 'schedules' : 'both')}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-violet-600 mb-3">
              <span>{expandedSection !== 'schedules' ? '\u25BC' : '\u25B6'}</span>
              Execution History ({jobs.length})
            </button>

            {expandedSection !== 'schedules' && (
              <div className="space-y-2">
                {jobs.length > 0 ? (
                  <>
                    {jobs.map((job) => (
                      <BatchJobCard
                        key={job.id}
                        job={job}
                        expanded={expandedJobId === job.id}
                        onToggle={() => setExpandedJobId(prev => prev === job.id ? null : job.id)}
                      />
                    ))}
                    {jobs.length >= jobsLimit && (
                      <button onClick={() => setJobsLimit((prev) => prev + 20)}
                        className="w-full py-2 text-sm font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors">
                        Load more...
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    No batch executions yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <ScheduleModal
          schedule={editingSchedule}
          category={category}
          useCase={useCase}
          onSave={handleSaveSchedule}
          onClose={() => { setShowCreateModal(false); setEditingSchedule(undefined); }}
        />
      )}
    </div>
  );
}

export default BatchScheduler;
