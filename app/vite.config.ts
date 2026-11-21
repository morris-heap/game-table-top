import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Served from https://morris-heap.github.io/virtual-table-top-ember-reach/
export default defineConfig({
  base: '/virtual-table-top-ember-reach/',
  plugins: [react()],
  // Rules data lives in ../data (shared with the rulebook)
  server: { fs: { allow: ['..'] } },
  test: { include: ['src/**/*.test.ts'] },
})
