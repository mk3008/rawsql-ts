import { SqlParamInjector, SqlFormatter, SelectQueryParser, PostgresJsonQueryBuilder, QueryBuilder, SimpleSelectQuery } from '../../..'; // Import from parent rawsql-ts
import { TodoSearchCriteria, Todo, TodoDetail, TodoStatus, TodoPriority } from './domain';
import { getTableColumns, DATABASE_CONFIG } from './database-config';
import { ITodoRepository, QueryBuildResult } from './infrastructure-interface';
import { Pool, PoolClient } from 'pg';

/**
 * RawSQL-based implementation of Todo repository using rawsql-ts
 * This demonstrates the DTO pattern with real PostgreSQL database operations
 */
export class RawSQLTodoRepository implements ITodoRepository {
    private pool: Pool;
    private enableDebugLogging: boolean = false; // Debug logging control flag

    constructor(enableDebugLogging: boolean = false) {
        // Initialize PostgreSQL connection pool
        this.pool = new Pool(DATABASE_CONFIG);
        this.enableDebugLogging = enableDebugLogging;
    }

    /**
     * Enable or disable debug logging
     * @param enabled Whether to enable debug logging
     */
    public setDebugLogging(enabled: boolean): void {
        this.enableDebugLogging = enabled;
    }

    /**
     * Private method to handle debug logging consistently
     * @param message Log message
     * @param data Optional data to log
     */
    private debugLog(message: string, data?: any): void {
        if (this.enableDebugLogging) {
            console.log(message);
            if (data !== undefined) {
                console.log(data);
            }
        }
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
        this.debugLog('Executing findByCriteria with query:', query);

        try {
            const result = await this.pool.query(query.formattedSql, query.params as any[]);
            this.debugLog(`Found ${result.rows.length} todos`);
            return result.rows.map(this.mapRowToTodo);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugLog('findByCriteria error:', error);
            throw new Error(`Failed to find todos: ${errorMessage}`);
        }
    }

    /**
     * Count todos matching search criteria
     */
    async countByCriteria(criteria: TodoSearchCriteria): Promise<number> {
        const countSql = `SELECT COUNT(*) as total FROM todo`;
        const searchState = this.convertToSearchState(criteria);
        this.debugLog('Count criteria search state:', searchState);

        const injector = new SqlParamInjector(getTableColumns);
        const injectedQuery = injector.inject(countSql, searchState);

        const formatter = new SqlFormatter({ preset: 'postgres' });
        const { formattedSql, params } = formatter.format(injectedQuery);

        this.debugLog('Count query:', { sql: formattedSql, params });

        const result = await this.pool.query(formattedSql, params as any[]);
        const count = parseInt(result.rows[0].total);
        this.debugLog(`Total count: ${count}`);
        return count;
    }

    /**
     * Find a single todo by ID with full details using PostgresJsonQueryBuilder
     * This demonstrates rawsql-ts's ability to create complex JSON objects with joins
     */
    async findById(id: string): Promise<TodoDetail | null> {
        try {
            // Base SQL query with JOINs to get todo, category, and comments
            // Note: No WHERE clause - SqlParamInjector will add it automatically
            const baseSql = `
                SELECT 
                    t.todo_id,
                    t.title,
                    t.description,
                    t.status,
                    t.priority,
                    t.created_at as todo_created_at,
                    t.updated_at as todo_updated_at,
                    -- Category fields
                    c.category_id,
                    c.name as category_name,
                    c.description as category_description,
                    c.color as category_color,
                    c.created_at as category_created_at,
                    -- Comment fields
                    com.todo_comment_id,
                    com.todo_id as comment_todo_id,
                    com.content as comment_content,
                    com.author_name as comment_author_name,
                    com.created_at as comment_created_at
                FROM todo t
                LEFT JOIN category c ON t.category_id = c.category_id
                LEFT JOIN todo_comment com ON t.todo_id = com.todo_id
                ORDER BY com.created_at ASC
            `;

            const categoryEntity = {
                id: "category",
                name: "Category",
                parentId: "todo",
                propertyName: "category",
                relationshipType: "object" as "object",
                columns: {
                    "category_id": "category_id",
                    "name": "category_name",
                    "description": "category_description",
                    "color": "category_color",
                    "created_at": "category_created_at"
                }
            };

            const commentsEntity = {
                id: "comments",
                name: "Comment",
                parentId: "todo",
                propertyName: "comments",
                relationshipType: "array" as "array",
                columns: {
                    "todo_comment_id": "todo_comment_id",
                    "todo_id": "comment_todo_id",
                    "content": "comment_content",
                    "author_name": "comment_author_name",
                    "created_at": "comment_created_at"
                }
            };

            // Define JSON mapping for hierarchical structure
            const jsonMapping = {
                rootName: "todo",
                rootEntity: {
                    id: "todo",
                    name: "Todo",
                    columns: {
                        "todo_id": "todo_id",
                        "title": "title",
                        "description": "description",
                        "status": "status",
                        "priority": "priority",
                        "category_id": "category_id",
                        "created_at": "todo_created_at",
                        "updated_at": "todo_updated_at"
                    }
                }, nestedEntities: [categoryEntity, commentsEntity],
                useJsonb: true,
                resultFormat: "single" as const  // Single object, not array
            };

            // Use SqlParamInjector to automatically generate WHERE clause
            const searchState = { todo_id: parseInt(id) };
            const injector = new SqlParamInjector(getTableColumns);
            const injectedQuery = injector.inject(baseSql, searchState) as SimpleSelectQuery;

            // Transform to JSON query using PostgresJsonQueryBuilder
            const jsonBuilder = new PostgresJsonQueryBuilder();
            const jsonQuery = jsonBuilder.buildJson(injectedQuery, jsonMapping);            // Format the final query
            const formatter = new SqlFormatter({ preset: 'postgres' });
            const { formattedSql, params } = formatter.format(jsonQuery);

            this.debugLog('\n=== Enhanced findById Query with PostgresJsonQueryBuilder ===');
            this.debugLog('Generated SQL:', formattedSql);
            this.debugLog('Parameters:', params);
            this.debugLog('===========================================================\n');

            // Execute the query with parameters from PostgresJsonQueryBuilder
            // SqlParamInjector already processed the WHERE clause parameters
            const result = await this.pool.query(formattedSql, params as any[]);

            if (result.rows.length === 0) {
                return null;
            }            // Parse the JSON result
            const todoJson = result.rows[0].todo;
            if (!todoJson) {
                return null;
            }

            // Return the parsed JSON directly as TodoDetail
            // The PostgresJsonQueryBuilder automatically creates the hierarchical structure
            return todoJson as TodoDetail;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugLog('Enhanced findById error:', error);
            throw new Error(`Failed to find todo by ID with details: ${errorMessage}`);
        }
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
                todo_id,
                title,
                description,
                status,
                priority,
                category_id,
                created_at,
                updated_at
            FROM
                todo
            ORDER BY
                CASE priority 
                    WHEN 'high' THEN 1 
                    WHEN 'medium' THEN 2 
                    WHEN 'low' THEN 3 
                END,
                created_at DESC
        `;        // Convert domain criteria to infrastructure state (DTO transformation)
        const searchState = this.convertToSearchState(criteria);
        this.debugLog('Search state (DTO transformation):', searchState);

        // SqlParamInjector automatically adds WHERE clause based on state
        const injector = new SqlParamInjector(getTableColumns);
        const injectedQuery = injector.inject(baseSql, searchState);

        // Format for different database dialects
        const formatter = new SqlFormatter({ preset: 'postgres' });
        const { formattedSql, params } = formatter.format(injectedQuery);

        this.debugLog('Generated search query:', { sql: formattedSql, params });

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
            todo_id: row.todo_id,
            title: row.title,
            description: row.description,
            status: row.status,
            priority: row.priority,
            categoryId: row.category_id,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
