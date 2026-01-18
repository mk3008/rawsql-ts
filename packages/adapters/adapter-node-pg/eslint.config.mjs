import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

const here = dirname(fileURLToPath(import.meta.url));

const projectConfigs = [resolve(here, 'tsconfig.json'), resolve(here, 'tsconfig.tests.json')];

export default [
  {
    ignores: ['node_modules', 'dist'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: projectConfigs,
        tsconfigRootDir: here,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
        {
          selector: 'method',
          format: ['camelCase'],
        },
      ],
    },
  },
];
