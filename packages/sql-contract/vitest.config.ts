import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [
      'dist/**',
      'node_modules/**',
      'tmp/**',
      'tests/readme/**/*.test.ts',
      'tests/mapper/driver/*.integration.test.ts',
    ],
    root: resolve(__dirname),
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@rawsql-ts/sql-contract': resolve(__dirname, 'src'),
      '@rawsql-ts/sql-contract/mapper': resolve(__dirname, 'src/mapper'),
      '@rawsql-ts/sql-contract/mapper/*': resolve(__dirname, 'src/mapper/*'),
      '@rawsql-ts/sql-contract/writer': resolve(__dirname, 'src/writer'),
      '@rawsql-ts/sql-contract/writer/*': resolve(__dirname, 'src/writer/*'),
      '@rawsql-ts/testkit-core': resolve(__dirname, '../testkit-core/src'),
      'rawsql-ts': resolve(__dirname, '../core/src'),
    },
  },
})
