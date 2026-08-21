import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: { statements: 45, branches: 40, functions: 45, lines: 45 },
      exclude: ['scripts/**', 'src/server.js', '**/*.config.js'],
    },
  },
});
