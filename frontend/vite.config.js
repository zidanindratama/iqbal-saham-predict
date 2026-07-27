import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Saat development (npm run dev), permintaan ke /api diteruskan ke Flask lokal
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})