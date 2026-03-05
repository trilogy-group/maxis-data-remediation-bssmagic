// TMF API Types based on BSS Magic Dashboard Requirements Specification

// Common types
export interface RelatedParty {
  role?: string;
  partyOrPartyRole?: {
    id?: string;
    name?: string;
    href?: string;
    '@referredType'?: string;
  };
}

export interface RelatedEntity {
  role?: string;
  entity?: {
    id?: string;
    name?: string;
    href?: string;
    '@referredType'?: string;
  };
}

export interface Characteristic {
  name?: string;
  value?: string | boolean | number;
  valueType?: string;
}

// TMF638 - Service
export interface Service {
  id: string;
  name: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  serviceType?: string;
  '@type'?: string;
  href?: string;
  relatedEntity?: RelatedEntity[];
  relatedParty?: RelatedParty[];
  
  // Custom 1867 detection fields (all direct from csord__Service__c, no JOINs)
  x_serviceType?: string;
  x_externalId?: string;
  x_billingAccountId?: string;
  x_billingAccountName?: string;
  x_picEmail?: string;
  x_subscriptionId?: string;
  x_subscriptionName?: string;
  x_accountId?: string;
  x_accountName?: string;
  x_solutionId?: string;
  x_solutionName?: string;
  x_migratedData?: boolean;
  x_migratedToHeroku?: boolean;
  x_has1867Issue?: boolean;
  x_replacementServiceId?: string;
  x_productConfigurationId?: string;
  x_missingBillingAccount?: boolean;
  x_missingPicEmail?: boolean;
  x_missingExternalId?: boolean;
  x_fibreVoiceOE?: boolean;
  x_fibreFibreOE?: boolean;
  x_mobileESMSOE?: boolean;
  x_accessVoiceOE?: boolean;
}

// TMF637 - Product
export interface Product {
  id: string;
  name?: string;
  status?: string;
  description?: string;
  isBundle?: boolean;
  isCustomerVisible?: boolean;
  productSerialNumber?: string;
  orderDate?: string;
  href?: string;
  
  productSpecification?: {
    id?: string;
    name?: string;
    brand?: string;
    description?: string;
  };
  
  productCharacteristic?: Characteristic[];
  
  productPrice?: Array<{
    name?: string;
    priceType?: string;
    price?: {
      taxIncludedAmount?: {
        value?: number;
        unit?: string;
      };
    };
    recurringChargePeriod?: string;
  }>;
  
  productTerm?: Array<{
    duration?: {
      amount?: number;
      units?: string;
    };
    validFor?: {
      startDateTime?: string;
      endDateTime?: string;
    };
  }>;
  
  product?: Array<{
    productRef?: {
      id?: string;
      name?: string;
      href?: string;
    };
  }>;
  
  productRelationship?: Array<{
    relationshipType?: string;
    id?: string;
    href?: string;
    product?: {
      id?: string;
      name?: string;
    };
  }>;
  
  relatedParty?: RelatedParty[];
  
  billingAccount?: {
    id?: string;
    name?: string;
    href?: string;
  };
  
  realizingService?: Array<{
    id?: string;
    name?: string;
    href?: string;
  }>;
  
  creationDate?: string;
  startDate?: string;
  terminationDate?: string;
  lastUpdate?: string;
}

// TMF663 - ShoppingCart
export interface ShoppingCart {
  id: string;
  href?: string;
  status?: string;
  name?: string;
  creationDate?: string;
  lastUpdate?: string;
  '@type'?: string;
}

// TMF622 - ProductOrder
export interface ProductOrder {
  id: string;
  href?: string;
  state?: string;
  category?: string;
  
  externalId?: Array<{
    id?: string;
    externalIdentifierType?: string;
  }>;
  
  relatedParty?: RelatedParty[];
  
  requestedStartDate?: string;
  requestedCompletionDate?: string;
  completionDate?: string;
  creationDate?: string;
}

// TMF666 - BillingAccount
export interface BillingAccount {
  id: string;
  href?: string;
  name?: string;
  accountType?: string;
  state?: string;
  description?: string;
  paymentStatus?: string;
  lastUpdate?: string;
  relatedParty?: RelatedParty[];
  '@type'?: string;
  '@baseType'?: string;
}

// TMF632 - Individual
export interface Individual {
  id: string;
  href?: string;
  name?: string;
  familyName?: string;
  givenName?: string;
  formattedName?: string;
  contactMedium?: Array<{
    contactType?: string;
    emailAddress?: string;
    phoneNumber?: string;
  }>;
  '@type'?: string;
  '@baseType'?: string;
}

// TMF656 - ServiceProblem
export interface ServiceProblem {
  id?: string;
  href?: string;
  name?: string;
  category?: string;
  description?: string;
  priority?: number;
  status?: string;
  reason?: string;
  impactImportanceFactor?: string;
  
  affectedResource?: Array<{
    id?: string;
    name?: string;
    href?: string;
    '@referredType'?: string;
    '@type'?: string;
  }>;
  
  characteristic?: Array<{
    '@type'?: string;
    name: string;
    value: string | number | boolean;
  }>;
  
  externalIdentifier?: Array<{
    id: string;
    externalIdentifierType?: string;
    owner?: string;
    '@type'?: string;
  }>;
  
  trackingRecord?: Array<{
    description?: string;
    time?: string;
    user?: string;
    '@type'?: string;
  }>;
  
  errorMessage?: Array<{
    code?: string;
    message?: string;
    reason?: string;
  }>;
  
  extensionInfo?: Array<{
    name?: string;
    value?: string;
    valueType?: string;
  }>;
  
  creationDate?: string;
  lastUpdate?: string;
  statusChangeDate?: string;
  resolutionDate?: string;
  '@type'?: string;
}

// ServiceProblemEventRecord (AsyncApexJob tracking)
export interface ServiceProblemEventRecord {
  id: string;
  eventType?: string;
  eventTime?: string;
  recordTime?: string;
  notification?: {
    '@type'?: string;
    '@baseType'?: string;
    '@schemaLocation'?: string;
  };
}

// CloudSense Gateway Types
export interface ConfigurationsResponse {
  success: boolean;
  basketId: string;
  basketName?: string;
  solutionName?: string;
  configurations?: Array<{
    guid: string;
    name: string;
    orderEnrichmentList?: Array<{
      guid: string;
      name: string;
      attributes?: Array<{
        name: string;
        value: string;
        displayValue?: string;
      }>;
    }>;
  }>;
}

export interface OEAttribute {
  name: string;
  value: string;
  displayValue?: string;
}

export interface OEAnalysis {
  configName: string;
  oeName: string;
  attributes: OEAttribute[];
  missingFields: string[];
  missingCount: number;
}

// 1147 Gateway Types
export interface PatchFieldRequest {
  fieldName: string;
  value: string;
  label: string;
}

export interface PatchCompleteRequest {
  serviceId: string;
  serviceType: string;
  fieldsToPatch: PatchFieldRequest[];
  dryRun?: boolean;
}

export interface PatchCompleteResponse {
  success: boolean;
  serviceId: string;
  patchedFields: Array<{
    fieldName: string;
    value: string;
    source: string;
    newValue: string;
  }>;
  cloudsenseDBUpdated: boolean;
  attachmentUpdated: boolean;
  backupAttachmentId?: string;
  remainingMissingFields: string[];
}

// OE Service Management Types (1867)
export interface OEAttachmentAttribute {
  name: string;
  value: string;
  label: string;
}

export interface OEProductSection {
  [productName: string]: {
    attributes: OEAttachmentAttribute[];
  };
}

export interface OEAttachmentContent {
  NonCommercialProduct: OEProductSection[];
  CommercialProduct: {
    attributes: OEAttachmentAttribute[];
  };
}

export interface OEServiceInfoResponse {
  id: string;
  serviceId: string;
  serviceName?: string;
  productDefinitionName: string;
  replacementServiceId?: string | null;
  replacementServiceExists: boolean;
  attachmentId: string;
  attachmentContent: OEAttachmentContent;
  success: boolean;
  status: string;
  message: string;
  errorCode?: string;
}

export interface OEMissingAttribute {
  section: 'NonCommercial' | 'Commercial';
  productName: string;
  attributeName: string;
  currentValue: string;
  currentLabel: string;
  resolvedValue?: string;
  resolvedLabel?: string;
  resolvedSource?: string;
}

export interface OEServiceAnalysis {
  serviceId: string;
  serviceName: string;
  productDefinitionName: string;
  replacementServiceExists: boolean;
  attachmentId: string;
  totalAttributes: number;
  populatedAttributes: number;
  missingAttributes: OEMissingAttribute[];
  isCandidate: boolean;
}

// Module Types
export type ModuleId = 'oe-patcher' | 'oe-checker' | 'solution-empty' | 'order-not-gen' | 'iot-qbs' | 'remediation-history';

export interface Module {
  id: ModuleId;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export type ScenarioType = 'fibre-voice' | 'fibre-only' | 'mobile-esms' | 'access-voice';

export interface Scenario {
  id: ScenarioType;
  name: string;
  description: string;
  requiredFields: string[];
}
