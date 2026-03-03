import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: resolve(__dirname),
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', '**/dist/**', '**/node_modules/**'],
  },
  resolve: {
    alias: {
      '@rawsql-ts/test-evidence-core': resolve(__dirname, '../test-evidence-core/src'),
    },
  },
});
