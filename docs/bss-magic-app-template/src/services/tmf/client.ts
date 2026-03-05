// TMF API Client
import type {
  Service,
  Product,
  ShoppingCart,
  ProductOrder,
  BillingAccount,
  Individual,
  ServiceProblem,
  ServiceProblemEventRecord,
  OEServiceInfoResponse,
} from '../../types/tmf-api';

// API Configuration
// All requests go through CloudFront which proxies /tmf-api/* to the ALB
// CloudFront handles API key and CORS headers automatically
const ENVIRONMENT = import.meta.env.VITE_TMF_ENVIRONMENT || 'production';
const OE_ENVIRONMENT = 'sandbox';

// Always use relative URL - CloudFront proxies /tmf-api/* to ALB
const TMF_BASE_URL = '';

const API_KEY = import.meta.env.VITE_BSSMAGIC_API_KEY || 
  'bssmagic-d58d6761265b01accc13e8b21bae8282';

interface FetchOptions {
  params?: Record<string, string | number | boolean>;
}

// Helper to build query string
function buildQueryString(params?: Record<string, string | number | boolean>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.append(key, String(value));
  });
  return searchParams.toString();
}

// Generic fetch wrapper
async function tmfFetch<T>(endpoint: string, options?: FetchOptions & { environment?: string }): Promise<T> {
  const queryString = buildQueryString(options?.params);
  const url = `${TMF_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
  
  const headers: Record<string, string> = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
    'X-Environment': options?.environment || ENVIRONMENT,
  };
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`TMF API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Generic POST wrapper
async function tmfPost<T>(endpoint: string, body: unknown, environment?: string): Promise<T> {
  const url = `${TMF_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
    'X-Environment': environment || ENVIRONMENT,
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`TMF API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// TMF638 - Service Inventory
export async function listServices(params?: {
  limit?: number;
  x_serviceType?: string;
  x_migratedData?: boolean;
  x_has1867Issue?: boolean;
  x_replacementServiceId?: string;
}): Promise<Service[]> {
  return tmfFetch<Service[]>('/tmf-api/serviceInventoryManagement/v5/service', { params });
}

export async function getService(id: string): Promise<Service> {
  return tmfFetch<Service>(`/tmf-api/serviceInventoryManagement/v5/service/${id}`);
}

// TMF637 - Product Inventory
export async function listProducts(params?: {
  limit?: number;
  status?: string;
  'relatedParty.partyOrPartyRole.name'?: string;
}): Promise<Product[]> {
  return tmfFetch<Product[]>('/tmf-api/productInventory/v5/product', { params });
}

export async function getProduct(id: string): Promise<Product> {
  return tmfFetch<Product>(`/tmf-api/productInventory/v5/product/${id}`);
}

// Custom views for 1867 scenarios
export async function listSolution1867FibreVoice(params?: { limit?: number }): Promise<Product[]> {
  return tmfFetch<Product[]>('/tmf-api/productInventory/v5/solution1867FibreVoice', { params });
}

export async function listSolution1867FibreOnly(params?: { limit?: number }): Promise<Product[]> {
  return tmfFetch<Product[]>('/tmf-api/productInventory/v5/solution1867FibreOnly', { params });
}

export async function listSolution1867MobileEsms(params?: { limit?: number }): Promise<Product[]> {
  return tmfFetch<Product[]>('/tmf-api/productInventory/v5/solution1867MobileEsms', { params });
}

export async function listSolution1867AccessVoice(params?: { limit?: number }): Promise<Product[]> {
  return tmfFetch<Product[]>('/tmf-api/productInventory/v5/solution1867AccessVoice', { params });
}

export async function listFailedMigrationProducts(params?: { limit?: number }): Promise<Product[]> {
  return listProducts({
    limit: params?.limit || 50,
    status: 'Not Migrated Successfully',
    'relatedParty.partyOrPartyRole.name': 'Migration User',
  });
}

// TMF663 - Shopping Cart
export async function listShoppingCarts(params?: {
  limit?: number;
  status?: string;
}): Promise<ShoppingCart[]> {
  return tmfFetch<ShoppingCart[]>('/tmf-api/shoppingCart/v5/shoppingCart', { params });
}

export async function getShoppingCart(id: string): Promise<ShoppingCart> {
  return tmfFetch<ShoppingCart>(`/tmf-api/shoppingCart/v5/shoppingCart/${id}`);
}

// TMF622 - Product Ordering
export async function listProductOrders(params?: {
  limit?: number;
  state?: string;
}): Promise<ProductOrder[]> {
  return tmfFetch<ProductOrder[]>('/tmf-api/productOrderingManagement/v5/productOrder', { params });
}

export async function getProductOrder(id: string): Promise<ProductOrder> {
  return tmfFetch<ProductOrder>(`/tmf-api/productOrderingManagement/v5/productOrder/${id}`);
}

// TMF666 - Billing Account
export async function listBillingAccounts(params?: { limit?: number }): Promise<BillingAccount[]> {
  return tmfFetch<BillingAccount[]>('/tmf-api/accountManagement/v5/billingAccount', { params });
}

export async function getBillingAccount(id: string): Promise<BillingAccount> {
  return tmfFetch<BillingAccount>(`/tmf-api/accountManagement/v5/billingAccount/${id}`);
}

// TMF632 - Individual (Party Management)
export async function getIndividual(id: string): Promise<Individual> {
  return tmfFetch<Individual>(`/tmf-api/partyManagement/v5/individual/${id}`);
}

// TMF656 - Service Problem Management
export async function listServiceProblems(params?: {
  limit?: number;
  category?: string;
  status?: string;
}): Promise<ServiceProblem[]> {
  return tmfFetch<ServiceProblem[]>('/tmf-api/serviceProblemManagement/v5/serviceProblem', { params });
}

export async function getServiceProblem(id: string): Promise<ServiceProblem> {
  return tmfFetch<ServiceProblem>(`/tmf-api/serviceProblemManagement/v5/serviceProblem/${id}`);
}

export async function createServiceProblem(problem: ServiceProblem): Promise<ServiceProblem> {
  return tmfPost<ServiceProblem>('/tmf-api/serviceProblemManagement/v5/serviceProblem', problem);
}

export async function deleteServiceProblem(id: string): Promise<void> {
  const url = `${TMF_BASE_URL}/tmf-api/serviceProblemManagement/v5/serviceProblem/${id}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'X-API-Key': API_KEY,
      'X-Environment': ENVIRONMENT,
    },
  });
  if (!response.ok) throw new Error(`Failed to delete service problem: ${response.statusText}`);
}

export async function getServiceProblemEventRecord(jobId: string): Promise<ServiceProblemEventRecord> {
  return tmfFetch<ServiceProblemEventRecord>(
    `/tmf-api/serviceProblemManagement/v5/serviceProblemEventRecord/${jobId}`
  );
}

// OE Service Management (1867 Checker) -- routed to sandbox runtime
export async function getOEServiceInfo(serviceId: string): Promise<OEServiceInfoResponse> {
  const raw = await tmfFetch<Record<string, unknown>>(
    `/tmf-api/oeServiceManagement/v1/oeServiceInfo/${serviceId}`,
    { environment: OE_ENVIRONMENT },
  );

  let attachmentContent = raw.attachmentContent;

  if (typeof attachmentContent === 'string') {
    try {
      attachmentContent = JSON.parse(attachmentContent);
    } catch {
      attachmentContent = parseHstoreAttachment(attachmentContent as string);
    }
  }

  const successVal = raw.success;
  const success = typeof successVal === 'string'
    ? successVal.toLowerCase() === 'true'
    : !!successVal;

  const replVal = raw.replacementServiceExists;
  const replacementServiceExists = typeof replVal === 'string'
    ? replVal.toLowerCase() === 'true'
    : !!replVal;

  return {
    ...raw,
    attachmentContent,
    success,
    replacementServiceExists,
  } as OEServiceInfoResponse;
}

export async function postOEServiceAttachment(
  serviceId: string,
  patchedContent: unknown
): Promise<{ success: boolean; message: string }> {
  const resp = await tmfPost<{ success: string; message?: string; errorCode?: string }>(
    `/tmf-api/oeServiceManagement/v1/oeServiceAttachment`,
    { serviceId, attachmentContent: JSON.stringify(patchedContent) },
    OE_ENVIRONMENT,
  );
  if (resp.success?.toLowerCase() !== 'true') {
    throw new Error(resp.message || resp.errorCode || 'Attachment update failed on Salesforce');
  }
  return { success: true, message: resp.message || 'OK' };
}

export async function postOEServiceRemediation(
  serviceId: string,
  productDefinitionName?: string
): Promise<{ success: boolean; message: string }> {
  const resp = await tmfPost<{ success: string; message?: string; errorCode?: string }>(
    `/tmf-api/oeServiceManagement/v1/oeServiceRemediation`,
    { serviceId, productDefinitionName: productDefinitionName || 'Voice' },
    OE_ENVIRONMENT,
  );
  if (resp.success?.toLowerCase() !== 'true') {
    throw new Error(resp.message || resp.errorCode || 'Remediation trigger failed on Salesforce');
  }
  return { success: true, message: resp.message || 'OK' };
}

function pythonDictToJson(s: string): string {
  let result = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (ch === '\\') {
        result += ch + (s[i + 1] || '');
        i++;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
        result += '"';
        continue;
      }
      result += ch === '"' ? '\\"' : ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      result += '"';
      continue;
    }

    if (ch === 'T' && s.slice(i, i + 4) === 'True') {
      result += 'true';
      i += 3;
      continue;
    }
    if (ch === 'F' && s.slice(i, i + 5) === 'False') {
      result += 'false';
      i += 4;
      continue;
    }
    if (ch === 'N' && s.slice(i, i + 4) === 'None') {
      result += 'null';
      i += 3;
      continue;
    }

    result += ch;
  }
  return result;
}

function parseHstoreValue(val: string): unknown {
  const cleaned = val.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(pythonDictToJson(cleaned));
    } catch {
      return cleaned;
    }
  }
}

function parseHstoreAttachment(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const entries = splitHstoreEntries(raw);

  for (const entry of entries) {
    const parts = splitHstoreChain(entry);
    if (parts.length === 1) {
      const [key, val] = splitKeyValue(parts[0]);
      if (key) result[key] = parseHstoreValue(val);
    } else if (parts.length >= 2) {
      const topKey = extractQuotedKey(parts[0]);
      if (parts.length === 2) {
        const [, val] = splitKeyValue(parts[0] + '=>' + parts[1]);
        result[topKey] = parseHstoreValue(val);
      } else {
        const subKey = extractQuotedKey(parts[1]);
        const lastVal = parts.slice(2).join('=>');
        const subVal = lastVal.startsWith('"') ? lastVal.slice(1, -1) : lastVal;
        const obj: Record<string, unknown> = {};
        obj[subKey] = parseHstoreValue(subVal);
        result[topKey] = obj;
      }
    }
  }

  return result;
}

function splitHstoreEntries(raw: string): string[] {
  const entries: string[] = [];
  let current = '';
  let inQuote = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\\' && inQuote) {
      current += ch + (raw[i + 1] || '');
      i += 2;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
      i++;
      continue;
    }
    if (!inQuote && ch === ',' && raw[i + 1] === ' ') {
      entries.push(current.trim());
      current = '';
      i += 2;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.trim()) entries.push(current.trim());
  return entries;
}

function splitHstoreChain(entry: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let i = 0;

  while (i < entry.length) {
    const ch = entry[i];
    if (ch === '\\' && inQuote) {
      current += ch + (entry[i + 1] || '');
      i += 2;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
      i++;
      continue;
    }
    if (!inQuote && ch === '=' && entry[i + 1] === '>') {
      parts.push(current.trim());
      current = '';
      i += 2;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitKeyValue(entry: string): [string, string] {
  let inQuote = false;
  for (let i = 0; i < entry.length; i++) {
    if (entry[i] === '\\' && inQuote) { i++; continue; }
    if (entry[i] === '"') { inQuote = !inQuote; continue; }
    if (!inQuote && entry[i] === '=' && entry[i + 1] === '>') {
      const key = extractQuotedKey(entry.slice(0, i).trim());
      const val = entry.slice(i + 2).trim();
      const unquotedVal = val.startsWith('"') ? val.slice(1, -1) : val;
      return [key, unquotedVal];
    }
  }
  return ['', entry];
}

function extractQuotedKey(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// Helper function to lookup PIC Email
export async function lookupPicEmail(serviceId: string): Promise<string | null> {
  try {
    const service = await getService(serviceId);
    
    // Use x_picEmail if available (optimized field)
    if (service.x_picEmail) {
      return service.x_picEmail;
    }
    
    // Fallback: lookup through billing account
    if (!service.x_billingAccountId) {
      return null;
    }
    
    const billingAccount = await getBillingAccount(service.x_billingAccountId);
    const contactParty = billingAccount.relatedParty?.find(p => p.role === 'contact');
    
    if (!contactParty?.partyOrPartyRole?.id) {
      return null;
    }
    
    const individual = await getIndividual(contactParty.partyOrPartyRole.id);
    const emailMedium = individual.contactMedium?.find(m => m.contactType === 'email');
    
    return emailMedium?.emailAddress || null;
  } catch (error) {
    console.error('Error looking up PIC email:', error);
    return null;
  }
}

// ============================================================================
// TMF697 - Work Order Management (Batch Scheduling)
// ============================================================================

export type RecurrencePattern = 'once' | 'daily' | 'weekdays' | 'weekly' | 'custom';
export type WorkOrderState = 'pending' | 'open' | 'inProgress' | 'completed' | 'cancelled' | 'failed';

export interface WorkOrderSchedule {
  id: string;
  href?: string;
  name: string;
  description?: string;
  isActive: boolean;
  category: string;
  recurrencePattern: RecurrencePattern;
  recurrenceDays?: number[];
  windowStartTime: string;
  windowEndTime: string;
  timezone?: string;
  maxBatchSize: number;
  selectionCriteria: Record<string, unknown> | string;
  validFrom?: string;
  validTo?: string;
  createdBy?: string;
  relatedParty?: Array<{ id: string; role: string }>;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutionId?: string;
  lastExecutionDate?: string;
  nextExecutionDate?: string;
  creationDate: string;
  lastUpdate?: string;
  '@type'?: string;
  '@baseType'?: string;
}

export interface WorkOrder {
  id: string;
  href?: string;
  name: string;
  description?: string;
  state: WorkOrderState;
  category: string;
  priority?: number;
  scheduledStartDate?: string;
  startDate?: string;
  completionDate?: string;
  expectedCompletionDate?: string;
  executionWindowStart?: string;
  executionWindowEnd?: string;
  requestedQuantity: number;
  actualQuantity: number;
  relatedParty?: Array<{ id: string; role: string }>;
  note?: Array<{ text: string; date: string }>;
  characteristic?: Array<{ name: string; value: unknown }>;
  x_summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    pending: number;
  };
  x_currentItemId?: string;
  x_currentItemState?: string;
  x_configuration?: Record<string, unknown> | string;
  x_lastError?: string;
  x_recurrencePattern: RecurrencePattern;
  x_isRecurrent: boolean;
  x_parentScheduleId?: string;
  x_executionNumber?: number;
  creationDate: string;
  lastUpdate?: string;
  '@type'?: string;
  '@baseType'?: string;
}

// ==========================================
// WorkOrder APIs - Direct TMF Runtime (no localStorage)
// All operations go through TMF Runtime sandbox
// ==========================================

const BATCH_TMF_BASE = '/tmf-api/batchProcessing/v1';

// Helper for TMF Runtime requests
async function batchFetch<T>(
  endpoint: string, 
  options?: { method?: string; body?: unknown; params?: Record<string, string | number | boolean> }
): Promise<T> {
  const queryString = options?.params ? '?' + new URLSearchParams(
    Object.entries(options.params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString() : '';
  
  const url = `${TMF_BASE_URL}${BATCH_TMF_BASE}${endpoint}${queryString}`;
  const response = await fetch(url, {
    method: options?.method || 'GET',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      'X-Environment': ENVIRONMENT,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return [] as unknown as T;
    }
    throw new Error(`Batch API Error: ${response.status}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// List Work Order Schedules - from TMF Runtime
export async function listWorkOrderSchedules(params?: {
  category?: string;
  isActive?: boolean;
}): Promise<WorkOrderSchedule[]> {
  try {
    const result = await batchFetch<WorkOrderSchedule | WorkOrderSchedule[]>(
      '/batchSchedule',
      { params: params as Record<string, string | number | boolean> }
    );
    // TMF Runtime may return single object - normalize to array
    const schedules = Array.isArray(result) ? result : (result?.id ? [result] : []);
    
    // Apply filters
    let filtered = schedules;
    if (params?.category) filtered = filtered.filter(s => s.category === params.category);
    if (params?.isActive !== undefined) filtered = filtered.filter(s => s.isActive === params.isActive);
    
    return filtered;
  } catch (e) {
    console.error('[WorkOrder] listWorkOrderSchedules error:', e);
    return [];
  }
}

// Get Work Order Schedule by ID
export async function getWorkOrderSchedule(id: string): Promise<WorkOrderSchedule> {
  return batchFetch<WorkOrderSchedule>(`/batchSchedule/${id}`);
}

// Create Work Order Schedule - POST to TMF Runtime
export async function createWorkOrderSchedule(schedule: Partial<WorkOrderSchedule>): Promise<WorkOrderSchedule> {
  const payload: Record<string, unknown> = {
    id: schedule.id || `sched-${Date.now()}`,
    name: schedule.name || 'New Schedule',
    isActive: schedule.isActive ?? true,
    category: schedule.category || '',
    recurrencePattern: schedule.recurrencePattern || 'daily',
    windowStartTime: schedule.windowStartTime || '00:00',
    windowEndTime: schedule.windowEndTime || '06:00',
    maxBatchSize: schedule.maxBatchSize || 100,
    selectionCriteria: schedule.selectionCriteria || {},
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    creationDate: new Date().toISOString(),
  };
  // Pass through optional fields
  if (schedule.validFrom) payload.validFrom = schedule.validFrom;
  if (schedule.validTo) payload.validTo = schedule.validTo;
  if (schedule.recurrenceDays) payload.recurrenceDays = schedule.recurrenceDays;
  if (schedule.description) payload.description = schedule.description;

  // Compute nextExecutionDate if not explicitly provided
  // The scheduler requires this field to know when to trigger
  if (schedule.nextExecutionDate) {
    payload.nextExecutionDate = schedule.nextExecutionDate;
  } else {
    const startTime = (payload.windowStartTime as string) || '00:00';
    const [hours, minutes] = startTime.split(':').map(Number);
    const nextExec = new Date();
    nextExec.setUTCHours(hours, minutes, 0, 0);
    // If the time already passed today, schedule for tomorrow
    if (nextExec.getTime() <= Date.now()) {
      nextExec.setUTCDate(nextExec.getUTCDate() + 1);
    }
    payload.nextExecutionDate = nextExec.toISOString();
  }
  
  const result = await batchFetch<WorkOrderSchedule>('/batchSchedule', {
    method: 'POST',
    body: payload,
  });
  
  // Return complete object (merge response with payload for missing fields)
  return {
    ...payload,
    ...result,
    '@type': 'BatchSchedule',
    '@baseType': 'Entity',
  } as WorkOrderSchedule;
}

// Update Work Order Schedule - PATCH to TMF Runtime
export async function updateWorkOrderSchedule(id: string, updates: Partial<WorkOrderSchedule>): Promise<WorkOrderSchedule> {
  return batchFetch<WorkOrderSchedule>(`/batchSchedule/${id}`, {
    method: 'PATCH',
    body: updates,
  });
}

// Delete Work Order Schedule - DELETE to TMF Runtime
export async function deleteWorkOrderSchedule(id: string): Promise<void> {
  await batchFetch<void>(`/batchSchedule/${id}`, { method: 'DELETE' });
}

// List Work Orders - from TMF Runtime
export async function listWorkOrders(params?: {
  category?: string;
  state?: WorkOrderState;
  limit?: number;
  x_parentScheduleId?: string;
}): Promise<WorkOrder[]> {
  try {
    // Don't send limit to the server - fetch all items and apply limit client-side after sorting
    const serverParams: Record<string, string | number | boolean> = {};
    if (params?.category) serverParams.category = params.category;
    if (params?.state) serverParams.state = params.state;
    if (params?.x_parentScheduleId) serverParams.x_parentScheduleId = params.x_parentScheduleId;

    const result = await batchFetch<WorkOrder | WorkOrder[]>(
      '/batchJob',
      { params: serverParams }
    );
    // TMF Runtime may return single object - normalize to array
    const orders = Array.isArray(result) ? result : (result?.id ? [result] : []);
    
    // Apply client-side filters
    let filtered = orders;
    if (params?.category) filtered = filtered.filter(o => o.category === params.category);
    if (params?.state) filtered = filtered.filter(o => o.state === params.state);
    // Sort by creation date descending BEFORE slicing to ensure we get the most recent
    filtered.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
    if (params?.limit) filtered = filtered.slice(0, params.limit);
    
    return filtered;
  } catch (e) {
    console.error('[WorkOrder] listWorkOrders error:', e);
    return [];
  }
}

// Get Work Order by ID
export async function getWorkOrder(id: string): Promise<WorkOrder> {
  return batchFetch<WorkOrder>(`/batchJob/${id}`);
}

// Create Work Order - POST to TMF Runtime
export async function createWorkOrder(workOrder: Partial<WorkOrder>): Promise<WorkOrder> {
  const payload = {
    id: workOrder.id || `wo-${Date.now()}`,
    name: workOrder.name || 'New Work Order',
    state: workOrder.state || 'pending',
    category: workOrder.category || '',
    requestedQuantity: workOrder.requestedQuantity || 0,
    actualQuantity: 0,
    x_summary: JSON.stringify({ total: 0, successful: 0, failed: 0, skipped: 0, pending: workOrder.requestedQuantity || 0 }),
    x_recurrencePattern: workOrder.x_recurrencePattern || 'once',
    x_isRecurrent: workOrder.x_isRecurrent || false,
    creationDate: new Date().toISOString(),
  };
  
  const result = await batchFetch<WorkOrder>('/batchJob', {
    method: 'POST',
    body: payload,
  });
  
  return {
    ...payload,
    ...result,
    '@type': 'BatchJob',
    '@baseType': 'Entity',
  } as WorkOrder;
}

// Update Work Order - PATCH to TMF Runtime
export async function updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<WorkOrder> {
  return batchFetch<WorkOrder>(`/batchJob/${id}`, {
    method: 'PATCH',
    body: updates,
  });
}

// Cancel Work Order
export async function cancelWorkOrder(id: string, reason?: string): Promise<WorkOrder> {
  return updateWorkOrder(id, { state: 'cancelled' });
}
