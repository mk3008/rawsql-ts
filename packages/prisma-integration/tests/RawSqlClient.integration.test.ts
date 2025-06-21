/**
 * Integration tests for RawSqlClient with public API (queryOne/queryMany)
 * 
 * Tests error handling and enhanced error reporting using the public API methods.
 * The query() method is now private and these tests use queryOne/queryMany instead.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RawSqlClient, SqlFileNotFoundError, JsonMappingRequiredError } from '../src/RawSqlClient';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock Prisma Client with minimal functionality
const mockPrismaClient = {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
};

describe('RawSqlClient - Integration with Enhanced Errors (Public API)', () => {
    let testDir: string;
    let client: RawSqlClient;

    beforeEach(async () => {
        // Reset mocks
        vi.clearAllMocks();

        // Create test directory in temp folder (cross-platform)
        testDir = path.join(os.tmpdir(), 'rawsql-test-' + Date.now());
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        fs.mkdirSync(testDir, { recursive: true });

        // Create RawSqlClient instance pointing to test directory
        client = new RawSqlClient(mockPrismaClient as any, {
            debug: true,
            sqlFilesPath: testDir
        });
    });

    afterEach(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('File Not Found Scenarios', () => {
        it('should throw SqlFileNotFoundError for non-existent SQL file when JSON mapping exists', async () => {
            // Arrange: Create JSON mapping but no SQL file to test SQL file not found error
            fs.writeFileSync(path.join(testDir, 'nonexistent.json'), JSON.stringify({
                rootName: 'Test',
                rootEntity: { columns: { id: 'id' } }
            }));

            // Act & Assert: Should throw SqlFileNotFoundError since JSON exists but SQL doesn't
            await expect(
                client.queryOne('nonexistent.sql')
            ).rejects.toThrow(SqlFileNotFoundError);
        });

        it('should provide detailed path information in error message', async () => {
            // Arrange: Create JSON mapping in subdirectory but no SQL file
            fs.mkdirSync(path.join(testDir, 'users'), { recursive: true });
            fs.writeFileSync(path.join(testDir, 'users', 'profile.json'), JSON.stringify({
                rootName: 'UserProfile',
                rootEntity: { columns: { id: 'id', name: 'name' } }
            }));

            // Act & Assert: Should throw SqlFileNotFoundError with detailed path information
            await expect(
                client.queryOne('users/profile.sql')
            ).rejects.toBeInstanceOf(SqlFileNotFoundError);
        });
    });

    describe('JSON Mapping Scenarios', () => {
        it('should throw JsonMappingRequiredError for missing JSON mapping file', async () => {
            // Arrange: Create SQL file without corresponding JSON mapping
            fs.writeFileSync(path.join(testDir, 'test.sql'), 'SELECT id, name FROM users');

            // Act & Assert: queryOne requires JSON mapping, should throw JsonMappingRequiredError
            await expect(
                client.queryOne('test.sql')
            ).rejects.toThrow(JsonMappingRequiredError);
        });

        it('should work with valid JSON mapping file', async () => {
            // Arrange: Create SQL file and valid JSON mapping
            fs.writeFileSync(path.join(testDir, 'test.sql'), 'SELECT id, name FROM users WHERE id = $1');
            fs.writeFileSync(path.join(testDir, 'test.json'), JSON.stringify({
                rootName: 'User',
                rootEntity: {
                    columns: {
                        id: 'id',
                        name: 'name'
                    }
                }
            }));            // Mock database response
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue([{ User: { id: 1, name: 'Alice' } }]);

            // Act: Should work with valid mapping
            const result = await client.queryOne('test.sql', {
                filter: { id: 1 }
            });            // Assert: Should return structured data (the inner object, not the wrapped one)
            expect(result).toBeDefined();
            expect(result).toEqual({ id: 1, name: 'Alice' });
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalled();
        });
    });

    describe('Error Message Quality', () => {
        it('should provide actionable error messages for missing JSON mapping files', async () => {
            // Arrange: Create SQL file but no JSON mapping (more common scenario)
            fs.mkdirSync(path.join(testDir, 'deeply', 'nested'), { recursive: true });
            fs.writeFileSync(path.join(testDir, 'deeply', 'nested', 'nonexistent.sql'), 'SELECT id FROM users');            // Act & Assert: Should provide helpful JsonMappingRequiredError
            await expect(
                client.queryOne('deeply/nested/nonexistent.sql')
            ).rejects.toBeInstanceOf(JsonMappingRequiredError);
        });

        it('should show the actual paths being searched for SQL files', async () => {
            // Arrange: Create JSON mapping but no SQL file to test SQL path resolution
            fs.writeFileSync(path.join(testDir, 'missing.json'), JSON.stringify({
                rootName: 'Test',
                rootEntity: { columns: { id: 'id' } }
            }));            // Act & Assert: Error message should contain actual search path for SQL file
            await expect(
                client.queryOne('missing.sql')
            ).rejects.toBeInstanceOf(SqlFileNotFoundError);
        });
    });

    describe('Enhanced Debug Output', () => {
        it('should provide debug information when debug=true', async () => {
            // Arrange: Create SQL and JSON files that match properly
            fs.writeFileSync(path.join(testDir, 'debug-test.sql'), 'SELECT COUNT(*) as total_count FROM users');
            fs.writeFileSync(path.join(testDir, 'debug-test.json'), JSON.stringify({
                rootName: 'Count',
                rootEntity: {
                    columns: {
                        total_count: 'total_count'  // Match the SQL column alias
                    }
                }
            }));            // Mock database response
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue([{ Count: { total_count: 5 } }]);

            // Act: Execute query with debug enabled
            const result = await client.queryOne('debug-test.sql');            // Assert: Should work and provide debug output (visible in console)
            expect(result).toBeDefined();
            expect(result).toEqual({ total_count: 5 });
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalled();
        });
    });
});