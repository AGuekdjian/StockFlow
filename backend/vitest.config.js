import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: { statements: 50, branches: 45, functions: 50, lines: 50 },
      exclude: ['scripts/**', 'src/server.js', '**/*.config.js'],
    },
  },
});
