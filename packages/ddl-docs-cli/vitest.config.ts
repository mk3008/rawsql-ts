import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 60000,
    exclude: ['dist/**', '**/dist/**', '**/node_modules/**'],
    globalSetup: resolve(__dirname, '../../vitest.global-setup.ts'),
  },
});
