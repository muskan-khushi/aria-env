import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/reset': 'http://127.0.0.1:7860',
      '/step': 'http://127.0.0.1:7860',
      '/state': 'http://127.0.0.1:7860',
      '/tasks': 'http://127.0.0.1:7860',
      '/grader': 'http://127.0.0.1:7860',
      '/baseline': 'http://127.0.0.1:7860',
      '/aria': {
        target: 'http://127.0.0.1:7860',
        ws: true
      }
    }
  }
})
