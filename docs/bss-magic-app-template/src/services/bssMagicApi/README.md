# BSS Magic API Client

## Overview
TypeScript client for the BSS Magic backend API. Provides comprehensive CRUD operations for managing Projects, BRDs (Business Requirements Documents), PRDs (Product Requirements Documents), and Engineering Specifications.

**Note**: All API endpoints are prefixed with `/bss-magic-api/`. The client automatically adds this prefix to all routes.

## Configuration

### Environment Variables
```env
# Base URL for the API (defaults to http://localhost:8003)
VITE_BSS_MAGIC_API_URL=http://localhost:8003

# API Key for authentication (required, no fallback)
VITE_BSS_MAGIC_API_KEY=your-api-key-here
```

## Usage

### Basic Usage
```typescript
import { bssMagicApi } from '@/services/bssMagicApi';

// Check API health
const health = await bssMagicApi.getHealthStatus();

// List projects
const projects = await bssMagicApi.listProjects({
  limit: 10,
  offset: 0,
  'filter[status]': 'active'
});

// Create a new project
const newProject = await bssMagicApi.createProject({
  slug: 'my-project',
  name: 'My Project',
  description: 'A new BSS Magic project',
  status: 'active'
});

// Load BRDs for a specific project
const projectId = '6da79276-2fd4-4197-bef9-bb4d99ec2249';
const projectBRDs = await bssMagicApi.listBRDs({
  'filter[project_id]': projectId,
  limit: 50,
  'filter[status]': 'approved',
  sort: 'created_at:desc'
});

// Create a BRD for a project
const newBRD = await bssMagicApi.createBRD({
  project_id: projectId,
  title: 'New Business Requirements',
  version: '1.0.0',
  status: 'draft',
  priority: 'high'
});

// Working with Workflows
const workflows = await bssMagicApi.listWorkflows({ limit: 10 });
const newWorkflow = await bssMagicApi.createWorkflow({
  title: 'Customer Onboarding Workflow',
  description: 'Automated onboarding process',
  journey_ids: ['journey-123'],
  brd_ids: ['brd-456'],
  content: {
    steps: [
      { id: 'step1', name: 'Verification' },
      { id: 'step2', name: 'Account Setup' }
    ]
  }
});

// Working with Pipelines
const pipelines = await bssMagicApi.listPipelines({ limit: 10 });
const newPipeline = await bssMagicApi.createPipeline({
  title: 'Data Migration Pipeline',
  description: 'Customer data migration process',
  journey_ids: ['journey-789'],
  engg_spec_ids: ['spec-321'],
  content: {
    stages: [
      { id: 'extract', name: 'Data Extraction' },
      { id: 'transform', name: 'Data Transformation' },
      { id: 'load', name: 'Data Loading' }
    ]
  }
});
```

### Custom Configuration
```typescript
import { BSSMagicApiClient } from '@/services/bssMagicApi';

// Create a custom client instance
const customClient = new BSSMagicApiClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'custom-api-key',
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

### Singleton Pattern
```typescript
import { getBSSMagicApiClient } from '@/services/bssMagicApi';

// Get the singleton instance
const client = getBSSMagicApiClient();

// Update configuration on the fly
client.setApiKey('new-api-key');
client.setBaseUrl('https://new-api.example.com');
```

## API Methods

### Health & Status
- `getApiInfo()` - Get API information
- `getHealthStatus()` - Check API health status

### Projects
- `listProjects(params?)` - List all projects with filters
- `createProject(project)` - Create a new project
- `getProject(projectId)` - Get a specific project
- `updateProject(projectId, update)` - Update a project
- `deleteProject(projectId)` - Delete a project

### BRDs (Business Requirements Documents)
- `listBRDs(params?)` - List all BRDs with filters
- `createBRD(brd)` - Create a new BRD
- `getBRD(brdId)` - Get a specific BRD
- `updateBRD(brdId, update)` - Update a BRD
- `deleteBRD(brdId)` - Delete a BRD

### PRDs (Product Requirements Documents)
- `listPRDs(params?)` - List all PRDs with filters
- `createPRD(prd)` - Create a new PRD
- `getPRD(prdId)` - Get a specific PRD
- `updatePRD(prdId, update)` - Update a PRD
- `deletePRD(prdId)` - Delete a PRD

### Engineering Specifications
- `listEngineeringSpecs(params?)` - List all specs with filters
- `createEngineeringSpec(spec)` - Create a new spec
- `getEngineeringSpec(specId)` - Get a specific spec
- `updateEngineeringSpec(specId, update)` - Update a spec
- `deleteEngineeringSpec(specId)` - Delete a spec

### Workflows
- `listWorkflows(params?)` - List all workflows with filters
- `createWorkflow(workflow)` - Create a new workflow
- `getWorkflow(workflowId)` - Get a specific workflow (includes content field)
- `updateWorkflow(workflowId, update)` - Update a workflow
- `deleteWorkflow(workflowId)` - Delete a workflow

### Pipelines
- `listPipelines(params?)` - List all pipelines with filters
- `createPipeline(pipeline)` - Create a new pipeline
- `getPipeline(pipelineId)` - Get a specific pipeline (includes content field)
- `updatePipeline(pipelineId, update)` - Update a pipeline
- `deletePipeline(pipelineId)` - Delete a pipeline

### Utility Methods
- `isAuthenticated()` - Check if API key is configured
- `setApiKey(apiKey)` - Update the API key
- `getBaseUrl()` - Get the current base URL
- `setBaseUrl(baseUrl)` - Update the base URL

## Query Parameters

### List Parameters
All list methods support these common parameters:
```typescript
{
  limit?: number;      // 1-1000, default: 50
  offset?: number;     // min: 0, default: 0
  sort?: string;       // e.g., 'created_at:desc' or '-created_at'
}
```

### Filter Parameters
Each resource type supports specific filters:

**Projects:**
```typescript
{
  'filter[status]'?: string;    // active, archived, draft
  'filter[name]'?: string;       // Supports wildcards with *
}
```

**BRDs:**
```typescript
{
  'filter[status]'?: 'draft' | 'in_review' | 'approved' | 'published' | 'deprecated' | 'archived';
  'filter[priority]'?: 'low' | 'medium' | 'high' | 'critical';
  'filter[project_id]'?: string;
}
```

**PRDs:**
```typescript
{
  'filter[status]'?: string;
  'filter[priority]'?: 'low' | 'medium' | 'high' | 'critical';
  'filter[parent_brd_id]'?: string;
}
```

**Engineering Specs:**
```typescript
{
  'filter[status]'?: 'not_started' | 'in_progress' | 'testing' | 'completed' | 'deployed';
  'filter[sprint_allocation]'?: string;
}
```

**Workflows:**
```typescript
{
  // No specific filters defined - supports standard pagination only
  limit?: number;      // 1-100, default: 50
  offset?: number;     // min: 0, default: 0
}
```

**Pipelines:**
```typescript
{
  // No specific filters defined - supports standard pagination only
  limit?: number;      // 1-100, default: 50
  offset?: number;     // min: 0, default: 0
}
```

**Note**: The `content` field is excluded from list responses for Workflows and Pipelines for performance reasons. It is only returned when retrieving individual items.

## Error Handling

The client automatically handles API errors and throws descriptive error messages:

```typescript
try {
  const project = await bssMagicApi.getProject('invalid-id');
} catch (error) {
  console.error('Failed to fetch project:', error.message);
  // Error message will contain the API error detail or HTTP status
}
```

## Types

All types are exported from the module for TypeScript usage:

```typescript
import type {
  Project,
  ProjectCreate,
  BRD,
  BRDCreate,
  PRD,
  EngineeringSpec,
  Workflow,
  WorkflowCreate,
  WorkflowUpdate,
  Pipeline,
  PipelineCreate,
  PipelineUpdate,
  ApiError
} from '@/services/bssMagicApi';
```

## Architecture Notes

- **Singleton Pattern**: Default export uses a singleton instance for consistent configuration
- **Environment Variables**: Uses Vite's `import.meta.env` for environment variable access
- **Bearer Authentication**: Automatically adds Bearer token header when API key is configured
- **Error Handling**: Consistent error handling with ApiError type
- **Query Building**: Helper method for building query strings from parameter objects
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Path Prefix**: All API routes automatically include the `/bss-magic-api/` prefix

## API Route Structure

All endpoints follow this pattern:
```
{baseUrl}/bss-magic-api/{endpoint}
```

For example:
- Health check: `http://localhost:8003/bss-magic-api/health`
- Projects: `http://localhost:8003/bss-magic-api/api/v1/projects`
- BRDs: `http://localhost:8003/bss-magic-api/api/v1/brds`