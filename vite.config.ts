/// <reference types="vitest" />
/// <reference types="vite/client" />
import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig, mergeConfig } from "vite"
import { defineConfig as defineVitestConfig } from "vitest/config"

const viteConfig = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
    },
  },
});

const vitestConfig = defineVitestConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setupTests.ts',
    },
});

export default mergeConfig(viteConfig, vitestConfig);
