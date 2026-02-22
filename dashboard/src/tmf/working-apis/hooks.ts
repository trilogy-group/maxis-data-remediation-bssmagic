/**
 * React Query hooks for working TMF APIs
 */

import type { QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { key, wrapQuery } from '@/tmf/core';
import * as api from './api';
import type { 
  ListServiceResponse, 
  ListPartyAccountResponse, 
  ListBillingAccountResponse,
  ListProductOrderResponse,
  ListShoppingCartResponse,
  ListProductResponse,
  ListProductOfferingResponse,
  ListSolution1867CandidateResponse,
  ListServiceProblemResponse,
  Service,
  BillingAccount,
  Individual
} from './api';

// Service hooks (TMF638)
export function useServiceList(
  params?: { 
    limit?: number; 
    offset?: number;
    x_serviceType?: string;
    x_migratedData?: boolean;
    x_has1867Issue?: boolean;
  },
  options?: Omit<
    UseQueryOptions<ListServiceResponse, Error, ListServiceResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListServiceResponse, Error> {
  return wrapQuery(
    key('TMF638', 'service', params),
    () => api.listService(params),
    options
  );
}

// 1867 Service Candidate hooks - NEW service-based detection
// Category 1: Voice services (Fibre Solution - Voice Service OE)
export function useService1867VoiceList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListServiceResponse, Error, ListServiceResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListServiceResponse, Error> {
  return wrapQuery(
    key('TMF638', 'service1867Voice', params),
    () => api.listService({ ...params, x_serviceType: 'Voice', x_migratedData: true }),
    options
  );
}

// Category 2: Fibre Service services (Fibre Solution - Fibre Service OE)
export function useService1867FibreList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListServiceResponse, Error, ListServiceResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListServiceResponse, Error> {
  return wrapQuery(
    key('TMF638', 'service1867Fibre', params),
    () => api.listService({ ...params, x_serviceType: 'Fibre Service', x_migratedData: true }),
    options
  );
}

// Category 3: eSMS Service services (Mobile Solution - ESMS OE)
export function useService1867EsmsList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListServiceResponse, Error, ListServiceResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListServiceResponse, Error> {
  return wrapQuery(
    key('TMF638', 'service1867Esms', params),
    () => api.listService({ ...params, x_serviceType: 'eSMS Service', x_migratedData: true }),
    options
  );
}

// Category 4: Access Service services (Access & Voice Solution - Access OE)
export function useService1867AccessList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListServiceResponse, Error, ListServiceResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListServiceResponse, Error> {
  return wrapQuery(
    key('TMF638', 'service1867Access', params),
    () => api.listService({ ...params, x_serviceType: 'Access Service', x_migratedData: true }),
    options
  );
}

// Party Account hooks (TMF666)
export function usePartyAccountList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListPartyAccountResponse, Error, ListPartyAccountResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListPartyAccountResponse, Error> {
  return wrapQuery(
    key('TMF666', 'partyAccount', params),
    () => api.listPartyAccount(params),
    options
  );
}

// Billing Account hooks (TMF666)
export function useBillingAccountList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListBillingAccountResponse, Error, ListBillingAccountResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListBillingAccountResponse, Error> {
  return wrapQuery(
    key('TMF666', 'billingAccount', params),
    () => api.listBillingAccount(params),
    options
  );
}

// Product Order hooks (TMF622)
export function useProductOrderList(
  params?: { limit?: number; offset?: number; state?: string },
  options?: Omit<
    UseQueryOptions<ListProductOrderResponse, Error, ListProductOrderResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListProductOrderResponse, Error> {
  return wrapQuery(
    key('TMF622', 'productOrder', params),
    () => api.listProductOrder(params),
    options
  );
}

// Shopping Cart hooks (TMF663)
export function useShoppingCartList(
  params?: { limit?: number; offset?: number; status?: string },
  options?: Omit<
    UseQueryOptions<ListShoppingCartResponse, Error, ListShoppingCartResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListShoppingCartResponse, Error> {
  return wrapQuery(
    key('TMF663', 'shoppingCart', params),
    () => api.listShoppingCart(params),
    options
  );
}

// Product hooks (TMF637)
// Combined: Solutions (isBundle=true) + Subscriptions (isBundle=false)
export function useProductList(
  params?: { 
    limit?: number; 
    offset?: number; 
    status?: string; 
    isBundle?: boolean;
    relatedPartyName?: string;
  },
  options?: Omit<
    UseQueryOptions<ListProductResponse, Error, ListProductResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListProductResponse, Error> {
  return wrapQuery(
    key('TMF637', 'product', params),
    () => api.listProduct(params),
    options
  );
}

// Get single Product by ID (TMF637)
export function useProduct(
  id: string | undefined,
  options?: Omit<
    UseQueryOptions<api.Product, Error, api.Product, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<api.Product, Error> {
  return wrapQuery(
    key('TMF637', 'product', id),
    () => api.getProduct(id!),
    {
      ...options,
      enabled: !!id && (options?.enabled !== false),
    }
  );
}

// Product Offering hooks (TMF620)
export function useProductOfferingList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListProductOfferingResponse, Error, ListProductOfferingResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListProductOfferingResponse, Error> {
  return wrapQuery(
    key('TMF620', 'productOffering', params),
    () => api.listProductOffering(params),
    options
  );
}

// 1867 scenario candidate hooks (custom views exposed via productInventory)
export function useSolution1867FibreVoiceList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListSolution1867CandidateResponse, Error, ListSolution1867CandidateResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListSolution1867CandidateResponse, Error> {
  return wrapQuery(
    key('TMF637', 'solution1867FibreVoice', params),
    () => api.listSolution1867FibreVoice(params),
    options
  );
}

export function useSolution1867FibreOnlyList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListSolution1867CandidateResponse, Error, ListSolution1867CandidateResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListSolution1867CandidateResponse, Error> {
  return wrapQuery(
    key('TMF637', 'solution1867FibreOnly', params),
    () => api.listSolution1867FibreOnly(params),
    options
  );
}

export function useSolution1867MobileEsmsList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListSolution1867CandidateResponse, Error, ListSolution1867CandidateResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListSolution1867CandidateResponse, Error> {
  return wrapQuery(
    key('TMF637', 'solution1867MobileEsms', params),
    () => api.listSolution1867MobileEsms(params),
    options
  );
}

export function useSolution1867AccessVoiceList(
  params?: { limit?: number; offset?: number },
  options?: Omit<
    UseQueryOptions<ListSolution1867CandidateResponse, Error, ListSolution1867CandidateResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListSolution1867CandidateResponse, Error> {
  return wrapQuery(
    key('TMF637', 'solution1867AccessVoice', params),
    () => api.listSolution1867AccessVoice(params),
    options
  );
}

// ServiceProblem hooks (TMF656) - tracks confirmed issues and remediation progress
export function useServiceProblemList(
  params?: { limit?: number; offset?: number; category?: string; status?: string },
  options?: Omit<
    UseQueryOptions<ListServiceProblemResponse, Error, ListServiceProblemResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<ListServiceProblemResponse, Error> {
  return wrapQuery(
    key('TMF656', 'serviceProblem', params),
    () => api.listServiceProblem(params),
    options
  );
}

// Get single Billing Account by ID (TMF666)
export function useBillingAccount(
  id: string | undefined,
  options?: Omit<
    UseQueryOptions<BillingAccount, Error, BillingAccount, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<BillingAccount, Error> {
  return wrapQuery(
    key('TMF666', 'billingAccount', id),
    () => api.getBillingAccount(id!),
    {
      ...options,
      enabled: !!id && (options?.enabled !== false),
    }
  );
}

// Get single Individual by ID (TMF632)
export function useIndividual(
  id: string | undefined,
  options?: Omit<
    UseQueryOptions<Individual, Error, Individual, QueryKey>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<Individual, Error> {
  return wrapQuery(
    key('TMF632', 'individual', id),
    () => api.getIndividual(id!),
    {
      ...options,
      enabled: !!id && (options?.enabled !== false),
    }
  );
}

/**
 * PIC Email Lookup Hook
 * Chains: Service → BillingAccount (relatedParty[role=contact]) → Individual (contactMedium[].emailAddress)
 * 
 * @param service - The service object containing relatedParty with billingAccount reference
 * @returns PIC email lookup result with loading/error states
 */
export function usePicEmailLookup(service: Service | undefined) {
  // Step 1: Extract billingAccountId from service.relatedParty
  const billingAccountId = service?.relatedParty?.find(
    rp => rp.role === 'billingAccount'
  )?.partyOrPartyRole?.id || service?.x_billingAccountId;

  // Step 2: Fetch BillingAccount to get contactId
  const billingAccountQuery = useBillingAccount(billingAccountId, {
    enabled: !!billingAccountId,
  });

  // Step 3: Extract contactId from billingAccount.relatedParty
  const contactId = billingAccountQuery.data?.relatedParty?.find(
    rp => rp.role === 'contact' && rp.partyOrPartyRole?.['@referredType'] === 'Individual'
  )?.partyOrPartyRole?.id;

  // Step 4: Fetch Individual to get email
  const individualQuery = useIndividual(contactId, {
    enabled: !!contactId,
  });

  // Step 5: Extract email from individual.contactMedium
  const picEmail = individualQuery.data?.contactMedium?.find(
    cm => cm.contactType === 'email'
  )?.emailAddress;

  return {
    picEmail,
    billingAccountId,
    billingAccountName: billingAccountQuery.data?.name,
    contactId,
    contactName: individualQuery.data?.formattedName || individualQuery.data?.name,
    isLoading: billingAccountQuery.isLoading || individualQuery.isLoading,
    isError: billingAccountQuery.isError || individualQuery.isError,
    error: billingAccountQuery.error || individualQuery.error,
    // Full chain data for debugging
    billingAccount: billingAccountQuery.data,
    individual: individualQuery.data,
  };
}