/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const shouldExcludeBenchmarks = process.env.VITEST_INCLUDE_BENCHMARKS !== '1'
const testExcludes = ['**/dist/**', '**/node_modules/**']

if (shouldExcludeBenchmarks) {
    // Keep benchmark files out of the default suite unless explicitly requested.
    testExcludes.push('benchmarks/**')
}

export default defineConfig({
    test: {
        environment: 'node',
        include: ['packages/*/tests/**/*.test.[jt]s'],
        exclude: testExcludes,
        root: resolve(__dirname),
        testTimeout: 10000,
        pool: 'threads',
        globalSetup: resolve(__dirname, 'vitest.global-setup.ts'),
    },
    resolve: {
        alias: {
            'rawsql-ts': resolve(__dirname, 'packages/core/src'),
            '@rawsql-ts/testkit-core': resolve(__dirname, 'packages/testkit-core/src'),
        '@rawsql-ts/sql-contract-zod': resolve(__dirname, 'packages/sql-contract-zod/src'),
        '@rawsql-ts/sql-contract': resolve(__dirname, 'packages/sql-contract/src'),
        },
    },
})
