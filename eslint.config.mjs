import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'path';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

const tsProjectFiles = new Set([resolve(process.cwd(), 'tsconfig.json')]);
const testsConfigFile = resolve(process.cwd(), 'tsconfig.tests.json');
if (existsSync(testsConfigFile)) {
    // Only include the tests config when it exists in the current workspace.
    tsProjectFiles.add(testsConfigFile);
}

const packagesDir = resolve(process.cwd(), 'packages');
if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }
        const pkgDir = resolve(packagesDir, entry.name);
        const pkgConfig = resolve(pkgDir, 'tsconfig.json');
        if (existsSync(pkgConfig)) {
            tsProjectFiles.add(pkgConfig);
        }
        const pkgTestsConfig = resolve(pkgDir, 'tsconfig.tests.json');
        if (existsSync(pkgTestsConfig)) {
            tsProjectFiles.add(pkgTestsConfig);
        }
    }
}
const tsProjectFileList = Array.from(tsProjectFiles);

const sharedParserOptions = {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: tsProjectFileList,
    tsconfigRootDir: process.cwd(),
};

export default [
    {
        ignores: [
            'node_modules',
            'dist',
            'packages/*/node_modules',
            'packages/*/dist',
            '**/tests/generated/**',
            'packages/sql-contract/src/**/*.d.ts',
        ],
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
