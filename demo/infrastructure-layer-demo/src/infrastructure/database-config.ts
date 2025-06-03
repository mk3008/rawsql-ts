/**
 * Database configuration and table column definitions
 * Now uses rawsql-ts SchemaManager to eliminate duplication
 */

import { getTableColumns as getColumnsFromSchema } from './schema-definitions';

/**
 * Table column resolver for rawsql-ts SqlParamInjector
 * Now delegates to unified schema definition
 * 
 * @param tableName - Name of the table
 * @returns Array of column names available for injection
 */
export function getTableColumns(tableName: string): string[] {
    return getColumnsFromSchema(tableName);
}

/**
 * Database connection configuration
 */
export const DATABASE_CONFIG = {
    host: 'localhost',
    port: 5433,  // Docker mapped port
    database: 'infrastructure_demo',
    user: 'demo_user',
    password: 'demo_password',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,  // Increased timeout for benchmarks
} as const;
