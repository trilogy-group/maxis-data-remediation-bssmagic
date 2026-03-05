// BSS Magic API - Main Export
// Central export point for the BSS Magic API client and types

export { BSSMagicApiClient, getBSSMagicApiClient } from './client';

// Export default client instance
export { default as bssMagicApi } from './client';

// Export all types
export type {
  // API configuration
  BSSMagicApiConfig,

  // Base API types
  ApiInfo,
  HealthStatus,
  ApiError,

  // Project types
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectListResponse,
  ProjectListParams,

  // BRD types
  BRD,
  BRDCreate,
  BRDUpdate,
  BRDListResponse,
  BRDListParams,

  // PRD types
  PRD,
  PRDListResponse,
  PRDListParams,

  // Engineering Spec types
  EngineeringSpec,
  EngineeringSpecListResponse,
  EngineeringSpecListParams,

  // Journey types
  Journey,
  JourneyCreate,
  JourneyUpdate,
  JourneyListResponse,
  JourneyListParams,

  // Query parameter types
  ListParams
} from './types';