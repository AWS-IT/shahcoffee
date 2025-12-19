import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Важно: фронтенд никогда не должен ходить напрямую в MoySklad.
      // Всё идёт через Node-сервер, который подставляет Authorization.
      '/api_ms': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },

      // Для админки и заказов — тоже на Node-сервер.
      '/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
