import { SqlParamInjector, SqlFormatter } from '../../..'; // Import from parent rawsql-ts
import { TodoSearchCriteria, Todo } from './domain';
import { getTableColumns, DATABASE_CONFIG } from './database-config';
import { Pool, PoolClient } from 'pg';

/**
 * Infrastructure layer - Handles database-specific transformations and connections
 * This demonstrates the DTO pattern using rawsql-ts with real PostgreSQL database
 */
export class TodoInfrastructureService {
    private pool: Pool;
    constructor() {
        // Initialize PostgreSQL connection pool
        this.pool = new Pool(DATABASE_CONFIG);
    }

    /**
     * Test database connection
     */    async testConnection(): Promise<boolean> {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Close database connection pool
     */
    async close(): Promise<void> {
        await this.pool.end();
    }

    /**
     * Convert domain search criteria to rawsql-ts compatible state object (DTO pattern)
     * 
     * This is the key transformation that enables clean architecture:
     * - Domain layer stays focused on business logic
     * - Infrastructure layer handles SQL-specific concerns
     * - rawsql-ts bridges the gap with type-safe transformations
     * 
     * @param criteria Domain-layer search criteria
     * @returns Infrastructure-layer state object with SQL operators and field mappings
     */
    public convertToSearchState(criteria: TodoSearchCriteria): Record<string, any> {
        return {
            // Domain field 'title' -> SQL LIKE pattern for partial matching
            // rawsql-ts will convert this to: WHERE title LIKE '%value%'
            title: criteria.title ? { like: `%${criteria.title}%` } : undefined,

            // Direct field mapping (domain matches database schema)
            // rawsql-ts will convert this to: WHERE status = 'value'
            status: criteria.status ? criteria.status : undefined,
            priority: criteria.priority ? criteria.priority : undefined,

            // Domain date range -> SQL operators with field name mapping
            // fromDate/toDate (domain) -> created_at with >=/<= operators (SQL)
            // rawsql-ts will convert this to: WHERE created_at >= 'date1' AND created_at <= 'date2'
            created_at: (criteria.fromDate || criteria.toDate) ? {
                ...(criteria.fromDate && { '>=': criteria.fromDate.toISOString() }),
                ...(criteria.toDate && { '<=': criteria.toDate.toISOString() })
            } : undefined
        };
    }

    /**
     * Build dynamic SQL query using rawsql-ts SqlParamInjector
     * 
     * @param criteria Domain search criteria
     * @returns Object containing the formatted SQL and parameters
     */
    public buildSearchQuery(criteria: TodoSearchCriteria) {
        // Base SQL query - SqlParamInjector will add WHERE clause automatically
        const baseSql = `
            SELECT 
                id,
                title,
                description,
                status,
                priority,
                created_at,
                updated_at
            FROM
                todos
            ORDER BY
                CASE priority 
                    WHEN 'high' THEN 1 
                    WHEN 'medium' THEN 2 
                    WHEN 'low' THEN 3 
                END,
                created_at DESC
        `;

        // Convert domain criteria to infrastructure state (DTO transformation)
        const searchState = this.convertToSearchState(criteria);

        // SqlParamInjector automatically adds WHERE clause based on state
        const injector = new SqlParamInjector(getTableColumns);
        const injectedQuery = injector.inject(baseSql, searchState);

        // Format for different database dialects
        const formatter = new SqlFormatter({ preset: 'postgres' });
        const { formattedSql, params } = formatter.format(injectedQuery); return {
            formattedSql,
            params
        };
    }

    /**
     * Execute search query against real PostgreSQL database
     * This demonstrates the complete DTO pattern in action with real data
     * 
     * @param criteria Domain search criteria
     * @returns Array of Todo entities
     */
    async searchTodos(criteria: TodoSearchCriteria): Promise<Todo[]> {
        // Reuse the query building logic
        const query = this.buildSearchQuery(criteria);

        try {
            // Execute query against real PostgreSQL database
            const result = await this.pool.query(query.formattedSql, query.params as any[]);

            // Map database rows to domain entities
            return result.rows.map(this.mapRowToTodo);
        } catch (error) {
            throw new Error(`Failed to search todos: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get total count of todos matching criteria
     */
    async countTodos(criteria: TodoSearchCriteria): Promise<number> {
        const countSql = `
            SELECT COUNT(*) as total
            FROM todos
        `;
        const searchState = this.convertToSearchState(criteria);

        const injector = new SqlParamInjector(getTableColumns);
        const injectedQuery = injector.inject(countSql, searchState);

        const formatter = new SqlFormatter({ preset: 'postgres' });
        const { formattedSql, params } = formatter.format(injectedQuery);

        const result = await this.pool.query(formattedSql, params as any[]);
        return parseInt(result.rows[0].total);
    }

    /**
     * Map database row to domain entity
     */
    private mapRowToTodo(row: any): Todo {
        return {
            id: row.id,
            title: row.title,
            description: row.description,
            status: row.status,
            priority: row.priority,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
