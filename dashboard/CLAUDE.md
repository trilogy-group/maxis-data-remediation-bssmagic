# Telco Application Template

## Overview

You are working on a opinionated NextJS template for building telecommunications
BSS/OSS applications. This template comes with multiple features pre configured
so you can only worry about building your application.

It comes with:

- Fully configured NextJS application
- Pre-built API clients for all TMF standards

## Dependencies

Here are the UI related dependencies that are pre configured:

- NextJS 15 with app router
- TailwindCSS for styling
- TailwindCSS typography plugin
- Zustand for state management
- Tanstack Query for data fetching
- TanStack Table for tables
- Tanstack Form for forms
- Lucide React for icons
- Recharts for charts

Utility libraries that are pre configured:

- Date-fns for date handling
- Zod for form validation
- clsx for class name merging

## TMF Integration

TMF is a telecommunications industry made set of standards to enable companies
to quickly integrate with each other. This template comes with pre-built API
clients for all TMF standards using Tanstack Query as a wrapper for all API
calls.

All client implementations are under the `src/tmf` directory and follow the
following pattern:

```
src/tmf/<STANDARD_NAME>/<ENTITY_NAME>/
├── hooks.ts
└── <ENTITY_NAME>.ts
└── <ENTITY_NAME>.msw.ts
```

The `<ENTITY_NAME>.ts` file contains the API client that peforms the raw HTTP
requests to the respective TMF API endpoint. For example, if you want to get a
customer by their ID:

```typescript
import { retrieveCustomer } from '@/tmf/customerManagement/customer/customer';

const customer = await retrieveCustomer('123');
```

The `hooks.ts` file contains the Tanstack Query hooks that wraps the calls in
the `<ENTITY_NAME>.ts` file. For the example above, the hook would be:

```tsx
import { useCustomer } from '@/tmf/customerManagement/customer/hooks';

// `data` will have the content from the retrieveCustomer call
const { data, isPending, error } = useCustomer('123');

// example usage in a component
return (
  <div>
    {isPending && <Loader />}
    {error && <div>Error: {error}</div>}
    {data && <div>Customer: {data}</div>}
  </div>
)
```

ATTENTION:The format of `data` depends on each TMF standard. Everything is
properly typed and you can check the types of each standard in
`src/tmf/<STANDARD_NAME>/types/*.ts` files. You must ALWAYS check the types
before using the data to make sure that you are displaying the correct values.
Below is a sample of the shape of the data returned by the TMF API.

For calls that should update information, we use Tanstack Query's mutations.
Here is an example suage for creating a customer:

```tsx
import { useCreateCustomer } from '@/tmf/customerManagement/customer/hooks';

const { mutate, isPending, error } = useCreateCustomer();
mutate({ name: 'John Doe' });

// component usage
return (
  <div>
    {isPending && <Loader />}
    {error && <div>Error: {error}</div>}
    <button onClick={() => mutate({ body: { name: 'John Doe' } })}>
      Create Customer
    </button>
  </div>
)
```

The `<ENTITY_NAME>.msw.ts` file contains utility functions for mocking the API
responses. Don't edit nor use those files.

## Branding

### Required Branding Elements

1. Must use Totogi-branded titles and descriptions
2. Must use Totogi favicon (when available)
3. Use `<Loader>` for loading experiences
4. Maintain consistent Totogi visual identity across all screens

## Coding Standards

### Component Patterns

```tsx
// Use React Query TMF hooks for data access
import { 
  useCustomerList, 
  useCustomer, 
  useCreateCustomer 
} from '@/tmf/customerManagement/customer/hooks'

function CustomerList() {
  const { data: customersResponse, isLoading, error } = useCustomerList()
  const createCustomerMutation = useCreateCustomer()

  // loading state
  if (isLoading) return <CustomerListLoader />
  // error state
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {customersResponse?.map(customer => (
        <CustomerCard key={customer.id} customer={customer} />
      ))}
      <button
        onClick={() => createCustomerMutation.mutate(newCustomerData)}
        disabled={createCustomerMutation.isPending}
      >
        {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
      </button>
    </div>
  )
}
```

### Styling Guidelines

```tsx
// Use Totogi color palette
<div className="bg-primary-600 text-white" />     // Primary purple
<div className="bg-navigation-900 text-white" />  // Navigation blue  
<div className="bg-success-600" />                // Success green
<div className="bg-warning-500" />                // Warning orange
<div className="bg-error-600" />                  // Error red

// Use utility functions for consistency
import { cn, formatTMFDate, formatTMFCurrency } from '@/lib/utils'

<div className={cn("base-classes", conditionalClasses)} />
```

## Common Patterns

Here are some common patterns of how to use the TMF API in your application.

### Overviews

Combines multiple TMF entities for a complete overview. For example, here is a
possible customer overview showing multiple information about a customer:

```typescript
// React Query automatically handles caching, deduplication, and background updates
const { data: customerResponse } = useCustomer(customerId)
const { data: accountsResponse } = useAccounts()
const { data: productsResponse } = useProducts({ customerId })
const { data: ticketsResponse } = useTroubleTickets({ customerId })
```

### List and Detail Views

Lots of times, we will want to show a list of items and its details. Here is an
example of a product catalog browsing flow:

```tsx
const { data: catalogsResponse } = useProductCatalogs()
const { data: offeringsResponse } = useProductOfferings({ 
  catalogId: selectedCatalog?.id,
  lifecycleStatus: 'Active'
})

return (
  <div className="grid grid-cols-2 gap-4">
    <ProductCatalogList catalogs={catalogs} />
    <ProductOfferingList offerings={offerings} />
  </div>
)
```

## Project Structure

```
src/
├── app/                                # NextJS app router
│   └── api/tmf-api/[...slug]/route.ts  # TMF API route (DO NOT EDIT)
├── components/
│   ├── ui/                             # Base UI components (Button, Input, etc.)
│   ├── telco/                          # Telco-specific components
│   └── forms/                          # Form components
├── mocks/                              # Mock related stuff (DO NOT EDIT)
├── tmf/                                # TMF client, hooks and types per standard
│   ├── core.ts                         # React Query helpers (key, wrapQuery, wrapMutation)
│   ├── tmf-fetcher.ts                  # Shared fetcher (base URL + JSON handling)
│   └── <STANDARD_NAME>/<ENTITY_NAME>/
│       ├── hooks.ts                    # Generated React Query hooks
│       ├── <ENTITY_NAME>.ts            # Generated client for each endpoint
│       └── <ENTITY_NAME>.msw.ts        # Generated MSW handlers (DO NOT EDIT)
├── lib/
│   └── utils.ts                        # Utility functions
└── stores/                             # Zustand stores (if needed)
```

## Development Commands

```bash
npm run build   # Production build
npm run lint    # Check code style
npm run format  # Format code
```

You must NEVER run any of the `npm run dev` commands

## Best Practices

1. **Include Totogi branding** in every generated app
2. **Always use todos** to track development progress
3. **Handle loading and error states** for all data fetching
4. **Use TypeScript strictly** with proper TMF types
5. **Follow TMF naming conventions** for consistency
6. **Use Totogi design system** colors and components
7. **Implement responsive design** for mobile compatibility
8. **Include proper ARIA attributes** for accessibility
