import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Process-exit regressions do not need the root suite's PostgreSQL setup.
export default defineConfig({
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'node',
    include: ['scripts/publish-workspace-utils.test.js'],
    testTimeout: 30000,
    pool: 'threads',
  },
});
