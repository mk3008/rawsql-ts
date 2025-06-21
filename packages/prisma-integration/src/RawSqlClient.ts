import { PrismaClientType, RawSqlClientOptions, PrismaSchemaInfo } from './types';
import { PrismaSchemaResolver } from './PrismaSchemaResolver';
import { UnifiedJsonMapping } from 'rawsql-ts';
import {
    SqlFormatter,
    SelectQueryParser,
    SqlParamInjector,
    SqlSortInjector,
    SqlPaginationInjector,
    TableColumnResolver, SimpleSelectQuery,
    SelectQuery,
    QueryBuilder,
    PostgresJsonQueryBuilder,
    JsonMapping,
    TypeTransformationPostProcessor,
    TypeTransformationConfig,
    unifyJsonMapping,
    processJsonMapping
} from 'rawsql-ts';
import { QueryBuildOptions } from 'rawsql-ts';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Custom error classes for rawsql-ts operations
 * 
 * These error classes provide detailed context and helpful suggestions
 * for common issues like missing files, invalid JSON, and SQL execution failures.
 * Each error includes structured information for programmatic handling.
 */

/**
 * Error thrown when SQL file is not found or cannot be read
 */
export class SqlFileNotFoundError extends Error {
    public readonly filename: string;
    public readonly searchedPath: string;
    public readonly suggestedPath?: string;

    constructor(filename: string, searchedPath: string, suggestedPath?: string) {
        const message = [
            `SQL file not found: '${filename}'`,
            `Searched in: ${searchedPath}`,
            suggestedPath ? `Expected at: ${suggestedPath}` : '',
            '',
            'Suggestions:',
            '- Check if the file exists at the specified path',
            `- Verify the sqlFilesPath configuration${suggestedPath ? ` (currently: '${path.dirname(suggestedPath)}')` : ''}`,
            '- Ensure the file has the correct extension (.sql)',
            filename.includes('/') ? '- Check if parent directories exist' : ''
        ].filter(line => line !== '').join('\n');

        super(message);
        this.name = 'SqlFileNotFoundError';
        this.filename = filename;
        this.searchedPath = searchedPath;
        this.suggestedPath = suggestedPath;
    }
}

/**
 * Error thrown when JSON mapping file has issues
 */
export class JsonMappingError extends Error {
    public readonly filename: string;
    public readonly filePath: string;
    public readonly issue: string;

    constructor(filename: string, filePath: string, issue: string, originalError?: Error) {
        const message = [
            `Invalid JSON mapping file: '${filename}'`,
            `Location: ${filePath}`,
            `Issue: ${issue}`,
            '',
            'Expected format:',
            '{',
            '  "resultFormat": "object" | "array",',
            '  "rootAlias": "string",',
            '  "columns": { "field": "column_alias" },',
            '  "relationships": { ... }',
            '}',
            originalError ? `\nOriginal error: ${originalError.message}` : ''
        ].filter(line => line !== '').join('\n');

        super(message);
        this.name = 'JsonMappingError';
        this.filename = filename;
        this.filePath = filePath;
        this.issue = issue;
    }
}

/**
 * Error thrown when JSON mapping is required but not found
 */
export class JsonMappingRequiredError extends Error {
    public readonly sqlFilePath: string;
    public readonly expectedMappingPath: string;
    public readonly methodName: string;

    constructor(sqlFilePath: string, expectedMappingPath: string, methodName: string) {
        const message = [
            `JSON mapping file is required but not found for ${methodName}()`,
            `SQL file: ${sqlFilePath}`,
            `Expected mapping file: ${expectedMappingPath}`,
            '',
            'Solutions:',
            `1. Create the JSON mapping file at: ${expectedMappingPath}`,
            `2. Use the raw query() method instead of ${methodName}() if you want unstructured results`,
            '',
            'Example JSON mapping structure:',
            '{',
            '  "resultFormat": "object",',
            '  "rootAlias": "item",',
            '  "columns": {',
            '    "id": "id",',
            '    "name": "name",',
            '    "email": "email"',
            '  }',
            '}'
        ].join('\n');

        super(message);
        this.name = 'JsonMappingRequiredError';
        this.sqlFilePath = sqlFilePath;
        this.expectedMappingPath = expectedMappingPath;
        this.methodName = methodName;
    }
}

/**
 * Error thrown when SQL query execution fails
 */
export class SqlExecutionError extends Error {
    public readonly sql: string;
    public readonly parameters: any[];
    public readonly databaseError: string;

    constructor(sql: string, parameters: any[], databaseError: string, originalError?: Error) {
        const cleanSql = sql.replace(/\s+/g, ' ').trim();
        const paramStr = parameters.length > 0 ? JSON.stringify(parameters) : '[]';

        const message = [
            'SQL query execution failed',
            '',
            `SQL: ${cleanSql.length > 200 ? cleanSql.substring(0, 200) + '...' : cleanSql}`,
            `Parameters: ${paramStr}`,
            `Database Error: ${databaseError}`,
            '',
            'Suggestions:',
            '- Check if all referenced tables and columns exist',
            '- Verify parameter types match expected database types',
            '- Check SQL syntax for any typos or missing clauses',
            parameters.length > 0 ? '- Ensure parameter count matches placeholders in SQL' : ''
        ].filter(line => line !== '').join('\n');

        super(message);
        this.name = 'SqlExecutionError';
        this.sql = sql;
        this.parameters = parameters;
        this.databaseError = databaseError;
    }
}

/**
 * Main class for Prisma integration with rawsql-ts
 * 
 * Extends Prisma with advanced SQL capabilities including:
 * - SQL file-based query execution
 * - Dynamic filtering, sorting, and pagination
 * - Schema-aware JSON serialization
 * - Type-safe parameter injection
 */
export class RawSqlClient {
    private readonly prisma: PrismaClientType; private readonly options: RawSqlClientOptions;
    private readonly schemaResolver: PrismaSchemaResolver;
    private schemaInfo?: PrismaSchemaInfo;
    private tableColumnResolver?: TableColumnResolver;
    private isInitialized = false;
    private schemaPreloaded = false;    // JSON mapping file cache to avoid reading the same file multiple times
    private readonly jsonMappingCache: Map<string, { content: UnifiedJsonMapping; timestamp: number }> = new Map();

    // SQL file cache to avoid reading the same file multiple times
    private readonly sqlFileCache: Map<string, { content: string; timestamp: number }> = new Map(); constructor(prisma: PrismaClientType, options: RawSqlClientOptions = {}) {
        this.prisma = prisma;
        this.options = {
            debug: false,
            defaultSchema: 'public',
            sqlFilesPath: './sql',
            enableFileCache: true,  // Enable caching by default for performance
            cacheMaxSize: 1000,     // Default cache limit
            ...options
        };
        this.schemaResolver = new PrismaSchemaResolver(this.options);
    }

    /**
     * Initialize the Prisma schema information and resolvers
     * This is called automatically when needed (lazy initialization)
     * Uses function-based lazy evaluation for optimal performance
     */
    private async initialize(): Promise<void> {
        if (this.isInitialized) {
            return; // Already initialized
        } if (this.options.debug) {
            const resolverMode = this.options.disableResolver ? 'SQL-only mode (no resolver)' : 'lazy function resolvers';
            console.log(`Initializing RawSqlClient with ${resolverMode}...`);
        }        // Create lazy function-based resolver or undefined if disabled
        if (this.options.disableResolver) {
            this.tableColumnResolver = undefined;
            if (this.options.debug) {
                console.log('Table column resolver disabled - using SQL-only mode');
            }
        } else {
            this.tableColumnResolver = this.createLazyTableColumnResolver();
            if (this.options.debug) {
                console.log('Lazy resolvers initialized - schema will be loaded on-demand');
            }
        }

        this.isInitialized = true;
    }

    /**
     * Create a lazy table column resolver that loads schema information only when needed
     * This avoids the expensive upfront schema resolution cost
     */
    private createLazyTableColumnResolver(): TableColumnResolver {
        return (tableName: string): string[] => {
            // Auto-initialize schema when first accessed
            if (!this.schemaInfo) {
                if (this.options.debug) {
                    console.log(`[LazyResolver] Auto-loading schema for table: ${tableName}`);
                }

                // Synchronous schema resolution (should be already cached after first init)
                // In production, schema should be pre-loaded via initializeSchema()
                try {
                    // This is a sync call to the already resolved schema
                    return this.schemaResolver.getColumnNames(tableName) || [];
                } catch (error) {
                    if (this.options.debug) {
                        console.warn(`[LazyResolver] Failed to resolve columns for table ${tableName}:`, error);
                    }
                    return [];
                }
            }

            return this.schemaResolver.getColumnNames(tableName) || [];
        };
    }

    /**
     * Ensure the RawSqlClient is initialized before use
     * Automatically calls initialize() if not already done
     * Auto-loads schema on first query if not preloaded
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Auto-load schema on first query if not already loaded
        if (!this.schemaInfo && !this.schemaPreloaded) {
            if (this.options.debug) {
                console.log('Auto-loading schema on first query...');
            }

            try {
                this.schemaInfo = await this.schemaResolver.resolveSchema(this.prisma);

                if (this.options.debug && this.schemaInfo) {
                    console.log(`Auto-loaded schema with ${Object.keys(this.schemaInfo.models).length} models`);
                }
            } catch (error) {
                if (this.options.debug) {
                    console.warn('Auto-initialization failed:', error);
                }
                throw error;
            }
        }
    }

    /**
     * Explicitly initialize schema information for production use
     * Call this method during application startup to avoid lazy loading delays
     */
    async initializeSchema(): Promise<void> {
        // Skip schema initialization if resolver is disabled
        if (this.options.disableResolver) {
            if (this.options.debug) {
                console.log('Skipping schema initialization - resolver disabled');
            }
            return;
        }

        if (this.schemaInfo) {
            return; // Already loaded
        }

        if (this.options.debug) {
            console.log('Pre-loading schema information for production...');
        }

        this.schemaInfo = await this.schemaResolver.resolveSchema(this.prisma);
        this.schemaPreloaded = true;

        if (this.options.debug && this.schemaInfo) {
            console.log(`Pre-loaded schema with ${Object.keys(this.schemaInfo.models).length} models`);
        }
    }

    /**
     * Execute SQL from file with dynamic conditions - INTERNAL USE ONLY
     * 
     * This method was made private to simplify the API and reduce confusion.
     * Use queryOne() or queryMany() instead for clearer intent and better type safety.
     * 
     * Reasons for making this private:
     * 1. Too many options led to confusing behavior (serialize: true/false/undefined)
     * 2. Return type was unpredictable (T[] | T | null depending on options)
     * 3. JSON mapping behavior was inconsistent (auto-detect vs explicit)
     * 4. queryOne/queryMany provide clearer intent and safer defaults
     * 
     * @param sqlFilePathOrQuery - Path to SQL file or pre-built SelectQuery
     * @param options - Query execution options (filter, sort, paging, serialize)
     * @returns Query result
     * @internal
     */
    // Main overloads for different return types based on serialization    private async query<T = any>(sqlFilePath: string, options: QueryBuildOptions & { serialize: JsonMapping | true }): Promise<T | null>;
    private async query<T = any>(sqlFilePath: string, options: QueryBuildOptions & { serialize: false }): Promise<T[]>;
    private async query<T = any>(sqlFilePath: string, options?: QueryBuildOptions): Promise<T[] | T | null>;
    private async query<T = any>(query: SelectQuery): Promise<T[]>;
    private async query<T = any>(sqlFilePathOrQuery: string | SelectQuery, options: QueryBuildOptions = {}): Promise<T[] | T | null> {
        await this.ensureInitialized();

        let modifiedQuery: SimpleSelectQuery;
        let shouldAutoSerialize = false;

        // Auto-detect serialization need based on usage pattern
        // If no serialize option is explicitly provided and this is a string path (not SelectQuery),
        // we'll attempt auto-serialization by trying to load a corresponding .json file
        if (typeof sqlFilePathOrQuery === 'string' && options.serialize === undefined) {
            const jsonMappingPath = sqlFilePathOrQuery.replace('.sql', '.json');
            try {
                // Check if a corresponding .json mapping file exists
                await this.loadJsonMapping(jsonMappingPath);
                shouldAutoSerialize = true;
                if (this.options.debug) {
                    console.log(`Auto-detected serialization potential for: ${jsonMappingPath}`);
                }
            } catch (error) {
                // No .json file found, proceed without auto-serialization
                shouldAutoSerialize = false;
                if (this.options.debug) {
                    console.log(`Auto-serialization disabled - JSON mapping not found: ${jsonMappingPath}`);
                    if (error instanceof Error && error.message.includes('resolved to:')) {
                        console.log(`Path resolution details: ${error.message}`);
                    }
                }
            }
        }

        if (typeof sqlFilePathOrQuery === 'string') {
            // Handle SQL file path
            const sqlFilePath = sqlFilePathOrQuery;

            // Load SQL from file
            const sqlContent = this.loadSqlFile(sqlFilePath);

            // Parse the base SQL
            let parsedQuery: SelectQuery;
            try {
                parsedQuery = SelectQueryParser.parse(sqlContent);
            } catch (error) {
                throw new Error(`Failed to parse SQL file "${sqlFilePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            // Start with parsed query
            modifiedQuery = QueryBuilder.buildSimpleQuery(parsedQuery);

            if (this.options.debug) {
                console.log(`Loaded SQL file: ${sqlFilePath}`);
                console.log('Parsed query:', modifiedQuery);
            }
        } else {
            // Handle pre-built SelectQuery
            modifiedQuery = QueryBuilder.buildSimpleQuery(sqlFilePathOrQuery);
        }

        // Apply dynamic modifications         // Apply filtering        // Apply filters
        if (options.filter) {
            if (!this.tableColumnResolver) {
                if (this.options.disableResolver) {
                    // When resolver is disabled, skip column validation and allow basic filtering
                    if (this.options.debug) {
                        console.log('Resolver disabled - applying filters without column validation');
                    }
                    const paramInjector = new SqlParamInjector(undefined, { allowAllUndefined: true });
                    modifiedQuery = paramInjector.inject(modifiedQuery, options.filter) as SimpleSelectQuery;
                } else {
                    throw new Error('TableColumnResolver not available. Initialization may have failed.');
                }
            } else {
                const extendedOptions = options as any;
                const allowAllUndefined = extendedOptions.allowAllUndefined ?? false;

                if (this.options.debug) {
                    console.log('Applying filters:', options.filter, 'allowAllUndefined:', allowAllUndefined);
                }

                const paramInjector = new SqlParamInjector(this.tableColumnResolver, { allowAllUndefined });
                modifiedQuery = paramInjector.inject(modifiedQuery, options.filter) as SimpleSelectQuery;
            }
        }

        // Apply sorting
        if (options.sort) {
            if (!this.tableColumnResolver) {
                if (this.options.disableResolver) {
                    // When resolver is disabled, skip column validation for sorting
                    if (this.options.debug) {
                        console.log('Resolver disabled - applying sorting without column validation');
                    }
                    const sortInjector = new SqlSortInjector(undefined);
                    modifiedQuery = sortInjector.inject(modifiedQuery, options.sort);
                } else {
                    throw new Error('TableColumnResolver not available for sorting. Initialization may have failed.');
                }
            } else {
                const sortInjector = new SqlSortInjector(this.tableColumnResolver);
                modifiedQuery = sortInjector.inject(modifiedQuery, options.sort);

                if (this.options.debug) {
                    console.log('Applied sorting:', options.sort);
                }
            }
        }

        // Apply pagination
        if (options.paging) {
            const paginationInjector = new SqlPaginationInjector();
            // Use the paging options directly since they already match PaginationOptions format
            modifiedQuery = paginationInjector.inject(modifiedQuery, options.paging) as SimpleSelectQuery;

            if (this.options.debug) {
                console.log('Applied pagination:', options.paging);
            }
        }

        // Apply JSON serialization if requested or auto-detected (before formatting)
        let serializationApplied = false;
        let actualSerialize: JsonMapping | null = null;

        // Determine if we should serialize
        const shouldSerialize = options.serialize !== undefined ? options.serialize : shouldAutoSerialize;

        if (shouldSerialize) {
            // Handle boolean case - auto-load JsonMapping from .json file
            if (typeof shouldSerialize === 'boolean' && shouldSerialize === true) {
                if (typeof sqlFilePathOrQuery === 'string') {
                    const jsonMappingPath = sqlFilePathOrQuery.replace('.sql', '.json');
                    try {
                        actualSerialize = await this.loadJsonMapping(jsonMappingPath);
                        if (this.options.debug) {
                            console.log(`${shouldAutoSerialize ? 'Auto-' : ''}loaded JsonMapping from: ${jsonMappingPath}`);
                        }
                    } catch (error) {
                        if (this.options.debug) {
                            console.log(`JsonMapping file not found for auto-serialization: ${jsonMappingPath}, skipping serialization`);
                            if (error instanceof Error && error.message.includes('resolved to:')) {
                                console.log(`Path resolution details: ${error.message}`);
                            }
                        }
                        actualSerialize = null;
                    }
                } else {
                    throw new Error('Auto-loading JsonMapping is only supported for SQL file paths, not pre-built queries');
                }
            } else if (typeof shouldSerialize === 'object') {
                // Explicit JsonMapping provided
                actualSerialize = shouldSerialize;
            }

            // Apply serialization if we have a valid JsonMapping
            if (actualSerialize) {
                // Override resultFormat if explicitly provided in options (cast to any for resultFormat access)
                const extendedOptions = options as any;
                if (extendedOptions.resultFormat) {
                    actualSerialize = { ...actualSerialize, resultFormat: extendedOptions.resultFormat };
                }

                // Create PostgresJsonQueryBuilder instance
                const jsonBuilder = new PostgresJsonQueryBuilder();

                // Convert SelectQuery to SimpleSelectQuery
                const simpleQuery = QueryBuilder.buildSimpleQuery(modifiedQuery);

                // Transform to JSON query and convert back to SelectQuery
                modifiedQuery = jsonBuilder.buildJsonQuery(simpleQuery, actualSerialize);
                serializationApplied = true;
            }
        }

        // Generate final SQL
        const formatter = new SqlFormatter({
            preset: this.getPresetFromProvider(this.schemaInfo?.databaseProvider)
        });
        const formattedResult = formatter.format(modifiedQuery);
        const finalSql = formattedResult.formattedSql;
        const parameters = formattedResult.params;

        // Convert parameters to array format for Prisma execution
        let parametersArray: any[];
        if (Array.isArray(parameters)) {
            // Already an array (Indexed or Anonymous style)
            parametersArray = parameters;
        } else if (parameters && typeof parameters === 'object') {
            // Object format (Named style) - convert to array
            parametersArray = Object.values(parameters);
        } else {
            // No parameters
            parametersArray = [];
        }

        if (this.options.debug) {
            console.log('Executing SQL:', finalSql);
            console.log('Parameters:', parameters);
            console.log('Parameters Array:', parametersArray);
        }        // Execute with Prisma
        const result = await this.executeSqlWithParams(finalSql, parametersArray);        // Apply type transformation if JsonMapping with type information is available
        let transformedResult = result;
        if (actualSerialize && result.length > 0) {
            // Only pass file path if sqlFilePathOrQuery is a string (file path)
            const filePath = typeof sqlFilePathOrQuery === 'string' ? sqlFilePathOrQuery : undefined;
            const transformConfig = await this.extractTypeTransformationConfig(actualSerialize, filePath);
            if (Object.keys(transformConfig.columnTransformations || {}).length > 0) {
                const processor = new TypeTransformationPostProcessor(transformConfig);
                transformedResult = processor.transformResult(result);

                if (this.options.debug) {
                    console.log('🔄 Applied type transformation to protect user input strings');
                }
            }
        }

        // Handle different return types based on serialization
        if (shouldSerialize) {
            // When serialized, return ExecuteScalar equivalent (1st row, 1st column value)
            if (transformedResult.length === 0) {
                return null as T | null;
            }

            const firstRow = transformedResult[0];
            // Get the first column value (ExecuteScalar behavior)
            // For JSON serialized results, the first column contains the complete JSON object
            if (firstRow && typeof firstRow === 'object') {
                const firstValue = Object.values(firstRow)[0];
                if (this.options.debug) {
                    console.log('ExecuteScalar: returning first column value from SQL JSON result');
                    console.log('First row:', JSON.stringify(firstRow));
                    console.log('First value:', JSON.stringify(firstValue));
                }
                return firstValue as T;
            } return firstRow as T;
        } else {
            // When not serialized, return array of rows
            return transformedResult as T[];
        }
    }

    /**
     * Load SQL content from file
     * 
     * @param sqlFilePath - Path to SQL file (relative to sqlFilesPath or absolute)
     * @returns SQL content as string
     * @throws Error if file not found or cannot be read
     */
    private loadSqlFile(sqlFilePath: string): string {
        try {
            // Determine the actual file path with proper normalization
            let actualPath: string;
            if (path.isAbsolute(sqlFilePath)) {
                actualPath = path.normalize(sqlFilePath);
            } else {
                // Use path.resolve for better cross-platform compatibility
                const basePath = path.resolve(this.options.sqlFilesPath || './sql');
                actualPath = path.resolve(basePath, sqlFilePath);
            }

            // Normalize the path to handle different separators and redundant segments
            actualPath = path.normalize(actualPath);            // Check cache first and validate file timestamp to avoid stale content
            if (this.options.enableFileCache && this.sqlFileCache.has(actualPath)) {
                // Check if file exists before checking timestamp (file might be deleted)
                if (fs.existsSync(actualPath)) {
                    const cachedEntry = this.sqlFileCache.get(actualPath)!;
                    const currentTimestamp = fs.statSync(actualPath).mtimeMs;

                    if (cachedEntry.timestamp === currentTimestamp) {
                        if (this.options.debug) {
                            console.log(`📋 Using cached SQL file: ${sqlFilePath}`);
                        }
                        return cachedEntry.content;
                    } else {
                        if (this.options.debug) {
                            console.log(`🔄 Cache invalidated for SQL file: ${sqlFilePath} (file modified)`);
                        }
                        this.sqlFileCache.delete(actualPath);
                    }
                } else {
                    // File was deleted, remove from cache
                    if (this.options.debug) {
                        console.log(`🗑️ Removing deleted file from cache: ${sqlFilePath}`);
                    }
                    this.sqlFileCache.delete(actualPath);
                }
            }

            if (this.options.debug) {
                console.log(`Attempting to load SQL file: ${sqlFilePath} -> ${actualPath}`);
            }

            // Check if file exists
            if (!fs.existsSync(actualPath)) {
                throw new SqlFileNotFoundError(
                    sqlFilePath,
                    actualPath,
                    actualPath
                );
            }

            // Read file content atomically
            let content: string;
            try {
                content = fs.readFileSync(actualPath, 'utf8');
            } catch (fsError) {
                if (fsError instanceof Error && (fsError as any).code === 'ENOENT') {
                    throw new Error(`SQL file not found: ${actualPath} (resolved from: ${sqlFilePath})`);
                }
                throw fsError;
            }

            if (this.options.debug) {
                console.log(`✅ Loaded SQL file: ${actualPath}`);
                console.log(`📝 Content preview: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
                console.log(`📊 File size: ${content.length} characters`);
            }

            // Cache the SQL content with timestamp to avoid re-reading the same file
            if (this.options.enableFileCache) {
                const fileStats = fs.statSync(actualPath);
                this.sqlFileCache.set(actualPath, {
                    content: content,
                    timestamp: fileStats.mtimeMs
                });

                if (this.options.debug) {
                    console.log(`💾 Cached SQL file: ${sqlFilePath} (timestamp: ${fileStats.mtimeMs})`);
                }
            }

            return content;
        } catch (error) {
            if (error instanceof SqlFileNotFoundError) {
                throw error;
            }
            if (error instanceof Error && error.message.includes('SQL file not found')) {
                throw error; // Re-throw file not found errors as-is
            }
            throw new Error(`Failed to load SQL file "${sqlFilePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Load JsonMapping from a .json file
     * 
     * @param jsonFilePath - Path to JSON file (relative to sqlFilesPath or absolute)
     * @returns JsonMapping object
     * @throws Error if file not found or invalid JSON
     */
    private async loadJsonMapping(jsonFilePath: string): Promise<JsonMapping> {
        try {
            // Load the unified mapping and convert to traditional JsonMapping
            const unifiedMapping = await this.loadUnifiedMapping(jsonFilePath);
            const jsonMapping = unifyJsonMapping(unifiedMapping);

            if (this.options.debug) {
                console.log(`✅ Loaded and converted unified mapping file: ${jsonFilePath}`);
                console.log(`🔄 JsonMapping keys: ${Object.keys(jsonMapping).join(', ')}`);
            }

            return jsonMapping;
        } catch (error) {
            if (error instanceof JsonMappingError) {
                throw error;
            }
            if (error instanceof Error && error.message.includes('Unified mapping file not found')) {
                // Extract the detailed path information from the unified mapping error
                const match = error.message.match(/Unified mapping file not found: (.+) \(resolved from: (.+)\)/);
                if (match) {
                    const [, actualPath, originalPath] = match;
                    throw new JsonMappingError(
                        path.basename(originalPath),
                        actualPath,
                        `File not found: ${originalPath} (resolved to: ${actualPath})`
                    );
                } else {
                    throw new JsonMappingError(
                        path.basename(jsonFilePath),
                        jsonFilePath,
                        `File not found: ${jsonFilePath}`
                    );
                }
            } else {
                // Re-throw as JsonMappingError for consistency
                throw new JsonMappingError(
                    path.basename(jsonFilePath),
                    jsonFilePath,
                    `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    error instanceof Error ? error : undefined
                );
            }
        }
    }

    /**
     * Execute SQL with parameters using Prisma
     * 
     * @param sql - The SQL query string     * @param params - Query parameters
     * @returns Query result
     */
    private async executeSqlWithParams<T = any>(sql: string, params: any[]): Promise<T[]> {
        try {
            if (this.options.debug) {
                console.log(`🔍 Executing SQL query...`);
                console.log(`📝 SQL: ${sql.length > 200 ? sql.substring(0, 200) + '...' : sql}`);
                console.log(`📋 Parameters (${params.length}): ${JSON.stringify(params)}`);
            }

            if (params.length === 0) {
                // No parameters - use simple query
                return this.prisma.$queryRawUnsafe(sql) as Promise<T[]>;
            } else {
                // With parameters - use parameterized query
                return this.prisma.$queryRawUnsafe(sql, ...params) as Promise<T[]>;
            }
        } catch (error) {
            // Extract database error message
            let databaseError = 'Unknown database error';
            if (error instanceof Error) {
                databaseError = error.message;
                // Extract specific database error details if available
                if ('code' in error && error.code) {
                    databaseError = `${error.code}: ${error.message}`;
                }
            }

            throw new SqlExecutionError(sql, params, databaseError, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Execute SQL from file with JSON serialization, returning a single object
     * Automatically loads corresponding .json mapping file
     * Throws error if JSON mapping file is not found
     * 
     * @param sqlFilePath - Path to SQL file (relative to sqlFilesPath or absolute)
     * @param options - Query execution options (filter, sort, paging, allowAllUndefined)
     * @returns Single serialized object or null
     * @throws JsonMappingRequiredError when JSON mapping file is not found
     */
    async queryOne<T>(sqlFilePath: string, options: Omit<QueryBuildOptions, 'serialize'> & { allowAllUndefined?: boolean } = {}): Promise<T | null> {
        // Check if JSON mapping file exists before proceeding
        const jsonMappingPath = sqlFilePath.replace('.sql', '.json');
        try {
            await this.loadJsonMapping(jsonMappingPath);
        } catch (error) {
            // JSON mapping is required for queryOne
            throw new JsonMappingRequiredError(sqlFilePath, jsonMappingPath, 'queryOne');
        }

        // Force serialization to true and resultFormat to 'single' for queryOne
        const queryOptions = { ...options, serialize: true as any, resultFormat: 'single' as any };
        const result = await this.query<T>(sqlFilePath, queryOptions);

        // Handle different result formats
        if (result === null || result === undefined) {
            return null;
        }

        // If result is already a single object (expected case), return it
        if (!Array.isArray(result)) {
            return result as T;
        }

        // If result is an array, return the first element or null
        if (Array.isArray(result)) {
            return result.length > 0 ? result[0] as T : null;
        }

        return result as T;
    }

    /**
     * Execute SQL from file with JSON serialization, returning an array
     * Automatically loads corresponding .json mapping file
     * Throws error if JSON mapping file is not found
     * 
     * @param sqlFilePath - Path to SQL file (relative to sqlFilesPath or absolute)
     * @param options - Query execution options (filter, sort, paging, allowAllUndefined)
     * @returns Array of serialized objects
     * @throws JsonMappingRequiredError when JSON mapping file is not found
     */
    async queryMany<T = any>(sqlFilePath: string, options: Omit<QueryBuildOptions, 'serialize'> & { allowAllUndefined?: boolean } = {}): Promise<T[]> {
        // Check if JSON mapping file exists before proceeding
        const jsonMappingPath = sqlFilePath.replace('.sql', '.json');
        try {
            await this.loadJsonMapping(jsonMappingPath);
        } catch (error) {
            // JSON mapping is required for queryMany
            throw new JsonMappingRequiredError(sqlFilePath, jsonMappingPath, 'queryMany');
        }

        // Force serialization to true and resultFormat to 'array' for queryMany
        const queryOptions = { ...options, serialize: true as any, resultFormat: 'array' as any };
        const result = await this.query<T>(sqlFilePath, queryOptions);

        // Handle different result formats
        if (result === null || result === undefined) {
            return [];
        }

        // If result is already an array (expected case), return it
        if (Array.isArray(result)) {
            return result as T[];
        }

        // If result is a single object, wrap it in an array
        return [result] as T[];
    }

    /**
     * Extract type transformation configuration from JsonMapping and type protection file
     * @param jsonMapping - The JsonMapping containing column information  
     * @param sqlFilePath - The SQL file path to find corresponding type protection file
     * @returns TypeTransformationConfig for protecting user input strings
     */
    private async extractTypeTransformationConfig(jsonMapping: JsonMapping, sqlFilePath?: string): Promise<TypeTransformationConfig> {
        const columnTransformations: { [key: string]: any } = {};

        // Try to load type protection configuration from unified JSON mapping
        let protectedStringFields: string[] = [];

        if (sqlFilePath) {
            try {
                const jsonMappingFilePath = sqlFilePath.replace('.sql', '.json');
                const unifiedMapping = await this.loadUnifiedMapping(jsonMappingFilePath);
                const result = processJsonMapping(unifiedMapping);
                protectedStringFields = result.metadata?.typeProtection?.protectedStringFields || [];

                if (this.options.debug) {
                    console.log('🔒 Loaded type protection config from unified mapping:', {
                        file: jsonMappingFilePath,
                        protectedFields: protectedStringFields,
                        unifiedMappingKeys: Object.keys(unifiedMapping),
                        format: result.format
                    });
                }
            } catch (error) {
                if (this.options.debug) {
                    console.log('💡 No unified mapping found or type protection config available, using value-based detection only', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        sqlFilePath
                    });
                }
            }
        } else {
            if (this.options.debug) {
                console.log('💡 No sqlFilePath provided, skipping type protection config loading');
            }
        }

        // Apply string protection to the specified fields
        for (const fieldName of protectedStringFields) {
            columnTransformations[fieldName] = {
                sourceType: 'custom' as const,
                targetType: 'string' as const,
                handleNull: true
            };
        }

        if (this.options.debug && Object.keys(columnTransformations).length > 0) {
            console.log('🔒 String protection applied to fields:', Object.keys(columnTransformations));
        }

        return {
            columnTransformations,
            enableValueBasedDetection: true  // Still allow auto-detection for non-protected fields
        };
    }

    /**
     * Load unified JSON mapping configuration that includes both mapping and type protection
     * Uses caching to avoid reading the same file multiple times
     * @param jsonMappingFilePath - Path to unified JSON mapping file
     * @returns Unified JSON mapping configuration
     */    private async loadUnifiedMapping(jsonMappingFilePath: string): Promise<UnifiedJsonMapping> {
        let actualPath: string = jsonMappingFilePath; // Initialize with fallback value

        try {
            // Determine the actual file path with proper normalization
            if (path.isAbsolute(jsonMappingFilePath)) {
                actualPath = path.normalize(jsonMappingFilePath);
            } else {
                // Use path.resolve for better cross-platform compatibility
                const basePath = path.resolve(this.options.sqlFilesPath || './sql');
                actualPath = path.resolve(basePath, jsonMappingFilePath);
            }

            // Normalize the path to handle different separators and redundant segments
            actualPath = path.normalize(actualPath);            // Check cache first and validate file timestamp to avoid stale content
            if (this.options.enableFileCache && this.jsonMappingCache.has(actualPath)) {
                // Check if file exists before checking timestamp (file might be deleted)
                if (fs.existsSync(actualPath)) {
                    const cachedEntry = this.jsonMappingCache.get(actualPath)!;
                    const currentTimestamp = fs.statSync(actualPath).mtimeMs;

                    if (cachedEntry.timestamp === currentTimestamp) {
                        if (this.options.debug) {
                            console.log(`📋 Using cached JSON mapping: ${jsonMappingFilePath}`);
                        }
                        return cachedEntry.content;
                    } else {
                        if (this.options.debug) {
                            console.log(`🔄 Cache invalidated for JSON mapping: ${jsonMappingFilePath} (file modified)`);
                        }
                        this.jsonMappingCache.delete(actualPath);
                    }
                } else {
                    // File was deleted, remove from cache
                    if (this.options.debug) {
                        console.log(`🗑️ Removing deleted JSON mapping from cache: ${jsonMappingFilePath}`);
                    }
                    this.jsonMappingCache.delete(actualPath);
                }
            }

            if (this.options.debug) {
                console.log(`Attempting to load unified mapping: ${jsonMappingFilePath} -> ${actualPath}`);
            }

            // Check if file exists
            if (!fs.existsSync(actualPath)) {
                throw new JsonMappingError(
                    path.basename(jsonMappingFilePath),
                    actualPath,
                    'File not found'
                );
            }

            // Read file content atomically
            let content: string;
            try {
                content = fs.readFileSync(actualPath, 'utf8');
            } catch (fsError) {
                if (fsError instanceof Error && (fsError as any).code === 'ENOENT') {
                    throw new JsonMappingError(
                        path.basename(jsonMappingFilePath),
                        actualPath,
                        `File not found: ${actualPath} (resolved from: ${jsonMappingFilePath})`
                    );
                }
                throw fsError;
            }

            if (this.options.debug) {
                console.log(`✅ Loading JSON mapping file: ${actualPath}`);
                console.log(`📝 Content preview: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
            }

            // Parse JSON content
            let parsed: UnifiedJsonMapping;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                throw new JsonMappingError(
                    path.basename(jsonMappingFilePath),
                    actualPath,
                    `Invalid JSON syntax: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
                    parseError instanceof Error ? parseError : undefined
                );
            }

            // Basic validation of the mapping structure
            if (!parsed || typeof parsed !== 'object') {
                throw new JsonMappingError(
                    path.basename(jsonMappingFilePath),
                    actualPath,
                    'Mapping file must contain a JSON object'
                );
            } if (this.options.debug) {
                console.log(`✅ Successfully parsed JSON mapping with keys: ${Object.keys(parsed).join(', ')}`);
            }

            // Cache the parsed mapping with timestamp to avoid re-reading the same file
            if (this.options.enableFileCache) {
                const fileStats = fs.statSync(actualPath);
                this.jsonMappingCache.set(actualPath, {
                    content: parsed,
                    timestamp: fileStats.mtimeMs
                });

                if (this.options.debug) {
                    console.log(`💾 Cached JSON mapping file: ${jsonMappingFilePath} (timestamp: ${fileStats.mtimeMs})`);
                }
            }

            return parsed;
        } catch (error) {
            if (error instanceof JsonMappingError) {
                throw error;
            }
            if (error instanceof Error && error.message.includes('Unified mapping file not found')) {
                throw error; // Re-throw file not found errors as-is
            }
            throw new JsonMappingError(
                path.basename(jsonMappingFilePath),
                actualPath,
                `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Get SqlFormatter preset from database provider
     * 
     * @param provider - Database provider string from Prisma
     * @returns SqlFormatter preset name
     */
    private getPresetFromProvider(provider?: string): 'postgres' | 'mysql' | 'sqlite' | 'sqlserver' | undefined {
        if (!provider) {
            return undefined;
        }

        switch (provider.toLowerCase()) {
            case 'postgresql':
            case 'postgres':
                return 'postgres';
            case 'mysql':
                return 'mysql';
            case 'sqlite':
                return 'sqlite';
            case 'sqlserver':
            case 'mssql':
                return 'sqlserver';
            default:
                if (this.options.debug) {
                    console.warn(`Unknown database provider: ${provider}, defaulting to no preset`);
                }
                return undefined;
        }
    }
}
