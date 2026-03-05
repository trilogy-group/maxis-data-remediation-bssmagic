// React Query Hooks for TMF API
import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import type {
  Service,
  Product,
  ShoppingCart,
  ProductOrder,
  BillingAccount,
  Individual,
  ServiceProblem,
  OEServiceInfoResponse,
} from '../../types/tmf-api';
import * as TMFClient from './client';

// Query key factories
export const tmfKeys = {
  all: ['tmf'] as const,
  services: () => [...tmfKeys.all, 'services'] as const,
  serviceList: (params?: Record<string, unknown>) => [...tmfKeys.services(), 'list', params] as const,
  service: (id: string) => [...tmfKeys.services(), 'detail', id] as const,
  products: () => [...tmfKeys.all, 'products'] as const,
  productList: (params?: Record<string, unknown>) => [...tmfKeys.products(), 'list', params] as const,
  product: (id: string) => [...tmfKeys.products(), 'detail', id] as const,
  shoppingCarts: () => [...tmfKeys.all, 'shoppingCarts'] as const,
  shoppingCartList: (params?: Record<string, unknown>) => [...tmfKeys.shoppingCarts(), 'list', params] as const,
  productOrders: () => [...tmfKeys.all, 'productOrders'] as const,
  productOrderList: (params?: Record<string, unknown>) => [...tmfKeys.productOrders(), 'list', params] as const,
  billingAccounts: () => [...tmfKeys.all, 'billingAccounts'] as const,
  billingAccount: (id: string) => [...tmfKeys.billingAccounts(), 'detail', id] as const,
  individuals: () => [...tmfKeys.all, 'individuals'] as const,
  individual: (id: string) => [...tmfKeys.individuals(), 'detail', id] as const,
  serviceProblems: () => [...tmfKeys.all, 'serviceProblems'] as const,
  serviceProblemList: (params?: Record<string, unknown>) => [...tmfKeys.serviceProblems(), 'list', params] as const,
  serviceProblem: (id: string) => [...tmfKeys.serviceProblems(), 'detail', id] as const,
};

// Service Hooks (TMF638)
export function useServices(params?: {
  limit?: number;
  x_serviceType?: string;
  x_migratedData?: boolean;
  x_has1867Issue?: boolean;
  x_replacementServiceId?: string;
}): UseQueryResult<Service[], Error> {
  return useQuery({
    queryKey: tmfKeys.serviceList(params),
    queryFn: () => TMFClient.listServices(params),
    staleTime: 30000, // 30 seconds
  });
}

export function useService(id: string, enabled = true): UseQueryResult<Service, Error> {
  return useQuery({
    queryKey: tmfKeys.service(id),
    queryFn: () => TMFClient.getService(id),
    enabled: enabled && !!id,
    staleTime: 30000,
  });
}

// Product Hooks (TMF637)
export function useProducts(params?: {
  limit?: number;
  status?: string;
  'relatedParty.partyOrPartyRole.name'?: string;
}): UseQueryResult<Product[], Error> {
  return useQuery({
    queryKey: tmfKeys.productList(params),
    queryFn: () => TMFClient.listProducts(params),
    staleTime: 30000,
  });
}

export function useProduct(id: string, enabled = true): UseQueryResult<Product, Error> {
  return useQuery({
    queryKey: tmfKeys.product(id),
    queryFn: () => TMFClient.getProduct(id),
    enabled: enabled && !!id,
    staleTime: 30000,
  });
}

// Failed Migration Products
export function useFailedMigrationProducts(params?: { limit?: number }): UseQueryResult<Product[], Error> {
  return useQuery({
    queryKey: [...tmfKeys.productList(params), 'failed-migrations'],
    queryFn: () => TMFClient.listFailedMigrationProducts(params),
    staleTime: 30000,
  });
}

// 1867 Scenario Products
export function useSolution1867FibreVoice(params?: { limit?: number }): UseQueryResult<Product[], Error> {
  return useQuery({
    queryKey: [...tmfKeys.productList(params), '1867-fibre-voice'],
    queryFn: () => TMFClient.listSolution1867FibreVoice(params),
    staleTime: 30000,
  });
}

export function useSolution1867FibreOnly(params?: { limit?: number }): UseQueryResult<Product[], Error> {
  return useQuery({
    queryKey: [...tmfKeys.productList(params), '1867-fibre-only'],
    queryFn: () => TMFClient.listSolution1867FibreOnly(params),
    staleTime: 30000,
  });
}

export function useSolution1867MobileEsms(params?: { limit?: number }): UseQueryResult<Product[], Error> {
  return useQuery({
    queryKey: [...tmfKeys.productList(params), '1867-mobile-esms'],
    queryFn: () => TMFClient.listSolution1867MobileEsms(params),
    staleTime: 30000,
  });
}

export function useSolution1867AccessVoice(params?: { limit?: number }): UseQueryResult<Product[], Error> {
  return useQuery({
    queryKey: [...tmfKeys.productList(params), '1867-access-voice'],
    queryFn: () => TMFClient.listSolution1867AccessVoice(params),
    staleTime: 30000,
  });
}

// Shopping Cart Hooks (TMF663)
export function useShoppingCarts(params?: {
  limit?: number;
  status?: string;
}): UseQueryResult<ShoppingCart[], Error> {
  return useQuery({
    queryKey: tmfKeys.shoppingCartList(params),
    queryFn: () => TMFClient.listShoppingCarts(params),
    staleTime: 30000,
  });
}

export function useShoppingCart(id: string, enabled = true): UseQueryResult<ShoppingCart, Error> {
  return useQuery({
    queryKey: [...tmfKeys.shoppingCarts(), 'detail', id],
    queryFn: () => TMFClient.getShoppingCart(id),
    enabled: enabled && !!id,
    staleTime: 30000,
  });
}

// Product Order Hooks (TMF622)
export function useProductOrders(params?: {
  limit?: number;
  state?: string;
}): UseQueryResult<ProductOrder[], Error> {
  return useQuery({
    queryKey: tmfKeys.productOrderList(params),
    queryFn: () => TMFClient.listProductOrders(params),
    staleTime: 30000,
  });
}

export function useProductOrder(id: string, enabled = true): UseQueryResult<ProductOrder, Error> {
  return useQuery({
    queryKey: [...tmfKeys.productOrders(), 'detail', id],
    queryFn: () => TMFClient.getProductOrder(id),
    enabled: enabled && !!id,
    staleTime: 30000,
  });
}

// Billing Account Hooks (TMF666)
export function useBillingAccounts(params?: { limit?: number }): UseQueryResult<BillingAccount[], Error> {
  return useQuery({
    queryKey: [...tmfKeys.billingAccounts(), 'list', params],
    queryFn: () => TMFClient.listBillingAccounts(params),
    staleTime: 30000,
  });
}

export function useBillingAccount(id: string, enabled = true): UseQueryResult<BillingAccount, Error> {
  return useQuery({
    queryKey: tmfKeys.billingAccount(id),
    queryFn: () => TMFClient.getBillingAccount(id),
    enabled: enabled && !!id,
    staleTime: 30000,
  });
}

// Individual Hooks (TMF632)
export function useIndividual(id: string, enabled = true): UseQueryResult<Individual, Error> {
  return useQuery({
    queryKey: tmfKeys.individual(id),
    queryFn: () => TMFClient.getIndividual(id),
    enabled: enabled && !!id,
    staleTime: 30000,
  });
}

// Service Problem Hooks (TMF656)
export function useServiceProblems(params?: {
  limit?: number;
  category?: string;
  status?: string;
}): UseQueryResult<ServiceProblem[], Error> {
  return useQuery({
    queryKey: tmfKeys.serviceProblemList(params),
    queryFn: () => TMFClient.listServiceProblems(params),
    staleTime: 60000, // 1 minute
  });
}

export function useServiceProblem(id: string, enabled = true): UseQueryResult<ServiceProblem, Error> {
  return useQuery({
    queryKey: tmfKeys.serviceProblem(id),
    queryFn: () => TMFClient.getServiceProblem(id),
    enabled: enabled && !!id,
    staleTime: 60000,
  });
}

// Service Problem Mutations
export function useCreateServiceProblem(): UseMutationResult<ServiceProblem, Error, ServiceProblem> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (problem: ServiceProblem) => TMFClient.createServiceProblem(problem),
    onSuccess: () => {
      // Invalidate service problems list to refetch
      queryClient.invalidateQueries({ queryKey: tmfKeys.serviceProblems() });
      queryClient.invalidateQueries({ queryKey: tmfKeys.products() });
    },
  });
}

// Service Problem Delete Mutation
export function useDeleteServiceProblem(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => TMFClient.deleteServiceProblem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tmfKeys.serviceProblems() });
    },
  });
}

// OE Service Management Hooks (1867 Checker)
export const oeKeys = {
  all: ['oe'] as const,
  serviceInfo: (id: string) => [...oeKeys.all, 'serviceInfo', id] as const,
};

export function useOEServiceInfo(
  serviceId: string,
  enabled = true
): UseQueryResult<OEServiceInfoResponse, Error> {
  return useQuery({
    queryKey: oeKeys.serviceInfo(serviceId),
    queryFn: () => TMFClient.getOEServiceInfo(serviceId),
    enabled: enabled && !!serviceId,
    staleTime: 60000,
    retry: 1,
  });
}

export function useOEPatchAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, patchedContent }: { serviceId: string; patchedContent: unknown }) =>
      TMFClient.postOEServiceAttachment(serviceId, patchedContent),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: oeKeys.serviceInfo(variables.serviceId) });
    },
  });
}

export function useOETriggerRemediation() {
  return useMutation({
    mutationFn: ({ serviceId, productDefinitionName }: { serviceId: string; productDefinitionName?: string }) =>
      TMFClient.postOEServiceRemediation(serviceId, productDefinitionName),
  });
}

// PIC Email Lookup Hook
export function usePicEmail(serviceId: string, enabled = true): UseQueryResult<string | null, Error> {
  return useQuery({
    queryKey: [...tmfKeys.service(serviceId), 'pic-email'],
    queryFn: () => TMFClient.lookupPicEmail(serviceId),
    enabled: enabled && !!serviceId,
    staleTime: 300000, // 5 minutes (emails don't change often)
  });
}
