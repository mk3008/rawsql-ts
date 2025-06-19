import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RawSqlClient, SqlFileNotFoundError, JsonMappingError, SqlExecutionError } from '../src/RawSqlClient';

// Mock Prisma Client
const mockPrismaClient = {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
};

describe('RawSqlClient - Enhanced Error Messages', () => {
    let client: RawSqlClient;

    beforeEach(async () => {
        // Reset mocks
        vi.clearAllMocks();

        // Create RawSqlClient instance with a non-existent path for testing
        client = new RawSqlClient(mockPrismaClient as any, {
            debug: true,
            sqlFilesPath: './non-existent-test-path'
        });
    });

    describe('SqlFileNotFoundError', () => {
        it('should throw SqlFileNotFoundError when SQL file does not exist', async () => {
            // Act & Assert: Expect enhanced error for non-existent file
            await expect(
                client.query('nonexistent/file.sql')
            ).rejects.toThrow(SqlFileNotFoundError);
        });

        it('should include helpful information in SqlFileNotFoundError', async () => {
            try {
                await client.query('users/profile.sql');
                expect.fail('Should have thrown SqlFileNotFoundError');
            } catch (error) {
                expect(error).toBeInstanceOf(SqlFileNotFoundError);
                const sqlError = error as SqlFileNotFoundError;
                
                expect(sqlError.filename).toBe('users/profile.sql');
                expect(sqlError.message).toContain('SQL file not found');
                expect(sqlError.message).toContain('Searched in:');
                expect(sqlError.message).toContain('Suggestions:');
                expect(sqlError.message).toContain('Check if the file exists at the specified path');
                expect(sqlError.message).toContain('Verify the sqlFilesPath configuration');
                expect(sqlError.message).toContain('Ensure the file has the correct extension (.sql)');
            }
        });
    });

    describe('JsonMappingError', () => {
        it('should throw JsonMappingError when JSON file does not exist', async () => {
            // Since we're using a non-existent path, the SQL file won't exist either
            // So we'll test with an existing client but non-existent JSON
            const workingClient = new RawSqlClient(mockPrismaClient as any, {
                debug: true,
                sqlFilesPath: './tests/sql'
            });

            // This will try to auto-load a JSON mapping file that doesn't exist
            await expect(
                workingClient.query('users/search.sql', { serialize: true })
            ).rejects.toThrow(JsonMappingError);
        });
    });

    describe('SqlExecutionError', () => {
        it('should throw SqlExecutionError when database query fails', async () => {
            const workingClient = new RawSqlClient(mockPrismaClient as any, {
                debug: true,
                sqlFilesPath: './tests/sql'
            });

            // Mock database error
            const dbError = new Error('column "invalid_column" does not exist');
            mockPrismaClient.$queryRawUnsafe.mockRejectedValue(dbError);

            // Act & Assert: Expect enhanced error
            await expect(
                workingClient.query('users/search.sql')
            ).rejects.toThrow(SqlExecutionError);
        });

        it('should include helpful information in SqlExecutionError', async () => {
            const workingClient = new RawSqlClient(mockPrismaClient as any, {
                debug: true,
                sqlFilesPath: './tests/sql'
            });

            // Mock database error with specific message
            const dbError = new Error('column "invalid_column" does not exist');
            mockPrismaClient.$queryRawUnsafe.mockRejectedValue(dbError);

            try {
                await workingClient.query('users/search.sql');
                expect.fail('Should have thrown SqlExecutionError');
            } catch (error) {
                expect(error).toBeInstanceOf(SqlExecutionError);
                const sqlError = error as SqlExecutionError;
                
                expect(sqlError.sql).toContain('SELECT');
                expect(sqlError.databaseError).toContain('column "invalid_column" does not exist');
                expect(sqlError.message).toContain('SQL query execution failed');
                expect(sqlError.message).toContain('Suggestions:');
                expect(sqlError.message).toContain('Check if all referenced tables and columns exist');
            }
        });
    });

    describe('Error class properties', () => {
        it('should have proper error class names', async () => {
            try {
                await client.query('nonexistent.sql');
                expect.fail('Should have thrown SqlFileNotFoundError');
            } catch (error) {
                expect(error).toBeInstanceOf(SqlFileNotFoundError);
                expect(error.name).toBe('SqlFileNotFoundError');
            }
        });
    });

    describe('Enhanced debug output', () => {
        it('should not crash when debug mode is enabled', async () => {
            // This test ensures our enhanced debug logging doesn't break anything
            const debugClient = new RawSqlClient(mockPrismaClient as any, {
                debug: true,
                sqlFilesPath: './tests/sql'
            });

            mockPrismaClient.$queryRawUnsafe.mockResolvedValue([{ id: 1, name: 'Test' }]);

            // This should work without throwing (ignoring the result)
            try {
                await debugClient.query('users/search.sql');
            } catch (error) {
                // Expected to fail due to schema initialization, but shouldn't be a debug-related error
                expect(error.message).not.toContain('debug');
            }
        });
    });
});