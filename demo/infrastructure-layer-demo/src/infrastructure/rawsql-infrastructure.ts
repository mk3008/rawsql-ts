import { SqlParamInjector, SqlFormatter, SelectQueryParser, PostgresJsonQueryBuilder, QueryBuilder, SimpleSelectQuery } from '../../../..'; // Import from parent rawsql-ts
import { TodoSearchCriteria } from '../contracts/search-criteria';
import { Todo, TodoDetail, TodoTableView, TodoStatus, TodoPriority } from '../domain/entities';
import { getTableColumns, DATABASE_CONFIG } from './database-config';
import { createJsonMapping } from './schema-definitions';
import { ITodoRepository, QueryBuildResult } from '../contracts/repository-interfaces';
import { SqlLogger } from '../contracts/sql-logger';
import { sqlLoader } from './sql-loader';
import { Pool, PoolClient } from 'pg';

/**
 * RawSQL-based Todo repository implementation using rawsql-ts
 * Demonstrates PostgresJsonQueryBuilder and SqlParamInjector integration
 */
export class RawSQLTodoRepository implements ITodoRepository {
    private pool: Pool;
    private enableDebugLogging: boolean = false;
    private sqlLogger?: SqlLogger;
    // Shared instances to avoid repeated instantiation
    private readonly sqlParamInjector: SqlParamInjector;
    private readonly sqlFormatter: SqlFormatter;
    private readonly postgresJsonQueryBuilder: PostgresJsonQueryBuilder;

    constructor(
        enableDebugLogging: boolean = false,
        sqlFormatterOptions?: any,
        sqlLogger?: SqlLogger
    ) {
        this.pool = new Pool(DATABASE_CONFIG);
        this.enableDebugLogging = enableDebugLogging;
        this.sqlLogger = sqlLogger;

        // Initialize shared instances once
        this.sqlParamInjector = new SqlParamInjector(getTableColumns);

        // Use custom SqlFormatter options for testing, default preset for production
        this.sqlFormatter = new SqlFormatter(
            sqlFormatterOptions || { preset: 'postgres' }
        );

        this.postgresJsonQueryBuilder = new PostgresJsonQueryBuilder();

        // Load all SQL queries into memory cache for optimal performance
        sqlLoader.loadAllQueries();
        this.debugLog(`🚀 SQL queries loaded: ${sqlLoader.getAvailableQueries().join(', ')}`);
    }

    /**
     * Toggle debug logging on/off
     */
    public setDebugLogging(enabled: boolean): void {
        this.enableDebugLogging = enabled;
    }

    /**
     * Unified debug logging method
     */
    private debugLog(message: string, data?: any): void {
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
     * Find todos matching search criteria - optimized for table display
     */
    async findByCriteria(criteria: TodoSearchCriteria): Promise<TodoTableView[]> {
        try {
            const query = this.buildSearchQuery(criteria);
            this.debugLog('🔍 Executing findByCriteria with SQL DTO transformation', query);

            const result = await this.executeQueryWithLogging(
                query.formattedSql,
                Object.values(query.params), // Convert Record to array
                'findByCriteria'
            );
            this.debugLog(`✅ Found ${result.rows.length} result rows with SQL DTO transformation`);            // Extract JSON array from aggregated result
            const todosJsonArray = result.rows[0]?.todo_array || [];
            this.debugLog(`📋 Extracted ${todosJsonArray.length} todos from JSON aggregation`);

            return todosJsonArray as TodoTableView[];
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugLog('❌ findByCriteria error:', error);
            throw new Error(`Failed to find todos: ${errorMessage}`);
        }
    }

    /**
     * Count todos matching search criteria
     */
    async countByCriteria(criteria: TodoSearchCriteria): Promise<number> {
        const countSql = sqlLoader.getQuery('countTodos');
        const searchState = this.convertToSearchState(criteria);

        // Use shared instances
        const injectedQuery = this.sqlParamInjector.inject(countSql, searchState);
        const { formattedSql, params } = this.sqlFormatter.format(injectedQuery);

        const result = await this.executeQueryWithLogging(
            formattedSql,
            Object.values(params), // Convert Record to array
            'countByCriteria'
        );
        const count = parseInt(result.rows[0].total);
        this.debugLog(`📊 Total count: ${count}`);
        return count;
    }

    /**
     * Find todo by ID with related data using PostgresJsonQueryBuilder
     * Demonstrates SqlParamInjector + PostgresJsonQueryBuilder integration
     */
    async findById(id: string): Promise<TodoDetail | null> {
        try {
            // step1. Load base query from SQL file
            const baseSql = sqlLoader.getQuery('findTodoWithRelations');

            // step2. Generate WHERE clause with SqlParamInjector
            const searchState = { todo_id: parseInt(id) };
            const injectedQuery = this.sqlParamInjector.inject(baseSql, searchState) as SimpleSelectQuery;

            // step3. Build JSON query structure using unified schema
            const jsonMapping = createJsonMapping('todo');
            const jsonQuery = this.postgresJsonQueryBuilder.buildJson(injectedQuery, jsonMapping);

            // step4. Format and execute
            const { formattedSql, params } = this.sqlFormatter.format(jsonQuery);

            const result = await this.executeQueryWithLogging(
                formattedSql,
                params as any[],
                'findById'
            );

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
        const baseSql = sqlLoader.getQuery('findTodos');

        const searchState = this.convertToSearchState(criteria);
        this.debugLog('🔄 Search state conversion:', searchState);

        // Generate WHERE clause with SqlParamInjector
        const injectedQuery = this.sqlParamInjector.inject(baseSql, searchState) as SimpleSelectQuery;        // Build JSON query structure using flat mapping for TodoTableView (9 columns only)
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
                    "createdAt": "todo_created_at",     // Map to camelCase as per TodoTableView
                    "updatedAt": "todo_updated_at",     // Map to camelCase as per TodoTableView
                    "category_name": "category_name",   // Flattened from category
                    "category_color": "category_color"  // Flattened from category
                }
            },
            nestedEntities: [],
            useJsonb: true,
            resultFormat: "array" as const
        };
        const jsonQuery = this.postgresJsonQueryBuilder.buildJson(injectedQuery, jsonMapping);

        // Format and execute
        const { formattedSql, params } = this.sqlFormatter.format(jsonQuery);

        this.debugLog('🛠️ Generated JSON query:', { sql: formattedSql, params });

        return { formattedSql, params: params as unknown[] };
    }

    /**
     * Test database connection
     */
    async testConnection(): Promise<boolean> {
        try {
            const client = await this.pool.connect();
            const connectionSql = sqlLoader.getQuery('connectionTest');
            await client.query(connectionSql);
            client.release();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Close connection pool
     */
    async close(): Promise<void> {
        await this.pool.end();
    }

    /**
     * Execute query with logging support
     * Captures execution time and details for reporting
     */
    private async executeQueryWithLogging(
        formattedSql: string,
        params: any[],
        queryLabel?: string
    ): Promise<any> {
        const startTime = performance.now();

        this.debugLog('🔍 Executing query', { sql: formattedSql, params });

        try {
            const result = await this.pool.query(formattedSql, params as any[]);
            const executionTime = performance.now() - startTime;

            // Log to SQL logger if available
            if (this.sqlLogger) {
                this.sqlLogger.logQuery({
                    sql: formattedSql,
                    params: [...params],
                    executionTimeMs: executionTime,
                    timestamp: new Date(),
                    queryLabel,
                    resultMeta: {
                        rowCount: result.rows?.length || 0,
                        hasResults: !!result.rows?.length
                    }
                });
            }

            this.debugLog(`✅ Query completed in ${executionTime.toFixed(2)}ms, ${result.rows?.length || 0} rows`);
            return result;

        } catch (error) {
            const executionTime = performance.now() - startTime;
            this.debugLog(`❌ Query failed after ${executionTime.toFixed(2)}ms:`, error);
            throw error;
        }
    }
}
