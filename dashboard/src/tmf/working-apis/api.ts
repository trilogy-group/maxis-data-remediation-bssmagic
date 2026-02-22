/**
 * Working TMF APIs - Direct clients for all mapped TMF entities
 */

import { tmfFetcher } from '../tmf-fetcher';

// Types for the working APIs
export interface Service {
  id: string;
  name: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  serviceType?: string;
  '@type'?: string;
  // TMF relatedEntity (for supporting Product/Solution)
  relatedEntity?: Array<{
    role?: string;
    entity?: {
      id?: string;
      href?: string;
      name?: string;
      '@referredType'?: string;
      '@type'?: string;
      '@baseType'?: string;
    };
    '@type'?: string;
    '@baseType'?: string;
  }>;
  // TMF relatedParty (customer, billingAccount references)
  relatedParty?: Array<{
    role?: string;
    partyOrPartyRole?: {
      id?: string;
      href?: string;
      name?: string;
      '@type'?: string;
      '@referredType'?: string;
    };
    '@type'?: string;
  }>;
  // Custom fields for 1867 detection
  x_serviceType?: string;
  x_externalId?: string;
  x_billingAccountId?: string;
  x_billingAccountName?: string;
  x_picEmail?: string;
  x_subscriptionId?: string;
  x_subscriptionName?: string;
  x_accountId?: string;
  x_accountName?: string;
  x_missingBillingAccount?: boolean;
  x_missingPicEmail?: boolean;
  x_missingExternalId?: boolean;
  x_has1867Issue?: boolean;
  x_migratedData?: boolean;
  x_migratedToHeroku?: boolean;
  x_solutionId?: string;
  x_solutionName?: string;
  x_fibreVoiceOE?: boolean;
  x_fibreFibreOE?: boolean;
  x_mobileESMSOE?: boolean;
  x_accessVoiceOE?: boolean;
}

export interface PartyAccount {
  id: string;
  name?: string;
  accountType?: string;
  state?: string;
  description?: string;
  paymentStatus?: string;
  lastUpdate?: string;
  contact?: Array<{
    contactName?: string;
    contactMedium?: Array<{
      contactType?: string;
      emailAddress?: string;
      id?: string;
    }>;
  }>;
  relatedParty?: Array<{
    id?: string;
    name?: string;
    role?: string;
  }>;
  '@type'?: string;
}

export interface BillingAccount {
  id: string;
  href?: string;
  name?: string;
  accountType?: string;
  state?: string;
  description?: string;
  paymentStatus?: string;
  lastUpdate?: string;
  contact?: Array<{
    contactName?: string;
    contactMedium?: Array<{
      contactType?: string;
      emailAddress?: string;
      id?: string;
    }>;
  }>;
  // relatedParty includes contact (Individual) reference for PIC Email lookup
  relatedParty?: Array<{
    role?: string;
    partyOrPartyRole?: {
      id?: string;
      href?: string;
      name?: string;
      '@type'?: string;
      '@referredType'?: string;
    };
    '@type'?: string;
  }>;
  '@type'?: string;
  '@baseType'?: string;
}

// Individual (TMF632) - for Contact/PIC Email lookup
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
    '@type'?: string;
    '@baseType'?: string;
  }>;
  '@type'?: string;
  '@baseType'?: string;
}

// ProductOrder (TMF622) - for Order Monitor module
export interface ProductOrder {
  id: string;
  href?: string;
  state?: string;
  category?: string;
  externalId?: Array<{
    id?: string;
    externalIdentifierType?: string;
    '@type'?: string;
  }>;
  relatedParty?: Array<{
    role?: string;
    partyOrPartyRole?: {
      id?: string;
      name?: string;
      href?: string;
      '@type'?: string;
      '@referredType'?: string;
    };
    '@type'?: string;
  }>;
  requestedStartDate?: string;
  requestedCompletionDate?: string;
  completionDate?: string;
  creationDate?: string;
  '@type'?: string;
  '@baseType'?: string;
}

// ShoppingCart (TMF663) - for Order Generation Monitor
export interface ShoppingCart {
  id: string;
  href?: string;
  status?: string;
  name?: string;
  creationDate?: string;
  lastUpdate?: string;
  '@type'?: string;
}

// Product (TMF637) - for Solutions and Subscriptions
// Enhanced with full TMF637 fields from csord__Solution__c mapping
export interface Product {
  id: string;
  name?: string;
  status?: string;
  description?: string;
  isBundle?: boolean;
  isCustomerVisible?: boolean;
  productSerialNumber?: string;  // Solution_Number__c
  orderDate?: string;
  
  // Product Specification
  productSpecification?: {
    id?: string;
    name?: string;
    brand?: string;
    description?: string;
    version?: string;
    href?: string;
    '@type'?: string;
  };
  
  // Product Characteristics (solutionStatus, remediationStatus, isMigratedToHeroku)
  productCharacteristic?: Array<{
    name?: string;
    value?: string;
    valueType?: string;
    '@type'?: string;
  }>;
  
  // Product Price (TCV, RC, OTC)
  productPrice?: Array<{
    name?: string;
    description?: string;
    priceType?: string;
    recurringChargePeriod?: string;
    price?: {
      taxIncludedAmount?: {
        unit?: string;
        value?: number;
      };
      dutyFreeAmount?: {
        unit?: string;
        value?: number;
      };
      '@type'?: string;
    };
    '@type'?: string;
  }>;
  
  // Product Relationship (MACD: replaces, replacedBy)
  productRelationship?: Array<{
    id?: string;
    relationshipType?: string;
    href?: string;
    name?: string;
    '@referredType'?: string;
    '@type'?: string;
    product?: {
      id?: string;
      href?: string;
      '@referredType'?: string;
    };
  }>;
  
  // Related Party (customer Account, creator User)
  relatedParty?: Array<{
    role?: string;
    id?: string;
    href?: string;
    name?: string;
    '@referredType'?: string;
    partyOrPartyRole?: {
      id?: string;
      name?: string;
      href?: string;
      '@type'?: string;
      '@referredType'?: string;
    };
    '@type'?: string;
  }>;
  
  // Billing Account
  billingAccount?: {
    id?: string;
    name?: string;
    href?: string;
    accountNumber?: string;
    '@type'?: string;
    '@referredType'?: string;
  };
  
  // Child Products (Subscriptions linked to Solution)
  product?: Array<{
    productRef?: {
      id?: string;
      name?: string;
      href?: string;
      '@type'?: string;
      '@referredType'?: string;
    };
  }>;
  
  // Product Term (contract duration)
  productTerm?: Array<{
    name?: string;
    description?: string;
    duration?: {
      amount?: number;
      units?: string;
    };
    '@type'?: string;
  }>;
  
  // Realizing Service (via Subscription -> Service)
  realizingService?: Array<{
    id?: string;
    name?: string;
    href?: string;
    '@type'?: string;
    '@referredType'?: string;
  }>;
  
  // Dates
  startDate?: string;
  creationDate?: string;
  terminationDate?: string;
  
  // TMF fields
  href?: string;
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
}

// ProductOffering (TMF620) - for Commercial Products
export interface ProductOffering {
  id: string;
  name?: string;
  lifecycleStatus?: string;
  description?: string;
  '@type'?: string;
}

// 1867 scenario candidates - custom productInventory endpoints
export interface Solution1867Candidate {
  id: string;
  href?: string;
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string | null;

  solutionId?: string;
  solutionName?: string;
  solutionCreatedDate?: string;
  solutionDefinitionName?: string;

  isFibreService?: boolean;
  isVoiceService?: boolean;
  hasESMS?: boolean;
  isESMSService?: boolean;
  isMobileSolution?: boolean;

  basketId?: string;
  basketName?: string;
  basketStageUI?: string;
  basketStatus?: string;
}

// List Services
export type ListServiceResponse = {
  data: Service[];
  status: number;
};

export const listService = async (
  params?: { 
    limit?: number; 
    offset?: number;
    x_serviceType?: string;
    x_migratedData?: boolean;
    x_has1867Issue?: boolean;
  },
): Promise<ListServiceResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.x_serviceType) queryParams.append('x_serviceType', params.x_serviceType);
  if (params?.x_migratedData !== undefined) queryParams.append('x_migratedData', params.x_migratedData.toString());
  if (params?.x_has1867Issue !== undefined) queryParams.append('x_has1867Issue', params.x_has1867Issue.toString());
  
  const query = queryParams.toString();
  return tmfFetcher<ListServiceResponse>(
    `/service${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
};

// List Party Accounts
export type ListPartyAccountResponse = {
  data: PartyAccount[];
  status: number;
};

export const listPartyAccount = async (
  params?: { limit?: number; offset?: number },
): Promise<ListPartyAccountResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  
  const query = queryParams.toString();
  return tmfFetcher<ListPartyAccountResponse>(
    `/partyAccount${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
};

// List Billing Accounts
export type ListBillingAccountResponse = {
  data: BillingAccount[];
  status: number;
};

export const listBillingAccount = async (
  params?: { limit?: number; offset?: number },
): Promise<ListBillingAccountResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  
  const query = queryParams.toString();
  return tmfFetcher<ListBillingAccountResponse>(
    `/billingAccount${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
};

// Get single Billing Account by ID (TMF666)
export const getBillingAccount = async (id: string): Promise<BillingAccount> => {
  const response = await tmfFetcher<{ data: BillingAccount; status: number }>(`/billingAccount/${id}`, { method: 'GET' });
  return response.data;
};

// Get single Individual by ID (TMF632)
export const getIndividual = async (id: string): Promise<Individual> => {
  const response = await tmfFetcher<{ data: Individual; status: number }>(`/individual/${id}`, { method: 'GET' });
  return response.data;
};

// List Product Orders (TMF622)
export type ListProductOrderResponse = {
  data: ProductOrder[];
  status: number;
};

export const listProductOrder = async (
  params?: { limit?: number; offset?: number; state?: string },
): Promise<ListProductOrderResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.state) queryParams.append('state', params.state);
  
  const query = queryParams.toString();
  return tmfFetcher<ListProductOrderResponse>(
    `/productOrder${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
};

// List Shopping Carts (TMF663)
// NOTE: status filter not supported by runtime - filter client-side if needed
export type ListShoppingCartResponse = {
  data: ShoppingCart[];
  status: number;
};

export const listShoppingCart = async (
  params?: { limit?: number; offset?: number; status?: string },
): Promise<ListShoppingCartResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  // NOTE: status filter removed - runtime doesn't support it (causes 500 error)
  // Filter client-side instead: data.filter(cart => cart.status === params.status)
  
  const query = queryParams.toString();
  return tmfFetcher<ListShoppingCartResponse>(
    `/shoppingCart${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
};

// List Products (TMF637)
// Combined view: Solutions (isBundle=true) + Subscriptions (isBundle=false)
export type ListProductResponse = {
  data: Product[];
  status: number;
};

export const listProduct = async (
  params?: { 
    limit?: number; 
    offset?: number; 
    status?: string; 
    isBundle?: boolean;
    relatedPartyName?: string;
  },
): Promise<ListProductResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.isBundle !== undefined) queryParams.append('isBundle', params.isBundle.toString());
  // Add nested filter for relatedParty.partyOrPartyRole.name
  if (params?.relatedPartyName) {
    queryParams.append('relatedParty.partyOrPartyRole.name', params.relatedPartyName);
  }
  
  const query = queryParams.toString();
  return tmfFetcher<ListProductResponse>(
    `/product${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
};

// Get single Product by ID (TMF637)
export const getProduct = async (id: string): Promise<Product> => {
  const response = await tmfFetcher<{ data: Product; status: number }>(`/product/${id}`, { method: 'GET' });
  return response.data;
};

// List Product Offerings (TMF620)
export type ListProductOfferingResponse = {
  data: ProductOffering[];
  status: number;
};

export const listProductOffering = async (
  params?: { limit?: number; offset?: number },
): Promise<ListProductOfferingResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  
  const query = queryParams.toString();
  return tmfFetcher<ListProductOfferingResponse>(
    `/productOffering${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
};

// List 1867 scenario candidates (custom views exposed via productInventory)
export type ListSolution1867CandidateResponse = {
  data: Solution1867Candidate[];
  status: number;
};

const list1867 = async (
  path: '/solution1867FibreVoice' | '/solution1867FibreOnly' | '/solution1867MobileEsms' | '/solution1867AccessVoice',
  params?: { limit?: number; offset?: number },
): Promise<ListSolution1867CandidateResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  const query = queryParams.toString();
  return tmfFetcher<ListSolution1867CandidateResponse>(
    `${path}${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
};

export const listSolution1867FibreVoice = async (
  params?: { limit?: number; offset?: number },
): Promise<ListSolution1867CandidateResponse> => list1867('/solution1867FibreVoice', params);

export const listSolution1867FibreOnly = async (
  params?: { limit?: number; offset?: number },
): Promise<ListSolution1867CandidateResponse> => list1867('/solution1867FibreOnly', params);

export const listSolution1867MobileEsms = async (
  params?: { limit?: number; offset?: number },
): Promise<ListSolution1867CandidateResponse> => list1867('/solution1867MobileEsms', params);

export const listSolution1867AccessVoice = async (
  params?: { limit?: number; offset?: number },
): Promise<ListSolution1867CandidateResponse> => list1867('/solution1867AccessVoice', params);

// ServiceProblem (TMF656) - tracks confirmed issues and remediation progress
export interface ServiceProblem {
  id: string;
  href?: string;
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string | null;
  name?: string;
  description?: string;
  category?: string; // 'SolutionEmpty' | 'PartialDataMissing' etc.
  priority?: number;
  status?: 'pending' | 'inProgress' | 'resolved' | 'rejected' | 'acknowledged' | 'held' | 'cancelled' | 'closed';
  statusChangeDate?: string;
  statusChangeReason?: string;
  creationDate?: string;
  lastUpdate?: string;
  resolutionDate?: string;
  reason?: string;
  originatingSystem?: string;
  impactImportanceFactor?: string;
  affectedNumberOfServices?: number;
  // Complex TMF fields (arrays)
  characteristic?: Array<{
    name?: string;
    value?: string | boolean | number;
    '@type'?: string;
  }>;
  externalIdentifier?: Array<{
    id?: string;
    externalIdentifierType?: string;
    owner?: string;
    '@type'?: string;
  }>;
  relatedEntity?: Array<{
    role?: string;
    entity?: {
      id?: string;
      href?: string;
      name?: string;
      '@type'?: string;
      '@referredType'?: string;
    };
    '@type'?: string;
  }>;
  note?: Array<{
    text?: string;
    date?: string;
    author?: string;
    '@type'?: string;
  }>;
  // Helper getters for common use cases
  solutionId?: string; // extracted from externalIdentifier or relatedEntity
  solutionName?: string; // extracted from relatedEntity
  module?: string; // extracted from category
}

export type ListServiceProblemResponse = {
  data: ServiceProblem[];
  status: number;
};

// Endpoint uses serviceProblemManagement API
const SERVICE_PROBLEM_BASE = '/serviceProblem';

export const listServiceProblem = async (
  params?: { limit?: number; offset?: number; category?: string; status?: string },
): Promise<ListServiceProblemResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.category) queryParams.append('category', params.category);
  if (params?.status) queryParams.append('status', params.status);

  const query = queryParams.toString();
  const raw = await tmfFetcher<ServiceProblem | ServiceProblem[] | ListServiceProblemResponse>(
    `${SERVICE_PROBLEM_BASE}${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );

  // Handle different response shapes
  if ('data' in raw && Array.isArray((raw as ListServiceProblemResponse).data)) {
    return raw as ListServiceProblemResponse;
  }
  if (Array.isArray(raw)) {
    return { data: raw as ServiceProblem[], status: 200 };
  }
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return { data: [raw as ServiceProblem], status: 200 };
  }
  return { data: [], status: 200 };
};

export const getServiceProblem = async (id: string): Promise<ServiceProblem> => {
  const response = await tmfFetcher<{ data: ServiceProblem; status: number }>(`${SERVICE_PROBLEM_BASE}/${id}`, { method: 'GET' });
  return response.data;
};

export const createServiceProblem = async (
  problem: Omit<ServiceProblem, 'id' | 'href'>,
): Promise<ServiceProblem> => {
  return tmfFetcher<ServiceProblem>(SERVICE_PROBLEM_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(problem),
  });
};

export const patchServiceProblem = async (
  id: string,
  update: Partial<ServiceProblem>,
): Promise<ServiceProblem> => {
  return tmfFetcher<ServiceProblem>(`${SERVICE_PROBLEM_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
};

// Helper to extract common fields from ServiceProblem
export function extractServiceProblemDetails(problem: ServiceProblem) {
  const solutionId = problem.externalIdentifier?.find(e => e.externalIdentifierType === 'SolutionId')?.id
    || problem.relatedEntity?.find(e => e.role === 'solution')?.entity?.id
    || problem.id;
  const solutionName = problem.relatedEntity?.find(e => e.role === 'solution')?.entity?.name
    || problem.name;
  const module = problem.category || 'unknown';
  const jobId = problem.characteristic?.find(c => c.name === 'jobId')?.value as string | undefined;
  const resultMessage = problem.characteristic?.find(c => c.name === 'resultMessage')?.value as string | undefined;

  return {
    solutionId,
    solutionName,
    module,
    jobId,
    resultMessage,
    status: problem.status,
    createdAt: problem.creationDate,
    updatedAt: problem.lastUpdate,
    description: problem.description,
  };
}