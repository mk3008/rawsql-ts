import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

export default mergeConfig(rootConfig, {
  test: {
    root: resolve(__dirname),
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', '**/dist/**', '**/node_modules/**'],
  },
});
