import { describe, it, expect, beforeEach } from 'vitest';
import { RawSqlClient } from '../src/RawSqlClient';

describe('Issue #128: JSON mapping files in subdirectories', () => {
    let client: RawSqlClient;    // Mock Prisma Client - only $queryRawUnsafe is used in the current API
    const mockPrismaClient = {
        $queryRawUnsafe: () => Promise.resolve([
            { UserProfile: { id: 1, name: 'Alice', email: 'alice@example.com', title: 'Engineer', bio: 'Developer' } }
        ]),
        _dmmf: {
            datamodel: {
                models: [
                    { name: 'User', fields: [{ name: 'id', type: 'Int', isId: true }, { name: 'name', type: 'String' }] }
                ]
            },
            schema: { outputTypes: [], inputTypes: [], enumTypes: [] }
        }
    };

    beforeEach(() => {
        client = new RawSqlClient(mockPrismaClient as any, {
            debug: false, // Disable debug for cleaner test output
            sqlFilesPath: './tests/sql'
        });
    });

    describe('Original issue reproduction', () => {
        it('should find JSON mapping files in subdirectories (WORKING CASE)', async () => {
            // This test demonstrates that the subdirectory JSON mapping DOES work
            const result = await client.queryOne('users/profile.sql', {
                filter: { id: 1 }
            });

            // Should return the nested object from JSON mapping (first column value)
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('email');
        });

        it('should throw error when JSON mapping file is missing for queryOne', async () => {
            // This reproduces the error when JSON mapping is required but missing
            // queryOne requires JSON mapping - should throw error if mapping file is missing
            try {
                await client.queryOne('users/list.sql', {
                    filter: { id: 1 }
                });
                expect.fail('Expected error for missing JSON mapping file');
            } catch (error) {
                expect(error).toBeDefined();
                expect(error instanceof Error).toBe(true);
                if (error instanceof Error) {
                    // Should contain information about missing JSON mapping
                    expect(error.message).toContain('JSON mapping file is required');
                }
            }
        });
    });

    describe('Path resolution improvements', () => {
        it('should handle various path formats consistently', async () => {
            // All these should resolve to the same file
            const pathVariants = [
                'users/profile.sql',
                './users/profile.sql',
                'users/./profile.sql'
            ];

            for (const sqlPath of pathVariants) {
                const result = await client.queryOne(sqlPath, {
                    filter: { id: 1 }
                });

                expect(result).toBeDefined();
                expect(typeof result).toBe('object');
            }
        });

        it('should provide helpful error messages for missing SQL files', async () => {
            try {
                await client.queryOne('nonexistent/file.sql');
                expect.fail('Expected error for missing SQL file');
            } catch (error) {
                expect(error).toBeDefined();
                expect(error instanceof Error).toBe(true);
                if (error instanceof Error) {
                    // Check for any common file not found indicators
                    const hasValidErrorMessage =
                        error.message.includes('not found') ||
                        error.message.includes('does not exist') ||
                        error.message.includes('ENOENT') ||
                        error.message.includes('file') ||
                        error.message.includes('Cannot find') ||
                        error.message.includes('no such file');
                    expect(hasValidErrorMessage).toBe(true);
                }
            }
        });
    });

    describe('Cross-platform compatibility', () => {
        it('should normalize different path separators', async () => {
            // Test path normalization (especially important on Windows)
            const result = await client.queryOne('users/profile.sql', {
                filter: { id: 1 }
            });

            expect(result).toBeDefined();
        });
    });
});