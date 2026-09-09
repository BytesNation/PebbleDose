import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { localPwa } from './pwa.ts';
export default defineConfig({
  plugins: [react(), tailwind(), localPwa()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.API_TARGET ?? 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
});
