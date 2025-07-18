import { TableColumnResolver } from 'rawsql-ts';
import { PrismaClientType, PrismaFieldInfo, PrismaModelInfo, RawSqlClientOptions, PrismaRelationInfo, PrismaSchemaInfo } from './types';
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
    private readonly options: RawSqlClientOptions;
    private schemaInfo?: PrismaSchemaInfo;

    constructor(options: RawSqlClientOptions) {
        this.options = options;
    }

    /**
     * Resolve complete schema information from Prisma client
     * 
     * @param prisma - The Prisma client instance
     * @returns Complete schema information
     */
    async resolveSchema(prisma: PrismaClientType): Promise<PrismaSchemaInfo> {
        if (this.options.debug) {
            console.log('[PrismaSchemaResolver] Resolving Prisma schema using DMMF...');
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
                }; if (this.options.debug) {
                    console.log(`[PrismaSchemaResolver] Successfully loaded schema with ${Object.keys(models).length} models from schema.prisma`);
                    console.log(`[PrismaSchemaResolver] Database provider: ${databaseProvider}`);
                }

                return this.schemaInfo;
            }
        } catch (error) {
            if (this.options.debug) {
                console.warn('[PrismaSchemaResolver] Failed to load schema from schema.prisma:', error);
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
                }; if (this.options.debug) {
                    console.log(`[PrismaSchemaResolver] Successfully loaded schema with ${Object.keys(models).length} models from Prisma client`);
                } return this.schemaInfo;
            }
        } catch (error) {
            if (this.options.debug) {
                console.warn('[PrismaSchemaResolver] Failed to extract DMMF from Prisma client:', error);
            }
        }

        // Final fallback: If all methods fail, throw error with generic paths
        // Use generic location names instead of exposing system-specific paths
        const searchedLocations = [
            './prisma/schema.prisma',
            './schema.prisma',
            '../prisma/schema.prisma',
            '../schema.prisma',
            '../../prisma/schema.prisma',
            '../../schema.prisma',
            '../../../prisma/schema.prisma',
            '../../../schema.prisma',
            './packages/*/prisma/schema.prisma',
            './examples/*/prisma/schema.prisma',
            ...(this.options.schemaPath ? ['<custom-schema-path>'] : [])
        ];

        throw new Error(
            `Unable to resolve Prisma schema information. Searched in these locations:\n` +
            searchedLocations.map(loc => `  - ${loc}`).join('\n') + '\n\n' +
            `Platform: ${process.platform}\n` +
            `Node.js version: ${process.version}\n\n` +
            'Solutions:\n' +
            '1. Ensure you have a valid schema.prisma file in one of the above locations\n' +
            '2. Provide a valid PrismaClient instance to the StaticAnalysisOrchestrator\n' +
            '3. Specify a custom schema location using the "schemaPath" option in RawSqlClient'
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
    }

    /**
     * Get DMMF directly from schema.prisma file
     * 
     * @returns Promise resolving to DMMF object or null if not found
     */
    private async getDMMFFromSchema(): Promise<any> {
        try {
            const schemaPath = await this.findSchemaFile();
            if (!schemaPath) {
                if (this.options.debug) {
                    console.log('[PrismaSchemaResolver] No schema.prisma file found in common locations');
                }
                return null;
            } if (this.options.debug) {
                console.log(`[PrismaSchemaResolver] Loading DMMF from schema file: ${schemaPath}`);
            }

            // Use @prisma/internals to get DMMF from schema.prisma
            const dmmf = await getDMMF({
                datamodel: fs.readFileSync(schemaPath, 'utf-8')
            });

            if (this.isValidDmmf(dmmf)) {
                if (this.options.debug) {
                    console.log(`[PrismaSchemaResolver] Successfully parsed DMMF with ${dmmf.datamodel.models.length} models`);
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
        return this.findSchemaFileSync();
    }

    /**
     * Find schema file synchronously
     * 
     * @returns Path to schema.prisma file or null if not found
     */
    private findSchemaFileSync(): string | null {
        // First priority: Check if custom schema path is provided and exists
        if (this.options.schemaPath) {
            try {
                if (fs.existsSync(this.options.schemaPath) && fs.statSync(this.options.schemaPath).isFile()) {
                    if (this.options.debug) {
                        console.log(`[PrismaSchemaResolver] Found schema file at custom path: ${this.options.schemaPath}`);
                    }
                    return this.options.schemaPath;
                }
            } catch (error) {
                if (this.options.debug) {
                    console.warn(`[PrismaSchemaResolver] Custom schema path invalid: ${this.options.schemaPath}`, error);
                }
            }
        }

        // Fallback: Check common locations relative to module directory for consistent resolution
        // Use module directory as base instead of process.cwd() to avoid execution context issues
        const moduleDir = path.dirname(__filename);
        const projectRoot = path.resolve(moduleDir, '..');
        const isWindows = process.platform === 'win32';
        const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
        
        const commonPaths = [
            // Project root and common locations
            path.resolve(projectRoot, 'prisma', 'schema.prisma'),
            path.resolve(projectRoot, 'schema.prisma'),
            
            // Parent directories (for monorepo structures)
            path.resolve(projectRoot, '..', 'prisma', 'schema.prisma'),
            path.resolve(projectRoot, '..', 'schema.prisma'),
            path.resolve(projectRoot, '../../prisma', 'schema.prisma'),
            path.resolve(projectRoot, '../../schema.prisma'),
            path.resolve(projectRoot, '../../../prisma', 'schema.prisma'),
            path.resolve(projectRoot, '../../../schema.prisma'),
            
            // Specific paths for package structures
            path.resolve(projectRoot, 'packages', 'prisma-integration', 'prisma', 'schema.prisma'),
            path.resolve(projectRoot, 'examples', 'prisma-comparison-demo', 'prisma', 'schema.prisma'),
            
            // Additional fallback paths
            path.resolve(projectRoot, '../../../../prisma/schema.prisma'),
            path.resolve(projectRoot, '../../../../schema.prisma'),
        ];

        // Add Windows-specific paths if running on Windows
        if (isWindows) {
            // Convert WSL-style paths to Windows paths if applicable
            const windowsProjectRoot = projectRoot.replace(/^\/mnt\/([a-z])/, '$1:');
            if (windowsProjectRoot !== projectRoot) {
                commonPaths.push(
                    path.join(windowsProjectRoot, 'prisma', 'schema.prisma'),
                    path.join(windowsProjectRoot, 'packages', 'prisma-integration', 'prisma', 'schema.prisma'),
                    path.join(windowsProjectRoot, 'examples', 'prisma-comparison-demo', 'prisma', 'schema.prisma')
                );
            }
        }

        // Add dynamic WSL paths if running in WSL (avoid hardcoded user paths)
        if (isWSL) {
            // Try to detect WSL mount points dynamically
            const wslMountBase = '/mnt/c';
            if (fs.existsSync(wslMountBase)) {
                // Add some common WSL paths relative to the detected mount
                const wslPaths = [
                    path.resolve(wslMountBase, 'projects', 'prisma', 'schema.prisma'),
                    path.resolve(wslMountBase, 'dev', 'prisma', 'schema.prisma')
                ];
                commonPaths.push(...wslPaths);
            }
        }

        if (this.options.debug) {
            console.log(`[PrismaSchemaResolver] Module directory: ${moduleDir}`);
            console.log(`[PrismaSchemaResolver] Project root: ${projectRoot}`);
            console.log(`[PrismaSchemaResolver] Searching for schema.prisma in ${commonPaths.length} locations...`);
        }

        for (const schemaPath of commonPaths) {
            try {
                if (this.options.debug) {
                    console.log(`[PrismaSchemaResolver] Checking: ${schemaPath}`);
                }
                
                if (fs.existsSync(schemaPath) && fs.statSync(schemaPath).isFile()) {
                    if (this.options.debug) {
                        console.log(`[PrismaSchemaResolver] ✅ Found schema file at: ${schemaPath}`);
                    }
                    return schemaPath;
                }
            } catch (error) {
                if (this.options.debug) {
                    console.log(`[PrismaSchemaResolver] ❌ Error checking ${schemaPath}:`, error instanceof Error ? error.message : error);
                }
                continue;
            }
        }

        if (this.options.debug) {
            console.log('[PrismaSchemaResolver] ❌ No schema.prisma file found in any location');
        }
        
        return null;
    }

    /**
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
                            console.log('[PrismaSchemaResolver] Successfully extracted DMMF from Prisma client');
                        }
                        return dmmf;
                    }
                } catch (error) {
                    // Continue to next method
                    if (this.options.debug) {
                        console.debug('[PrismaSchemaResolver] DMMF extraction method failed:', error);
                    }
                }
            }

            if (this.options.debug) {
                console.warn('[PrismaSchemaResolver] No valid DMMF found using standard access patterns');
            }
            return null;

        } catch (error) {
            if (this.options.debug) {
                console.error('[PrismaSchemaResolver] Error during DMMF extraction:', error);
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
     */
    private extractDatabaseProvider(dmmf: any): string | undefined {
        try {
            // Check if DMMF has datasources information
            if (dmmf && dmmf.datasources && Array.isArray(dmmf.datasources) && dmmf.datasources.length > 0) {
                const datasource = dmmf.datasources[0];
                if (datasource && datasource.provider) {
                    const provider = datasource.provider.toLowerCase(); if (this.options.debug) {
                        console.log(`[PrismaSchemaResolver] Found database provider from DMMF datasources: ${provider}`);
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
                    const provider = datasourceMatch[1].toLowerCase(); if (this.options.debug) {
                        console.log(`[PrismaSchemaResolver] Found database provider from schema file: ${provider}`);
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
                            console.log(`[PrismaSchemaResolver] Found database provider from fallback pattern: ${provider}`);
                        }
                        return provider;
                    }
                }
            } if (this.options.debug) {
                console.warn('[PrismaSchemaResolver] Could not determine database provider from DMMF or schema file');
            }
            return undefined;
        } catch (error) {
            if (this.options.debug) {
                console.warn('[PrismaSchemaResolver] Error extracting database provider:', error);
            }
            return undefined;
        }
    }
}
