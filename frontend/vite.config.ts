import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://localhost:8180'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 基础库单独打包：体积大、很少变，业务代码改了也能继续用浏览器缓存
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: 3001,
    // 开发时把后端接口转发到 Go 后端，避免跨域
    // 注意按前缀匹配：前端页面路由不要以这几个前缀开头，否则刷新页面会被转发到后端
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
      },
      '/auth': {
        target: BACKEND,
        changeOrigin: true,
      },
      '/home': {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
})
