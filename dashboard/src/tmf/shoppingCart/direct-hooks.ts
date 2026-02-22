/**
 * React Query hooks for Direct PostgreSQL Shopping Cart API
 */

import type { QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { key, wrapQuery } from '@/tmf/core';
import type { 
  ListShoppingCartParams, 
  ListShoppingCartResponse, 
  RetrieveShoppingCartResponse 
} from './direct-api';
import * as api from './direct-api';

export function useShoppingCartListDirect(
  params?: ListShoppingCartParams,
  options?: Omit<
    UseQueryOptions<ListShoppingCartResponse, Error, ListShoppingCartResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >,
): UseQueryResult<ListShoppingCartResponse, Error> {
  return wrapQuery(
    key('TMF663', 'shopping-cart-direct', params),
    () => api.listShoppingCartDirect(params),
    options,
  );
}

export function useShoppingCartDirect(
  id: string,
  options?: Omit<
    UseQueryOptions<RetrieveShoppingCartResponse, Error, RetrieveShoppingCartResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >,
): UseQueryResult<RetrieveShoppingCartResponse, Error> {
  return wrapQuery(
    key('TMF663', 'shopping-cart-direct', id),
    () => api.retrieveShoppingCartDirect(id),
    options,
  );
}

