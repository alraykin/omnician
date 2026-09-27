import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

function spaDirectoryIndexes() {
  return {
    name: 'spa-directory-indexes',
    closeBundle() {
      const indexPath = path.resolve(rootDir, 'dist/index.html')
      if (!fs.existsSync(indexPath)) return
      const html = fs.readFileSync(indexPath)
      for (const dir of ['tuner', 'rhythm']) {
        const destDir = path.resolve(rootDir, 'dist', dir)
        fs.mkdirSync(destDir, { recursive: true })
        fs.writeFileSync(path.join(destDir, 'index.html'), html)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), spaDirectoryIndexes()],
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
