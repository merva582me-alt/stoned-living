import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy /api/* to the Cloudflare Worker during local development.
      // Run `wrangler dev` inside /workers/resolver (port 8787) alongside `vite`.
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
          rewrite: (p) => p // keep path as-is — Worker handles /api/*
        }
      }
    },
  };
});
