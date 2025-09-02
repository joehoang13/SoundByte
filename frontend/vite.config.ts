// frontend/vite.config.ts — ensure proxy is present for Option A
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // backend
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
