import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**', 'tmp/**'],
    root: resolve(__dirname),
    testTimeout: 30000,
  },
});
