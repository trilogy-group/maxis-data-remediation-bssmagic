'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors except 408, 429
              if (error instanceof Error && 'status' in error) {
                const status = (error as any).status;
                if (
                  status >= 400 &&
                  status < 500 &&
                  status !== 408 &&
                  status !== 429
                ) {
                  return false;
                }
              }
              return failureCount < 3;
            },
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
