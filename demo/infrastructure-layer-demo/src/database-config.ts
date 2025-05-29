/**
 * Database configuration and table column definitions
 * Centralized configuration for rawsql-ts SqlParamInjector
 */

/**
 * Table column resolver for rawsql-ts SqlParamInjector
 * Defines available columns for dynamic SQL injection
 * 
 * @param tableName - Name of the table
 * @returns Array of column names available for injection
 */
export function getTableColumns(tableName: string): string[] {
    if (tableName === 'todos') {
        return ['id', 'title', 'description', 'status', 'priority', 'created_at', 'updated_at'];
    }
    return [];
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
    connectionTimeoutMillis: 2000,
} as const;
