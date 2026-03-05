import { getAuthHeaders } from '../auth/authHeaders';
import {
  AiBlockRequest,
  AiBlockResponse,
  AiBlockServiceConfig,
  AiAnalysisResult
} from './types';

/**
 * AI Block Service Client
 * Calls the ai-fde backend /ai-block/run endpoint
 * 
 * This is a generic AI service that can be used for any domain-specific
 * analysis by providing appropriate system prompts and parsing logic.
 */
export class AiBlockService {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config?: AiBlockServiceConfig) {
    // Get base URL from environment
    this.baseUrl = config?.baseUrl || 
      import.meta.env.VITE_AI_FDE_API_URL || 
      'https://adapter.bss-magic.totogi.solutions';

    // Remove trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');

    this.headers = {
      'Content-Type': 'application/json',
      ...config?.headers
    };
  }

  /**
   * Get headers with current auth token
   */
  private getHeaders(): Record<string, string> {
    const authHeaders = getAuthHeaders();
    return {
      ...this.headers,
      ...authHeaders
    };
  }

  /**
   * Execute AI block with raw request
   */
  async run(request: AiBlockRequest): Promise<AiBlockResponse> {
    const response = await fetch(`${this.baseUrl}/ai-fde/api/v1/ai-block/run`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Block request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Execute an AI analysis with a custom system prompt
   * Returns a generic analysis result that can be extended for domain-specific use
   * 
   * @param userQuestion - The user's question or input
   * @param systemPrompt - Custom system prompt for the AI
   * @param options - Additional options for the request
   */
  async analyze(
    userQuestion: string,
    systemPrompt: string,
    options?: {
      enableMcp?: boolean;
      mcpOptions?: {
        data?: boolean;
        knowledge?: boolean;
        ontology?: boolean;
        etom?: boolean;
      };
      timeoutMs?: number;
      sessionPrefix?: string;
    }
  ): Promise<AiAnalysisResult> {
    const request: AiBlockRequest = {
      system_prompt: systemPrompt,
      user_input: userQuestion,
      mcp: options?.enableMcp ? {
        data: options.mcpOptions?.data ?? true,
        knowledge: options.mcpOptions?.knowledge ?? true,
        ontology: options.mcpOptions?.ontology ?? true,
        etom: options.mcpOptions?.etom ?? false
      } : undefined,
      timeout_ms: options?.timeoutMs || 30000,
      tracing: {
        session_id: `${options?.sessionPrefix || 'ai-analysis'}-${Date.now()}`
      }
    };

    const response = await this.run(request);

    // Try to parse structured JSON from the response
    try {
      let jsonText = response.text.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      const result = JSON.parse(jsonText);
      
      return {
        insightType: result.insightType || 'success',
        insightMessage: result.insightMessage || response.text,
        data: result
      };
    } catch {
      // If JSON parsing fails, return the raw text as the insight
      return {
        insightType: 'success',
        insightMessage: response.text,
        data: undefined
      };
    }
  }

  /**
   * Simple chat completion without structured parsing
   * Returns the raw AI response text
   */
  async chat(
    userInput: string,
    systemPrompt?: string,
    options?: {
      enableMcp?: boolean;
      timeoutMs?: number;
    }
  ): Promise<string> {
    const request: AiBlockRequest = {
      system_prompt: systemPrompt,
      user_input: userInput,
      mcp: options?.enableMcp ? {
        data: true,
        knowledge: true,
        ontology: true,
        etom: false
      } : undefined,
      timeout_ms: options?.timeoutMs || 30000
    };

    const response = await this.run(request);
    return response.text;
  }
}

// Singleton instance
let serviceInstance: AiBlockService | null = null;

/**
 * Get the singleton AI Block Service instance
 */
export function getAiBlockService(config?: AiBlockServiceConfig): AiBlockService {
  if (!serviceInstance) {
    serviceInstance = new AiBlockService(config);
  }
  return serviceInstance;
}

/**
 * Reset the singleton (useful for testing or reconfiguration)
 */
export function resetAiBlockService(): void {
  serviceInstance = null;
}

export default getAiBlockService();
