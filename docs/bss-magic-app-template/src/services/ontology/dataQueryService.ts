/**
 * Data Query Service
 * Handles data query operations using the /data-api/query/build endpoint
 */

import { getOntologyApiClient } from './client';

// ============ Query Builder Types ============

export interface QuerySelectField {
  field: string;
  alias?: string;
  is_expression?: boolean;
}

export interface SimpleWhereClause {
  left_condition: string;
  operator: string; // Only "=" for now
  right_value: any;
}

export interface CompositeWhereClause {
  combine_with: 'AND' | 'OR';
  clauses: Array<SimpleWhereClause | CompositeWhereClause>;
}

export interface OrderByClause {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface JoinCondition {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  table?: string;
  left_condition: string;
  operator: string;
  right_condition: string;
}

export interface DataQueryRequest {
  connection_id: string;
  database: string;
  select_fields: Array<string | QuerySelectField>;
  primary_table: string;
  joins?: JoinCondition[];
  where_clauses?: SimpleWhereClause | CompositeWhereClause | SimpleWhereClause[];
  group_by?: string[];
  order?: OrderByClause[];
  limit?: number;
}

export type QueryStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timeout';

export interface DataQueryResponse {
  query_id: string;
  generated_query: string;
  status: QueryStatus;
  data: Array<Record<string, any>>;
  columns: string[];
  row_count: number;
  execution_time_ms?: number;
  bytes_scanned?: number;
  metadata?: Record<string, any>;
  error_message?: string;
  warnings?: string[];
}

export interface QueryValidationResponse {
  valid: boolean;
  query: string;
  errors?: string[];
  warnings?: string[];
  estimated_rows?: number;
  estimated_cost?: number;
  suggestions?: string[];
}

// ============ Service Implementation ============

class DataQueryService {
  private client = getOntologyApiClient();

  /**
   * Build and execute a query using the query builder endpoint
   */
  async executeQuery(request: DataQueryRequest): Promise<DataQueryResponse> {
    const payload = {
      connection_id: request.connection_id,
      database: request.database,
      select_fields: request.select_fields,
      primary_table: request.primary_table,
      ...(request.joins && { joins: request.joins }),
      ...(request.where_clauses && { where_clauses: request.where_clauses }),
      ...(request.group_by && { group_by: request.group_by }),
      ...(request.order && { order: request.order }),
      ...(request.limit && { limit: request.limit })
    };

    const response = await this.client.post<DataQueryResponse>(
      '/ontology-schema/data/query/build',
      payload,
      {
        context: 'Execute Query Builder'
      }
    );

    return {
      query_id: response.query_id || '',
      generated_query: response.generated_query || '',
      status: response.status || 'failed',
      data: response.data || [],
      columns: response.columns || [],
      row_count: response.row_count || 0,
      execution_time_ms: response.execution_time_ms,
      bytes_scanned: response.bytes_scanned,
      metadata: response.metadata,
      error_message: response.error_message,
      warnings: response.warnings
    };
  }

  /**
   * Validate a query without executing it
   */
  async validateQuery(request: DataQueryRequest): Promise<QueryValidationResponse> {
    const payload = {
      query_builder_request: {
        connection_id: request.connection_id,
        database: request.database,
        select_fields: request.select_fields,
        primary_table: request.primary_table,
        ...(request.joins && { joins: request.joins }),
        ...(request.where_clauses && { where_clauses: request.where_clauses }),
        ...(request.order && { order: request.order }),
        ...(request.limit && { limit: request.limit })
      },
      explain: false
    };

    const response = await this.client.post<QueryValidationResponse>(
      '/data-api/query/validate',
      payload,
      {
        context: 'Validate Query Builder'
      }
    );

    return {
      valid: response.valid || false,
      query: response.query || '',
      errors: response.errors,
      warnings: response.warnings,
      estimated_rows: response.estimated_rows,
      estimated_cost: response.estimated_cost,
      suggestions: response.suggestions
    };
  }

  /**
   * Helper to build WHERE clauses from simple conditions
   * Combines multiple conditions with AND
   */
  buildWhereClause(
    conditions: Array<{ field: string; value: any }>
  ): SimpleWhereClause[] | undefined {
    if (!conditions || conditions.length === 0) {
      return undefined;
    }

    return conditions.map(condition => ({
      left_condition: condition.field,
      operator: '=',
      right_value: condition.value
    }));
  }

  /**
   * Helper to get source system type from source_system_name
   */
  getSourceSystemType(sourceSystemName: string): 'athena' | 'postgresql' | 's3' | 'unknown' {
    const name = sourceSystemName.toLowerCase();
    if (name.includes('athena')) return 'athena';
    if (name.includes('postgres') || name.includes('postgresql')) return 'postgresql';
    if (name.includes('s3')) return 's3';
    return 'unknown';
  }

  /**
   * Fetch voice revenue aggregated by cell from CellVoiceRevenue table
   * Returns a map of cell_name -> total revenue in SDG
   */
  async fetchVoiceRevenueByCell(cellNames: string[]): Promise<Record<string, number>> {
    if (!cellNames || cellNames.length === 0) {
      return {};
    }

    try {
      // Strip "RBS-" and "4G-" prefixes from cell names for CellVoiceRevenue table
      const strippedCellNames = cellNames.map(name => {
        if (name.startsWith('RBS-')) return name.slice(4);
        if (name.startsWith('4G-')) return name.slice(3);
        return name;
      });

      const response = await this.executeQuery({
        connection_id: 'bss-magic-postgresql',
        database: 'placeholder',
        select_fields: [
          'cell_name',
          'SUM(total_revenue_micro) AS total_revenue_micro'
        ],
        primary_table: 'CellVoiceRevenue',
        where_clauses: {
          left_condition: 'cell_name',
          operator: 'IN',
          right_value: strippedCellNames
        },
        group_by: ['cell_name'],
        limit: 10000
      });

      // Build map with ORIGINAL cell names as keys (need to map back)
      const revenueMap: Record<string, number> = {};
      
      // Create reverse lookup: stripped name -> original names
      const strippedToOriginal: Record<string, string[]> = {};
      cellNames.forEach((original, i) => {
        const stripped = strippedCellNames[i];
        if (!strippedToOriginal[stripped]) strippedToOriginal[stripped] = [];
        strippedToOriginal[stripped].push(original);
      });

      for (const row of response.data) {
        if (row.cell_name) {
          const revenue = (row.total_revenue_micro || 0) / 1_000_000;
          // Map revenue back to all original cell names that match this stripped name
          const originals = strippedToOriginal[row.cell_name] || [];
          for (const orig of originals) {
            revenueMap[orig] = revenue;
          }
        }
      }
      return revenueMap;
    } catch (error) {
      console.error('[fetchVoiceRevenueByCell] Error fetching voice revenue:', error);
      return {};
    }
  }

  /**
   * Fetch open ticket counts by site (grouped)
   * Open = ticket_status = 'Running'
   */
  async fetchOpenTicketCountsBySites(siteNames: string[]): Promise<Record<string, number>> {
    if (!siteNames.length) return {};

    try {
      const upperSiteNames = siteNames.map(s => s.toUpperCase());
      
      const response = await this.executeQuery({
        connection_id: 'bss-magic-postgresql',
        database: 'placeholder',
        select_fields: [
          'site_name_normalized',
          'COUNT(*) AS open_count'
        ],
        primary_table: 'NetworkTroubleTicket',
        where_clauses: {
          combine_with: 'AND',
          clauses: [
            { left_condition: 'site_name_normalized', operator: 'IN', right_value: upperSiteNames },
            { left_condition: 'ticket_status', operator: '=', right_value: 'Running' }
          ]
        },
        group_by: ['site_name_normalized'],
        limit: 10000
      });

      const countMap: Record<string, number> = {};
      for (const row of response.data) {
        if (row.site_name_normalized) {
          countMap[row.site_name_normalized] = parseInt(row.open_count, 10) || 0;
        }
      }
      return countMap;
    } catch (error) {
      console.error('[fetchOpenTicketCountsBySites] Error:', error);
      return {};
    }
  }

  /**
   * Fetch total ticket counts by site (grouped)
   */
  async fetchTotalTicketCountsBySites(siteNames: string[]): Promise<Record<string, number>> {
    if (!siteNames.length) return {};

    try {
      const upperSiteNames = siteNames.map(s => s.toUpperCase());
      
      const response = await this.executeQuery({
        connection_id: 'bss-magic-postgresql',
        database: 'placeholder',
        select_fields: [
          'site_name_normalized',
          'COUNT(*) AS total_count'
        ],
        primary_table: 'NetworkTroubleTicket',
        where_clauses: {
          left_condition: 'site_name_normalized',
          operator: 'IN',
          right_value: upperSiteNames
        },
        group_by: ['site_name_normalized'],
        limit: 10000
      });

      const countMap: Record<string, number> = {};
      for (const row of response.data) {
        if (row.site_name_normalized) {
          countMap[row.site_name_normalized] = parseInt(row.total_count, 10) || 0;
        }
      }
      return countMap;
    } catch (error) {
      console.error('[fetchTotalTicketCountsBySites] Error:', error);
      return {};
    }
  }

  /**
   * Extract site name from cell name
   * - Remove "RBS-" or "4G-" prefix
   * - Remove "-XX" suffix (dash + 2 chars)
   */
  extractSiteNameFromCellName(cellName: string): string {
    let siteName = cellName;
    
    // Step 1: Remove prefix
    if (siteName.startsWith('RBS-')) {
      siteName = siteName.slice(4);
    } else if (siteName.startsWith('4G-')) {
      siteName = siteName.slice(3);
    }
    
    // Step 2: Remove suffix "-XX" (dash + 2 chars) if present
    if (siteName.length > 3 && siteName[siteName.length - 3] === '-') {
      siteName = siteName.slice(0, -3);
    }
    
    return siteName;
  }

  /**
   * Fetch trouble tickets for a site by site_name_normalized
   */
  async fetchTroubleTicketsBySite(siteName: string): Promise<TroubleTicket[]> {
    if (!siteName) {
      return [];
    }

    try {
      console.log(`[fetchTroubleTicketsBySite] Fetching tickets for site: ${siteName}`);
      
      const response = await this.executeQuery({
        connection_id: 'bss-magic-postgresql',
        database: 'placeholder',
        select_fields: ['*'],
        primary_table: 'NetworkTroubleTicket',
        where_clauses: {
          left_condition: 'site_name_normalized',
          operator: '=',
          right_value: siteName.toUpperCase()
        },
        order: [{ field: 'created_at', direction: 'DESC' }],
        limit: 100
      });

      console.log(`[fetchTroubleTicketsBySite] Found ${response.data.length} tickets`);
      return response.data as TroubleTicket[];
    } catch (error) {
      console.error('[fetchTroubleTicketsBySite] Error fetching trouble tickets:', error);
      return [];
    }
  }

  /**
   * Fetch performance baseline data for a cell
   * @param cellId The cell identifier (e.g., "RBS-VITA-C2")
   * @param dayHourPairs Array of { dayOfWeek, hour } to query
   */
  async fetchBaselineForCell(
    cellId: string, 
    dayHourPairs: Array<{ dayOfWeek: number; hour: number }>
  ): Promise<PerformanceBaseline[]> {
    if (!cellId || !dayHourPairs.length) {
      return [];
    }

    try {
      console.log(`[fetchBaselineForCell] Fetching baseline for cell: ${cellId}, pairs: ${dayHourPairs.length}`);
      
      // Build OR conditions for each day/hour pair
      const dayHourConditions = dayHourPairs.map(pair => ({
        combine_with: 'AND' as const,
        clauses: [
          { left_condition: 'day_of_week', operator: '=', right_value: pair.dayOfWeek },
          { left_condition: 'time_of_day_hour', operator: '=', right_value: pair.hour }
        ]
      }));

      const response = await this.executeQuery({
        connection_id: 'bss-magic-postgresql',
        database: 'placeholder',
        select_fields: ['*'],
        primary_table: 'PerformanceBaseline',
        where_clauses: {
          combine_with: 'AND',
          clauses: [
            { left_condition: 'cell_id', operator: '=', right_value: cellId },
            { left_condition: 'baseline_period', operator: '=', right_value: '2025-11-27_2025-12-10+2026-01-03_2026-01-12' },
            {
              combine_with: 'OR',
              clauses: dayHourConditions
            }
          ]
        },
        order: [
          { field: 'day_of_week', direction: 'ASC' },
          { field: 'time_of_day_hour', direction: 'ASC' }
        ],
        limit: 100
      });

      console.log(`[fetchBaselineForCell] Found ${response.data.length} baseline records`);
      return response.data as PerformanceBaseline[];
    } catch (error) {
      console.error('[fetchBaselineForCell] Error fetching baseline:', error);
      return [];
    }
  }
}

// ============ Trouble Ticket Type ============

export interface TroubleTicket {
  ticket_id: string;
  title: string;
  domain: string | null;
  fault_level: string | null;
  ticket_status: string | null;
  ticket_technology: string | null;
  cell_region: string | null;
  cell_city: string | null;
  matched_site_id: string | null;
  site_name_normalized: string | null;
  ticket_site_name: string | null;
  is_site_outage: boolean;
  is_sla_violation: boolean;
  sla_status: string | null;
  is_closed: boolean;
  created_at: string | null;
  closure_time: string | null;
  mttr_minutes: number | null;
}

// ============ Performance Baseline Type ============

export interface PerformanceBaseline {
  baseline_id: string;
  cell_id: string;
  cell_technology: string;
  baseline_period: string;    // e.g., "2025-11-27_2025-12-10+2026-01-03_2026-01-12"
  day_of_week: number;        // 0-6 (0=Sunday)
  time_of_day_hour: number;   // 0-23
  baseline_traffic_mean: number;
  baseline_traffic_stddev: number;
  baseline_call_attempts_mean: number;
  baseline_data_volume_mean: number;
  sample_size: number;
  first_sample: string | null;
  last_sample: string | null;
  last_updated: string | null;
}

// Create singleton instance
let serviceInstance: DataQueryService | null = null;

/**
 * Get the singleton Data Query Service instance
 */
export function getDataQueryService(): DataQueryService {
  if (!serviceInstance) {
    serviceInstance = new DataQueryService();
  }
  return serviceInstance;
}

// Export default instance
export const dataQueryService = getDataQueryService();
export default dataQueryService;
