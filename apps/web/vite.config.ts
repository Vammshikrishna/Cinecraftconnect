/// <reference types="vite/client" />
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig(({ mode }) => ({
  envDir: path.resolve(__dirname, "../../"),
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@cinecraft/types": path.resolve(__dirname, "../../packages/types/src"),
      "@cinecraft/core": path.resolve(__dirname, "../../packages/core/src"),
      "@cinecraft/validation": path.resolve(__dirname, "../../packages/validation/src"),
      "@cinecraft/storage": path.resolve(__dirname, "../../packages/storage/src"),
      "@cinecraft/api": path.resolve(__dirname, "../../packages/api/src"),
      "@cinecraft/auth": path.resolve(__dirname, "../../packages/auth/src"),
      "@cinecraft/e2ee": path.resolve(__dirname, "../../packages/e2ee/src"),
      "@cinecraft/messaging": path.resolve(__dirname, "../../packages/messaging/src"),
      "@cinecraft/calling": path.resolve(__dirname, "../../packages/calling/src"),
      "@cinecraft/notifications": path.resolve(__dirname, "../../packages/notifications/src"),
      "@cinecraft/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-livekit': ['@livekit/components-react', 'livekit-client'],
          'vendor-utils': ['date-fns', 'zod', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  esbuild: mode === 'production' ? {
    drop: ['console', 'debugger'],
  } : undefined,
}));
