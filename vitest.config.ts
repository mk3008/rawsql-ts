/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['packages/*/tests/**/*.test.[jt]s'],
        exclude: ['**/dist/**', '**/node_modules/**'],
        root: resolve(__dirname),
        testTimeout: 10000,
        pool: 'threads',
        tsconfig: resolve(__dirname, 'tsconfig.tests.json'),
        globalSetup: resolve(__dirname, 'vitest.global-setup.ts'),
    },
    resolve: {
        alias: {
            'rawsql-ts': resolve(__dirname, 'packages/core/src'),
            '@rawsql-ts/testkit-core': resolve(__dirname, 'packages/testkit-core/src'),
        },
    },
})
