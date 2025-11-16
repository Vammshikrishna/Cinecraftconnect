/// <reference types="vitest" />
/// <reference types="vite/client" />
import react from "@vitejs/plugin-react"
import { defineConfig, mergeConfig } from "vite"
import { defineConfig as defineVitestConfig } from "vitest/config"
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tsconfigPaths from 'vite-tsconfig-paths';

const viteConfig = defineConfig({
  plugins: [react(), tsconfigPaths()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
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
