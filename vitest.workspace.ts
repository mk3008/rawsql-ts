import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './packages/testkit-core/vitest.config.ts',
    test: {
      root: './packages/testkit-core',
    },
  },
  {
    extends: './packages/testkit-sqlite/vitest.config.ts',
    test: {
      root: './packages/testkit-sqlite',
    },
  },
]);
