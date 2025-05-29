import { SqlParamInjector, SqlFormatter } from '../../..'; // Import from parent rawsql-ts
import { TodoSearchCriteria, Todo, TodoStatus, TodoPriority } from './domain';
import { getTableColumns, DATABASE_CONFIG } from './database-config';
import { ITodoRepository, QueryBuildResult } from './infrastructure-interface';
import { Pool, PoolClient } from 'pg';

/**
 * RawSQL-based implementation of Todo repository using rawsql-ts
 * This demonstrates the DTO pattern with real PostgreSQL database operations
 */
export class RawSQLTodoRepository implements ITodoRepository {
    private pool: Pool;

    constructor() {
        // Initialize PostgreSQL connection pool
        this.pool = new Pool(DATABASE_CONFIG);
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

    // === Repository Interface Implementation ===

    /**
     * Find todos based on search criteria
     */
    async findByCriteria(criteria: TodoSearchCriteria): Promise<Todo[]> {
        const query = this.buildSearchQuery(criteria);

        try {
            const result = await this.pool.query(query.formattedSql, query.params as any[]);
            return result.rows.map(this.mapRowToTodo);
        } catch (error) {
            throw new Error(`Failed to find todos: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Count todos matching search criteria
     */
    async countByCriteria(criteria: TodoSearchCriteria): Promise<number> {
        const countSql = `SELECT COUNT(*) as total FROM todos`;
        const searchState = this.convertToSearchState(criteria);

        const injector = new SqlParamInjector(getTableColumns);
        const injectedQuery = injector.inject(countSql, searchState);

        const formatter = new SqlFormatter({ preset: 'postgres' });
        const { formattedSql, params } = formatter.format(injectedQuery);

        const result = await this.pool.query(formattedSql, params as any[]);
        return parseInt(result.rows[0].total);
    }

    /**
     * Find a single todo by ID
     */
    async findById(id: string): Promise<Todo | null> {
        const sql = 'SELECT * FROM todos WHERE id = $1';

        try {
            const result = await this.pool.query(sql, [id]);
            return result.rows.length > 0 ? this.mapRowToTodo(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Failed to find todo by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create a new todo
     */
    async create(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
        const sql = `
            INSERT INTO todos (title, description, status, priority, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING *
        `;

        try {
            const result = await this.pool.query(sql, [
                todo.title,
                todo.description,
                todo.status,
                todo.priority
            ]);
            return this.mapRowToTodo(result.rows[0]);
        } catch (error) {
            throw new Error(`Failed to create todo: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update an existing todo
     */
    async update(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>): Promise<Todo | null> {
        const setFields = [];
        const values = [];
        let paramIndex = 1;

        if (updates.title !== undefined) {
            setFields.push(`title = $${paramIndex++}`);
            values.push(updates.title);
        }
        if (updates.description !== undefined) {
            setFields.push(`description = $${paramIndex++}`);
            values.push(updates.description);
        }
        if (updates.status !== undefined) {
            setFields.push(`status = $${paramIndex++}`);
            values.push(updates.status);
        }
        if (updates.priority !== undefined) {
            setFields.push(`priority = $${paramIndex++}`);
            values.push(updates.priority);
        }

        if (setFields.length === 0) {
            return this.findById(id);
        }

        setFields.push(`updated_at = $${paramIndex++}`);
        values.push(new Date());
        values.push(id);

        const sql = `
            UPDATE todos 
            SET ${setFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        try {
            const result = await this.pool.query(sql, values);
            return result.rows.length > 0 ? this.mapRowToTodo(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Failed to update todo: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete a todo by ID
     */
    async delete(id: string): Promise<boolean> {
        const sql = 'DELETE FROM todos WHERE id = $1';

        try {
            const result = await this.pool.query(sql, [id]);
            return (result.rowCount || 0) > 0;
        } catch (error) {
            throw new Error(`Failed to delete todo: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update todo status
     */
    async updateStatus(id: string, status: TodoStatus): Promise<Todo | null> {
        return this.update(id, { status });
    }

    /**
     * Update todo priority
     */
    async updatePriority(id: string, priority: TodoPriority): Promise<Todo | null> {
        return this.update(id, { priority });
    }

    /**
     * Find todos by status
     */
    async findByStatus(status: TodoStatus): Promise<Todo[]> {
        return this.findByCriteria({ status });
    }

    /**
     * Find todos by priority
     */
    async findByPriority(priority: TodoPriority): Promise<Todo[]> {
        return this.findByCriteria({ priority });
    }

    // === Demo-specific methods (for infrastructure layer demonstration) ===

    /**
     * Build dynamic SQL query using rawsql-ts SqlParamInjector (demo utility)
     * 
     * @param criteria Domain search criteria
     * @returns Object containing the formatted SQL and parameters
     */
    public buildSearchQuery(criteria: TodoSearchCriteria): QueryBuildResult {
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
        const { formattedSql, params } = formatter.format(injectedQuery);

        return {
            formattedSql,
            params: params as unknown[]
        };
    }

    /**
     * Test database connection (demo utility)
     */
    async testConnection(): Promise<boolean> {
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
     * Close database connection pool (demo utility)
     */
    async close(): Promise<void> {
        await this.pool.end();
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
