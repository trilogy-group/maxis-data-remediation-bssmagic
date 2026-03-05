/**
 * Knowledge Base Service
 * Handles read-only operations for Rationales, RationaleSummaries, and KnowledgeTags
 */

import { getOntologyApiClient } from './client';

// ============ Types ============

export type RationaleSourceType = 'human' | 'ml' | 'document' | 'system';

export interface KnowledgeTag {
  id: string;
  tag_name: string;
  description?: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface RationaleTagSummary {
  id: string;
  tag_name: string;
}

export interface Rationale {
  id: string;
  description: string;
  source_type: RationaleSourceType;
  source_ref: string;
  confidence: number;
  tags?: RationaleTagSummary[];
  created_at: string;
}

export interface SelectionCriteria {
  tags?: string[];
  time_window?: string;
  source_types?: RationaleSourceType[];
}

export interface SummaryStats {
  count: number;
  avg_confidence: number;
  confidence_distribution?: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface RationaleSummary {
  id: string;
  description: string;
  owner: string;
  selection_criteria?: SelectionCriteria;
  summary_stats?: SummaryStats;
  last_updated: string;
}

// ============ Response Types ============

export interface ListRationalesResponse {
  rationales: Rationale[];
  total_count?: number;
}

export interface GetRationaleResponse {
  rationale: Rationale;
}

export interface ListRationaleSummariesResponse {
  summaries: RationaleSummary[];
  total_count?: number;
}

export interface GetRationaleSummaryResponse {
  summary: RationaleSummary;
}

export interface ListKnowledgeTagsResponse {
  tags: KnowledgeTag[];
  total_count?: number;
}

export interface GetKnowledgeTagResponse {
  tag: KnowledgeTag;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// ============ Service Implementation ============

class KnowledgeBaseService {
  private client = getOntologyApiClient();

  // ============ Rationale Operations (Read-Only) ============

  /**
   * List all rationales with pagination
   * GET /ontology-schema/rationales
   */
  async listRationales(params?: PaginationParams): Promise<ListRationalesResponse> {
    const response = await this.client.get<ListRationalesResponse>(
      '/ontology-schema/rationales',
      params
    );
    return {
      rationales: response.rationales || [],
      total_count: response.total_count
    };
  }

  /**
   * Get a specific rationale by ID
   * GET /ontology-schema/rationale/{rationale_id}
   */
  async getRationale(rationaleId: string): Promise<Rationale> {
    const response = await this.client.get<GetRationaleResponse>(
      `/ontology-schema/rationale/${rationaleId}`
    );
    return response.rationale;
  }

  // ============ RationaleSummary Operations (Read-Only) ============

  /**
   * List all rationale summaries with pagination
   * GET /ontology-schema/rationale_summaries
   */
  async listRationaleSummaries(params?: PaginationParams): Promise<ListRationaleSummariesResponse> {
    const response = await this.client.get<ListRationaleSummariesResponse>(
      '/ontology-schema/rationale_summaries',
      params
    );
    return {
      summaries: response.summaries || [],
      total_count: response.total_count
    };
  }

  /**
   * Get a specific rationale summary by ID
   * GET /ontology-schema/rationale_summary/{summary_id}
   */
  async getRationaleSummary(summaryId: string): Promise<RationaleSummary> {
    const response = await this.client.get<GetRationaleSummaryResponse>(
      `/ontology-schema/rationale_summary/${summaryId}`
    );
    return response.summary;
  }

  // ============ KnowledgeTag Operations (Read-Only) ============

  /**
   * List all knowledge tags with pagination
   * GET /ontology-schema/knowledge-tags
   */
  async listKnowledgeTags(params?: PaginationParams): Promise<ListKnowledgeTagsResponse> {
    const response = await this.client.get<ListKnowledgeTagsResponse>(
      '/ontology-schema/knowledge-tags',
      params
    );
    return {
      tags: response.tags || [],
      total_count: response.total_count
    };
  }

  /**
   * Get a specific knowledge tag by ID
   * GET /ontology-schema/knowledge-tag/{tag_id}
   */
  async getKnowledgeTag(tagId: string): Promise<KnowledgeTag> {
    const response = await this.client.get<GetKnowledgeTagResponse>(
      `/ontology-schema/knowledge-tag/${tagId}`
    );
    return response.tag;
  }

  // ============ Helper Methods ============

  /**
   * Get rationales filtered by tag ID
   */
  async getRationalesForTag(tagId: string): Promise<Rationale[]> {
    const response = await this.listRationales({ limit: 100 });
    return response.rationales.filter(
      r => r.tags && r.tags.some(t => t.id === tagId)
    );
  }
}

// Create singleton instance
let serviceInstance: KnowledgeBaseService | null = null;

/**
 * Get the singleton Knowledge Base Service instance
 */
export function getKnowledgeBaseService(): KnowledgeBaseService {
  if (!serviceInstance) {
    serviceInstance = new KnowledgeBaseService();
  }
  return serviceInstance;
}

// Export default instance
export const knowledgeBaseService = getKnowledgeBaseService();
export default knowledgeBaseService;

