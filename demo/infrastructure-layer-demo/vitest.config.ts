import { defineConfig } from 'vitest/config';
import { join } from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: ['node_modules', 'dist'],
        setupFiles: ['./src/test/setup.ts'],
    },
    resolve: {
        alias: {
            '@': join(__dirname, 'src'),
            'rawsql-ts': join(__dirname, '../../'), // Point to parent rawsql-ts project
        },
    },
});
