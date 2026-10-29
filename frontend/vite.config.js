import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: path.resolve(__dirname, '../public'),
    emptyOutDir: true,
    assetsDir: 'assets'
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3055',
        changeOrigin: true
      }
    }
  }
});
