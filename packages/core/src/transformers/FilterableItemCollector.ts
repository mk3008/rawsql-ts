import { SelectQuery } from '../models/SelectQuery';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { SchemaCollector, TableSchema } from './SchemaCollector';
import { TableColumnResolver } from './TableColumnResolver';
import { ParameterDetector } from '../utils/ParameterDetector';
import { SelectableColumnCollector, DuplicateDetectionMode } from './SelectableColumnCollector';

/**
 * Options for FilterableItemCollector
 */
export interface FilterableItemCollectorOptions {
    /** If true, return qualified names (table.column), if false return column names only */
    qualified?: boolean;
    /** If true, collect all columns available from upstream sources for maximum search conditions */
    upstream?: boolean;
}

/**
 * Represents a filterable item that can be used in DynamicQueryBuilder
 * Can be either a table column or a SQL parameter
 */
export class FilterableItem {
    constructor(
        public readonly name: string,
        public readonly type: 'column' | 'parameter',
        public readonly tableName?: string
    ) {}
}

/**
 * Collects filterable items (columns and parameters) from SQL queries
 * for use in DynamicQueryBuilder filtering functionality.
 * 
 * This class combines:
 * - Table columns (from SelectableColumnCollector with FullName duplicate detection)
 * - SQL parameters (from ParameterDetector)
 * 
 * Features:
 * - FullName mode preserves columns with same names from different tables (u.id vs p.id)
 * - Upstream collection (default) provides comprehensive column discovery for maximum filtering
 * - Qualified mode option for table.column naming in complex JOINs
 * 
 * This allows DynamicQueryBuilder to filter on both actual table columns
 * and fixed parameters defined in the SQL with full JOIN table support.
 */
export class FilterableItemCollector {
    private tableColumnResolver?: TableColumnResolver;
    private options: FilterableItemCollectorOptions;

    /**
     * Creates a new FilterableItemCollector
     * @param tableColumnResolver Optional resolver for wildcard column expansion
     * @param options Optional configuration options
     *   - qualified: If true, return table.column names; if false, return column names only
     *   - upstream: If true (default), collect all available columns from upstream sources for maximum filtering capability
     */
    constructor(tableColumnResolver?: TableColumnResolver, options?: FilterableItemCollectorOptions) {
        this.tableColumnResolver = tableColumnResolver;
        this.options = { qualified: false, upstream: true, ...options };
    }

    /**
     * Collects all filterable items (columns and parameters) from a SQL query
     * @param query The parsed SQL query to analyze
     * @returns Array of FilterableItem objects representing columns and parameters
     */
    collect(query: SelectQuery): FilterableItem[] {
        const items: FilterableItem[] = [];

        // 1. Collect table columns using SchemaCollector
        const columnItems = this.collectColumns(query);
        items.push(...columnItems);

        // 2. Collect SQL parameters using ParameterDetector
        const parameterItems = this.collectParameters(query);
        items.push(...parameterItems);

        // 3. Remove duplicates (same name and type)
        return this.removeDuplicates(items);
    }

    /**
     * Collects table columns using both SelectableColumnCollector and SchemaCollector
     */
    private collectColumns(query: SelectQuery): FilterableItem[] {
        const items: FilterableItem[] = [];
        
        // First, collect columns using SelectableColumnCollector (includes WHERE clause columns)
        try {
            const columnCollector = new SelectableColumnCollector(
                this.tableColumnResolver,
                false, // includeUsingColumns
                DuplicateDetectionMode.FullName, // Use full names to preserve duplicates
                { upstream: this.options.upstream } // Enable upstream collection based on options
            );
            
            const columns = columnCollector.collect(query);

            // Convert column information to FilterableItem objects
            for (const column of columns) {
                let tableName: string | undefined = undefined;
                let realTableName: string | undefined = undefined;
                
                // Primary: Extract table name from column reference namespace using getNamespace()
                if (column.value && typeof (column.value as any).getNamespace === 'function') {
                    const namespace = (column.value as any).getNamespace();
                    if (namespace && namespace.trim() !== '') {
                        tableName = namespace;
                        // Get real table name if using qualified mode
                        if (this.options.qualified) {
                            realTableName = this.getRealTableName(query, namespace);
                        }
                    }
                }

                // Fallback: Try to infer from query structure for simple queries
                if (!tableName) {
                    tableName = this.inferTableNameFromQuery(query);
                    if (tableName && this.options.qualified) {
                        realTableName = tableName; // For simple queries, table name is already real
                    }
                }

                // Generate column name based on qualified option
                let columnName = column.name;
                if (this.options.qualified && (realTableName || tableName)) {
                    const nameToUse = realTableName || tableName;
                    columnName = `${nameToUse}.${column.name}`;
                }

                items.push(new FilterableItem(columnName, 'column', tableName));
            }

        } catch (error) {
            // If SelectableColumnCollector fails, fall back to SchemaCollector only
            console.warn('Failed to collect columns with SelectableColumnCollector, using fallback:', error);
            
            try {
                const schemaCollector = new SchemaCollector(this.tableColumnResolver, true);
                const schemas = schemaCollector.collect(query);

                for (const schema of schemas) {
                    for (const columnName of schema.columns) {
                        // Generate column name based on qualified option
                        let finalColumnName = columnName;
                        if (this.options.qualified) {
                            // For SchemaCollector, schema.name should already be the real table name
                            finalColumnName = `${schema.name}.${columnName}`;
                        }
                        items.push(new FilterableItem(finalColumnName, 'column', schema.name));
                    }
                }
            } catch (fallbackError) {
                console.warn('Failed to collect columns with both approaches:', error, fallbackError);
            }
        }

        return items;
    }

    /**
     * Attempts to infer table name from query structure for simple cases
     */
    private inferTableNameFromQuery(query: SelectQuery): string | undefined {
        // For simple queries with single table, try to extract table name
        if (query instanceof SimpleSelectQuery && query.fromClause && query.fromClause.source) {
            const datasource = query.fromClause.source.datasource;
            if (datasource && typeof (datasource as any).table === 'object') {
                const table = (datasource as any).table;
                if (table && typeof table.name === 'string') {
                    return table.name;
                }
            }
        }
        return undefined;
    }

    /**
     * Attempts to resolve real table name from alias/namespace
     */
    private getRealTableName(query: SelectQuery, aliasOrName: string): string | undefined {
        try {
            // Handle CTEs by converting to simple query first
            const simpleQuery = (query as any).type === 'WITH' ? (query as any).toSimpleQuery() : query;
            
            if (simpleQuery instanceof SimpleSelectQuery && simpleQuery.fromClause) {
                // Check main datasource
                if (simpleQuery.fromClause.source?.datasource) {
                    const mainSource = simpleQuery.fromClause.source;
                    const realName = this.extractRealTableName(mainSource, aliasOrName);
                    if (realName) return realName;
                }

                // Check JOIN clauses
                const fromClause = simpleQuery.fromClause as any;
                if (fromClause.joinClauses && Array.isArray(fromClause.joinClauses)) {
                    for (const joinClause of fromClause.joinClauses) {
                        if (joinClause.source?.datasource) {
                            const realName = this.extractRealTableName(joinClause.source, aliasOrName);
                            if (realName) return realName;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Error resolving real table name:', error);
        }
        
        // If we can't resolve, return the original name
        return aliasOrName;
    }

    /**
     * Extracts real table name from a datasource
     */
    private extractRealTableName(source: any, aliasOrName: string): string | undefined {
        try {
            const datasource = source.datasource;
            if (!datasource) return undefined;

            // Get alias from multiple possible locations
            const alias = source.alias || source.aliasExpression?.table?.name;
            const realTableName = datasource.table?.name;

            if (alias === aliasOrName && realTableName) {
                return realTableName;
            }

            // If no alias but names match, it's a direct table reference
            if (!alias && realTableName === aliasOrName) {
                return realTableName;
            }
        } catch (error) {
            // Ignore errors in extraction
        }
        
        return undefined;
    }

    /**
     * Collects SQL parameters from the query using ParameterDetector
     */
    private collectParameters(query: SelectQuery): FilterableItem[] {
        const items: FilterableItem[] = [];

        try {
            // Use existing ParameterDetector to extract parameter names from AST
            const parameterNames = ParameterDetector.extractParameterNames(query);

            // Convert parameter names to FilterableItem objects
            for (const paramName of parameterNames) {
                items.push(new FilterableItem(paramName, 'parameter'));
            }
        } catch (error) {
            // If parameter extraction fails, continue with empty parameter list
            console.warn('Failed to collect parameters:', error);
        }

        return items;
    }

    /**
     * Removes duplicate items with the same name, type, and table name
     * This preserves columns with the same name from different tables
     */
    private removeDuplicates(items: FilterableItem[]): FilterableItem[] {
        const seen = new Set<string>();
        const result: FilterableItem[] = [];

        for (const item of items) {
            // Include table name in the key to preserve columns from different tables
            const key = `${item.type}:${item.name}:${item.tableName || 'none'}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(item);
            }
        }

        return result.sort((a, b) => {
            // Sort by type first (columns before parameters), then by table name, then by name
            if (a.type !== b.type) {
                return a.type === 'column' ? -1 : 1;
            }
            
            // For columns, sort by table name first, then column name
            if (a.type === 'column') {
                const tableA = a.tableName || '';
                const tableB = b.tableName || '';
                if (tableA !== tableB) {
                    return tableA.localeCompare(tableB);
                }
            }
            
            return a.name.localeCompare(b.name);
        });
    }
}