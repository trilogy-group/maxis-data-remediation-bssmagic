// BSS Magic API Client
// Main API client for interacting with the BSS Magic backend

import {
  ApiInfo,
  HealthStatus,
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectListResponse,
  ProjectListParams,
  BRD,
  BRDCreate,
  BRDUpdate,
  BRDListResponse,
  BRDListParams,
  PRD,
  PRDListResponse,
  PRDListParams,
  EngineeringSpec,
  EngineeringSpecListResponse,
  EngineeringSpecListParams,
  Journey,
  JourneyCreate,
  JourneyUpdate,
  JourneyListResponse,
  JourneyListParams,
  Workflow,
  WorkflowCreate,
  WorkflowUpdate,
  WorkflowListResponse,
  WorkflowListParams,
  Pipeline,
  PipelineCreate,
  PipelineUpdate,
  PipelineListResponse,
  PipelineListParams,
  WorkflowExecution,
  WorkflowExecutionCreate,
  WorkflowExecutionUpdate,
  WorkflowExecutionListResponse,
  WorkflowExecutionListParams,
  PipelineExecution,
  PipelineExecutionCreate,
  PipelineExecutionUpdate,
  PipelineExecutionListResponse,
  PipelineExecutionListParams,
  App,
  AppCreate,
  AppUpdate,
  AppListResponse,
  AppListParams,
  AppWorkspaceFilesResponse,
  AppFileContentsResponse,
  AppWorkspaceInitResponse,
  DecisionTrace,
  DecisionTraceCreate,
  DecisionTraceListResponse,
  DecisionTraceListParams,
  Dashboard,
  DashboardCreate,
  DashboardUpdate,
  DashboardListResponse,
  DashboardListParams,
  ApiError,
  BSSMagicApiConfig
} from './types';
import { getAuthHeaders } from '../auth/authHeaders';

/**
 * BSS Magic API Client
 * Provides methods for interacting with the BSS Magic backend API
 */
export class BSSMagicApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config?: Partial<BSSMagicApiConfig>) {
    // Get base URL from environment or use fallback
    // Support both Vite (import.meta.env) and Node.js (process.env)
    let envUrl: string | undefined;

    // Check Node.js process.env first (for seed scripts)
    if (typeof process !== 'undefined' && process.env) {
      envUrl = process.env.VITE_BSS_MAGIC_API_URL;
    }

    // Fallback to Vite import.meta.env (for browser/Vite)
    if (!envUrl && typeof import.meta !== 'undefined' && import.meta.env) {
      envUrl = import.meta.env.VITE_BSS_MAGIC_API_URL;
    }

    this.baseUrl =
      config?.baseUrl ||
      envUrl ||
      'https://adapters.bss-magic.totogi.solutions';

    // Remove trailing slash if present
    this.baseUrl = this.baseUrl.replace(/\/$/, '');

    // Set default headers
    this.headers = {
      'Content-Type': 'application/json',
      ...config?.headers
    };

    // Note: Authorization header will be added dynamically from Cognito token
    // in getHeaders() method
  }

  /**
   * Get headers with current auth token
   */
  private getHeaders(): Record<string, string> {
    // Get Cognito ID token
    const authHeaders = getAuthHeaders();

    // Merge with base headers, Cognito token takes precedence
    return {
      ...this.headers,
      ...authHeaders
    };
  }

  /**
   * Helper method to handle API responses
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Helper method to build query string from parameters
   */
  private buildQueryString(params?: Record<string, any>): string {
    if (!params) return '';

    const queryParts: string[] = [];
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    });

    return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  }

  // ============ Health Endpoints ============

  /**
   * Get API information
   */
  async getApiInfo(): Promise<ApiInfo> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<ApiInfo>(response);
  }

  /**
   * Check API health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/health`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<HealthStatus>(response);
  }

  // ============ Project Endpoints ============

  /**
   * List all projects with optional filters
   */
  async listProjects(params?: ProjectListParams): Promise<ProjectListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/projects${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<ProjectListResponse>(response);
  }

  /**
   * Create a new project
   */
  async createProject(project: ProjectCreate): Promise<Project> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/projects`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(project)
    });
    return this.handleResponse<Project>(response);
  }

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<Project> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<Project>(response);
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, update: ProjectUpdate): Promise<Project> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<Project>(response);
  }

  /**
   * Delete a project (only if no folders exist)
   */
  async deleteProject(projectId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete project: ${response.status}`);
    }
  }

  // ============ Journey Endpoints ============

  /**
   * List all journeys for a project (across all folders)
   */
  async listProjectJourneys(projectId: string, params?: JourneyListParams): Promise<JourneyListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}/journeys${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<JourneyListResponse>(response);
  }

  async getProjectJourney(projectId: string, journeyId: string): Promise<Journey> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}/journeys/${journeyId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<Journey>(response);
  }

  /**
   * Create a journey at the project level (BSS journeys - no folder required)
   */
  async createProjectJourney(projectId: string, journey: JourneyCreate): Promise<Journey> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}/journeys`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(journey)
    });
    return this.handleResponse<Journey>(response);
  }

  /**
   * Update a journey at the project level (BSS journeys - no folder required)
   */
  async updateProjectJourney(projectId: string, journeyId: string, update: JourneyUpdate): Promise<Journey> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}/journeys/${journeyId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<Journey>(response);
  }

  /**
   * List journeys in a folder
   */
  async listJourneys(projectId: string, folderId: string, params?: JourneyListParams): Promise<JourneyListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(
      `${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}/folders/${folderId}/journeys${queryString}`,
      {
        method: 'GET',
        headers: this.getHeaders()
      }
    );
    return this.handleResponse<JourneyListResponse>(response);
  }

  /**
   * Create a journey in a folder
   */
  async createJourney(projectId: string, folderId: string, journey: JourneyCreate): Promise<Journey> {
    const response = await fetch(
      `${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}/folders/${folderId}/journeys`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(journey)
      }
    );
    return this.handleResponse<Journey>(response);
  }

  /**
   * Get a specific journey
   */
  async getJourney(projectId: string, folderId: string, journeyId: string): Promise<Journey> {
    const response = await fetch(
      `${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}/folders/${folderId}/journeys/${journeyId}`,
      {
        method: 'GET',
        headers: this.getHeaders()
      }
    );
    return this.handleResponse<Journey>(response);
  }

  /**
   * Update a journey
   */
  async updateJourney(projectId: string, folderId: string, journeyId: string, update: JourneyUpdate): Promise<Journey> {
    const response = await fetch(
      `${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}/folders/${folderId}/journeys/${journeyId}`,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(update)
      }
    );
    return this.handleResponse<Journey>(response);
  }

  /**
   * Delete a journey
   */
  async deleteJourney(projectId: string, folderId: string, journeyId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/bss-magic-api/api/v1/projects/${projectId}/folders/${folderId}/journeys/${journeyId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders()
      }
    );
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete journey: ${response.status}`);
    }
  }

  // ============ BRD Endpoints ============

  /**
   * List all BRDs with optional filters
   */
  async listBRDs(params?: BRDListParams): Promise<BRDListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/brds/${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<BRDListResponse>(response);
  }

  /**
   * Create a new BRD
   */
  async createBRD(brd: BRDCreate): Promise<BRD> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/brds/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(brd)
    });
    return this.handleResponse<BRD>(response);
  }

  /**
   * Get a specific BRD by ID
   */
  async getBRD(brdId: string): Promise<BRD> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/brds/${brdId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<BRD>(response);
  }

  /**
   * Update a BRD
   */
  async updateBRD(brdId: string, update: BRDUpdate): Promise<BRD> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/brds/${brdId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<BRD>(response);
  }

  /**
   * Delete a BRD
   */
  async deleteBRD(brdId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/brds/${brdId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete BRD: ${response.status}`);
    }
  }

  // ============ PRD Endpoints ============

  /**
   * List all PRDs with optional filters
   */
  async listPRDs(params?: PRDListParams): Promise<PRDListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/prds${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<PRDListResponse>(response);
  }

  /**
   * Create a new PRD
   * Note: Full create endpoint not shown in OpenAPI but follows pattern
   */
  async createPRD(prd: Partial<PRD>): Promise<PRD> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/prds`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(prd)
    });
    return this.handleResponse<PRD>(response);
  }

  /**
   * Get a specific PRD by ID
   */
  async getPRD(prdId: string): Promise<PRD> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/prds/${prdId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<PRD>(response);
  }

  /**
   * Update a PRD
   */
  async updatePRD(prdId: string, update: Partial<PRD>): Promise<PRD> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/prds/${prdId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<PRD>(response);
  }

  /**
   * Delete a PRD
   */
  async deletePRD(prdId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/prds/${prdId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete PRD: ${response.status}`);
    }
  }

  // ============ Engineering Spec Endpoints ============

  /**
   * List all Engineering Specs with optional filters
   */
  async listEngineeringSpecs(params?: EngineeringSpecListParams): Promise<EngineeringSpecListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/engineering-specs${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<EngineeringSpecListResponse>(response);
  }

  /**
   * Create a new Engineering Spec
   * Note: Full create endpoint not shown in OpenAPI but follows pattern
   */
  async createEngineeringSpec(spec: Partial<EngineeringSpec>): Promise<EngineeringSpec> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/engineering-specs`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(spec)
    });
    return this.handleResponse<EngineeringSpec>(response);
  }

  /**
   * Get a specific Engineering Spec by ID
   */
  async getEngineeringSpec(specId: string): Promise<EngineeringSpec> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/engineering-specs/${specId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<EngineeringSpec>(response);
  }

  /**
   * Update an Engineering Spec
   */
  async updateEngineeringSpec(specId: string, update: Partial<EngineeringSpec>): Promise<EngineeringSpec> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/engineering-specs/${specId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<EngineeringSpec>(response);
  }

  /**
   * Delete an Engineering Spec
   */
  async deleteEngineeringSpec(specId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/engineering-specs/${specId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete Engineering Spec: ${response.status}`);
    }
  }

  // ============ Workflow Endpoints ============

  /**
   * List all Workflows
   */
  async listWorkflows(params?: WorkflowListParams): Promise<WorkflowListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflows${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<WorkflowListResponse | Workflow[]>(response);
    // Handle both array and object response formats
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        limit: params?.limit || 50,
        offset: params?.offset || 0
      };
    }
    return data;
  }

  /**
   * Create a new Workflow
   */
  async createWorkflow(workflow: WorkflowCreate): Promise<Workflow> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflows`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(workflow)
    });
    return this.handleResponse<Workflow>(response);
  }

  /**
   * Get a specific Workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<Workflow> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflows/${workflowId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<Workflow>(response);
  }

  /**
   * Update a Workflow
   */
  async updateWorkflow(workflowId: string, update: WorkflowUpdate): Promise<Workflow> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<Workflow>(response);
  }

  /**
   * Delete a Workflow
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflows/${workflowId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete Workflow: ${response.status}`);
    }
  }

  // ============ Pipeline Endpoints ============

  /**
   * List all Pipelines
   */
  async listPipelines(params?: PipelineListParams): Promise<PipelineListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipelines${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<PipelineListResponse | Pipeline[]>(response);
    // Handle both array and object response formats
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        limit: params?.limit || 50,
        offset: params?.offset || 0
      };
    }
    return data;
  }

  /**
   * Create a new Pipeline
   */
  async createPipeline(pipeline: PipelineCreate): Promise<Pipeline> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipelines`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(pipeline)
    });
    return this.handleResponse<Pipeline>(response);
  }

  /**
   * Get a specific Pipeline by ID
   */
  async getPipeline(pipelineId: string): Promise<Pipeline> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipelines/${pipelineId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<Pipeline>(response);
  }

  /**
   * Update a Pipeline
   */
  async updatePipeline(pipelineId: string, update: PipelineUpdate): Promise<Pipeline> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipelines/${pipelineId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<Pipeline>(response);
  }

  /**
   * Delete a Pipeline
   */
  async deletePipeline(pipelineId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipelines/${pipelineId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete Pipeline: ${response.status}`);
    }
  }

  // ============ Workflow Execution Endpoints ============

  /**
   * List all Workflow Executions with optional filters
   */
  async listWorkflowExecutions(params?: WorkflowExecutionListParams): Promise<WorkflowExecutionListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflow-executions${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<WorkflowExecutionListResponse | WorkflowExecution[]>(response);
    // Handle both array and object response formats
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        limit: params?.limit || 50,
        offset: params?.offset || 0
      };
    }
    return data;
  }

  /**
   * Create a new Workflow Execution
   */
  async createWorkflowExecution(execution: WorkflowExecutionCreate): Promise<WorkflowExecution> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflow-executions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(execution)
    });
    return this.handleResponse<WorkflowExecution>(response);
  }

  /**
   * Get a specific Workflow Execution by ID
   */
  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflow-executions/${executionId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<WorkflowExecution>(response);
  }

  /**
   * Update a Workflow Execution
   * Note: Using PUT as specified in the API reference
   */
  async updateWorkflowExecution(executionId: string, update: WorkflowExecutionUpdate): Promise<WorkflowExecution> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflow-executions/${executionId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<WorkflowExecution>(response);
  }

  /**
   * Delete a Workflow Execution
   */
  async deleteWorkflowExecution(executionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/workflow-executions/${executionId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete Workflow Execution: ${response.status}`);
    }
  }

  // ============ Pipeline Execution Endpoints ============

  /**
   * List all Pipeline Executions with optional filters
   */
  async listPipelineExecutions(params?: PipelineExecutionListParams): Promise<PipelineExecutionListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipeline-executions${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<PipelineExecutionListResponse | PipelineExecution[]>(response);
    // Handle both array and object response formats
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        limit: params?.limit || 50,
        offset: params?.offset || 0
      };
    }
    return data;
  }

  /**
   * Create a new Pipeline Execution
   */
  async createPipelineExecution(execution: PipelineExecutionCreate): Promise<PipelineExecution> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipeline-executions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(execution)
    });
    return this.handleResponse<PipelineExecution>(response);
  }

  /**
   * Get a specific Pipeline Execution by ID
   * Returns detailed information including stage tracking
   */
  async getPipelineExecution(executionId: string): Promise<PipelineExecution> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipeline-executions/${executionId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<PipelineExecution>(response);
  }

  /**
   * Update a Pipeline Execution
   * Note: Using PUT as specified in the API reference
   */
  async updatePipelineExecution(executionId: string, update: PipelineExecutionUpdate): Promise<PipelineExecution> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipeline-executions/${executionId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<PipelineExecution>(response);
  }

  /**
   * Delete a Pipeline Execution
   */
  async deletePipelineExecution(executionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/pipeline-executions/${executionId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete Pipeline Execution: ${response.status}`);
    }
  }

  // ============ App Endpoints ============

  /**
   * List all Apps with optional filters
   */
  async listApps(params?: AppListParams): Promise<AppListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/apps${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<AppListResponse | App[]>(response);
    // Handle both array and object response formats
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        limit: params?.limit || 50,
        offset: params?.offset || 0
      };
    }
    return data;
  }

  /**
   * Create a new App
   */
  async createApp(app: AppCreate): Promise<App> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/apps`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(app)
    });
    return this.handleResponse<App>(response);
  }

  /**
   * Get a specific App by ID
   */
  async getApp(appId: string): Promise<App> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/apps/${appId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<App>(response);
  }

  /**
   * Get a specific App by slug
   */
  async getAppBySlug(slug: string): Promise<App> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/apps/by-slug/${slug}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<App>(response);
  }

  /**
   * Update an App
   */
  async updateApp(appId: string, update: AppUpdate): Promise<App> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/apps/${appId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<App>(response);
  }

  /**
   * Delete an App
   */
  async deleteApp(appId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/apps/${appId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete App: ${response.status}`);
    }
  }

  /**
   * Update dev server status for an App
   */
  async updateAppDevServer(appId: string, running: boolean, host: string = 'localhost'): Promise<App> {
    const response = await fetch(
      `${this.baseUrl}/bss-magic-api/api/v1/apps/${appId}/update-dev-server?running=${running}&host=${encodeURIComponent(host)}`,
      {
        method: 'POST',
        headers: this.getHeaders()
      }
    );
    return this.handleResponse<App>(response);
  }

  /**
   * List files in an app's workspace
   */
  async listAppFiles(appId: string): Promise<AppWorkspaceFilesResponse> {
    const response = await fetch(
      `${this.baseUrl}/bss-magic-api/api/v1/apps/${appId}/files`,
      {
        method: 'GET',
        headers: this.getHeaders()
      }
    );
    return this.handleResponse<AppWorkspaceFilesResponse>(response);
  }

  /**
   * Get contents of specific files in an app's workspace
   */
  async getAppFileContents(appId: string, files: string[]): Promise<AppFileContentsResponse> {
    const params = new URLSearchParams({ files: files.join(',') });
    const response = await fetch(
      `${this.baseUrl}/bss-magic-api/api/v1/apps/${appId}/file-contents?${params}`,
      {
        method: 'GET',
        headers: this.getHeaders()
      }
    );
    return this.handleResponse<AppFileContentsResponse>(response);
  }

  /**
   * Initialize or reinitialize an app's workspace
   * This will delete and recreate the workspace from the app's repository or default template
   */
  async initializeAppWorkspace(appId: string): Promise<AppWorkspaceInitResponse> {
    const response = await fetch(
      `${this.baseUrl}/bss-magic-api/api/v1/apps/${appId}/workspace/initialize`,
      {
        method: 'POST',
        headers: this.getHeaders()
      }
    );
    return this.handleResponse<AppWorkspaceInitResponse>(response);
  }

  // ============ BSS Stats Endpoints ============

  /**
   * Get BSS statistics for a project
   */
  async getBSSStats(projectId?: string): Promise<any> {
    const queryString = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/bss/stats${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<any>(response);
  }

  /**
   * Get BSS changelog for a project
   */
  async getBSSChangelog(projectId?: string): Promise<any> {
    const queryString = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/bss/changelog${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<any>(response);
  }

  // ============ User Profile Endpoints ============

  /**
   * Get current user's profile
   */
  async getUserProfile(): Promise<{ user_id: string; user_name: string; tenant_id: string; tenant_name: string; role: string }> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/users/profile`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  // ============ Decision Trace Endpoints (Append-Only) ============

  /**
   * Create a new Decision Trace
   * Note: DecisionTrace is append-only - records cannot be updated or deleted once created
   */
  async createDecisionTrace(trace: DecisionTraceCreate): Promise<DecisionTrace> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/decision-traces`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(trace)
    });
    return this.handleResponse<DecisionTrace>(response);
  }

  /**
   * Get a specific Decision Trace by trace_id
   */
  async getDecisionTrace(traceId: string): Promise<DecisionTrace> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/decision-traces/${traceId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<DecisionTrace>(response);
  }

  /**
   * List Decision Traces with optional filters
   * Results are sorted by timestamp (most recent first)
   */
  async listDecisionTraces(params?: DecisionTraceListParams): Promise<DecisionTraceListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/decision-traces${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<DecisionTraceListResponse>(response);
  }

  /**
   * Get Decision Traces for a specific journey
   * Useful for tracing all decisions made during a journey execution
   */
  async listDecisionTracesByJourney(journeyId: string, params?: Omit<DecisionTraceListParams, 'journey_id'>): Promise<DecisionTraceListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/decision-traces/by-journey/${journeyId}${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<DecisionTraceListResponse>(response);
  }

  /**
   * Get Decision Traces filtered by outcome
   * Useful for analyzing failed decisions to identify knowledge gaps
   * @param outcome - 'success' | 'failure' | 'pending'
   */
  async listDecisionTracesByOutcome(outcome: 'success' | 'failure' | 'pending', params?: Omit<DecisionTraceListParams, 'outcome'>): Promise<DecisionTraceListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/decision-traces/by-outcome/${outcome}${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<DecisionTraceListResponse>(response);
  }

  /**
   * Get Decision Traces that used a specific knowledge node
   * Useful for analyzing knowledge node effectiveness and impact
   */
  async listDecisionTracesByKnowledgeNode(knowledgeNodeId: string, params?: DecisionTraceListParams): Promise<DecisionTraceListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/decision-traces/by-knowledge-node/${knowledgeNodeId}${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<DecisionTraceListResponse>(response);
  }

  // ============ Dashboard Endpoints ============

  /**
   * List all Dashboards with optional filters
   */
  async listDashboards(params?: DashboardListParams): Promise<DashboardListResponse> {
    const queryString = this.buildQueryString(params);
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/dashboards${queryString}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<DashboardListResponse>(response);
  }

  /**
   * Create a new Dashboard
   */
  async createDashboard(dashboard: DashboardCreate): Promise<Dashboard> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/dashboards`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(dashboard)
    });
    return this.handleResponse<Dashboard>(response);
  }

  /**
   * Get a specific Dashboard by ID (includes full a2ui_json)
   */
  async getDashboard(dashboardId: string): Promise<Dashboard> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/dashboards/${dashboardId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<Dashboard>(response);
  }

  /**
   * Update a Dashboard (name, description, tags only)
   */
  async updateDashboard(dashboardId: string, update: DashboardUpdate): Promise<Dashboard> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/dashboards/${dashboardId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(update)
    });
    return this.handleResponse<Dashboard>(response);
  }

  /**
   * Delete a Dashboard
   */
  async deleteDashboard(dashboardId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bss-magic-api/api/v1/dashboards/${dashboardId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: response.statusText,
        status_code: response.status
      }));
      throw new Error(error.detail || `Failed to delete Dashboard: ${response.status}`);
    }
  }

  // ============ Utility Methods ============

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Update the base URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
}

// Create a singleton instance
let clientInstance: BSSMagicApiClient | null = null;

/**
 * Get the singleton BSS Magic API client instance
 */
export function getBSSMagicApiClient(config?: Partial<BSSMagicApiConfig>): BSSMagicApiClient {
  if (!clientInstance) {
    clientInstance = new BSSMagicApiClient(config);
  } else if (config) {
    // Update existing instance with new config if provided
    if (config.baseUrl) {
      clientInstance.setBaseUrl(config.baseUrl);
    }
    // Note: API key is no longer used - authentication is handled via Cognito tokens
  }
  return clientInstance;
}

// Export default instance
export default getBSSMagicApiClient();
