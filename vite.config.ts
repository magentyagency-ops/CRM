import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  server: {
    port: 5180,
  },
  build: {
    rollupOptions: {
      input: resolve(root, 'index.html'),
    },
  },
})
