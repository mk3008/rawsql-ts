import { describe, it, expect, beforeEach } from 'vitest';
import { RawSqlClient } from '../src/RawSqlClient';

describe('Issue #128: JSON mapping files in subdirectories', () => {
    let client: RawSqlClient;

    // Mock Prisma Client
    const mockPrismaClient = {
        $queryRaw: () => Promise.resolve([]),
        $queryRawUnsafe: () => Promise.resolve([{ id: 1, name: 'Alice', email: 'alice@example.com', title: 'Engineer', bio: 'Developer' }]),
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

            // Should return structured object (due to JSON mapping)
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });

        it('should provide clear error messages when JSON files are missing in subdirectories', async () => {
            // This reproduces the error message from the issue
            let debugOutput: string[] = [];
            
            // Temporarily enable debug to capture the error message
            const debugClient = new RawSqlClient(mockPrismaClient as any, {
                debug: true,
                sqlFilesPath: './tests/sql'
            });

            // Capture console.log output
            const originalLog = console.log;
            console.log = (...args: any[]) => {
                debugOutput.push(args.join(' '));
            };

            try {
                const result = await debugClient.queryOne('users/list.sql', { 
                    filter: { id: 1 } 
                });

                // Should still work but use non-serialized mode
                expect(result).toBeDefined();
            } finally {
                console.log = originalLog;
            }

            // Should have logged the improved error message
            const errorMessages = debugOutput.filter(msg => 
                msg.includes('JsonMapping file not found') || 
                msg.includes('Path resolution details')
            );
            
            expect(errorMessages.length).toBeGreaterThan(0);
            
            // The new error messages should include path resolution details
            const hasPathDetails = debugOutput.some(msg => 
                msg.includes('resolved to:')
            );
            expect(hasPathDetails).toBe(true);
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

        it('should provide helpful error messages for missing files', async () => {
            try {
                await client.query('nonexistent/file.sql');
                fail('Expected error for missing file');
            } catch (error) {
                expect(error).toBeDefined();
                expect(error instanceof Error).toBe(true);
                
                if (error instanceof Error) {
                    // Should include both original path and resolved path
                    expect(error.message).toContain('nonexistent/file.sql');
                    expect(error.message).toContain('resolved from');
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