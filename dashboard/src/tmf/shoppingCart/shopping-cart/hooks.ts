import type {
  QueryKey,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import { key, wrapMutation, wrapQuery } from '@/tmf/core';
import type {
  createShoppingCartResponse,
  deleteShoppingCartResponse,
  listShoppingCartResponse,
  patchShoppingCartResponse,
  retrieveShoppingCartResponse,
} from '@/tmf/shoppingCart/shopping-cart/shopping-cart';
import * as api from '@/tmf/shoppingCart/shopping-cart/shopping-cart';
import type {
  CreateShoppingCartParams,
  ListShoppingCartParams,
  PatchShoppingCartParams,
  RetrieveShoppingCartParams,
  ShoppingCartFVOBody,
  ShoppingCartMVOBody,
} from '@/tmf/shoppingCart/types';

export function useShoppingCartList(
  params?: ListShoppingCartParams,
  options?: Omit<
    UseQueryOptions<
      listShoppingCartResponse,
      Error,
      listShoppingCartResponse,
      QueryKey
    >,
    'queryKey' | 'queryFn'
  >,
): UseQueryResult<listShoppingCartResponse, Error> {
  return wrapQuery(
    key('TMF663', 'shopping-cart', params),
    () => api.listShoppingCart(params),
    options,
  );
}

export function useShoppingCart(
  id: string,
  params?: RetrieveShoppingCartParams,
): UseQueryResult<retrieveShoppingCartResponse, Error> {
  return wrapQuery(key('TMF663', 'shopping-cart', id), () =>
    api.retrieveShoppingCart(id, params),
  );
}

export function useCreateShoppingCart(): UseMutationResult<
  createShoppingCartResponse,
  Error,
  { body: ShoppingCartFVOBody; params?: CreateShoppingCartParams },
  unknown
> {
  return wrapMutation(
    (vars: { body: ShoppingCartFVOBody; params?: CreateShoppingCartParams }) =>
      api.createShoppingCart(vars.body, vars.params),
  );
}

export function useUpdateShoppingCart(): UseMutationResult<
  patchShoppingCartResponse,
  Error,
  { id: string; body: ShoppingCartMVOBody; params?: PatchShoppingCartParams },
  unknown
> {
  return wrapMutation(
    (vars: {
      id: string;
      body: ShoppingCartMVOBody;
      params?: PatchShoppingCartParams;
    }) => api.patchShoppingCart(vars.id, vars.body, vars.params),
  );
}

export function useDeleteShoppingCart(): UseMutationResult<
  deleteShoppingCartResponse,
  Error,
  string,
  unknown
> {
  return wrapMutation((id: string) => api.deleteShoppingCart(id));
}
