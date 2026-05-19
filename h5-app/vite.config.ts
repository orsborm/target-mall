import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { h5MockPlugin } from './mock/server'

export default defineConfig({
  plugins: [vue(), h5MockPlugin()],
  resolve: {
    alias: {
      '@/utils': resolve(__dirname, '../shared/utils'),
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api/v1/user': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api/v1/goods': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
      '/api/v1/order': {
        target: 'http://localhost:8003',
        changeOrigin: true,
      },
      '/api/v1/cart': {
        target: 'http://localhost:8003',
        changeOrigin: true,
      },
      '/api/v1/msg': {
        target: 'http://localhost:8004',
        changeOrigin: true,
      },
      '/api/v1/sys': {
        target: 'http://localhost:8005',
        changeOrigin: true,
      },
    },
  },
})
