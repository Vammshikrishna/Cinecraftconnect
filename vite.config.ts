/// <reference types="vitest" />
/// <reference types="vite/client" />
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

import { visualizer } from "rollup-plugin-visualizer"

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tsconfigPaths(),
    visualizer({
      open: false,
      filename: "bundle-stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
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
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'lucide-react', 'framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-three': ['three'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  esbuild: mode === 'production' ? {
    drop: ['console', 'debugger'],
  } : undefined,
}));
