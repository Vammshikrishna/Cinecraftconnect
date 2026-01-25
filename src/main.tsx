import React, { Suspense } from "react";
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import './index.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false, // Prevent lag when switching tabs
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Suspense>
    </QueryClientProvider>
  </React.StrictMode>
);
