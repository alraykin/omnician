import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { factoryApiPlugin } from './vite-factory-plugin.ts'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss(), factoryApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 43121,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 43121,
    strictPort: true,
  },
})
