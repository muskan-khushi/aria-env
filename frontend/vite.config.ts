import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    proxy: {
      '/reset': 'http://localhost:7860',
      '/step': 'http://localhost:7860',
      '/state': 'http://localhost:7860',
      '/tasks': 'http://localhost:7860',
      '/grader': 'http://localhost:7860',
      '/baseline': 'http://localhost:7860',
      '/generate': 'http://localhost:7860',
      '/replay': 'http://localhost:7860',
      '/leaderboard': 'http://localhost:7860',
      '/frameworks': 'http://localhost:7860',
      '/ws': {
        target: 'ws://localhost:7860',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})