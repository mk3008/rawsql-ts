import { Pool } from 'pg';
import { Todo, TodoSearchCriteria, TodoStatus, TodoPriority } from '../domain/Todo';
import { TodoRepository } from '../domain/TodoRepository';
import { SqlParamInjector, SqlFormatter } from '../../../..'; // Import from parent rawsql-ts

/**
 * PostgreSQL implementation of TodoRepository using rawsql-ts SqlParamInjector
 * This implementation demonstrates the power of SqlParamInjector for dynamic query building
 */
export class PostgresTodoRepository implements TodoRepository {
    constructor(private readonly pool: Pool) { }

    /**
     * Convert domain search criteria to rawsql-ts compatible state object (DTO pattern)
     * This demonstrates how rawsql-ts enables clean separation between domain and infrastructure layers
     * 
     * @param criteria Domain-layer search criteria
     * @returns Infrastructure-layer state object with SQL operators and field mappings
     */
    private convertToSearchState(criteria: TodoSearchCriteria): Record<string, any> {
        return {
            // Domain field 'title' -> SQL LIKE pattern for partial matching
            title: criteria.title ? { like: `%${criteria.title}%` } : undefined,

            // Direct field mapping (domain matches database schema)
            status: criteria.status ? criteria.status : undefined,
            priority: criteria.priority ? criteria.priority : undefined,

            // Domain date range -> SQL operators with field name mapping
            // fromDate/toDate (domain) -> created_at with >=/<= operators (SQL)
            created_at: (criteria.fromDate || criteria.toDate) ? {
                ...(criteria.fromDate && { '>=': criteria.fromDate.toISOString() }),
                ...(criteria.toDate && { '<=': criteria.toDate.toISOString() })
            } : undefined
        };
    }

    /**
     * Search todos based on criteria using rawsql-ts SqlParamInjector
     * @param criteria - Search criteria for filtering todos
     * @returns Promise resolving to an array of matching todos
     */
    async searchTodos(criteria: TodoSearchCriteria): Promise<Todo[]> {
        // Base SQL query - SqlParamInjector will inject WHERE conditions dynamically
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
                created_at DESC        `;

        // Convert domain criteria to rawsql-ts compatible state (DTO transformation)
        const state = this.convertToSearchState(criteria);

        try {
            // rawsql-ts SqlParamInjector automatically handles dynamic WHERE clause injection
            const injector = new SqlParamInjector();
            const injectedQuery = injector.inject(baseSql, state);

            // Format for PostgreSQL with indexed parameters
            const formatter = new SqlFormatter({ preset: 'postgres' });
            const { formattedSql, params } = formatter.format(injectedQuery);

            // Execute the query (params should be array for postgres preset)
            const result = await this.pool.query(formattedSql, params as any[]);
            return result.rows.map(this.mapRowToTodo);
        } catch (error) {
            throw new Error(`Failed to search todos: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Map database row to Todo entity
     * @param row - Database row
     * @returns Todo entity
     */
    private mapRowToTodo(row: any): Todo {
        return {
            id: row.id,
            title: row.title,
            description: row.description,
            status: row.status as TodoStatus,
            priority: row.priority as TodoPriority,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
}
