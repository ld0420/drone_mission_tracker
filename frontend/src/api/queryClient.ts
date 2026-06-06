import { QueryClient } from '@tanstack/react-query';

// Single shared client. Mission/capture data is effectively static for a
// session, so we keep it fresh for a while and avoid noisy refetches.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
