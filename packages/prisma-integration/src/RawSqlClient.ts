import { PrismaClientType, RawSqlClientOptions, PrismaSchemaInfo } from './types';
import { PrismaSchemaResolver } from './PrismaSchemaResolver';
import { UnifiedJsonMapping, convertUnifiedMapping } from './UnifiedJsonMapping';
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
    TypeTransformationConfig
} from 'rawsql-ts';
import { QueryBuildOptions } from 'rawsql-ts';
import * as fs from 'fs';
import * as path from 'path';

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

    constructor(prisma: PrismaClientType, options: RawSqlClientOptions = {}) {
        this.prisma = prisma;
        this.options = {
            debug: false,
            defaultSchema: 'public', sqlFilesPath: './sql',
            ...options
        };
        this.schemaResolver = new PrismaSchemaResolver(this.options);
    }

    /**
     * Initialize the Prisma schema information and resolvers
     * This is called automatically when needed (lazy initialization)
     */
    private async initialize(): Promise<void> {
        if (this.isInitialized) {
            return; // Already initialized
        } if (this.options.debug) {
            console.log('Initializing RawSqlClient schema information...');
        }

        this.schemaInfo = await this.schemaResolver.resolveSchema(this.prisma);

        if (this.schemaInfo) {
            this.tableColumnResolver = this.schemaResolver.createTableColumnResolver();
        }

        if (this.options.debug && this.schemaInfo) {
            console.log(`Loaded schema with ${Object.keys(this.schemaInfo.models).length} models`);
        }

        this.isInitialized = true;
    }

    /**
     * Ensure the RawSqlClient is initialized before use
     * Automatically calls initialize() if not already done
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    /**
     * Execute SQL from file with dynamic conditions
     * 
     * @param sqlFilePath - Path to SQL file (relative to sqlFilesPath or absolute)
     * @param options - Query execution options (filter, sort, paging, serialize)
     * @returns Query result
     */
    // Main overloads for different return types based on serialization
    async query<T = any>(sqlFilePath: string, options: QueryBuildOptions & { serialize: JsonMapping | true }): Promise<T | null>;
    async query<T = any>(sqlFilePath: string, options: QueryBuildOptions & { serialize: false }): Promise<T[]>;
    async query<T = any>(sqlFilePath: string, options?: QueryBuildOptions): Promise<T[] | T | null>;
    async query<T = any>(query: SelectQuery): Promise<T[]>; async query<T = any>(sqlFilePathOrQuery: string | SelectQuery, options: QueryBuildOptions = {}): Promise<T[] | T | null> {
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

        // Apply dynamic modifications       
        // Apply filtering        // Apply filters
        if (options.filter) {
            if (!this.tableColumnResolver) {
                throw new Error('TableColumnResolver not available. Initialization may have failed.');
            }

            const extendedOptions = options as any;
            const allowAllUndefined = extendedOptions.allowAllUndefined ?? false;

            if (this.options.debug) {
                console.log('Applying filters:', options.filter, 'allowAllUndefined:', allowAllUndefined);
            }

            const paramInjector = new SqlParamInjector(this.tableColumnResolver, { allowAllUndefined });
            modifiedQuery = paramInjector.inject(modifiedQuery, options.filter) as SimpleSelectQuery;
        }

        // Apply sorting
        if (options.sort) {
            const sortInjector = new SqlSortInjector(this.tableColumnResolver);
            modifiedQuery = sortInjector.inject(modifiedQuery, options.sort);

            if (this.options.debug) {
                console.log('Applied sorting:', options.sort);
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
                            console.log(`JsonMapping file not found: ${jsonMappingPath}, skipping serialization`);
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
            if (firstRow && typeof firstRow === 'object') {
                const firstValue = Object.values(firstRow)[0];
                if (this.options.debug) {
                    console.log('ExecuteScalar: returning first column value from SQL JSON result');
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
            // Determine the actual file path
            let actualPath: string;

            if (path.isAbsolute(sqlFilePath)) {
                actualPath = sqlFilePath;
            } else {
                actualPath = path.join(this.options.sqlFilesPath || './sql', sqlFilePath);
            }

            // Check if file exists
            if (!fs.existsSync(actualPath)) {
                throw new Error(`SQL file not found: ${actualPath}`);
            }

            // Read file content
            const content = fs.readFileSync(actualPath, 'utf8');

            if (this.options.debug) {
                console.log(`Loaded SQL file: ${actualPath}`);
                console.log(`Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
            }

            return content;
        } catch (error) {
            if (error instanceof Error && error.message.includes('SQL file not found')) {
                throw error;
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
            const { jsonMapping } = convertUnifiedMapping(unifiedMapping);

            if (this.options.debug) {
                console.log(`Loaded and converted unified mapping file: ${jsonFilePath}`);
            }

            return jsonMapping;
        } catch (error) {
            if (error instanceof Error && error.message.includes('Unified mapping file not found')) {
                throw new Error(`JsonMapping file not found: ${jsonFilePath}`);
            } else {
                throw new Error(`Failed to load JsonMapping file "${jsonFilePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            if (params.length === 0) {
                // No parameters - use simple query
                return this.prisma.$queryRawUnsafe(sql) as Promise<T[]>;
            } else {
                // With parameters - use parameterized query
                return this.prisma.$queryRawUnsafe(sql, ...params) as Promise<T[]>;
            }
        } catch (error) {
            if (this.options.debug) {
                console.error('SQL execution failed:', error);
                console.error('SQL:', sql);
                console.error('Parameters:', params);
            } throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Execute SQL from file with JSON serialization, returning a single object
     * Automatically loads corresponding .json mapping file
     * 
     * @param sqlFilePath - Path to SQL file (relative to sqlFilesPath or absolute)
     * @param options - Query execution options (filter, sort, paging, allowAllUndefined)
     * @returns Single serialized object or null
     */
    async queryOne<T>(sqlFilePath: string, options: Omit<QueryBuildOptions, 'serialize'> & { allowAllUndefined?: boolean } = {}): Promise<T | null> {
        // Force serialization to true and resultFormat to 'single' for queryOne
        const queryOptions = { ...options, serialize: true as any, resultFormat: 'single' as any };
        const result = await this.query<T>(sqlFilePath, queryOptions);        // Handle different result formats
        if (result === null || result === undefined) {
            return null;
        }        // If result is already a single object (expected case), return it
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
     * 
     * @param sqlFilePath - Path to SQL file (relative to sqlFilesPath or absolute)
     * @param options - Query execution options (filter, sort, paging, allowAllUndefined)
     * @returns Array of serialized objects
     */
    async queryMany<T = any>(sqlFilePath: string, options: Omit<QueryBuildOptions, 'serialize'> & { allowAllUndefined?: boolean } = {}): Promise<T[]> {
        // Force serialization to true and resultFormat to 'array' for queryMany
        const queryOptions = { ...options, serialize: true as any, resultFormat: 'array' as any };
        const result = await this.query<T>(sqlFilePath, queryOptions);

        // Handle different result formats        // Handle different result formats
        if (result === null || result === undefined) {
            return [];
        }        // If result is already an array (expected case), return it
        if (Array.isArray(result)) {
            return result as T[];
        }        // If result is a single object, wrap it in an array
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
                const { typeProtection } = convertUnifiedMapping(unifiedMapping);
                protectedStringFields = typeProtection.protectedStringFields || [];

                if (this.options.debug) {
                    console.log('🔒 Loaded type protection config from unified mapping:', {
                        file: jsonMappingFilePath,
                        protectedFields: protectedStringFields,
                        unifiedMappingKeys: Object.keys(unifiedMapping),
                        typeProtectionKeys: Object.keys(typeProtection)
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
     * @param jsonMappingFilePath - Path to unified JSON mapping file
     * @returns Unified JSON mapping configuration
     */
    private async loadUnifiedMapping(jsonMappingFilePath: string): Promise<UnifiedJsonMapping> {
        try {
            // Determine the actual file path
            let actualPath: string;

            if (path.isAbsolute(jsonMappingFilePath)) {
                actualPath = jsonMappingFilePath;
            } else {
                actualPath = path.join(this.options.sqlFilesPath || './sql', jsonMappingFilePath);
            }

            // Check if file exists
            if (!fs.existsSync(actualPath)) {
                throw new Error(`Unified mapping file not found: ${actualPath}`);
            }

            // Read and parse JSON file
            const content = fs.readFileSync(actualPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to load unified mapping file "${jsonMappingFilePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
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
