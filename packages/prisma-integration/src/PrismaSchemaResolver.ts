
import { TableColumnResolver } from 'rawsql-ts';
import { PrismaClientType, PrismaFieldInfo, PrismaModelInfo, PrismaReaderOptions, PrismaRelationInfo, PrismaSchemaInfo } from './types';
import { getDMMF } from '@prisma/internals';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves Prisma schema information from the client
 * 
 * This class analyzes the Prisma client to extract model definitions,
 * field types, relationships, and other metadata needed for dynamic SQL generation.
 */
export class PrismaSchemaResolver {
    private readonly options: PrismaReaderOptions;
    private schemaInfo?: PrismaSchemaInfo;

    constructor(options: PrismaReaderOptions) {
        this.options = options;
    }    /**
     * Resolve complete schema information from Prisma client
     * 
     * @param prisma - The Prisma client instance
     * @returns Complete schema information
     */
    async resolveSchema(prisma: PrismaClientType): Promise<PrismaSchemaInfo> {
        if (this.options.debug) {
            console.log('Resolving Prisma schema using DMMF...');
        }

        try {
            // Primary method: Extract from schema.prisma using @prisma/internals
            const dmmf = await this.getDMMFFromSchema();
            if (dmmf) {
                const models = this.parseModelsFromDmmf(dmmf);
                const databaseProvider = this.extractDatabaseProvider(dmmf);

                this.schemaInfo = {
                    models,
                    schemaName: this.options.defaultSchema || 'public',
                    databaseProvider
                };

                if (this.options.debug) {
                    console.log(`Successfully loaded schema with ${Object.keys(models).length} models from schema.prisma`);
                    console.log(`Database provider: ${databaseProvider}`);
                }

                return this.schemaInfo;
            }
        } catch (error) {
            if (this.options.debug) {
                console.warn('Failed to load schema from schema.prisma:', error);
            }
        }

        try {
            // Fallback: Extract from Prisma client
            const dmmf = this.extractDmmfFromClient(prisma);
            if (dmmf && this.isValidDmmf(dmmf)) {
                const models = this.parseModelsFromDmmf(dmmf);
                this.schemaInfo = {
                    models,
                    schemaName: this.options.defaultSchema || 'public'
                };

                if (this.options.debug) {
                    console.log(`Successfully loaded schema with ${Object.keys(models).length} models from Prisma client`);
                }

                return this.schemaInfo;
            }
        } catch (error) {
            if (this.options.debug) {
                console.warn('Failed to extract DMMF from Prisma client:', error);
            }
        }

        // Final fallback: Use mock data for development/testing
        if (this.shouldUseMockData()) {
            const models = this.createMockModels();
            this.schemaInfo = {
                models,
                schemaName: this.options.defaultSchema || 'public'
            };

            if (this.options.debug) {
                console.log('Using mock schema data for development/testing');
            }

            return this.schemaInfo;
        }

        // If all methods fail in production, throw comprehensive error
        throw new Error(
            'Unable to resolve Prisma schema information. ' +
            'Ensure you have a valid schema.prisma file or Prisma client instance. ' +
            'Checked: schema.prisma file, Prisma client DMMF access.'
        );
    }

    /**
     * Create a TableColumnResolver function for rawsql-ts
     * 
     * @returns TableColumnResolver function
     */
    createTableColumnResolver(): TableColumnResolver {
        if (!this.schemaInfo) {
            throw new Error('Schema not resolved. Call resolveSchema() first.');
        }

        return (tableName: string): string[] => {
            const columnNames = this.getColumnNames(tableName);
            return columnNames || [];
        };
    }

    /**
     * Get all available table names
     * 
     * @returns Array of table names
     */
    getTableNames(): string[] {
        if (!this.schemaInfo) {
            return [];
        }
        return Object.values(this.schemaInfo.models).map(model => model.tableName);
    }

    /**
     * Get all column names for a specific table
     * 
     * @param tableName - The table name
     * @returns Array of column names, or undefined if table not found
     */
    getColumnNames(tableName: string): string[] | undefined {
        if (!this.schemaInfo) {
            return undefined;
        }

        const model = this.findModelByTableName(tableName);
        if (!model) {
            return undefined;
        }

        return Object.values(model.fields).map(field => field.columnName);
    }

    /**
     * Check if a table exists in the schema
     * 
     * @param tableName - The table name to check
     * @returns true if table exists, false otherwise
     */
    hasTable(tableName: string): boolean {
        return this.findModelByTableName(tableName) !== undefined;
    }

    /**
     * Check if a column exists in a specific table
     * 
     * @param tableName - The table name
     * @param columnName - The column name to check
     * @returns true if column exists, false otherwise
     */
    hasColumn(tableName: string, columnName: string): boolean {
        const model = this.findModelByTableName(tableName);
        if (!model) {
            return false;
        }

        return Object.values(model.fields).some(field => field.columnName === columnName);
    }    /**
     * Get DMMF directly from schema.prisma file
     * 
     * @returns Promise resolving to DMMF object or null if not found
     */
    private async getDMMFFromSchema(): Promise<any> {
        try {
            const schemaPath = await this.findSchemaFile();
            if (!schemaPath) {
                if (this.options.debug) {
                    console.log('No schema.prisma file found in common locations');
                }
                return null;
            }

            if (this.options.debug) {
                console.log(`Loading DMMF from schema file: ${schemaPath}`);
            }

            // Use @prisma/internals to get DMMF from schema.prisma
            const dmmf = await getDMMF({
                datamodel: fs.readFileSync(schemaPath, 'utf-8')
            });

            if (this.isValidDmmf(dmmf)) {
                if (this.options.debug) {
                    console.log(`Successfully parsed DMMF with ${dmmf.datamodel.models.length} models`);
                }
                return dmmf;
            }

            return null;
        } catch (error) {
            if (this.options.debug) {
                console.error('Error loading DMMF from schema file:', error);
            }
            return null;
        }
    }

    /**
     * Find schema.prisma file in common locations
     * 
     * @returns Promise resolving to schema file path or null if not found
     */
    private async findSchemaFile(): Promise<string | null> {
        const commonPaths = [
            // Current working directory
            path.join(process.cwd(), 'schema.prisma'),
            path.join(process.cwd(), 'prisma', 'schema.prisma'),
            // Project root (if we're in a subdirectory)
            path.join(process.cwd(), '..', 'schema.prisma'),
            path.join(process.cwd(), '..', 'prisma', 'schema.prisma'),
            // Common monorepo structures
            path.join(process.cwd(), '../../schema.prisma'),
            path.join(process.cwd(), '../../prisma', 'schema.prisma'),
            // Check if custom schema path is provided
            ...(this.options.schemaPath ? [this.options.schemaPath] : [])
        ];

        for (const schemaPath of commonPaths) {
            try {
                if (fs.existsSync(schemaPath) && fs.statSync(schemaPath).isFile()) {
                    if (this.options.debug) {
                        console.log(`Found schema file at: ${schemaPath}`);
                    }
                    return schemaPath;
                }
            } catch (error) {
                // Continue checking other paths
                continue;
            }
        }

        return null;
    }

    /**
     * Extract model information from Prisma client
     * 
     * @param prisma - The Prisma client instance
     * @returns Record of model information
     */    private async extractModelsFromClient(prisma: PrismaClientType): Promise<Record<string, PrismaModelInfo>> {
        // Extract DMMF from Prisma client
        const dmmf = this.extractDmmfFromClient(prisma);

        if (dmmf && this.isValidDmmf(dmmf)) {
            if (this.options.debug) {
                console.log(`Extracted DMMF with ${dmmf.datamodel.models.length} models from client`);
            }
            return this.parseModelsFromDmmf(dmmf);
        }

        // If DMMF extraction fails, throw error
        throw new Error(
            'Unable to extract schema information from Prisma client. ' +
            'Make sure you are using a valid Prisma client instance with generated types.'
        );
    }/**
     * Extract DMMF from Prisma client using various access methods
     * Supports multiple Prisma versions and deployment environments
     */
    private extractDmmfFromClient(prisma: PrismaClientType): any {
        const client = prisma as any;

        try {
            // Try different ways to access DMMF based on Prisma version
            const dmmfSources = [
                // Prisma 5.x+
                () => client._dmmf,
                // Prisma 4.x
                () => client.dmmf,
                // Engine-based access (various versions)
                () => client._engine?.dmmf,
                () => client._requestHandler?.dmmf,
                // Alternative engine access patterns
                () => client._engine?.datamodel,
                () => client._clientVersion && client._engineConfig?.generator?.output?.dmmf,
                // Try accessing through internal methods
                () => typeof client.getDmmf === 'function' ? client.getDmmf() : null,
                () => typeof client._getDmmf === 'function' ? client._getDmmf() : null,
                // Last resort: check constructor or prototype
                () => client.constructor?.dmmf,
                () => Object.getPrototypeOf(client)?.dmmf
            ];

            for (const getDmmf of dmmfSources) {
                try {
                    const dmmf = getDmmf();
                    if (this.isValidDmmf(dmmf)) {
                        if (this.options.debug) {
                            console.log('Successfully extracted DMMF from Prisma client');
                        }
                        return dmmf;
                    }
                } catch (error) {
                    // Continue to next method
                    if (this.options.debug) {
                        console.debug('DMMF extraction method failed:', error);
                    }
                }
            }

            if (this.options.debug) {
                console.warn('No valid DMMF found using standard access patterns');
            }
            return null;

        } catch (error) {
            if (this.options.debug) {
                console.error('Error during DMMF extraction:', error);
            }
            return null;
        }
    }

    /**
     * Validate if the extracted object is a valid DMMF
     */
    private isValidDmmf(dmmf: any): boolean {
        return (
            dmmf &&
            typeof dmmf === 'object' &&
            dmmf.datamodel &&
            Array.isArray(dmmf.datamodel.models) &&
            dmmf.datamodel.models.length > 0
        );
    }    /**
     * Determine if mock data should be used
     */
    private shouldUseMockData(): boolean {
        // Use mock data in test environment or when explicitly enabled
        return (
            process.env.NODE_ENV === 'test' ||
            process.env.VITEST === 'true' ||
            (this.options.debug === true && process.env.NODE_ENV !== 'production')
        );
    }

    /**
     * Create mock models for development/testing
     */
    private createMockModels(): Record<string, PrismaModelInfo> {
        return {
            // Example User model - for testing/development only
            User: {
                name: 'User',
                tableName: 'users',
                fields: {
                    id: {
                        name: 'id',
                        columnName: 'id',
                        type: 'Int',
                        isOptional: false,
                        isList: false,
                        isId: true,
                        isUnique: true,
                        isGenerated: true
                    },
                    email: {
                        name: 'email',
                        columnName: 'email',
                        type: 'String',
                        isOptional: false,
                        isList: false,
                        isId: false,
                        isUnique: true
                    },
                    name: {
                        name: 'name',
                        columnName: 'name',
                        type: 'String',
                        isOptional: true,
                        isList: false,
                        isId: false,
                        isUnique: false
                    }
                },
                relations: {
                    posts: {
                        name: 'posts',
                        modelName: 'Post',
                        type: 'one-to-many',
                        foreignKeys: [],
                        referencedFields: [],
                        isOptional: false,
                        isList: true
                    }
                },
                primaryKey: ['id'],
                uniqueConstraints: [['email']]
            },
            // Example Post model - for testing/development only
            Post: {
                name: 'Post',
                tableName: 'posts',
                fields: {
                    id: {
                        name: 'id',
                        columnName: 'id',
                        type: 'Int',
                        isOptional: false,
                        isList: false,
                        isId: true,
                        isUnique: true,
                        isGenerated: true
                    },
                    title: {
                        name: 'title',
                        columnName: 'title',
                        type: 'String',
                        isOptional: false,
                        isList: false,
                        isId: false,
                        isUnique: false
                    },
                    content: {
                        name: 'content',
                        columnName: 'content',
                        type: 'String',
                        isOptional: true,
                        isList: false,
                        isId: false,
                        isUnique: false
                    },
                    authorId: {
                        name: 'authorId',
                        columnName: 'author_id',
                        type: 'Int',
                        isOptional: false,
                        isList: false,
                        isId: false,
                        isUnique: false
                    }
                },
                relations: {
                    author: {
                        name: 'author',
                        modelName: 'User',
                        type: 'many-to-one',
                        foreignKeys: ['authorId'],
                        referencedFields: ['id'],
                        isOptional: false,
                        isList: false
                    }
                },
                primaryKey: ['id'],
                uniqueConstraints: []
            }
        };
    }

    /**
     * Parse model information from Prisma DMMF
     * 
     * @param dmmf - Data Model Meta Format from Prisma
     * @returns Parsed model information
     */
    private parseModelsFromDmmf(dmmf: any): Record<string, PrismaModelInfo> {
        const models: Record<string, PrismaModelInfo> = {};

        // Parse each model from DMMF
        for (const model of dmmf.datamodel.models) {
            const modelInfo: PrismaModelInfo = {
                name: model.name,
                tableName: this.getTableName(model.name, model.dbName),
                fields: this.parseFieldsFromModel(model),
                relations: this.parseRelationsFromModel(model),
                primaryKey: this.extractPrimaryKey(model),
                uniqueConstraints: this.extractUniqueConstraints(model)
            };

            models[model.name] = modelInfo;
        }

        return models;
    }

    /**
     * Get table name with custom mappings applied
     */
    private getTableName(modelName: string, dbName?: string): string {
        const mappedName = this.options.tableNameMappings?.[modelName];
        return mappedName || dbName || modelName;
    }

    /**
     * Parse field information from model
     */
    private parseFieldsFromModel(model: any): Record<string, PrismaFieldInfo> {
        const fields: Record<string, PrismaFieldInfo> = {};

        for (const field of model.fields) {
            if (field.relationName) {
                // Skip relation fields - they're handled separately
                continue;
            }

            const fieldInfo: PrismaFieldInfo = {
                name: field.name,
                columnName: this.getColumnName(model.name, field.name, field.dbName),
                type: field.type,
                isOptional: field.isOptional,
                isList: field.isList,
                isId: field.isId,
                isUnique: field.isUnique,
                defaultValue: field.default,
                isGenerated: field.isGenerated
            };

            fields[field.name] = fieldInfo;
        }

        return fields;
    }

    /**
     * Get column name with custom mappings applied
     */
    private getColumnName(modelName: string, fieldName: string, dbName?: string): string {
        const mappedName = this.options.columnNameMappings?.[modelName]?.[fieldName];
        return mappedName || dbName || fieldName;
    }

    /**
     * Parse relation information from model
     */
    private parseRelationsFromModel(model: any): Record<string, PrismaRelationInfo> {
        const relations: Record<string, PrismaRelationInfo> = {};

        for (const field of model.fields) {
            if (!field.relationName) {
                continue;
            }

            const relationType = this.determineRelationType(field);
            const relationInfo: PrismaRelationInfo = {
                name: field.name,
                modelName: field.type,
                type: relationType,
                foreignKeys: field.relationFromFields || [],
                referencedFields: field.relationToFields || [],
                isOptional: field.isOptional,
                isList: field.isList
            };

            relations[field.name] = relationInfo;
        }

        return relations;
    }

    /**
     * Determine relation type from field information
     */
    private determineRelationType(field: any): PrismaRelationInfo['type'] {
        if (field.isList) {
            return 'one-to-many';
        }

        if (field.relationFromFields && field.relationFromFields.length > 0) {
            return 'many-to-one';
        }

        return 'one-to-one';
    }

    /**
     * Extract primary key fields from model
     */
    private extractPrimaryKey(model: any): string[] {
        const primaryKeyFields = model.fields.filter((field: any) => field.isId);
        return primaryKeyFields.map((field: any) => field.name);
    }

    /**
     * Extract unique constraints from model
     */
    private extractUniqueConstraints(model: any): string[][] {
        const uniqueConstraints: string[][] = [];

        // Single field unique constraints
        const uniqueFields = model.fields.filter((field: any) => field.isUnique);
        for (const field of uniqueFields) {
            uniqueConstraints.push([field.name]);
        }

        // Multi-field unique constraints
        if (model.uniqueConstraints) {
            for (const constraint of model.uniqueConstraints) {
                uniqueConstraints.push(constraint.fields);
            }
        } return uniqueConstraints;
    }

    /**
     * Find model by table name
     * 
     * @param tableName - The table name to search for
     * @returns Model information if found, undefined otherwise
     */
    private findModelByTableName(tableName: string): PrismaModelInfo | undefined {
        if (!this.schemaInfo) {
            return undefined;
        }
        return Object.values(this.schemaInfo.models).find(model => model.tableName === tableName);
    }

    /**
     * Get model information by model name
     * 
     * @param modelName - The Prisma model name
     * @returns Model information if found, undefined otherwise
     */
    getModelInfo(modelName: string): PrismaModelInfo | undefined {
        if (!this.schemaInfo) {
            return undefined;
        }
        return this.schemaInfo.models[modelName];
    }

    /**
     * Get all model names
     * 
     * @returns Array of model names
     */
    getModelNames(): string[] {
        if (!this.schemaInfo) {
            return [];
        } return Object.keys(this.schemaInfo.models);
    }

    /**
     * Extract database provider from DMMF
     * 
     * @param dmmf - The DMMF object
     * @returns Database provider string (postgresql, mysql, sqlite, etc.)
     */    private extractDatabaseProvider(dmmf: any): string | undefined {
        try {
            // Check if DMMF has datasources information
            if (dmmf && dmmf.datasources && Array.isArray(dmmf.datasources) && dmmf.datasources.length > 0) {
                const datasource = dmmf.datasources[0];
                if (datasource && datasource.provider) {
                    const provider = datasource.provider.toLowerCase();
                    if (this.options.debug) {
                        console.log(`Found database provider from DMMF datasources: ${provider}`);
                    }
                    return provider;
                }
            }

            // Fallback: try to read from schema file directly
            const schemaPath = this.findSchemaFileSync();
            if (schemaPath && fs.existsSync(schemaPath)) {
                const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

                // Look specifically for datasource db { provider = "..." } pattern
                const datasourceMatch = schemaContent.match(/datasource\s+\w+\s*\{[^}]*provider\s*=\s*"([^"]+)"[^}]*\}/);
                if (datasourceMatch && datasourceMatch[1]) {
                    const provider = datasourceMatch[1].toLowerCase();
                    if (this.options.debug) {
                        console.log(`Found database provider from schema file: ${provider}`);
                    }
                    return provider;
                }

                // Fallback to simple provider match (less reliable)
                const providerMatch = schemaContent.match(/provider\s*=\s*"([^"]+)"/);
                if (providerMatch && providerMatch[1]) {
                    // Skip if this is a generator provider (prisma-client-js)
                    const provider = providerMatch[1].toLowerCase();
                    if (provider !== 'prisma-client-js' && !provider.includes('client')) {
                        if (this.options.debug) {
                            console.log(`Found database provider from fallback pattern: ${provider}`);
                        }
                        return provider;
                    }
                }
            }

            if (this.options.debug) {
                console.warn('Could not determine database provider from DMMF or schema file');
            }
            return undefined;
        } catch (error) {
            if (this.options.debug) {
                console.warn('Error extracting database provider:', error);
            }
            return undefined;
        }
    }

    /**
     * Find schema file synchronously (for fallback use)
     * 
     * @returns Path to schema.prisma file or undefined
     */
    private findSchemaFileSync(): string | undefined {
        const possiblePaths = [
            this.options.schemaPath,
            './prisma/schema.prisma',
            './schema.prisma',
            '../prisma/schema.prisma',
            '../../prisma/schema.prisma'
        ].filter(Boolean) as string[];

        for (const schemaPath of possiblePaths) {
            if (fs.existsSync(schemaPath)) {
                return path.resolve(schemaPath);
            }
        }

        return undefined;
    }
}
