import { SqlParamInjector, SqlFormatter, SelectQueryParser, PostgresJsonQueryBuilder, QueryBuilder, SimpleSelectQuery } from '../../../..'; // Import from parent rawsql-ts
import { TodoSearchCriteria, Todo, TodoDetail, TodoStatus, TodoPriority } from '../domain/domain';
import { getTableColumns, DATABASE_CONFIG } from './database-config';
import { createJsonMapping } from './schema-migrated';
import { ITodoRepository, QueryBuildResult } from './infrastructure-interface';
import { Pool, PoolClient } from 'pg';

/**
 * RawSQL-based Todo repository implementation using rawsql-ts
 * Demonstrates PostgresJsonQueryBuilder and SqlParamInjector integration
 */
export class RawSQLTodoRepository implements ITodoRepository {
    private pool: Pool;
    private enableDebugLogging: boolean = false;
    // Shared instances to avoid repeated instantiation
    private readonly sqlParamInjector: SqlParamInjector;
    private readonly sqlFormatter: SqlFormatter;
    private readonly postgresJsonQueryBuilder: PostgresJsonQueryBuilder;

    constructor(enableDebugLogging: boolean = false) {
        this.pool = new Pool(DATABASE_CONFIG);
        this.enableDebugLogging = enableDebugLogging;

        // Initialize shared instances once
        this.sqlParamInjector = new SqlParamInjector(getTableColumns);
        this.sqlFormatter = new SqlFormatter({ preset: 'postgres' });
        this.postgresJsonQueryBuilder = new PostgresJsonQueryBuilder();
    }

    /**
     * Toggle debug logging on/off
     */
    public setDebugLogging(enabled: boolean): void {
        this.enableDebugLogging = enabled;
    }

    /**
     * Unified debug logging method
     */    private debugLog(message: string, data?: any): void {
        if (this.enableDebugLogging) {
            console.log(message);
            if (data !== undefined) console.log(data);
        }
    }

    /**
     * Convert domain criteria to SQL search state (DTO pattern)
     * Maps domain-specific fields to database operators and constraints
     */
    public convertToSearchState(criteria: TodoSearchCriteria): Record<string, any> {
        return {
            // Partial text matching: title -> LIKE '%value%'
            title: criteria.title ? { like: `%${criteria.title}%` } : undefined,

            // Direct field mapping
            status: criteria.status || undefined,
            priority: criteria.priority || undefined,

            // Date range mapping: domain dates -> created_at with operators
            created_at: (criteria.fromDate || criteria.toDate) ? {
                ...(criteria.fromDate && { '>=': criteria.fromDate.toISOString() }),
                ...(criteria.toDate && { '<=': criteria.toDate.toISOString() })
            } : undefined
        };
    }

    // === Core Repository Methods ===

    /**
     * Find todos matching search criteria
     */
    async findByCriteria(criteria: TodoSearchCriteria): Promise<Todo[]> {
        const query = this.buildSearchQuery(criteria);
        this.debugLog('🔍 Executing findByCriteria', query);

        try {
            const result = await this.pool.query(query.formattedSql, query.params as any[]);
            this.debugLog(`✅ Found ${result.rows.length} todos`);
            return result.rows.map(row => this.mapRowToTodo(row));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugLog('❌ findByCriteria error:', error); throw new Error(`Failed to find todos: ${errorMessage}`);
        }
    }

    /**
     * Count todos matching search criteria
     */
    async countByCriteria(criteria: TodoSearchCriteria): Promise<number> {
        const countSql = `SELECT COUNT(*) as total FROM todo`;
        const searchState = this.convertToSearchState(criteria);

        // Use shared instances
        const injectedQuery = this.sqlParamInjector.inject(countSql, searchState);
        const { formattedSql, params } = this.sqlFormatter.format(injectedQuery);

        this.debugLog('🔢 Count query:', { sql: formattedSql, params }); const result = await this.pool.query(formattedSql, params as any[]);
        const count = parseInt(result.rows[0].total); this.debugLog(`📊 Total count: ${count}`);
        return count;
    }

    /**
     * Find todo by ID with related data using PostgresJsonQueryBuilder
     * Demonstrates SqlParamInjector + PostgresJsonQueryBuilder integration
     */
    async findById(id: string): Promise<TodoDetail | null> {
        try {
            // Base query with JOINs - SqlParamInjector will add WHERE clause
            const baseSql = `
                SELECT 
                    t.todo_id, t.title, t.description, t.status, t.priority,
                    t.created_at as todo_created_at, t.updated_at as todo_updated_at,
                    c.category_id, c.name as category_name, c.description as category_description,
                    c.color as category_color, c.created_at as category_created_at,
                    com.todo_comment_id, com.todo_id as comment_todo_id,
                    com.content as comment_content, com.author_name as comment_author_name,
                    com.created_at as comment_created_at
                FROM todo t                LEFT JOIN category c ON t.category_id = c.category_id
                LEFT JOIN todo_comment com ON t.todo_id = com.todo_id
                ORDER BY com.created_at ASC
            `;

            // Generate WHERE clause with SqlParamInjector
            const searchState = { todo_id: parseInt(id) };
            const injectedQuery = this.sqlParamInjector.inject(baseSql, searchState) as SimpleSelectQuery;

            // Build JSON query structure using unified schema
            const jsonMapping = createJsonMapping('todo');
            const jsonQuery = this.postgresJsonQueryBuilder.buildJson(injectedQuery, jsonMapping);

            // Format and execute
            const { formattedSql, params } = this.sqlFormatter.format(jsonQuery);

            this.debugLog('🎯 Enhanced findById Query');
            this.debugLog('SQL:', formattedSql);
            this.debugLog('Params:', params);

            const result = await this.pool.query(formattedSql, params as any[]);

            if (result.rows.length === 0) {
                return null;
            }

            const todoJson = result.rows[0].todo;
            return todoJson ? (todoJson as TodoDetail) : null;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugLog('❌ findById error:', error); throw new Error(`Failed to find todo by ID: ${errorMessage}`);
        }
    }

    // === Demo Utility Methods ===

    /**
     * Build search query using SqlParamInjector (demo utility)
     */
    public buildSearchQuery(criteria: TodoSearchCriteria): QueryBuildResult {
        const baseSql = `
            SELECT todo_id, title, description, status, priority, category_id, created_at, updated_at
            FROM todo
            ORDER BY 
                CASE priority 
                    WHEN 'high' THEN 1 
                    WHEN 'medium' THEN 2 
                    WHEN 'low' THEN 3 
                END,                created_at DESC
        `;

        const searchState = this.convertToSearchState(criteria);
        this.debugLog('🔄 Search state conversion:', searchState);

        // Use shared instances
        const injectedQuery = this.sqlParamInjector.inject(baseSql, searchState);
        const { formattedSql, params } = this.sqlFormatter.format(injectedQuery);

        this.debugLog('🛠️ Generated query:', { sql: formattedSql, params });

        return { formattedSql, params: params as unknown[] };
    }

    /**
     * Test database connection
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
     * Close connection pool
     */    async close(): Promise<void> {
        await this.pool.end();
    }

    // === Private Helper Methods ===

    /**
     * Map database row to domain Todo entity
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
