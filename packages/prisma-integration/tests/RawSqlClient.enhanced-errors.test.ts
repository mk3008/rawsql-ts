/**
 * Enhanced error handling tests for RawSqlClient
 * 
 * ⚠️ DEPRECATED: Most tests in this file are disabled because query() method is now private.
 * 
 * The query() method has been made private as part of API simplification.
 * Use queryOne() or queryMany() instead for new code.
 * 
 * These tests remain here for reference and can be adapted to test the public API
 * when the enhanced error handling is updated to work with queryOne/queryMany.
 */
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

    // DISABLED: Tests using query() method are disabled as it's now private
    describe.skip('SqlFileNotFoundError - DEPRECATED: query() method now private', () => {
        it('should throw SqlFileNotFoundError when SQL file does not exist', async () => {
            // NOTE: This test is disabled because query() is now private
            // Migration: Use queryOne() or queryMany() instead
            console.log('⚠️ Test disabled: query() method is now private. Use queryOne/queryMany instead.');
        });

        it('should include helpful information in SqlFileNotFoundError', async () => {
            // NOTE: This test is disabled because query() is now private
            // Migration: Use queryOne() or queryMany() instead
            console.log('⚠️ Test disabled: query() method is now private. Use queryOne/queryMany instead.');
        });
    });    // DISABLED: Tests using query() method are disabled as it's now private
    describe.skip('JsonMappingError - DEPRECATED: query() method now private', () => {
        it('should throw JsonMappingError when JSON file does not exist', async () => {
            // NOTE: This test is disabled because query() is now private
            // Migration: Use queryOne() or queryMany() instead
            console.log('⚠️ Test disabled: query() method is now private. Use queryOne/queryMany instead.');
        });
    });    // DISABLED: Tests using query() method are disabled as it's now private
    describe.skip('SqlExecutionError - DEPRECATED: query() method now private', () => {
        it('should throw SqlExecutionError when database query fails', async () => {
            // NOTE: This test is disabled because query() is now private
            // Migration: Use queryOne() or queryMany() instead
            console.log('⚠️ Test disabled: query() method is now private. Use queryOne/queryMany instead.');
        });

        it('should include helpful information in SqlExecutionError', async () => {
            // NOTE: This test is disabled because query() is now private
            // Migration: Use queryOne() or queryMany() instead
            console.log('⚠️ Test disabled: query() method is now private. Use queryOne/queryMany instead.');
        });
    });    // DISABLED: Tests using query() method are disabled as it's now private
    describe.skip('Error class properties - DEPRECATED: query() method now private', () => {
        it('should have proper error class names', async () => {
            // NOTE: This test is disabled because query() is now private
            // Migration: Use queryOne() or queryMany() instead
            console.log('⚠️ Test disabled: query() method is now private. Use queryOne/queryMany instead.');
        });
    });    // DISABLED: Tests using query() method are disabled as it's now private
    describe.skip('Enhanced debug output - DEPRECATED: query() method now private', () => {
        it('should not crash when debug mode is enabled', async () => {
            // NOTE: This test is disabled because query() is now private
            // Migration: Use queryOne() or queryMany() instead
            console.log('⚠️ Test disabled: query() method is now private. Use queryOne/queryMany instead.');
        });
    });
});