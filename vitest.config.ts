import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',

    include: ['src/**/*.test.ts'],

    sequence: {
      shuffle: true,
    },

    coverage: {
      provider: 'istanbul',
      exclude: ['src/generated'],
      reporter: ['text', 'json-summary', 'lcov'],
    },
  },
})
