import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 60000,
    globalSetup: resolve(__dirname, '../../vitest.global-setup.ts'),
  },
});

