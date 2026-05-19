/**
 * Central schema management utility for rawsql-ts.
 * Converts user-defined table definitions into resolvers consumed by collectors and builders.
 *
 * @example
 * ```typescript
 * const manager = new SchemaManager({
 *   users: {
 *     name: 'users',
 *     columns: {
 *       id: { name: 'id', isPrimaryKey: true },
 *       email: { name: 'email' }
 *     }
 *   }
 * });
 *
 * const resolver = manager.createTableColumnResolver();
 * const collector = new SchemaCollector(resolver);
 * const schemas = collector.collect(SelectQueryParser.parse('SELECT * FROM users'));
 * ```
 * Related tests: packages/core/tests/transformers/SchemaCollector.test.ts
 */

// === Core Types for User-defined Schemas ===

/**
 * Database column metadata for schema mapping
 */
export interface ColumnDefinition {
    /** Column name in database */
    name: string;
    /** Primary key indicator - used for UPDATE/DELETE query WHERE conditions */
    isPrimaryKey?: boolean;
    /** Foreign key reference */
    foreignKey?: {
        table: string;
        column: string;
    };
}

/**
 * Table relationship definition
 */
export interface RelationshipDefinition {
    /** Type of relationship */
    type: 'object' | 'array';
    /** Target table name */
    table: string;
    /** Caller-owned relationship property name */
    propertyName: string;
    /** Optional: Override target table's primary key */
    targetKey?: string;
}

/**
 * Complete table schema definition that users write
 */
export interface TableDefinition {
    /** Table name in database */
    name: string;
    /** Human-readable entity name */
    displayName?: string;
    /** Column definitions */
    columns: Record<string, ColumnDefinition>;
    /** Relationships with other tables */
    relationships?: RelationshipDefinition[];
}

/**
 * Schema registry containing all table definitions
 */
export interface SchemaRegistry {
    [tableName: string]: TableDefinition;
}

// === Schema Manager Class ===

/**
 * Central schema management utility for rawsql-ts
 * Converts user-defined schemas to resolvers consumed by schema-aware utilities
 */
export class SchemaManager {
    private schemas: SchemaRegistry;

    constructor(schemas: SchemaRegistry) {
        this.schemas = schemas;
        this.validateSchemas();
    }

    /**
     * Validate schema definitions for consistency
     * Ensures each table has a primary key (required for UPDATE/DELETE operations)
     * and validates relationship references
     */
    private validateSchemas(): void {
        const tableNames = Object.keys(this.schemas);
        const errors: string[] = [];

        // Validate each table
        Object.entries(this.schemas).forEach(([tableName, table]) => {
            // Check primary key exists (required for UPDATE/DELETE WHERE conditions)
            const primaryKeys = Object.entries(table.columns)
                .filter(([_, col]) => col.isPrimaryKey)
                .map(([name, _]) => name);

            if (primaryKeys.length === 0) {
                errors.push(`Table '${tableName}' has no primary key defined`);
            }

            // Validate foreign key references
            table.relationships?.forEach(rel => {
                if (!tableNames.includes(rel.table)) {
                    errors.push(`Table '${tableName}' references unknown table '${rel.table}' in relationship`);
                }
            });
        });

        if (errors.length > 0) {
            throw new Error(`Schema validation failed:\\n${errors.join('\\n')}`);
        }
    }

    /**
     * Get table column names for SqlParamInjector TableColumnResolver
     * @param tableName Name of the table
     * @returns Array of column names
     */
    public getTableColumns(tableName: string): string[] {
        const table = this.schemas[tableName];
        if (!table) {
            return [];
        }
        return Object.keys(table.columns);
    }

    /**
     * Create TableColumnResolver function for SqlParamInjector
     * @returns Function compatible with SqlParamInjector
     */
    public createTableColumnResolver(): (tableName: string) => string[] {
        return (tableName: string) => this.getTableColumns(tableName);
    }

    /**
     * Get all table names in the schema
     * @returns Array of table names
     */
    public getTableNames(): string[] {
        return Object.keys(this.schemas);
    }

    /**
     * Get table definition by name
     * @param tableName Name of the table
     * @returns Table definition or undefined
     */
    public getTable(tableName: string): TableDefinition | undefined {
        return this.schemas[tableName];
    }

    /**
     * Get primary key column name for a table
     * Used by QueryBuilder.buildUpdateQuery for WHERE clause conditions
     * @param tableName Name of the table
     * @returns Primary key column name or undefined
     */
    public getPrimaryKey(tableName: string): string | undefined {
        const table = this.schemas[tableName];
        if (!table) return undefined;

        const primaryKeyEntry = Object.entries(table.columns)
            .find(([_, col]) => col.isPrimaryKey);

        return primaryKeyEntry ? primaryKeyEntry[0] : undefined;
    }

    /**
     * Get foreign key relationships for a table
     * @param tableName Name of the table
     * @returns Array of foreign key relationships
     */
    public getForeignKeys(tableName: string): Array<{ column: string; referencedTable: string; referencedColumn: string }> {
        const table = this.schemas[tableName];
        if (!table) return [];

        const foreignKeys: Array<{ column: string; referencedTable: string; referencedColumn: string }> = [];

        Object.entries(table.columns).forEach(([columnName, column]) => {
            if (column.foreignKey) {
                foreignKeys.push({
                    column: columnName,
                    referencedTable: column.foreignKey.table,
                    referencedColumn: column.foreignKey.column
                });
            }
        });

        return foreignKeys;
    }
}

// === Convenience Functions ===

/**
 * Create a SchemaManager instance from schema definitions
 * @param schemas Schema registry object
 * @returns SchemaManager instance
 */
export function createSchemaManager(schemas: SchemaRegistry): SchemaManager {
    return new SchemaManager(schemas);
}

/**
 * Create TableColumnResolver function from schema definitions
 * @param schemas Schema registry object
 * @returns TableColumnResolver function for SqlParamInjector
 */
export function createTableColumnResolver(schemas: SchemaRegistry): (tableName: string) => string[] {
    const manager = new SchemaManager(schemas);
    return manager.createTableColumnResolver();
}

