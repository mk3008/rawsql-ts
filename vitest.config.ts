/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const shouldExcludeBenchmarks = process.env.VITEST_INCLUDE_BENCHMARKS !== '1'
const integrationTestPatterns = [
    'packages/sql-contract/tests/readme/**/*.test.[jt]s',
    'packages/sql-contract/tests/mapper/driver/pg-mapper.integration.test.ts',
]

const baseExcludes = ['**/dist/**', '**/node_modules/**']
if (shouldExcludeBenchmarks) {
    // Keep benchmark files out of the default suite unless explicitly requested.
    baseExcludes.push('benchmarks/**')
}

const defaultTestExcludes = [...baseExcludes, ...integrationTestPatterns]
const integrationTestExcludes = [...baseExcludes]

export const integrationConfig = defineConfig({
    test: {
        environment: 'node',
        include: integrationTestPatterns,
        exclude: integrationTestExcludes,
        root: resolve(__dirname),
        testTimeout: 30000,
        pool: 'threads',
        globalSetup: resolve(__dirname, 'vitest.global-setup.ts'),
    },
    resolve: {
        alias: {
            'rawsql-ts': resolve(__dirname, 'packages/core/src'),
            '@rawsql-ts/testkit-core': resolve(__dirname, 'packages/testkit-core/src'),
            '@rawsql-ts/sql-contract-zod': resolve(__dirname, 'packages/sql-contract-zod/src'),
            '@rawsql-ts/sql-contract/mapper': resolve(__dirname, 'packages/sql-contract/src/mapper'),
            '@rawsql-ts/sql-contract/mapper/*': resolve(__dirname, 'packages/sql-contract/src/mapper/*'),
            '@rawsql-ts/sql-contract/writer': resolve(__dirname, 'packages/sql-contract/src/writer'),
            '@rawsql-ts/sql-contract/writer/*': resolve(__dirname, 'packages/sql-contract/src/writer/*'),
            '@rawsql-ts/sql-contract': resolve(__dirname, 'packages/sql-contract/src'),
            '@rawsql-ts/test-evidence-core': resolve(__dirname, 'packages/test-evidence-core/src'),
            '@rawsql-ts/test-evidence-renderer-md': resolve(__dirname, 'packages/test-evidence-renderer-md/src'),
            '@rawsql-ts/adapter-node-pg': resolve(__dirname, 'packages/adapters/adapter-node-pg/src'),
            '@rawsql-ts/adapter-node-pg/*': resolve(__dirname, 'packages/adapters/adapter-node-pg/src/*'),
            '@rawsql-ts/shared-binder': resolve(__dirname, 'packages/_shared/binder/src'),
            '@rawsql-ts/shared-binder/*': resolve(__dirname, 'packages/_shared/binder/src/*'),
        },
    },
})

export default defineConfig({
    test: {
        environment: 'node',
        include: ['packages/*/tests/**/*.test.[jt]s'],
        exclude: defaultTestExcludes,
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
            '@rawsql-ts/sql-contract/mapper': resolve(__dirname, 'packages/sql-contract/src/mapper'),
            '@rawsql-ts/sql-contract/mapper/*': resolve(__dirname, 'packages/sql-contract/src/mapper/*'),
            '@rawsql-ts/sql-contract/writer': resolve(__dirname, 'packages/sql-contract/src/writer'),
            '@rawsql-ts/sql-contract/writer/*': resolve(__dirname, 'packages/sql-contract/src/writer/*'),
            '@rawsql-ts/sql-contract': resolve(__dirname, 'packages/sql-contract/src'),
            '@rawsql-ts/test-evidence-core': resolve(__dirname, 'packages/test-evidence-core/src'),
            '@rawsql-ts/test-evidence-renderer-md': resolve(__dirname, 'packages/test-evidence-renderer-md/src'),
            '@rawsql-ts/adapter-node-pg': resolve(__dirname, 'packages/adapters/adapter-node-pg/src'),
            '@rawsql-ts/adapter-node-pg/*': resolve(__dirname, 'packages/adapters/adapter-node-pg/src/*'),
            '@rawsql-ts/shared-binder': resolve(__dirname, 'packages/_shared/binder/src'),
            '@rawsql-ts/shared-binder/*': resolve(__dirname, 'packages/_shared/binder/src/*'),
        },
    },
})
