import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    globalSetup: ['tests/support/global-setup.ts'],
    // Starting a Postgres testcontainer can exceed the default 5s timeout on some machines.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: [
      {
        find: /^@rawsql-ts\/core\/dist\/src\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/core/src/$1'),
      },
      {
        find: '@rawsql-ts/core',
        replacement: path.resolve(__dirname, '../../packages/core/src'),
      },
    ],
  },
});
