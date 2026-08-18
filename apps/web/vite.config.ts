import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] }
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      {
        find: /^simple-mind-map$/,
        replacement: path.resolve(__dirname, '../../packages/simple-mind-map/src/index.ts')
      },
      {
        find: '@zoeymind-ext-mind',
        replacement: path.resolve(__dirname, './src/products/mind/x/index.ts')
      },
      {
        find: '@tanstack/react-router',
        replacement: path.resolve(__dirname, './src/shared/tanstack-router-shim.tsx')
      }
    ]
  }
})
