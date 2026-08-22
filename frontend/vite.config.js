import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: { statements: 22, branches: 40, functions: 15, lines: 22 },
      exclude: ['src/main.jsx', 'dist/**', '**/*.config.js'],
    },
  },
});
