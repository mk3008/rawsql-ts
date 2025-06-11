import {
    PrismaClientType,
    PrismaRawSqlOptions,
    PrismaSchemaInfo,
    PrismaModelInfo,
    PrismaFieldInfo,
    PrismaRelationInfo
} from '../types';

/**
 * Resolves Prisma schema information from the client
 * 
 * This class analyzes the Prisma client to extract model definitions,
 * field types, relationships, and other metadata needed for dynamic SQL generation.
 */
export class PrismaSchemaResolver {
    private readonly options: PrismaRawSqlOptions;

    constructor(options: PrismaRawSqlOptions) {
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
            console.log('Resolving Prisma schema...');
        }

        // In a real implementation, we would use Prisma's DMMF (Data Model Meta Format)
        // or introspect the database to get schema information
        // For now, we'll create a mock implementation that demonstrates the concept

        const models = await this.extractModelsFromClient(prisma);

        return {
            models,
            schemaName: this.options.defaultSchema || 'public'
        };
    }

    /**
     * Extract model information from Prisma client
     * 
     * @param prisma - The Prisma client instance
     * @returns Record of model information
     */
    private async extractModelsFromClient(prisma: PrismaClientType): Promise<Record<string, PrismaModelInfo>> {
        // Try to access Prisma's DMMF (Data Model Meta Format)
        try {
            const dmmf = (prisma as any)._dmmf || (prisma as any).dmmf;
            if (dmmf && dmmf.datamodel) {
                return this.parseModelsFromDmmf(dmmf);
            }
        } catch (error) {
            if (this.options.debug) {
                console.warn('Could not access Prisma DMMF, using mock data:', error);
            }
        }

        // Fallback: return mock model structure for demonstration
        // In a real implementation, this would be populated from actual schema
        const models: Record<string, PrismaModelInfo> = {
            // Example User model - this would normally come from Prisma schema
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
            // Example Post model
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

        if (this.options.debug) {
            console.log('Using mock schema with sample User and Post models');
        }

        return models;
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
        }

        return uniqueConstraints;
    }
}
