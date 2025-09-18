import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/video-coord-app/', // GitHub Pages用のベースパス
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
