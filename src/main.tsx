import React, { Suspense } from "react";
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Suppress specific verbose library logs
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;

const suppressionFilter = (args: any[]) => {
  if (typeof args[0] !== 'string') return false;
  const msg = args[0];
  return (
    msg.includes('disconnect from room') || 
    msg.includes('websocket closed') || 
    msg.includes('Starting LiveKit call') ||
    msg.toLowerCase().includes('tracking prevention') ||
    msg.toLowerCase().includes('loaded lazily') ||
    msg.includes('[Intervention]')
  );
};

console.log = (...args: any[]) => {
  if (suppressionFilter(args)) return;
  originalLog.apply(console, args);
};

console.info = (...args: any[]) => {
  if (suppressionFilter(args)) return;
  originalInfo.apply(console, args);
};

console.warn = (...args: any[]) => {
  if (suppressionFilter(args)) return;
  originalWarn.apply(console, args);
};

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
      <ThemeProvider defaultTheme="system" storageKey="theme">
        <Suspense fallback={
          <div className="min-h-screen bg-background flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        }>
          <AuthProvider>
            <App />
          </AuthProvider>
        </Suspense>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
