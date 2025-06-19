import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RawSqlClient, SqlFileNotFoundError, JsonMappingError } from '../src/RawSqlClient';
import * as fs from 'fs';
import * as path from 'path';

// Mock Prisma Client with minimal functionality
const mockPrismaClient = {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
};

describe('RawSqlClient - Integration with Enhanced Errors', () => {
    const testDir = '/tmp/rawsql-test';
    let client: RawSqlClient;

    beforeEach(async () => {
        // Reset mocks
        vi.clearAllMocks();

        // Create test directory
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
        it('should throw SqlFileNotFoundError for non-existent SQL file', async () => {
            await expect(
                client.query('nonexistent.sql')
            ).rejects.toThrow(SqlFileNotFoundError);

            try {
                await client.query('users/profile.sql');
                expect.fail('Should have thrown SqlFileNotFoundError');
            } catch (error) {
                expect(error).toBeInstanceOf(SqlFileNotFoundError);
                const sqlError = error as SqlFileNotFoundError;
                expect(sqlError.filename).toBe('users/profile.sql');
                expect(sqlError.message).toContain('SQL file not found');
                expect(sqlError.message).toContain('Suggestions:');
            }
        });
    });

    describe('JSON Mapping Scenarios', () => {
        it('should throw JsonMappingError for invalid JSON mapping file', async () => {
            // Create a valid SQL file
            fs.writeFileSync(path.join(testDir, 'test.sql'), 'SELECT id, name FROM users');
            
            // Create an invalid JSON file
            fs.writeFileSync(path.join(testDir, 'test.json'), '{ invalid json }');

            await expect(
                client.query('test.sql', { serialize: true })
            ).rejects.toThrow(JsonMappingError);

            try {
                await client.query('test.sql', { serialize: true });
                expect.fail('Should have thrown JsonMappingError');
            } catch (error) {
                expect(error).toBeInstanceOf(JsonMappingError);
                const jsonError = error as JsonMappingError;
                expect(jsonError.filename).toBe('test.json');
                expect(jsonError.issue).toContain('Invalid JSON syntax');
                expect(jsonError.message).toContain('Expected format:');
            }
        });

        it('should throw JsonMappingError for missing JSON mapping file when serialize=true', async () => {
            // Create a valid SQL file but no JSON file
            fs.writeFileSync(path.join(testDir, 'test.sql'), 'SELECT id, name FROM users');

            await expect(
                client.query('test.sql', { serialize: true })
            ).rejects.toThrow(JsonMappingError);

            try {
                await client.query('test.sql', { serialize: true });
                expect.fail('Should have thrown JsonMappingError');
            } catch (error) {
                expect(error).toBeInstanceOf(JsonMappingError);
                const jsonError = error as JsonMappingError;
                expect(jsonError.filename).toBe('test.json');
                expect(jsonError.issue).toBe('File not found');
            }
        });
    });

    describe('Enhanced Debug Output', () => {
        it('should provide enhanced debug messages for successful file loading', async () => {
            // Mock console.log to capture output
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            // Create valid files
            fs.writeFileSync(path.join(testDir, 'test.sql'), 'SELECT id, name FROM users');
            fs.writeFileSync(path.join(testDir, 'test.json'), JSON.stringify({
                resultFormat: 'object',
                rootAlias: 'user',
                columns: { id: 'id', name: 'name' }
            }));

            // Mock successful database execution
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue([{ user: { id: 1, name: 'Test' } }]);

            try {
                await client.query('test.sql', { serialize: true });
            } catch (error) {
                // Expected to fail due to schema initialization, but we can still check debug output
                // The important thing is that file loading debug messages were called
            }

            // Check that enhanced debug messages were logged
            const logCalls = consoleSpy.mock.calls.map(call => call[0]).join(' ');
            
            expect(logCalls).toContain('✅ Loaded SQL file:');
            expect(logCalls).toContain('📝 Content preview:');
            expect(logCalls).toContain('📊 File size:');

            consoleSpy.mockRestore();
        });
    });

    describe('Error Message Quality', () => {
        it('should provide actionable error messages', async () => {
            try {
                await client.query('deeply/nested/nonexistent.sql');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).toBeInstanceOf(SqlFileNotFoundError);
                expect(error.message).toContain('Check if parent directories exist');
                expect(error.message).toContain('Verify the sqlFilesPath configuration');
                expect(error.message).toContain('Ensure the file has the correct extension (.sql)');
            }
        });

        it('should show the actual paths being searched', async () => {
            try {
                await client.query('missing.sql');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).toBeInstanceOf(SqlFileNotFoundError);
                expect(error.message).toContain(testDir);
                expect(error.message).toContain('missing.sql');
            }
        });
    });
});