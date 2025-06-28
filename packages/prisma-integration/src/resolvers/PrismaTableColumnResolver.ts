import { TableColumnResolver } from 'rawsql-ts';
import { PrismaSchemaInfo, PrismaModelInfo } from '../types';

/**
 * Prisma-specific table and column resolver
 * 
 * This resolver uses Prisma schema information to resolve table and column names
 * for SQL generation and validation.
 */
export class PrismaTableColumnResolver {
    private readonly schemaInfo: PrismaSchemaInfo;

    constructor(schemaInfo: PrismaSchemaInfo) {
        this.schemaInfo = schemaInfo;
    }

    /**
     * Create a TableColumnResolver function for rawsql-ts
     * 
     * @returns TableColumnResolver function
     */
    createTableColumnResolver(): TableColumnResolver {
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
        return Object.values(this.schemaInfo.models).map(model => model.tableName);
    }

    /**
     * Get all column names for a specific table
     * 
     * @param tableName - The table name
     * @returns Array of column names, or undefined if table not found
     */
    getColumnNames(tableName: string): string[] | undefined {
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
     * Get the primary key columns for a table
     * 
     * @param tableName - The table name
     * @returns Array of primary key column names, or undefined if table not found
     */
    getPrimaryKeyColumns(tableName: string): string[] | undefined {
        const model = this.findModelByTableName(tableName);
        if (!model) {
            return undefined;
        }

        return model.primaryKey.map(fieldName => {
            const field = model.fields[fieldName];
            return field ? field.columnName : fieldName;
        });
    }

    /**
     * Get the unique constraints for a table
     * 
     * @param tableName - The table name
     * @returns Array of unique constraint column arrays, or undefined if table not found
     */
    getUniqueConstraints(tableName: string): string[][] | undefined {
        const model = this.findModelByTableName(tableName);
        if (!model) {
            return undefined;
        }

        return model.uniqueConstraints.map(constraint =>
            constraint.map(fieldName => {
                const field = model.fields[fieldName];
                return field ? field.columnName : fieldName;
            })
        );
    }

    /**
     * Get column type information
     * 
     * @param tableName - The table name
     * @param columnName - The column name
     * @returns Column type information, or undefined if not found
     */
    getColumnType(tableName: string, columnName: string): string | undefined {
        const model = this.findModelByTableName(tableName);
        if (!model) {
            return undefined;
        }

        const field = Object.values(model.fields).find(field => field.columnName === columnName);
        return field?.type;
    }

    /**
     * Check if a column is nullable
     * 
     * @param tableName - The table name
     * @param columnName - The column name
     * @returns true if column is nullable, false if not nullable, undefined if not found
     */
    isColumnNullable(tableName: string, columnName: string): boolean | undefined {
        const model = this.findModelByTableName(tableName);
        if (!model) {
            return undefined;
        }

        const field = Object.values(model.fields).find(field => field.columnName === columnName);
        return field?.isOptional;
    }

    /**
     * Get relation information for a table
     * 
     * @param tableName - The table name
     * @returns Array of relation information, or undefined if table not found
     */
    getRelations(tableName: string): Array<{
        name: string;
        relatedTable: string;
        type: string;
        foreignKeys: string[];
        referencedKeys: string[];
    }> | undefined {
        const model = this.findModelByTableName(tableName);
        if (!model) {
            return undefined;
        }

        return Object.values(model.relations).map(relation => {
            const relatedModel = this.schemaInfo.models[relation.modelName];
            return {
                name: relation.name,
                relatedTable: relatedModel?.tableName || relation.modelName,
                type: relation.type,
                foreignKeys: relation.foreignKeys.map(fieldName => {
                    const field = model.fields[fieldName];
                    return field ? field.columnName : fieldName;
                }),
                referencedKeys: relation.referencedFields.map(fieldName => {
                    const field = relatedModel?.fields[fieldName];
                    return field ? field.columnName : fieldName;
                })
            };
        });
    }

    /**
     * Find model by table name
     * 
     * @param tableName - The table name to search for
     * @returns Model information if found, undefined otherwise
     */
    private findModelByTableName(tableName: string): PrismaModelInfo | undefined {
        return Object.values(this.schemaInfo.models).find(model => model.tableName === tableName);
    }

    /**
     * Get model information by model name
     * 
     * @param modelName - The Prisma model name
     * @returns Model information if found, undefined otherwise
     */
    getModelInfo(modelName: string): PrismaModelInfo | undefined {
        return this.schemaInfo.models[modelName];
    }

    /**
     * Get all model names
     * 
     * @returns Array of model names
     */
    getModelNames(): string[] {
        return Object.keys(this.schemaInfo.models);
    }
}
