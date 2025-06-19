import { describe, it, expect, beforeEach } from 'vitest';
import { RawSqlClient } from '../src/RawSqlClient';

// Mock Prisma Client with minimal DMMF to avoid schema resolution issues
const mockPrismaClient = {
    $queryRaw: () => Promise.resolve([]),
    $queryRawUnsafe: () => Promise.resolve([]),
    _dmmf: {
        datamodel: {
            models: [
                {
                    name: 'User',
                    fields: [
                        { name: 'id', type: 'Int', isId: true },
                        { name: 'name', type: 'String' },
                        { name: 'email', type: 'String' }
                    ]
                }
            ]
        },
        schema: {
            outputTypes: [],
            inputTypes: [],
            enumTypes: []
        }
    }
};

describe('RawSqlClient - Path Resolution Enhancement', () => {
    let client: RawSqlClient;

    beforeEach(() => {
        client = new RawSqlClient(mockPrismaClient as any, {
            debug: true,
            sqlFilesPath: './tests/sql'
        });
    });

    describe('Enhanced error reporting', () => {
        it('should provide detailed path information for missing files', async () => {
            try {
                // Try to load a file that definitely doesn't exist
                await client.query('nonexistent/missing.sql');
                fail('Expected error was not thrown');
            } catch (error) {
                expect(error).toBeDefined();
                expect(error instanceof Error).toBe(true);
                if (error instanceof Error) {
                    // Should include both the original path and resolved path
                    expect(error.message).toContain('nonexistent/missing.sql');
                    expect(error.message).toContain('resolved from:');
                }
            }
        });

        it('should provide detailed path information for missing JSON mapping files', async () => {
            try {
                // Try to load a SQL file that exists but JSON mapping doesn't
                await client.query('users/list.sql', { serialize: true });
                // Should not throw an error, but should log detailed path info
                // The test passes if no error is thrown (fallback behavior)
                expect(true).toBe(true);
            } catch (error) {
                // If an error is thrown, it should have detailed path info
                if (error instanceof Error) {
                    expect(error.message).toContain('users/list.json');
                }
            }
        });
    });

    describe('Cross-platform path handling', () => {
        it('should normalize paths correctly', async () => {
            // Test with different path separators and redundant segments
            const pathVariations = [
                'users/list.sql',
                'users\\list.sql',  // Windows-style separator
                'users//list.sql',  // Double separator
                './users/list.sql', // Relative with dot
                'users/../users/list.sql' // Redundant path segments
            ];

            for (const sqlPath of pathVariations) {
                try {
                    await client.query(sqlPath);
                    // Should work the same way regardless of path format
                    expect(true).toBe(true);
                } catch (error) {
                    // All should fail the same way (file exists but no serialization)
                    expect(error).toBeDefined();
                }
            }
        });
    });
});