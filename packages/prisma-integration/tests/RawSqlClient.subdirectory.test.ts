import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RawSqlClient } from '../src/RawSqlClient';
import * as fs from 'fs';
import * as path from 'path';

// Mock Prisma Client with minimal DMMF to avoid schema resolution issues
const mockPrismaClient = {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
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

describe('RawSqlClient - JSON Mapping Subdirectory Bug', () => {
    let client: RawSqlClient;

    beforeEach(async () => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create RawSqlClient instance
        client = new RawSqlClient(mockPrismaClient as any, {
            debug: true,
            sqlFilesPath: './tests/sql'
        });
    });

    describe('Reproduce the subdirectory issue', () => {
        it('should attempt to load JSON mapping from subdirectory', async () => {
            // This test shows that subdirectory JSON mapping WORKS correctly
            
            // Mock: minimal database result
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue([
                { UserProfile: { id: 1, name: 'Alice', email: 'alice@example.com' } }
            ]);

            // Act: Try to use the subdirectory SQL file with JSON mapping
            const result = await client.queryOne('users/profile.sql', {
                filter: { id: 1 }
            });

            // If we get here, the test actually worked
            expect(result).toBeDefined();
            expect(result).toHaveProperty('UserProfile');
        });

        it('should reproduce the missing JSON file issue', async () => {
            // This test reproduces the exact scenario from the issue:
            // SQL file exists in subdirectory, but JSON file does not exist
            
            // Mock: minimal database result (for non-serialized query)
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue([
                { id: 1, name: 'Alice', email: 'alice@example.com' }
            ]);

            // Act: Try to use a subdirectory SQL file without a corresponding JSON file
            // This should reproduce the "JsonMapping file not found: users/list.json" message
            const result = await client.queryOne('users/list.sql', {
                filter: { id: 1 }
            });

            // The current behavior: falls back to first column value (scalar)
            expect(result).toBe(1);  // First column value from the first row
        });

        it('should work correctly with root-level JSON mapping files', async () => {
            // This tests the control case - root level files should work
            
            // Mock: result that would come from JSON serialization
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue([
                { UserList: { id: 1, name: 'Alice', email: 'alice@example.com' } }
            ]);

            // Act: Use root-level SQL file with JSON mapping
            const result = await client.queryOne('root-test.sql', {
                filter: { id: 1 }
            });

            // Should work correctly with JSON mapping
            expect(result).toBeDefined();
            expect(result).toHaveProperty('UserList');
        });
    });
});