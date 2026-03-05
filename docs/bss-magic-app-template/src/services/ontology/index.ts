// Ontology API - Main Export
// Central export point for the Ontology API client and types

export { OntologyApiClient, getOntologyApiClient } from './client';

// Export default client instance
export { default as ontologyApi } from './client';

// Export all types
export type {
    DataListParams,
    DataListResponse,
    DataRecordResponse,
    NotImplementedError,
    DataOperationResult,
    ApiError,
    OntologyApiConfig
} from './types';

// Data Query Service
export { 
    getDataQueryService, 
    dataQueryService 
} from './dataQueryService';

export type {
    QuerySelectField,
    SimpleWhereClause,
    CompositeWhereClause,
    OrderByClause,
    JoinCondition,
    DataQueryRequest,
    QueryStatus,
    DataQueryResponse,
    QueryValidationResponse
} from './dataQueryService';

// Knowledge Base Service (Rationales, Summaries, Tags - Read-Only)
export {
    getKnowledgeBaseService,
    knowledgeBaseService
} from './knowledgeBaseService';

export type {
    RationaleSourceType,
    KnowledgeTag,
    RationaleTagSummary,
    Rationale,
    SelectionCriteria,
    SummaryStats,
    RationaleSummary,
    ListRationalesResponse,
    GetRationaleResponse,
    ListRationaleSummariesResponse,
    GetRationaleSummaryResponse,
    ListKnowledgeTagsResponse,
    GetKnowledgeTagResponse,
    PaginationParams
} from './knowledgeBaseService';
