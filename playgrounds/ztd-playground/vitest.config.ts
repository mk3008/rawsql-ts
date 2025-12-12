import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    // Starting the Postgres testcontainer can exceed the default 5s timeout on some machines.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Avoid starting multiple containers in parallel across test files.
    fileParallelism: false,
  },
});
