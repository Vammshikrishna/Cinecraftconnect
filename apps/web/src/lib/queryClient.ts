import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes (increased for better mobile experience)
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (keep in memory longer)
      retry: 1,
      refetchOnWindowFocus: false, // Prevent lag when switching tabs
    },
  },
});
