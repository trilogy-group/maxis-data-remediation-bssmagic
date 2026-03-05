import {
    DataListParams,
    DataListResponse,
    DataRecordResponse,
    DataOperationResult,
    ApiError,
    OntologyApiConfig
} from './types';
import { getAuthHeaders } from '../auth/authHeaders';

export class OntologyApiClient {
    private baseUrl: string;
    private headers: Record<string, string>;

    constructor(config?: Partial<OntologyApiConfig>) {
        // Get base URL from environment or use fallback
        // Priority: config.baseUrl > process.env > import.meta.env > fallback

        this.baseUrl =
            config?.baseUrl ||
            (typeof process !== 'undefined' ? process.env.VITE_ONTOLOGY_API_URL : undefined) ||
            import.meta.env.VITE_ONTOLOGY_API_URL ||
            'http://localhost:8003';

        this.baseUrl = this.baseUrl.replace(/\/$/, '');

        this.headers = {
            'Content-Type': 'application/json',
            ...config?.headers
        };
    }

    private getHeaders(): Record<string, string> {
        const authHeaders = getAuthHeaders();
        return {
            ...this.headers,
            ...authHeaders
        };
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            let errorDetail = response.statusText;
            let statusCode = response.status;

            try {
                const error: ApiError = await response.json();
                errorDetail = error.detail || errorDetail;
                statusCode = error.status_code || statusCode;
            } catch {
                // If JSON parsing fails, use status text
            }

            const error = new Error(errorDetail || `API Error: ${statusCode}`);
            (error as any).status = statusCode;
            throw error;
        }
        return response.json();
    }

    /**
     * Generic GET request
     * GET from any endpoint with optional query params
     */
    async get<T>(
        endpoint: string,
        params?: Record<string, any>,
        options?: { context?: string }
    ): Promise<T> {
        try {
            const queryString = this.buildQueryString(params);
            const response = await fetch(
                `${this.baseUrl}${endpoint}${queryString}`,
                {
                    method: 'GET',
                    headers: this.getHeaders()
                }
            );
            return this.handleResponse<T>(response);
        } catch (error: any) {
            console.error(`GET ${endpoint} failed:`, error);
            throw error;
        }
    }

    /**
     * Generic POST request
     * POST to any endpoint with optional body
     */
    async post<T>(
        endpoint: string,
        body?: any,
        options?: { context?: string }
    ): Promise<T> {
        try {
            const response = await fetch(
                `${this.baseUrl}${endpoint}`,
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: body ? JSON.stringify(body) : undefined
                }
            );
            return this.handleResponse<T>(response);
        } catch (error: any) {
            console.error(`POST ${endpoint} failed:`, error);
            throw error;
        }
    }

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

    /**
     * List entity records with pagination
     * GET /ontology-schema/data/api/{api_name}/entity/{entity_name}
     */
    async listEntityRecords(
        apiName: string,
        entityName: string,
        params: DataListParams = {}
    ): Promise<DataListResponse> {
        const {
            limit = 100,
            offset = 0,
            filter_field,
            filter_value
        } = params;

        const queryParams: Record<string, any> = {
            limit,
            offset
        };

        if (filter_field && filter_value) {
            queryParams.filter_field = filter_field;
            queryParams.filter_value = filter_value;
        }

        try {
            const queryString = this.buildQueryString(queryParams);
            const response = await fetch(
                `${this.baseUrl}/ontology-schema/data/api/${apiName}/entity/${entityName}${queryString}`,
                {
                    method: 'GET',
                    headers: this.getHeaders()
                }
            );

            const rawResponse = await this.handleResponse<any>(response);

            // Handle various response formats
            let data: any[] = [];
            let totalCount = 0;

            if (rawResponse?.entities && Array.isArray(rawResponse.entities)) {
                data = rawResponse.entities;
                totalCount = rawResponse.total_count || data.length;
            } else if (rawResponse?.data && Array.isArray(rawResponse.data)) {
                data = rawResponse.data;
                totalCount = rawResponse.total_count || data.length;
            } else if (rawResponse?.rows && Array.isArray(rawResponse.rows)) {
                data = rawResponse.rows;
                totalCount = rawResponse.total_count || data.length;
            } else if (rawResponse?.result) {
                if (Array.isArray(rawResponse.result)) {
                    data = rawResponse.result;
                } else if (rawResponse.result.rows) {
                    data = rawResponse.result.rows;
                } else if (rawResponse.result.data) {
                    data = rawResponse.result.data;
                }
                totalCount = rawResponse.total_count || rawResponse.result.total_count || data.length;
            } else if (Array.isArray(rawResponse)) {
                data = rawResponse;
                totalCount = rawResponse.length;
            }

            return {
                data,
                total_count: totalCount,
                page: Math.floor(offset / limit) + 1,
                page_size: limit
            };
        } catch (error: any) {
            console.error(`Failed to list records for ${apiName}/${entityName}:`, error);

            if (error.status === 501) {
                throw new Error('Data operations are not yet supported for this source type. Currently only Athena sources are supported.');
            }

            throw error;
        }
    }

    /**
     * Get single entity record by ID
     * GET /ontology-schema/data/api/{api_name}/entity/{entity_name}/{entity_id}
     */
    async getEntityRecord(
        apiName: string,
        entityName: string,
        entityId: string,
        idColumn: string = 'id'
    ): Promise<any | null> {
        try {
            const queryParams: Record<string, any> = {};
            if (idColumn !== 'id') {
                queryParams.id_column = idColumn;
            }

            const queryString = this.buildQueryString(queryParams);
            const response = await fetch(
                `${this.baseUrl}/ontology-schema/data/api/${apiName}/entity/${entityName}/${entityId}${queryString}`,
                {
                    method: 'GET',
                    headers: this.getHeaders()
                }
            );

            const rawResponse = await this.handleResponse<DataRecordResponse>(response);
            return rawResponse?.data || rawResponse || null;
        } catch (error: any) {
            console.error(`Failed to get record ${entityId}:`, error);

            if (error.status === 501) {
                throw new Error('Data operations are not yet supported for this source type. Currently only Athena sources are supported.');
            }

            return null;
        }
    }

    /**
     * Update entity record
     * PUT /ontology-schema/data/api/{api_name}/entity/{entity_name}/{entity_id}
     */
    async updateEntityRecord(
        apiName: string,
        entityName: string,
        entityId: string,
        data: any
    ): Promise<DataOperationResult> {
        try {
            const response = await fetch(
                `${this.baseUrl}/ontology-schema/data/api/${apiName}/entity/${entityName}/${entityId}`,
                {
                    method: 'PUT',
                    headers: this.getHeaders(),
                    body: JSON.stringify(data)
                }
            );

            await this.handleResponse<any>(response);

            return {
                success: true,
                message: 'Record updated successfully'
            };
        } catch (error: any) {
            if (error.status === 501) {
                const isAthena = error.message?.includes('Athena');
                return {
                    success: false,
                    message: isAthena
                        ? 'Update operations are not supported for Athena (read-only data source)'
                        : 'Update operation is not yet implemented for this source type',
                    error: {
                        status: 501,
                        message: error.message || 'Not Implemented',
                        detail: isAthena
                            ? 'Athena is a read-only data source and does not support updates'
                            : 'The backend does not support updating records for this source type yet'
                    }
                };
            }

            return {
                success: false,
                message: error.message || 'Failed to update record'
            };
        }
    }

    /**
     * Delete entity record
     * DELETE /ontology-schema/data/api/{api_name}/entity/{entity_name}/{entity_id}
     */
    async deleteEntityRecord(
        apiName: string,
        entityName: string,
        entityId: string
    ): Promise<DataOperationResult> {
        try {
            const response = await fetch(
                `${this.baseUrl}/ontology-schema/data/api/${apiName}/entity/${entityName}/${entityId}`,
                {
                    method: 'DELETE',
                    headers: this.getHeaders()
                }
            );

            await this.handleResponse<any>(response);

            return {
                success: true,
                message: 'Record deleted successfully'
            };
        } catch (error: any) {
            if (error.status === 501) {
                const isAthena = error.message?.includes('Athena');
                return {
                    success: false,
                    message: isAthena
                        ? 'Delete operations are not supported for Athena (read-only data source)'
                        : 'Delete operation is not yet implemented for this source type',
                    error: {
                        status: 501,
                        message: error.message || 'Not Implemented',
                        detail: isAthena
                            ? 'Athena is a read-only data source and does not support deletions'
                            : 'The backend does not support deleting records for this source type yet'
                    }
                };
            }

            return {
                success: false,
                message: error.message || 'Failed to delete record'
            };
        }
    }
}

// Singleton instance
let clientInstance: OntologyApiClient | null = null;

export function getOntologyApiClient(): OntologyApiClient {
    if (!clientInstance) {
        clientInstance = new OntologyApiClient();
    }
    return clientInstance;
}

export default getOntologyApiClient();
