/**
 * AI Block Service Types
 * Matches the ai-fde backend /ai-block/run endpoint
 */

export interface MCPSelection {
  ontology?: boolean;
  etom?: boolean;
  knowledge?: boolean;
  data?: boolean;
}

export interface TracingInfo {
  execution_id?: string;
  block_id?: string;
  session_id?: string;
}

export interface AiBlockRequest {
  system_prompt?: string;
  user_input: string;
  model?: string;
  mcp?: MCPSelection;
  tools?: Array<any>;
  tracing?: TracingInfo;
  timeout_ms?: number;
}

export interface AiBlockResponse {
  text: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  trace?: TracingInfo;
}

export interface AiBlockServiceConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

/**
 * Generic structured response for AI analysis
 * Apps can extend this interface for domain-specific analysis results
 */
export interface AiAnalysisResult {
  /** The type of insight provided */
  insightType: string;
  /** Human-readable insight message */
  insightMessage: string;
  /** Optional structured data returned by the AI */
  data?: Record<string, any>;
}
