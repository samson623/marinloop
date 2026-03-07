import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [react(), tailwindcss(), visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // The index bundle (~665KB) contains all vendor deps; this is pre-existing
    // and acceptable — gzip size is ~195KB. Raise the warning limit to avoid noise.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'scanner-vendor': ['html5-qrcode'],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
  },
})
