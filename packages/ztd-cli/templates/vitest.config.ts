import { defineConfig } from 'vitest/config';

export default defineConfig({
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
