import { existsSync } from 'node:fs';
import { resolve } from 'path';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

const tsProjectFiles = [resolve(process.cwd(), 'tsconfig.json')];
const testsConfigFile = resolve(process.cwd(), 'tsconfig.tests.json');
if (existsSync(testsConfigFile)) {
    // Only include the tests config when it exists in the current workspace.
    tsProjectFiles.push(testsConfigFile);
}

const sharedParserOptions = {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: tsProjectFiles,
    tsconfigRootDir: process.cwd(),
};

export default [
    {
        ignores: ['node_modules', 'dist', 'packages/*/node_modules', 'packages/*/dist'],
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: sharedParserOptions,
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
