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
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@zoeymind-ext-mind': path.resolve(__dirname, './src/products/mind/x/index.ts'),
      '@tanstack/react-router': path.resolve(__dirname, './src/shared/tanstack-router-shim.tsx')
    }
  }
})
