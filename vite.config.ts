/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';

export default defineConfig(({ mode }) => {
  // `vite build --mode analyze` fonctionne sous Windows comme sous Linux (pas de variable en ligne).
  const isAnalyze = mode === 'analyze' || process.env.ANALYZE === 'true';

  const plugins: PluginOption[] = [react(), tailwindcss()];
  if (isAnalyze) {
    plugins.push(
      visualizer({
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }) as PluginOption,
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      target: 'es2020',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/gsap') || id.includes('node_modules/@gsap')) {
              return 'gsap';
            }
            return undefined;
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
    },
  };
});
