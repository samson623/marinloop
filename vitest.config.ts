import { defineConfig } from 'vitest/config'
import path from 'path'
import viteConfig from './vite.config'

export default defineConfig({
  ...viteConfig,
  resolve: {
    ...viteConfig.resolve,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    mockReset: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/test/**',
        'src/shared/types/**',
        'src/main.tsx',
      ],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
    },
  },
})
