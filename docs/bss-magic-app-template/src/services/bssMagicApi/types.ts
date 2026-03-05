// BSS Magic API Types
// Generated from OpenAPI specification

// Base API types
export interface ApiInfo {
  service: string;
  version: string;
  description?: string;
  documentation?: string;
  health?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  service: string;
  version: string;
  database?: {
    type: string;
    connected: boolean;
  };
}

// Project types
export interface Project {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'draft';
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  slug: string; // Pattern: ^[a-z0-9-]+$
  name: string;
  description?: string;
  status?: 'active' | 'archived' | 'draft';
  initialize_templates?: boolean;
  metadata?: Record<string, any>;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: string;
  metadata?: Record<string, any>;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  limit: number;
  offset: number;
}

// BRD types
export interface BRD {
  id: string;
  project_id?: string;
  title: string;
  version?: string;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'deprecated' | 'archived';
  content?: Record<string, any>;
  business_objectives?: Record<string, any>;
  success_criteria?: Record<string, any>;
  revenue_impact?: Record<string, any>;
  regulatory_requirements?: string[];
  etom_processes?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

export interface BRDCreate {
  project_id?: string;
  title: string;
  version?: string;
  status?: string;
  content?: Record<string, any>;
  business_objectives?: Record<string, any>;
  priority?: string;
}

export interface BRDUpdate {
  title?: string;
  status?: string;
  content?: Record<string, any>;
  priority?: string;
}

export interface BRDListResponse {
  items: BRD[];
  total: number;
  limit: number;
  offset: number;
}

// PRD types
export interface PRD {
  id: string;
  parent_brd_id?: string;
  project_id?: string;
  title: string;
  version?: string;
  status?: string;
  content?: Record<string, any>;
  features?: any[];
  acceptance_criteria?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

export interface PRDListResponse {
  items: PRD[];
  total: number;
  limit: number;
  offset: number;
}

// Engineering Spec types
export interface EngineeringSpec {
  id: string;
  parent_prd_id?: string;
  project_id?: string;
  title: string;
  version?: string;
  status?: 'not_started' | 'in_progress' | 'in_review' | 'completed' | 'done' | 'deployed';
  content?: Record<string, any>;
  technical_design?: Record<string, any>;
  implementation_details?: Record<string, any>;
  testing_strategy?: Record<string, any>;
  sprint_allocation?: string;
  story_points?: number;
  created_at: string;
  updated_at: string;
}

export interface EngineeringSpecListResponse {
  items: EngineeringSpec[];
  total: number;
  limit: number;
  offset: number;
}

// Workflow types
export interface Workflow {
  id: string;
  title: string;
  description?: string;
  journey_ids?: string[];
  brd_ids?: string[];
  engg_spec_ids?: string[];
  content?: Record<string, any>; // Workflow steps and configuration
  created_at: string;
  updated_at: string;
}

export interface WorkflowCreate {
  title: string;
  description?: string;
  journey_ids?: string[];
  brd_ids?: string[];
  engg_spec_ids?: string[];
  content?: Record<string, any>;
}

export interface WorkflowUpdate {
  title?: string;
  description?: string;
  journey_ids?: string[];
  brd_ids?: string[];
  engg_spec_ids?: string[];
  content?: Record<string, any>;
}

export interface WorkflowListResponse {
  items: Workflow[];
  total: number;
  limit: number;
  offset: number;
}

// Pipeline types
export interface HydrationEntity {
  api_name: string;
  entity_name: string;
}

export interface Pipeline {
  id: string;
  title: string;
  description?: string;
  journey_ids?: string[];
  brd_ids?: string[];
  engg_spec_ids?: string[];
  content?: Record<string, any>; // Pipeline stages and configuration
  hydration_entities: HydrationEntity[];
  hydration_pipeline: boolean;
  etl_script?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineCreate {
  title: string;
  description?: string;
  journey_ids?: string[];
  brd_ids?: string[];
  engg_spec_ids?: string[];
  content?: Record<string, any>;
  hydration_entities?: HydrationEntity[];
  hydration_pipeline?: boolean;
  etl_script?: string | null;
}

export interface PipelineUpdate {
  title?: string;
  description?: string;
  journey_ids?: string[];
  brd_ids?: string[];
  engg_spec_ids?: string[];
  content?: Record<string, any>;
  hydration_entities?: HydrationEntity[];
  hydration_pipeline?: boolean;
  etl_script?: string | null;
}

export interface PipelineListResponse {
  items: Pipeline[];
  total: number;
  limit: number;
  offset: number;
}

// Journey types
export interface Journey {
  id: string;
  project_id: string;
  folder_id: string;
  name: string;
  description?: string;
  structure?: Record<string, any>; // Flexible JSON for journey definitions
  noun_verb_view?: Record<string, any>; // Noun-verb view data
  prds?: string[]; // Links to PRDs
  engineering_specs?: string[]; // Links to Engineering Specs
  repository_url?: string; // GitHub repository URL
  created_at: string;
  updated_at: string;
}

export interface JourneyCreate {
  name: string;
  description?: string;
  structure?: Record<string, any>;
  noun_verb_view?: Record<string, any>;
  repository_url?: string;
}

export interface JourneyUpdate {
  name?: string;
  description?: string;
  structure?: Record<string, any>;
  noun_verb_view?: Record<string, any>;
  repository_url?: string;
}

export interface JourneyListResponse {
  items: Journey[];
  total: number;
  limit: number;
  offset: number;
}

// Query parameters
export interface ListParams {
  limit?: number; // 1-1000, default: 50
  offset?: number; // min: 0, default: 0
  sort?: string; // e.g., 'created_at:desc' or '-created_at'
}

export interface ProjectListParams extends ListParams {
  'filter[status]'?: string;
  'filter[name]'?: string;
}

export interface BRDListParams extends ListParams {
  'filter[status]'?: 'draft' | 'in_review' | 'approved' | 'published' | 'deprecated' | 'archived';
  'filter[priority]'?: 'low' | 'medium' | 'high' | 'critical';
  'filter[project_id]'?: string;
}

export interface PRDListParams extends ListParams {
  'filter[status]'?: string;
  'filter[priority]'?: 'low' | 'medium' | 'high' | 'critical';
  'filter[parent_brd_id]'?: string;
}

export interface EngineeringSpecListParams extends ListParams {
  'filter[status]'?: 'not_started' | 'in_progress' | 'in_review' | 'completed' | 'done' | 'deployed';
  'filter[sprint_allocation]'?: string;
  'filter[project_id]'?: string;
}

export interface JourneyListParams extends ListParams {
  'filter[name]'?: string;
}

export interface WorkflowListParams extends ListParams {
  // No specific filters defined in API spec, just pagination
}

export interface PipelineListParams extends ListParams {
  entity_name?: string; // Filter by hydration_entities.entity_name
}

// Workflow Execution types
export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_title?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input_params?: Record<string, any>;
  output?: Record<string, any>;
  tags?: string[];
  error_message?: string;
  // Optional rich error details from backend
  error_details?: any;
  // Optional logs array emitted by the workflow engine per block/step
  execution_logs?: ExecutionLog[];
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
}

// Execution log entry as returned by workflows API
export interface ExecutionLog {
  message: string;
  timestamp: string; // ISO string
  stepId?: string; // e.g., 'cellperf-1', 'respond-1', 'trigger-1'
  level?: 'info' | 'warn' | 'error' | string;
}

export interface WorkflowExecutionCreate {
  workflow_id: string;
  input_params?: Record<string, any>;
  tags?: string[];
}

export interface WorkflowExecutionUpdate {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  output?: Record<string, any>;
  tags?: string[];
  error_message?: string;
}

export interface WorkflowExecutionListResponse {
  items: WorkflowExecution[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkflowExecutionListParams extends ListParams {
  workflow_id?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

// Pipeline Execution types
export interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  output?: Record<string, any>;
  error_message?: string;
}

export interface PipelineExecution {
  id: string;
  pipeline_id: string;
  pipeline_title?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input_params?: Record<string, any>;
  output?: Record<string, any>;
  tags?: string[];
  stages?: PipelineStage[];
  current_stage?: string;
  completed_stages?: number;
  total_stages?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineExecutionCreate {
  pipeline_id: string;
  input_params?: Record<string, any>;
  tags?: string[];
}

export interface PipelineExecutionUpdate {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  output?: Record<string, any>;
  tags?: string[];
  stages?: PipelineStage[];
  current_stage?: string;
  completed_stages?: number;
  error_message?: string;
}

export interface PipelineExecutionListResponse {
  items: PipelineExecution[];
  total: number;
  limit: number;
  offset: number;
}

export interface PipelineExecutionListParams extends ListParams {
  pipeline_id?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

// App types
export interface App {
  id: string;
  name: string;
  slug: string;
  description?: string;
  app_type: string;
  framework?: string;
  repository_url?: string;
  dev_port?: number;
  dev_server_running: boolean;
  dev_server_url?: string;
  status: string;
  deployment_url?: string;
  locked: boolean;
  version: string;
  metadata_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_built_at?: string;
}

export interface AppCreate {
  name: string;
  slug: string;
  description?: string;
  app_type?: string;
  framework?: string;
  repository_url?: string;
  dev_port?: number;
  metadata_json?: Record<string, any>;
}

export interface AppUpdate {
  name?: string;
  slug?: string;
  description?: string;
  app_type?: string;
  framework?: string;
  repository_url?: string;
  dev_port?: number;
  dev_server_running?: boolean;
  dev_server_url?: string;
  status?: string;
  deployment_url?: string;
  locked?: boolean;
  version?: string;
  metadata_json?: Record<string, any>;
  last_built_at?: string;
}

export interface AppListResponse {
  items: App[];
  total: number;
  limit: number;
  offset: number;
}

export interface AppListParams extends ListParams {
  status?: string;
  app_type?: string;
}

// App Workspace types
export interface AppWorkspaceFile {
  path: string;
  size_bytes: number;
}

export interface AppWorkspaceFilesResponse {
  success: boolean;
  app_slug: string;
  app_name: string;
  working_directory: string;
  total_files: number;
  total_size_bytes: number;
  files: AppWorkspaceFile[];
  excluded_patterns: string[];
}

export interface AppFileContent {
  path: string;
  size_bytes: number;
  content: string;
  content_available: boolean;
  content_type?: 'text' | 'binary' | 'too_large';
  encoding?: string;
  reason?: string;
}

export interface AppFileContentsResponse {
  success: boolean;
  app_slug: string;
  app_name: string;
  working_directory: string;
  requested_files: string[];
  retrieved_files: number;
  files: AppFileContent[];
  errors: string[];
}

export interface AppWorkspaceInitResponse {
  success: boolean;
  app_id: string;
  app_slug: string;
  message: string;
  working_directory: string;
  source: 'repository' | 'template' | 'empty';
  files_count?: number;
}

// Error response
export interface ApiError {
  detail: string;
  status_code: number;
  type?: string;
}

// DecisionTrace types (append-only - no update or delete)
export interface DecisionTrace {
  id: string;
  trace_id: string;
  decision_name: string;
  timestamp: string;
  journey_id?: string;
  action_taken?: string;
  applied_knowledge_nodes?: string[];
  fact_refs?: string[];
  entity_refs?: string[];
  confidence_at_decision?: number;
  explanation_summary?: string;
  outcome?: 'success' | 'failure' | 'pending';
  additional_metadata?: Record<string, any>;
  created_at: string;
}

export interface DecisionTraceCreate {
  decision_name: string;
  timestamp: string;
  trace_id?: string;
  journey_id?: string;
  action_taken?: string;
  applied_knowledge_nodes?: string[];
  fact_refs?: string[];
  entity_refs?: string[];
  confidence_at_decision?: number;
  explanation_summary?: string;
  outcome?: 'success' | 'failure' | 'pending';
  additional_metadata?: Record<string, any>;
}

export interface DecisionTraceListResponse {
  items: DecisionTrace[];
  total: number;
  limit: number;
  offset: number;
}

export interface DecisionTraceListParams extends ListParams {
  journey_id?: string;
  outcome?: 'success' | 'failure' | 'pending';
  decision_name?: string;
  start_date?: string;
  end_date?: string;
}

// Dashboard types
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  a2ui_json: Record<string, any>; // A2UI component tree JSON
  thumbnail_url?: string;
  tags?: string[];
  is_public: boolean;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardListItem {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  tags?: string[];
  is_public: boolean;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardCreate {
  name: string;
  description?: string;
  a2ui_json: Record<string, any>;
  tags?: string[];
  is_public?: boolean;
}

export interface DashboardUpdate {
  name?: string;
  description?: string;
  tags?: string[];
  is_public?: boolean;
}

export interface DashboardListResponse {
  items: DashboardListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardListParams extends ListParams {
  search?: string;
  created_by?: string;
}

// API configuration
export interface BSSMagicApiConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  // Note: Authentication is handled via Cognito tokens, not API keys
}
