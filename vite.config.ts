import { existsSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The repo-root `index.html` is the immutable design reference (ported from in T2,
// never overwritten). The app's real HTML entry is `app.html`. On build we emit it
// as `dist/index.html` so the T11 nginx SPA fallback (`try_files … /index.html`)
// works with no extra config.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'spades:emit-index-html',
      closeBundle() {
        const from = resolve('dist/app.html')
        const to = resolve('dist/index.html')
        if (existsSync(from)) renameSync(from, to)
      },
    },
  ],
  build: {
    rollupOptions: {
      input: resolve('app.html'),
    },
  },
  server: {
    open: '/app.html',
  },
})
