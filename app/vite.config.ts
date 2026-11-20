import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Served from https://morris-heap.github.io/game-table-top/
export default defineConfig({
  base: '/game-table-top/',
  plugins: [react()],
  // Rules data lives in ../data (shared with the rulebook)
  server: { fs: { allow: ['..'] } },
  test: { include: ['src/**/*.test.ts'] },
})
