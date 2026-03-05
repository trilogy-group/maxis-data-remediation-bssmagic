// Shared types for build stream functionality
// This file breaks the circular dependency between buildStreamStore.ts and AIBuilder.tsx

// Core message interface
export interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// Extended App interface to match AppResponse model
export interface App {
  id: string;
  name: string;
  slug: string;
  description?: string;
  app_type: string;
  framework?: string;
  working_directory: string;
  repository_url?: string;
  dev_port?: number;
  dev_server_running: boolean;
  dev_server_url?: string;
  status: string;
  deployment_url?: string;
  locked?: boolean;
  version: string;
  created_at: string;
  updated_at: string;
  last_built_at?: string;
  has_brd: boolean;
  has_prd: boolean;
  has_eng_specs: boolean;
  has_codebase: boolean;
  has_results: boolean;
  latest_result?: any;
}

// Build session and log interfaces
export interface BuildSessionResponse {
  id: string;
  app_id: string;
  claude_session_id?: string;
  requirements: string;
  working_dir: string;
  status: string;
  build_status?: string;
  success: boolean;
  cost_usd?: number;
  output?: string;
  error?: string;
  exit_code?: number;
  result?: any; // Large JSON result data
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface SessionLogResponse {
  id: string;
  session_id: string;
  sequence_number: number;
  log_data: any;
  log_type?: string;
  log_level?: string;
  message?: string;
  timestamp: string;
}

// Build stream configuration
export interface BuildStreamConfig {
  sessionId?: string;
  selectedApp?: App | null;
  workingDir?: string;
  apiEndpoint?: string;
  customPayload?: Record<string, any>;
  processorType?: 'app-builder' | 'process-completer';
  customSessionId?: string;
}

// Process Result interface for result retrieval
export interface ProcessResult {
  session_id: string;
  app_id: string;
  app_name: string;
  app_slug: string;
  status: string;
  success: boolean;
  result: any;
  result_size_bytes: number;
  cost_usd: number;
  created_at: string;
  completed_at: string;
}

// File upload types
export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  uploadProgress: number;
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export type UploadState = 'idle' | 'uploading' | 'completed' | 'error';

// Extended upload state for UI components that expect an object
export interface UploadStateObject {
  files: UploadFile[];
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

// Build stream state interface (legacy)
export interface BuildStreamState {
  sessionId: string | null;
  messages: Message[];
  isBuilding: boolean;
  selectedApp: App | null;
  error: string | null;
  processorType?: 'app-builder' | 'process-completer';
  uploadState: UploadState;
  toolExecutionOutline?: any[];
}

// Build stream hook interface
export interface BuildStreamHook {
  // State
  streams: Record<string, BuildStreamState>;
  activeStreamId: string | null;
  
  // Stream management
  createStream: (streamId: string, config?: Partial<BuildStreamConfig>) => void;
  switchStream: (streamId: string) => void;
  removeStream: (streamId: string) => void;
  
  // Current stream operations
  sendMessage: (message: string, config?: BuildStreamConfig) => Promise<void>;
  updateMessages: (messages: Message[]) => void;
  setSelectedApp: (app: App | null) => void;
  
  // File upload operations
  addFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  uploadFiles: (appName?: string, appType?: string, workingDir?: string) => Promise<{ success: boolean; app?: App; error?: string }>;
  
  // Process result retrieval
  getProcessResult: (sessionId: string, apiEndpoint?: string) => Promise<ProcessResult | null>;
  
  // Current stream state
  currentStream: BuildStreamState | null;
}