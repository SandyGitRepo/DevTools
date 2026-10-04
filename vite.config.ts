import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the built app works from any sub-path (e.g. https://intranet/devtoolkit/).
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: {
        name: 'DevToolkit',
        short_name: 'DevToolkit',
        description: 'Internal utilities portal - everything processed locally.',
        theme_color: '#001A33',
        background_color: '#001A33',
        display: 'standalone',
        start_url: './',
        icons: [{ src: 'logo.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,wasm,ttf,bcmap,pfb,icc}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  optimizeDeps: {
    // These load WebAssembly via import.meta.url and must not be pre-bundled.
    exclude: ['prettier-plugin-java', 'web-tree-sitter', 'hash-wasm'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
    sourcemap: false,
  },
  worker: { format: 'es' },
  // Dev: forward /api to a locally running `npm start` so server-side tools work with hot reload
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8080' } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
