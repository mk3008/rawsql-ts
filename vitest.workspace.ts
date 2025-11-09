import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './packages/testkit-core/vitest.config.ts',
    test: {
      root: './packages/testkit-core',
    },
  },
  {
    extends: './packages/drivers/sqlite-testkit/vitest.config.ts',
    test: {
      root: './packages/drivers/sqlite-testkit',
    },
  },
]);
