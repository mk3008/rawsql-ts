import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '#features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '#libraries': fileURLToPath(new URL('./src/libraries', import.meta.url)),
      '#adapters': fileURLToPath(new URL('./src/adapters', import.meta.url)),
      '#tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/features/**/*.test.ts'],
    environment: 'node',
    globals: true,
    setupFiles: ['.ztd/support/setup-env.ts'],
    globalSetup: ['.ztd/support/global-setup.ts'],
    // Starting a Postgres testcontainer can exceed the default 5s timeout on some machines.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
