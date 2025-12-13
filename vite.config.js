import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api_ms': {
        target: 'https://api.moysklad.ru',
        changeOrigin: true,  // Чтобы не было проблем с хостами
        rewrite: (path) => path.replace(/^\/api_ms/, ''), // Преобразуем путь
        secure: false, // Для работы с HTTPS
      },
    },
  },
});
