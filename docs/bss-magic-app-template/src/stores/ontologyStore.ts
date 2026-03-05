/**
 * Ontology Store
 * 
 * Generic store for managing ontology data (entities, records, etc.)
 * Apps can extend this pattern for domain-specific data management.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getOntologyApiClient } from '../services/ontology/client';

/** Generic entity record type */
export interface EntityRecord {
    id: string;
    [key: string]: any;
}

/** Pagination state */
export interface PaginationState {
    offset: number;
    limit: number;
    total: number;
    page: number;
}

/** Entity data state */
export interface EntityDataState {
    records: EntityRecord[];
    loading: boolean;
    loaded: boolean;
    error: string | null;
    pagination: PaginationState;
}

/** Ontology store state interface */
interface OntologyState {
    // Entity data by entityKey (e.g., "api:entity")
    entities: Record<string, EntityDataState>;
    
    // Global loading state
    loading: boolean;
    error: string | null;
    
    // Actions
    loadEntityRecords: (
        apiName: string,
        entityName: string,
        options?: {
            limit?: number;
            offset?: number;
            filterField?: string;
            filterValue?: string;
        }
    ) => Promise<void>;
    
    getEntityRecords: (apiName: string, entityName: string) => EntityRecord[];
    isEntityLoading: (apiName: string, entityName: string) => boolean;
    isEntityLoaded: (apiName: string, entityName: string) => boolean;
    getEntityError: (apiName: string, entityName: string) => string | null;
    
    // Clear data
    clearEntity: (apiName: string, entityName: string) => void;
    clearAll: () => void;
}

/** Generate a unique key for entity data storage */
function getEntityKey(apiName: string, entityName: string): string {
    return `${apiName}:${entityName}`;
}

/** Default pagination state */
const defaultPagination: PaginationState = {
    offset: 0,
    limit: 100,
    total: 0,
    page: 1,
};

/** Default entity data state */
const defaultEntityState: EntityDataState = {
    records: [],
    loading: false,
    loaded: false,
    error: null,
    pagination: { ...defaultPagination },
};

export const useOntologyStore = create<OntologyState>()(
    devtools(
        (set, get) => ({
            // Initial state
            entities: {},
            loading: false,
            error: null,

            loadEntityRecords: async (
                apiName: string,
                entityName: string,
                options = {}
            ) => {
                const entityKey = getEntityKey(apiName, entityName);
                const { limit = 100, offset = 0, filterField, filterValue } = options;

                // Get current entity state or default
                const currentState = get().entities[entityKey] || { ...defaultEntityState };

                // Don't reload if already loading
                if (currentState.loading) {
                    console.log(`[OntologyStore] ${entityKey} already loading, skipping`);
                    return;
                }

                // Mark as loading
                set((state) => ({
                    entities: {
                        ...state.entities,
                        [entityKey]: {
                            ...currentState,
                            loading: true,
                            error: null,
                        },
                    },
                }));

                try {
                    const client = getOntologyApiClient();
                    const response = await client.listEntityRecords(apiName, entityName, {
                        limit,
                        offset,
                        filter_field: filterField,
                        filter_value: filterValue,
                    });

                    console.log(`[OntologyStore] Loaded ${response.data.length} records for ${entityKey}`);

                    set((state) => ({
                        entities: {
                            ...state.entities,
                            [entityKey]: {
                                records: response.data,
                                loading: false,
                                loaded: true,
                                error: null,
                                pagination: {
                                    offset,
                                    limit,
                                    total: response.total_count,
                                    page: response.page,
                                },
                            },
                        },
                    }));
                } catch (error: any) {
                    console.error(`[OntologyStore] Error loading ${entityKey}:`, error);

                    set((state) => ({
                        entities: {
                            ...state.entities,
                            [entityKey]: {
                                ...currentState,
                                loading: false,
                                error: error.message || 'Failed to load entity records',
                            },
                        },
                    }));
                }
            },

            getEntityRecords: (apiName: string, entityName: string): EntityRecord[] => {
                const entityKey = getEntityKey(apiName, entityName);
                return get().entities[entityKey]?.records || [];
            },

            isEntityLoading: (apiName: string, entityName: string): boolean => {
                const entityKey = getEntityKey(apiName, entityName);
                return get().entities[entityKey]?.loading || false;
            },

            isEntityLoaded: (apiName: string, entityName: string): boolean => {
                const entityKey = getEntityKey(apiName, entityName);
                return get().entities[entityKey]?.loaded || false;
            },

            getEntityError: (apiName: string, entityName: string): string | null => {
                const entityKey = getEntityKey(apiName, entityName);
                return get().entities[entityKey]?.error || null;
            },

            clearEntity: (apiName: string, entityName: string) => {
                const entityKey = getEntityKey(apiName, entityName);
                set((state) => {
                    const { [entityKey]: _, ...rest } = state.entities;
                    return { entities: rest };
                });
            },

            clearAll: () => {
                set({ entities: {}, loading: false, error: null });
            },
        }),
        {
            name: 'ontology-store',
        }
    )
);

export default useOntologyStore;
