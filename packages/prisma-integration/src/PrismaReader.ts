import { PrismaClientType, PrismaReaderOptions, PrismaSchemaInfo } from './types';
import { PrismaSchemaResolver } from './PrismaSchemaResolver';
import {
    SqlFormatter,
    SelectQueryParser,
    SqlParamInjector,
    SqlSortInjector,
    SqlPaginationInjector,
    TableColumnResolver,
    SimpleSelectQuery,
    SelectQuery,
    QueryBuilder,
    PostgresJsonQueryBuilder,
    JsonMapping
} from 'rawsql-ts';
import { QueryBuildOptions } from '../../core/src/transformers/DynamicQueryBuilder';
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
export class PrismaReader {
    private readonly prisma: PrismaClientType; private readonly options: PrismaReaderOptions;
    private readonly schemaResolver: PrismaSchemaResolver;
    private schemaInfo?: PrismaSchemaInfo;
    private tableColumnResolver?: TableColumnResolver;
    private isInitialized = false;

    constructor(prisma: PrismaClientType, options: PrismaReaderOptions = {}) {
        this.prisma = prisma;
        this.options = {
            debug: false,
            defaultSchema: 'public',
            sqlFilesPath: './sql',
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
        }

        if (this.options.debug) {
            console.log('Initializing PrismaReader schema information...');
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
     * Ensure the PrismaReader is initialized before use
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
     */    // Overloads for different return types based on serialization
    async query<T = any>(sqlFilePath: string, options: QueryBuildOptions & { serialize: JsonMapping | true }): Promise<T | null>;
    async query<T = any>(sqlFilePath: string, options?: Omit<QueryBuildOptions, 'serialize'> | (QueryBuildOptions & { serialize?: false })): Promise<T[]>;
    async query<T = any>(query: SelectQuery): Promise<T[]>; async query<T = any>(sqlFilePathOrQuery: string | SelectQuery, options: QueryBuildOptions = {}): Promise<T[] | T | null> {
        await this.ensureInitialized();

        let modifiedQuery: SimpleSelectQuery;

        if (typeof sqlFilePathOrQuery === 'string') {
            // Handle SQL file path
            const sqlFilePath = sqlFilePathOrQuery;

            // Load SQL from file
            const sqlContent = this.loadSqlFile(sqlFilePath);

            // Parse the base SQL
            let parsedQuery: SimpleSelectQuery;
            try {
                parsedQuery = SelectQueryParser.parse(sqlContent) as SimpleSelectQuery;
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
        }        // Apply dynamic modifications
        // Apply filtering
        if (options.filter && Object.keys(options.filter).length > 0) {
            if (!this.tableColumnResolver) {
                throw new Error('TableColumnResolver not available. Initialization may have failed.');
            }
            const paramInjector = new SqlParamInjector(this.tableColumnResolver);
            modifiedQuery = paramInjector.inject(modifiedQuery, options.filter);

            if (this.options.debug) {
                console.log('Applying filters:', options.filter);
            }
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
            modifiedQuery = paginationInjector.inject(modifiedQuery, options.paging);

            if (this.options.debug) {
                console.log('Applied pagination:', options.paging);
            }
        }        // Apply JSON serialization if requested (before formatting)
        let serializationApplied = false;
        let actualSerialize: JsonMapping | null = null;

        if (options.serialize) {
            // Handle boolean case - auto-load JsonMapping from .json file
            if (typeof options.serialize === 'boolean' && options.serialize === true) {
                if (typeof sqlFilePathOrQuery === 'string') {
                    const jsonMappingPath = sqlFilePathOrQuery.replace('.sql', '.json');
                    try {
                        actualSerialize = await this.loadJsonMapping(jsonMappingPath);
                        if (this.options.debug) {
                            console.log(`Auto-loaded JsonMapping from: ${jsonMappingPath}`);
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
            } else if (typeof options.serialize === 'object') {
                // Explicit JsonMapping provided
                actualSerialize = options.serialize;
            }

            // Apply serialization if we have a valid JsonMapping
            if (actualSerialize) {
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
        const result = await this.executeSqlWithParams(finalSql, parametersArray);

        // Handle different return types based on serialization
        if (options.serialize) {
            // When serialized, expect a single object or null
            if (result.length === 0) {
                return null as T | null;
            }

            const serializedResult = result[0];

            // Check if this is a resultFormat: "array" case and extract the array
            if (actualSerialize && actualSerialize.resultFormat === 'array' && serializedResult) {
                // The result should be an object with a single property containing the array
                // Find the first property that contains an array
                for (const [key, value] of Object.entries(serializedResult)) {
                    if (Array.isArray(value)) {
                        if (this.options.debug) {
                            console.log(`Auto-extracting array from property "${key}" due to resultFormat: "array"`);
                        }
                        return value as T;
                    }
                }

                // If no array property found, log warning and return as-is
                if (this.options.debug) {
                    console.warn('resultFormat: "array" specified but no array property found in result');
                }
            }

            return serializedResult as T;
        } else {
            // When not serialized, return array of rows
            return result as T[];
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
            // Determine the actual file path
            let actualPath: string;

            if (path.isAbsolute(jsonFilePath)) {
                actualPath = jsonFilePath;
            } else {
                actualPath = path.join(this.options.sqlFilesPath || './sql', jsonFilePath);
            }

            // Check if file exists
            if (!fs.existsSync(actualPath)) {
                throw new Error(`JsonMapping file not found: ${actualPath}`);
            }

            // Read and parse JSON file
            const content = fs.readFileSync(actualPath, 'utf8');
            const jsonMapping = JSON.parse(content) as JsonMapping;

            if (this.options.debug) {
                console.log(`Loaded JsonMapping file: ${actualPath}`);
            }

            return jsonMapping;
        } catch (error) {
            if (error instanceof Error && error.message.includes('JsonMapping file not found')) {
                throw error;
            } else {
                throw new Error(`Failed to load JsonMapping file "${jsonFilePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    /**
     * Execute SQL with parameters using Prisma
     * 
     * @param sql - The SQL query string
     * @param params - Query parameters
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
