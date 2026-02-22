/**
 * Direct PostgreSQL Shopping Cart API Client
 * Uses /api/direct/shopping-cart to bypass TMF Server JSONB bug
 */

export interface CartPrice {
  priceType?: string;
  name?: string;
  description?: string;
  price?: {
    value?: number;
    unit?: string;
  };
  recurringChargePeriod?: string;
  '@type'?: string;
}

export interface ProductOffering {
  id?: string;
  name?: string;
  family?: string;
}

export interface CartItemDetail {
  id: string;
  name?: string;
  action?: string;
  quantity?: number;
  status?: string;
  '@type'?: string;
  
  // Pricing
  itemPrice?: CartPrice[];
  itemTotalPrice?: CartPrice[];
  oneOffCharge?: number | null;
  recurringCharge?: number | null;
  totalContractValue?: number | null;
  currency?: string | null;
  billingFrequency?: number | null;
  contractTerm?: number | null;
  
  // Product info
  productDefinitionId?: string | null;
  productFamily?: string | null;
  productOffering?: ProductOffering | null;
  configurationStatus?: string | null;
  
  // IDs
  guid?: string | null;
  solutionId?: string | null;
  solutionName?: string | null;
  basketId?: string;
  parentConfigurationId?: string | null;
  
  // Dates
  createdDate?: string | null;
  lastModifiedDate?: string | null;
}

export interface RelatedParty {
  id?: string;
  name?: string;
  role?: string;
  '@type'?: string;
}

export interface ShoppingCart {
  id: string;
  href?: string;
  name?: string;
  description?: string | null;
  status?: string;
  creationDate?: string;
  lastUpdate?: string;
  cartTotalPrice?: CartPrice[];
  cartItem?: CartItemDetail[];
  relatedParty?: RelatedParty[];
  validFor?: {
    startDateTime?: string;
    endDateTime?: string;
  };
  '@type'?: string;
  
  // Extension fields
  basketStage?: string | null;
  totalPrice?: number | null;
  totalContractValue?: number | null;
  currency?: string | null;
  accountId?: string | null;
  accountName?: string | null;
}

export type ListShoppingCartParams = {
  limit?: number;
  offset?: number;
};

export type ListShoppingCartResponse = {
  data: ShoppingCart[];
  status: number;
  source?: string;
};

/**
 * Fetch shopping carts from direct PostgreSQL API
 * Bypasses TMF Server's buggy JSONB parser
 */
export const listShoppingCartDirect = async (
  params?: ListShoppingCartParams,
): Promise<ListShoppingCartResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  
  const url = `/api/direct/shopping-cart${searchParams.toString() ? `?${searchParams}` : ''}`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  
  const data = await res.json();
  return { 
    data: Array.isArray(data) ? data : [], 
    status: res.status,
    source: 'direct-postgresql'
  };
};

export type RetrieveShoppingCartResponse = {
  data: ShoppingCart;
  status: number;
  source?: string;
};

/**
 * Fetch a single shopping cart by ID
 */
export const retrieveShoppingCartDirect = async (
  id: string,
): Promise<RetrieveShoppingCartResponse> => {
  const res = await fetch(`/api/direct/shopping-cart/${id}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  
  const data = await res.json();
  return { 
    data, 
    status: res.status,
    source: 'direct-postgresql'
  };
};

// Helper type for cart items
export interface CartItemsResponse {
  basketId: string;
  itemCount: number;
  items: CartItemDetail[];
  source?: string;
}

export const fetchCartItemDetailsDirect = async (
  basketId: string,
): Promise<CartItemsResponse> => {
  const cart = await retrieveShoppingCartDirect(basketId);
  return {
    basketId,
    itemCount: cart.data.cartItem?.length || 0,
    items: cart.data.cartItem || [],
    source: 'direct-postgresql'
  };
};

