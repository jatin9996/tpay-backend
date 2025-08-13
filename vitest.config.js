import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    setupFiles: ['./test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'coverage/',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    }
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
})
