/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
    test: {
        environment: 'node',
        include: [
            'packages/*/tests/**/*.test.[jt]s',
            'examples/*/tests/**/*.test.[jt]s'
        ],
        exclude: [
            '**/dist/**',
            '**/node_modules/**'
        ],
        root: resolve(__dirname),
        testTimeout: 10000,
        // モノレポ内の各パッケージのテストを並列実行
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: false,
                isolate: true
            }
        }
    },
    // 各パッケージのtsconfig.jsonを認識するためのresolve設定
    resolve: {
        alias: {
            'rawsql-ts': resolve(__dirname, 'packages/core/src'),
            '@msugiura/rawsql-prisma': resolve(__dirname, 'packages/prisma-integration/src')
        }
    }
})
