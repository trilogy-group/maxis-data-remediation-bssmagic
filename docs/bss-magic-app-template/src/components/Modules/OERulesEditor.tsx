import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
  Database,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useOERulesConfig,
  useSaveOERulesConfig,
  useAvailableFields,
} from '../../services/gateways/hooks';
import type { OERulesConfig } from '../../services/salesforce/client';

interface OERulesEditorProps {
  onClose: () => void;
}

export function OERulesEditor({ onClose }: OERulesEditorProps) {
  const { data: config, isLoading: isLoadingConfig } = useOERulesConfig();
  const { data: availableFields, isLoading: isLoadingFields, refetch: refetchFields } = useAvailableFields();
  const saveMutation = useSaveOERulesConfig();

  const [editorContent, setEditorContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (config && !isDirty) {
      setEditorContent(JSON.stringify(config, null, 2));
    }
  }, [config, isDirty]);

  const handleContentChange = useCallback((value: string) => {
    setEditorContent(value);
    setIsDirty(true);
    try {
      JSON.parse(value);
      setValidationError(null);
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, []);

  const handleSave = useCallback(() => {
    try {
      const parsed = JSON.parse(editorContent) as OERulesConfig;
      if (!parsed.service_types || typeof parsed.service_types !== 'object') {
        setValidationError('Missing "service_types" object');
        return;
      }
      saveMutation.mutate(parsed, {
        onSuccess: () => {
          setIsDirty(false);
          setValidationError(null);
        },
        onError: (err) => {
          setValidationError(`Save failed: ${err.message}`);
        },
      });
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [editorContent, saveMutation]);

  const handleReset = useCallback(() => {
    if (config) {
      setEditorContent(JSON.stringify(config, null, 2));
      setIsDirty(false);
      setValidationError(null);
    }
  }, [config]);

  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = editorContent.substring(0, start);
    const after = editorContent.substring(end);
    const newContent = before + `"${text}"` + after;
    setEditorContent(newContent);
    setIsDirty(true);
    try {
      JSON.parse(newContent);
      setValidationError(null);
    } catch {}
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length + 2;
    }, 0);
  }, [editorContent]);

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">OE Rules Configuration</h3>
          {isDirty && (
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[10px] font-medium">
              Unsaved changes
            </span>
          )}
          {saveMutation.isSuccess && !isDirty && (
            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          Close
        </button>
      </div>

      <div className="flex" style={{ height: '500px' }}>
        {/* Left: JSON Editor */}
        <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700">
          {isLoadingConfig ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-slate-500">Loading configuration...</span>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={editorContent}
              onChange={(e) => handleContentChange(e.target.value)}
              className="flex-1 p-4 font-mono text-xs leading-relaxed bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 resize-none focus:outline-none border-none"
              spellCheck={false}
              wrap="off"
            />
          )}

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs">
              {validationError ? (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                  {validationError.length > 60 ? validationError.slice(0, 60) + '...' : validationError}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Valid JSON
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={!isDirty}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={!!validationError || saveMutation.isPending || !isDirty}
                className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                Save & Reload
              </button>
            </div>
          </div>
        </div>

        {/* Right: Available Fields sidebar */}
        <div className="w-64 flex flex-col bg-slate-50 dark:bg-slate-900">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Available Fields</span>
              </div>
              <button
                onClick={() => refetchFields()}
                disabled={isLoadingFields}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                title="Refresh fields from TMF API"
              >
                {isLoadingFields ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Click to insert at cursor position</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingFields ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Service View Fields ({availableFields?.serviceFields.length ?? 0})
                </div>
                {availableFields?.serviceFields.map((field) => (
                  <button
                    key={field}
                    onClick={() => insertAtCursor(`service.${field}`)}
                    className="w-full text-left px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors flex items-center gap-1.5 group"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    <span className="text-indigo-600 dark:text-indigo-400">service.</span>{field}
                  </button>
                ))}

                <div className="px-2 py-1 mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Related Entities (Level 2)
                </div>
                {['billingAccount.name', 'billingAccount.id', 'individual.contactMedium'].map((path) => (
                  <button
                    key={path}
                    onClick={() => insertAtCursor(path)}
                    className="w-full text-left px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors flex items-center gap-1.5 group"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    <span className="text-violet-600 dark:text-violet-400">{path.split('.')[0]}.</span>{path.split('.').slice(1).join('.')}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400">
            Source: {availableFields?.source ?? 'TMF API'}
          </div>
        </div>
      </div>
    </div>
  );
}
