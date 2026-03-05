export type JourneyStepType = 'start' | 'process' | 'decision' | 'end' | 'subprocess' | 'event';
export type JourneyStatus = 'draft' | 'review' | 'approved' | 'implemented';
export type ConnectionPoint = 'top' | 'bottom' | 'left' | 'right';
export type ConnectionStyle = 'straight' | 'curved' | 'orthogonal';
export type ConnectionType = 'normal' | 'data-flow';

export interface Variable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  description: string;
  defaultValue?: any;
  isRequired: boolean;
}

export interface AssociatedSchema {
  schemaName: string;
  schemaType: 'TMF_API' | 'Data_Model' | 'Business_Entity' | 'Process_Schema';
  schemaContext: string;
  schemaId?: string;
  tmfVersion?: string;
}

export interface TmfApi {
  apiName: string;
  endpoint: string;
  method: string;
  purpose: string;
  connectedExternalApis: string[];
}

export interface ExternalApi {
  apiName: string;
  endpoint: string;
  method: string;
  purpose: string;
  payload_structure?: any;
  response_structure?: any;
  connectedTmfApi: string;
}

export interface CrossPlatformIntegration {
  enabled: boolean;
  platformType: string;
  apiMappings: Array<{
    tmfApi: string;
    externalApi: string;
    dataFlow: string;
    purpose: string;
  }>;
}

export interface JourneyStep {
  id: string;
  name: string;
  type: JourneyStepType;
  x: number;
  y: number;
  width: number;
  height: number;
  requiredEntities: string[];
  associatedSchemas?: AssociatedSchema[];
  tmfApis?: TmfApi[];
  externalApis?: ExternalApi[];
  crossPlatformIntegration?: CrossPlatformIntegration | null;
  variables: Variable[];
  description: string;
  estimatedDuration: number;
  owner: string;
  status: JourneyStatus;
  tmfApi?: { id: string; name: string };
}

export interface TemplateStep {
  name: string;
  type: JourneyStepType;
  estimatedDuration: number;
  description: string;
  requiredEntities: string[];
  associatedSchemas?: AssociatedSchema[];
  tmfApis?: TmfApi[];
  externalApis?: ExternalApi[];
  crossPlatformIntegration?: CrossPlatformIntegration | null;
  variables: Variable[];
  tmfApi?: { id: string; name: string };
}

export interface JourneyTemplate {
  name: string;
  description: string;
  category: string;
  estimatedDuration: number;
  etomCompliant: boolean;
  requiredEntities: string[];
  steps: TemplateStep[];
}

// Extended journey template that can be either classic or network visualization format
export interface ExtendedJourneyTemplate {
  name: string;
  description: string;
  category: string;
  estimatedDuration?: number;
  etomCompliant?: boolean;
  requiredEntities?: string[];
  steps?: TemplateStep[];
  // New network visualization format
  networkVisualization?: EtomJourneyVisualization;
  type: 'classic' | 'network' | 'etom-enhanced';
}

export interface JourneyConnection {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  sourcePoint: ConnectionPoint;
  targetPoint: ConnectionPoint;
  style: ConnectionStyle;
  type: ConnectionType;
  label?: string;
  condition?: string;
} 

// --- New eTOM Graph Types (backward compatible: existing types remain unchanged) ---

export type EtomProcessLevel = 1 | 2 | 3 | 4 | 5;

export interface EtomProcessNode {
  id: string; // eTOM process identifier, e.g., "1.5.8"
  uid?: string; // Optional eTOM UID, e.g., "102"
  name: string;
  domain: string; // e.g., "Resource Domain", "Service Domain"
  level: EtomProcessLevel;
  process_identifier?: string; // Process identifier for display, typically same as id
  briefDescription?: string;
  extendedDescription?: string;
  parentId?: string; // Parent process identifier if available
  nextProcessIds: string[]; // Directed edges to other processes (by id)
  requiredEntities?: string[]; // Entities required by this process
}

export interface EtomEntityNode {
  id: string; // Unique id for the entity node
  name: string; // Friendly entity name, e.g., "CellTower"
  schemaName: string; // Underlying schema, e.g., "PhysicalResource", "Place", "Alarm"
  domain: string; // Domain to which this entity belongs (Resource, Service, Product, etc.)
  tmfApi?: string; // e.g., "tmf639-resource-inventory-management-api"
  entityType?: string; // More specific type info (e.g., "CellTower")
  inheritsFrom?: string[]; // Optional inheritance chain for schemas like Place
  linkedProcessId: string; // The eTOM process id this entity is primarily associated with
  nextEntityIds?: string[]; // Directed edges to other entities (by id)
  infographic?: string; // Optional SVG content for visual representation
}

export interface LabeledEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string; // Optional label for visualization
}

export interface EtomJourneyVisualization {
  name: string;
  description?: string;
  processes: EtomProcessNode[];
  processEdges: LabeledEdge[]; // edges between process nodes
  entities: EtomEntityNode[];
  entityEdges: LabeledEdge[]; // edges between entity nodes
}