export type EntityType = string; // Allow any string for normalized domain names

export interface PropertyConstraints {
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  enumValues?: string[];
}

export interface Property {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'enum';
  required: boolean;
  description: string;
  defaultValue?: any;
  constraints?: PropertyConstraints;
  isKey: boolean;
  isInherited?: boolean;
  inheritedFrom?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Property[];
  color: string;
  description: string;
  isLocked: boolean;
  isVisible: boolean;
  tags: string[];
  // TMF API information for property loading (separate from source system)
  apiName?: string; // TMF API name for loading schema properties
  schemaName?: string; // Schema name for loading schema properties
  domainName?: string; // TMF domain name for display (e.g., "Customer Management", "Product Catalog")
  // Source system fields for future use (underlying systems of records)
  sourceSystem?: string;
  sourceConnectionType?: 'DB' | 'API';
  connectionStatus?: 'connected' | 'not connected' | 'disconnected';
  // New source systems array field from API
  source_systems?: Array<{
    source_id: string;
    source_name: string;
    source_type: string;
  }> | null;
  // Legacy source connection fields from API (for backward compatibility)
  source_id?: string;
  source_name?: string;
  source_type?: string;
  createdAt: string;
  updatedAt: string;
  validation: ValidationResult;
  /**
   * Optional: If this entity inherits from another, this is the base entity's id.
   */
  baseEntityId?: string;
  inheritsFrom?: string[];
  infographic?: string;
  repository_url?: string | null;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'OneToOne' | 'OneToMany' | 'ManyToMany' | 'ManyToOne';
  label: string;
  description: string;
  sourceCardinality: string;
  targetCardinality: string;
}

export interface CanvasState {
  offsetX: number;
  offsetY: number;
  scale: number;
  isPanning: boolean;
  gridSize: number;
  selectedEntityId?: string;
  selectedRelationshipId?: string;
} 