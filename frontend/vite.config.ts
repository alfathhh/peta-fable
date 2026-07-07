import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // shpjs mengacu ke `global` ala Node — petakan ke globalThis di browser
  define: { global: 'globalThis' },
  build: {
    rollupOptions: {
      output: {
        // pecah vendor besar agar chunk utama kecil & cache browser lebih awet
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          leaflet: ['leaflet', 'leaflet.markercluster'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // port backend dev; ganti bila backend jalan di port lain (lihat backend/.env)
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
