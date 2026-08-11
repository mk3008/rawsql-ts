import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  resolve: {
    alias: {
      '@rawsql-ts/investigation-core': fileURLToPath(new URL('../../packages/investigation-core/src/index.ts', import.meta.url)),
      '@rawsql-ts/sql-grep-core/browser': fileURLToPath(new URL('../../packages/sql-grep-core/src/browser.ts', import.meta.url)),
      'rawsql-ts': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
});
