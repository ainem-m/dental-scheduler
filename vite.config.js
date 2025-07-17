import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  root: 'client', // Set the project root to the 'client' directory
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // API requests
      '/api': {
        target: 'http://localhost:3000',
      },
      // WebSocket connections
      '/socket.io': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../dist', // Adjust output output dir relative to the new root
    emptyOutDir: true,
  },
  define: {
    __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
  },
});
