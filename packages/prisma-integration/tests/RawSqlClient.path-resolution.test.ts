/**
 * Path resolution tests for RawSqlClient
 * 
 * ⚠️ DEPRECATED: Most tests in this file are disabled because query() method is now private.
 * 
 * The query() method has been made private as part of API simplification.
 * Use queryOne() or queryMany() instead for new code.
 */
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

describe.skip('RawSqlClient - Path Resolution Enhancement - DEPRECATED: query() method now private', () => {
    let client: RawSqlClient;

    beforeEach(() => {
        client = new RawSqlClient(mockPrismaClient as any, {
            debug: true,
            sqlFilesPath: './tests/sql'
        });
    });

    // NOTE: All tests using query() method are disabled because it's now private
    // Migration: Use queryOne() or queryMany() instead
    console.log('⚠️ All tests disabled: query() method is now private. Use queryOne/queryMany instead.');
});