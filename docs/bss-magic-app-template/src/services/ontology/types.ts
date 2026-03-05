export interface DataListParams {
    limit?: number;
    offset?: number;
    filter_field?: string;
    filter_value?: string;
}

export interface DataListResponse {
    data: any[];
    total_count: number;
    page: number;
    page_size: number;
}

export interface DataRecordResponse {
    data: any;
}

export interface NotImplementedError {
    status: 501;
    message: string;
    detail?: string;
}

export interface DataOperationResult {
    success: boolean;
    message?: string;
    error?: NotImplementedError;
}

export interface ApiError {
    detail: string;
    status_code: number;
    type?: string;
}

export interface OntologyApiConfig {
    baseUrl: string;
    headers?: Record<string, string>;
}
