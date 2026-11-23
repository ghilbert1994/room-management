/* global process */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API runs on 3000 by default. Override with VITE_API_TARGET when that port
// is already taken on your machine (e.g. VITE_API_TARGET=http://localhost:3001).
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
})
