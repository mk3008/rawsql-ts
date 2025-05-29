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
                created_at DESC
        `;

        // Prepare search parameters for SqlParamInjector
        const searchParams: Record<string, any> = {};

        if (criteria.title) {
            searchParams.title = { like: `%${criteria.title}%` };
        }

        if (criteria.status) {
            searchParams.status = criteria.status;
        }

        if (criteria.priority) {
            searchParams.priority = criteria.priority;
        }

        if (criteria.fromDate) {
            searchParams.created_at = { '>=': criteria.fromDate.toISOString() };
        }

        if (criteria.toDate) {
            // If both fromDate and toDate, use range
            if (criteria.fromDate) {
                searchParams.created_at = {
                    '>=': criteria.fromDate.toISOString(),
                    '<=': criteria.toDate.toISOString()
                };
            } else {
                searchParams.created_at = { '<=': criteria.toDate.toISOString() };
            }
        }

        try {
            // Use SqlParamInjector to dynamically inject search parameters
            const injector = new SqlParamInjector();
            const injectedQuery = injector.inject(baseSql, searchParams);

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
