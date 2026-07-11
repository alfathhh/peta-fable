import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
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
        target: env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  };
});
