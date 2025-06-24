import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import * as path from 'path';

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
        test: {
            globals: true,
            environment: 'node',
            watch: false,
            env: {
                // Make sure DATABASE_URL is available in tests
                DATABASE_URL: env.DATABASE_URL || 'postgresql://demo_user:demo_password@localhost:5432/prisma_comparison_demo?schema=public',
                // Ensure schema path is absolute for test explorer
                PRISMA_SCHEMA_PATH: path.join(process.cwd(), 'prisma', 'schema.prisma'),
            },
        },
    };
});
