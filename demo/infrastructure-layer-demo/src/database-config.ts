/**
 * Database configuration and table column definitions
 * Centralized configuration for rawsql-ts SqlParamInjector
 */

/**
 * Table column resolver for rawsql-ts SqlParamInjector
 * Defines available columns for dynamic SQL injection across all tables
 * 
 * @param tableName - Name of the table
 * @returns Array of column names available for injection
 */
export function getTableColumns(tableName: string): string[] {
    switch (tableName) {
        case 'todo':
            return ['todo_id', 'title', 'description', 'status', 'priority', 'category_id', 'created_at', 'updated_at'];

        case 'category':
            return ['category_id', 'name', 'description', 'color', 'created_at'];

        case 'todo_comment':
            return ['todo_comment_id', 'todo_id', 'content', 'author_name', 'created_at'];

        default:
            return [];
    }
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
