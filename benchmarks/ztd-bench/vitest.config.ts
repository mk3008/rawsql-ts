import path from 'node:path';
import { defineConfig } from 'vitest/config';

const rootDir = path.resolve(__dirname, '../..');

export default defineConfig({
  root: rootDir,
  test: {
    include: ['benchmarks/ztd-bench/tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    globalSetup: ['benchmarks/ztd-bench/tests/support/global-setup.ts'],
  },
});
