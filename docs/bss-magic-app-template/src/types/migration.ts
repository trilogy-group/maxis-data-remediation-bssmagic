export type MigrationPhase = 'setup' | 'analysis' | 'mapping' | 'transformation' | 'execution' | 'validation' | 'reinforcement';
export type MigrationStatus = 'preparing' | 'analyzing' | 'mapping' | 'transforming' | 'validating' | 'learning' | 'completed' | 'failed';
export type FileType = 'csv' | 'json' | 'xml' | 'excel' | 'schema' | 'database' | 'api';
export type SourceType = 'file' | 'folder' | 'database' | 'api' | 'stream';

export interface SchemaDefinition {
  fields: SchemaField[];
  totalRecords: number;
  sampleData: any[];
  relationships?: SchemaRelationship[];
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'enum';
  required: boolean;
  description?: string;
  sampleValues: any[];
  dataQuality: DataQualityMetrics;
  constraints?: FieldConstraints;
  businessRules?: BusinessRule[];
}

export interface FieldConstraints {
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  enumValues?: string[];
  unique?: boolean;
  nullable?: boolean;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface SchemaRelationship {
  sourceField: string;
  targetField: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  cardinality: string;
}

export interface DataQualityMetrics {
  completeness: number; // 0-1
  accuracy: number; // 0-1
  consistency: number; // 0-1
  uniqueness: number; // 0-1
  validity: number; // 0-1
  timeliness: number; // 0-1
  integrity: number; // 0-1
}

export interface AIAnalysisResult {
  confidence: number; // 0-1
  detectedFormat: FileType;
  suggestedMappings: FieldMapping[];
  dataQualityIssues: DataQualityIssue[];
  semanticInsights: SemanticInsight[];
  entityRecognition: EntityRecognitionResult[];
  transformationSuggestions: TransformationSuggestion[];
  learningRecommendations: LearningRecommendation[];
}

export interface EntityRecognitionResult {
  entityName: string;
  confidence: number;
  detectedFields: string[];
  businessContext: string;
  suggestedTMFMapping: string;
}

export interface TransformationSuggestion {
  sourceField: string;
  targetField: string;
  transformationType: 'format' | 'type' | 'calculation' | 'lookup' | 'validation' | 'enrichment';
  transformationRule: string;
  confidence: number;
  examples: TransformationExample[];
}

export interface TransformationExample {
  input: any;
  output: any;
  confidence: number;
}

export interface LearningRecommendation {
  type: 'sample_data' | 'business_rules' | 'validation_rules' | 'transformation_rules';
  description: string;
  priority: 'low' | 'medium' | 'high';
  impact: string;
  suggestedActions: string[];
}

export interface FieldMapping {
  id: string;
  sourceField: string;
  targetEntity: string;
  targetProperty: string;
  confidence: number;
  transformationRule?: TransformationRule;
  validationRules?: ValidationRule[];
  businessContext?: string;
  aiConfidence: number;
  userConfidence?: number;
  learningHistory: LearningHistory[];
}

export interface TransformationRule {
  id: string;
  type: 'format' | 'type' | 'calculation' | 'lookup' | 'validation' | 'enrichment' | 'custom';
  expression: string;
  parameters?: Record<string, any>;
  examples: TransformationExample[];
  aiGenerated: boolean;
  userModified: boolean;
  performance: number; // 0-1
}

export interface ValidationRule {
  id: string;
  type: 'format' | 'range' | 'pattern' | 'business' | 'custom';
  expression: string;
  errorMessage: string;
  severity: 'error' | 'warning' | 'info';
}

export interface LearningHistory {
  timestamp: string;
  action: 'mapping_created' | 'mapping_modified' | 'transformation_added' | 'validation_added' | 'sample_provided';
  confidence: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  aiSuggestion?: string;
}

export interface DataQualityIssue {
  type: 'missing_values' | 'duplicates' | 'invalid_format' | 'outliers' | 'inconsistencies' | 'business_rule_violation';
  field: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedFix: string;
  affectedRecords: number;
  aiSuggestedFix?: string;
  userAccepted?: boolean;
}

export interface SemanticInsight {
  type: 'pattern' | 'relationship' | 'business_rule' | 'anomaly' | 'trend' | 'correlation';
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  affectedFields: string[];
  businessImplication: string;
}

export interface SourceFile {
  id: string;
  name: string;
  type: FileType;
  sourceType: SourceType;
  size: number;
  uploadedAt: string;
  schema?: SchemaDefinition;
  sampleData?: any[];
  aiAnalysis?: AIAnalysisResult;
  metadata?: FileMetadata;
  processingStatus: 'pending' | 'analyzing' | 'analyzed' | 'error';
  fileObject?: File;
}

export interface FileMetadata {
  encoding?: string;
  delimiter?: string;
  hasHeader?: boolean;
  totalRows?: number;
  columns?: string[];
  filePath?: string;
  databaseInfo?: DatabaseInfo;
  apiInfo?: ApiInfo;
}

export interface DatabaseInfo {
  type: 'mysql' | 'postgresql' | 'oracle' | 'sqlserver' | 'mongodb' | 'other';
  host?: string;
  port?: number;
  database?: string;
  table?: string;
  connectionString?: string;
}

export interface ApiInfo {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  authentication?: string;
  headers?: Record<string, string>;
  parameters?: Record<string, string>;
}

export interface MigrationError {
  id: string;
  type: 'validation' | 'transformation' | 'system' | 'mapping' | 'business_rule';
  message: string;
  field?: string;
  recordIndex?: number;
  severity: 'error' | 'warning';
  timestamp: string;
  aiSuggestedFix?: string;
  userAction?: 'ignored' | 'fixed' | 'pending';
}

export interface MigrationWarning {
  id: string;
  message: string;
  field?: string;
  recordIndex?: number;
  timestamp: string;
  aiContext?: string;
}

export interface TransformationLog {
  id: string;
  phase: MigrationPhase;
  message: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  details?: any;
  aiGenerated?: boolean;
  performanceMetrics?: PerformanceMetrics;
}

export interface PerformanceMetrics {
  processingTime: number;
  recordsPerSecond: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
}

export interface MigrationExecution {
  id: string;
  status: MigrationStatus;
  progress: number;
  recordsProcessed: number;
  totalRecords: number;
  errors: MigrationError[];
  warnings: MigrationWarning[];
  transformationLogs: TransformationLog[];
  startTime: string;
  endTime?: string;
  performanceMetrics: PerformanceMetrics;
  aiInsights: AIExecutionInsight[];
}

export interface AIExecutionInsight {
  type: 'optimization' | 'anomaly' | 'trend' | 'quality' | 'performance';
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  suggestedAction?: string;
}

export interface ReinforcementLearningSession {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  status: 'active' | 'paused' | 'completed';
  mappings: FieldMapping[];
  sampleData: SampleDataEntry[];
  learningMetrics: LearningMetrics;
  aiModelVersion: string;
}

export interface SampleDataEntry {
  id: string;
  sourceData: Record<string, any>;
  targetData: Record<string, any>;
  userFeedback: 'correct' | 'incorrect' | 'partial';
  aiConfidence: number;
  timestamp: string;
  notes?: string;
}

export interface LearningMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingSamples: number;
  validationSamples: number;
  lastUpdated: string;
}

export interface DocumentationEntry {
  id: string;
  type: 'business_rule' | 'transformation_rule' | 'validation_rule' | 'mapping_rule' | 'data_quality' | 'api_documentation';
  title: string;
  description: string;
  content: string;
  tags: string[];
  relatedFields: string[];
  relatedEntities: string[];
  createdAt: string;
  updatedAt: string;
  aiGenerated: boolean;
  userModified: boolean;
  version: string;
}

export interface MigrationState {
  currentPhase: MigrationPhase;
  sourceFiles: SourceFile[];
  targetSchema?: SchemaDefinition;
  mappings: FieldMapping[];
  execution?: MigrationExecution;
  reinforcementLearning?: ReinforcementLearningSession[];
  documentation: DocumentationEntry[];
  aiModelVersion: string;
  learningEnabled: boolean;
  autoMappingEnabled: boolean;
  qualityThreshold: number;
} 