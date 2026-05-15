import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { adminMockPlugin } from './mock/server'

export default defineConfig({
  plugins: [vue(), adminMockPlugin()],
  resolve: {
    alias: {
      '@/utils': resolve(__dirname, '../shared/utils'),
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      // Only proxy paths that the real backend handles (everything else → mock)
      '/api/v1/user/auth': { target: 'http://localhost:8001', changeOrigin: true },
      '/api/v1/user/profile': { target: 'http://localhost:8001', changeOrigin: true },
      '/api/v1/user/address': { target: 'http://localhost:8001', changeOrigin: true },
      '/api/v1/goods/category': { target: 'http://localhost:8002', changeOrigin: true },
      '/api/v1/goods/spu/list': { target: 'http://localhost:8002', changeOrigin: true },
      '/api/v1/goods/spu/': { target: 'http://localhost:8002', changeOrigin: true },
      '/api/v1/order/admin': { target: 'http://localhost:8003', changeOrigin: true },
      '/api/v1/order/orders/list': { target: 'http://localhost:8003', changeOrigin: true },
      '/api/v1/order/orders/': { target: 'http://localhost:8003', changeOrigin: true },
      '/api/v1/order/cart': { target: 'http://localhost:8003', changeOrigin: true },
      '/api/v1/order/pay': { target: 'http://localhost:8003', changeOrigin: true },
      '/api/v1/sys/dashboard': { target: 'http://localhost:8005', changeOrigin: true },
      '/api/v1/sys/log': { target: 'http://localhost:8005', changeOrigin: true },
      '/api/v1/sys/common': { target: 'http://localhost:8005', changeOrigin: true },
      '/api/v1/msg': { target: 'http://localhost:8004', changeOrigin: true },
    },
  },
})
