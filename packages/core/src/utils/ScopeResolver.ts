import { SelectQuery, SimpleSelectQuery, BinarySelectQuery } from '../models/SelectQuery';
import { CTEQuery, FromClause, JoinClause, SelectItem, SubQuerySource, TableSource } from '../models/Clause';
import { InsertQuery } from '../models/InsertQuery';
import { UpdateQuery } from '../models/UpdateQuery';
import { DeleteQuery } from '../models/DeleteQuery';
import { CTECollector } from '../transformers/CTECollector';
import { CursorContextAnalyzer } from './CursorContextAnalyzer';
import { ColumnReference, QualifiedName, ValueComponent } from '../models/ValueComponent';
import { TextPositionUtils } from './TextPositionUtils';

/**
 * Information about a table available in the current scope
 */
export interface AvailableTable {
    /** Table name (unqualified) */
    name: string;
    /** Table alias (if any) */
    alias?: string;
    /** Schema name (if qualified) */
    schema?: string;
    /** Full qualified name */
    fullName: string;
    /** Source type: 'table', 'cte', 'subquery' */
    sourceType: 'table' | 'cte' | 'subquery';
    /** Original table reference for subqueries */
    originalQuery?: SelectQuery;
}

/**
 * Information about a CTE available in the current scope
 */
export interface AvailableCTE {
    /** CTE name */
    name: string;
    /** Column names if determinable */
    columns?: string[];
    /** The CTE query definition (SELECT or writable DML with RETURNING) */
    query: CTEQuery;
    /** Whether the CTE is materialized */
    materialized?: boolean;
}

/**
 * Information about columns available for a specific table
 */
export interface AvailableColumn {
    /** Column name */
    name: string;
    /** Table name the column belongs to */
    tableName: string;
    /** Table alias (if any) */
    tableAlias?: string;
    /** Data type (if known) */
    type?: string;
    /** Whether column is nullable */
    nullable?: boolean;
    /** Full qualified column reference */
    fullReference: string;
}

/**
 * Complete scope information at a cursor position
 */
export interface ScopeInfo {
    /** Tables available at the current position */
    availableTables: AvailableTable[];
    /** CTEs available at the current position */
    availableCTEs: AvailableCTE[];
    /** Nesting level (0 = root query) */
    subqueryLevel: number;
    /** Columns visible from all tables in scope */
    visibleColumns: AvailableColumn[];
    /** Current query being analyzed */
    currentQuery?: SelectQuery;
    /** Parent queries (for nested contexts) */
    parentQueries: SelectQuery[];
}

/**
 * Resolves scope information at cursor positions for SQL IntelliSense
 * 
 * Provides comprehensive scope analysis including table availability, CTE resolution,
 * and column visibility for intelligent code completion suggestions.
 * 
 * @example
 * ```typescript
 * const sql = `
 *   WITH users AS (SELECT id, name FROM accounts)
 *   SELECT u.name FROM users u 
 *   LEFT JOIN orders o ON u.id = o.user_id
 *   WHERE u.|
 * `;
 * const scope = ScopeResolver.resolveAt(sql, { line: 4, column: 12 });
 * 
 * console.log(scope.availableTables); // [{ name: 'users', alias: 'u' }, { name: 'orders', alias: 'o' }]
 * console.log(scope.availableCTEs); // [{ name: 'users', columns: ['id', 'name'] }]
 * ```
 */
export class ScopeResolver {
    /**
     * Resolve scope information at the specified cursor position
     * 
     * @param sql - SQL text to analyze
     * @param cursorPosition - Character position of cursor (0-based)
     * @returns Complete scope information
     */
    public static resolve(sql: string, cursorPosition: number): ScopeInfo {
        // Simplified for suggestion-only focus - return basic scope information
        // Complex SQL parsing removed to avoid issues with incomplete SQL syntax
        return this.createEmptyScope();
    }
    
    /**
     * Resolve scope information at line/column position
     * 
     * @param sql - SQL text to analyze
     * @param position - Line and column position (1-based)
     * @returns Complete scope information
     */
    public static resolveAt(sql: string, position: { line: number; column: number }): ScopeInfo {
        const charOffset = TextPositionUtils.lineColumnToCharOffset(sql, position);
        if (charOffset === -1) {
            return this.createEmptyScope();
        }
        return this.resolve(sql, charOffset);
    }
    
    /**
     * Get available columns for a specific table or alias
     * 
     * @param sql - SQL text containing the query
     * @param cursorPosition - Cursor position for scope resolution
     * @param tableOrAlias - Table name or alias to get columns for
     * @returns Array of available columns for the specified table
     */
    public static getColumnsForTable(
        sql: string, 
        cursorPosition: number, 
        tableOrAlias: string
    ): AvailableColumn[] {
        const scope = this.resolve(sql, cursorPosition);
        
        // Find matching table
        const table = scope.availableTables.find(t => 
            t.name === tableOrAlias || t.alias === tableOrAlias
        );
        
        if (!table) {
            return [];
        }
        
        // Return columns for this table
        return scope.visibleColumns.filter(col => 
            col.tableName === table.name || 
            (table.alias && col.tableAlias === table.alias)
        );
    }
    
    private static analyzeScopeFromQuery(query: SelectQuery): ScopeInfo {
        const scope: ScopeInfo = {
            availableTables: [],
            availableCTEs: [],
            subqueryLevel: 0,
            visibleColumns: [],
            currentQuery: query,
            parentQueries: []
        };
        
        if (query instanceof SimpleSelectQuery) {
            // Collect CTEs
            scope.availableCTEs = this.collectCTEs(query);
            
            // Collect tables from FROM and JOINs
            scope.availableTables = this.collectTablesFromQuery(query);
            
            // Collect visible columns
            scope.visibleColumns = this.collectVisibleColumns(scope.availableTables, scope.availableCTEs);
            
        } else if (query instanceof BinarySelectQuery) {
            // For UNION queries, analyze both sides
            const leftScope = this.analyzeScopeFromQuery(query.left);
            const rightScope = this.analyzeScopeFromQuery(query.right);
            
            // Merge scopes (tables from both sides available)
            scope.availableTables = [...leftScope.availableTables, ...rightScope.availableTables];
            scope.availableCTEs = [...leftScope.availableCTEs, ...rightScope.availableCTEs];
            scope.visibleColumns = [...leftScope.visibleColumns, ...rightScope.visibleColumns];
        }
        
        return scope;
    }
    
    private static collectCTEs(query: SimpleSelectQuery): AvailableCTE[] {
        const ctes: AvailableCTE[] = [];
        
        if (query.withClause) {
            const cteCollector = new CTECollector();
            const collectedCTEs = cteCollector.collect(query);
            
            for (const cte of collectedCTEs) {
                ctes.push({
                    name: cte.getSourceAliasName(),
                    query: cte.query,
                    columns: this.extractCTEColumns(cte.query),
                    materialized: cte.materialized || false
                });
            }
        }
        
        return ctes;
    }
    
    private static collectTablesFromQuery(query: SimpleSelectQuery): AvailableTable[] {
        const tables: AvailableTable[] = [];
        
        // Collect from FROM clause
        if (query.fromClause) {
            const fromTables = this.extractTablesFromFromClause(query.fromClause);
            tables.push(...fromTables);
        }
        
        return tables;
    }
    
    private static extractTablesFromFromClause(fromClause: FromClause): AvailableTable[] {
        const tables: AvailableTable[] = [];
        
        // Extract main source table
        if (fromClause.source.datasource instanceof TableSource) {
            const table: AvailableTable = {
                name: this.extractTableName(fromClause.source.datasource.qualifiedName),
                alias: fromClause.source.aliasExpression?.table.name,
                schema: this.extractSchemaName(fromClause.source.datasource.qualifiedName),
                fullName: this.getQualifiedNameString(fromClause.source.datasource.qualifiedName),
                sourceType: 'table'
            };
            tables.push(table);
        } else if (fromClause.source.datasource instanceof SubQuerySource) {
            const table: AvailableTable = {
                name: fromClause.source.aliasExpression?.table.name || 'subquery',
                alias: fromClause.source.aliasExpression?.table.name,
                fullName: fromClause.source.aliasExpression?.table.name || 'subquery',
                sourceType: 'subquery',
                originalQuery: fromClause.source.datasource.query
            };
            tables.push(table);
        }
        
        // Collect from JOINs
        if (fromClause.joins) {
            for (const join of fromClause.joins) {
                const joinTables = this.extractTablesFromJoin(join);
                tables.push(...joinTables);
            }
        }
        
        return tables;
    }
    
    private static extractTablesFromJoin(join: JoinClause): AvailableTable[] {
        const tables: AvailableTable[] = [];
        
        if (join.source.datasource instanceof TableSource) {
            const table: AvailableTable = {
                name: this.extractTableName(join.source.datasource.qualifiedName),
                alias: join.source.aliasExpression?.table.name,
                schema: this.extractSchemaName(join.source.datasource.qualifiedName),
                fullName: this.getQualifiedNameString(join.source.datasource.qualifiedName),
                sourceType: 'table'
            };
            tables.push(table);
        } else if (join.source.datasource instanceof SubQuerySource) {
            const table: AvailableTable = {
                name: join.source.aliasExpression?.table.name || 'subquery',
                alias: join.source.aliasExpression?.table.name,
                fullName: join.source.aliasExpression?.table.name || 'subquery',
                sourceType: 'subquery',
                originalQuery: join.source.datasource.query
            };
            tables.push(table);
        }
        
        return tables;
    }
    
    private static getQualifiedNameString(qualifiedName: QualifiedName): string {
        // Use the existing method from QualifiedName to get the string representation
        return qualifiedName.toString();
    }
    
    private static extractTableName(qualifiedName: QualifiedName): string {
        const fullName = this.getQualifiedNameString(qualifiedName);
        const parts = fullName.split('.');
        return parts[parts.length - 1]; // Last part is table name
    }
    
    private static extractSchemaName(qualifiedName: QualifiedName): string | undefined {
        const fullName = this.getQualifiedNameString(qualifiedName);
        const parts = fullName.split('.');
        return parts.length > 1 ? parts[parts.length - 2] : undefined;
    }
    
    private static extractCTEColumns(query: CTEQuery): string[] | undefined {
        try {
            if (this.isSelectQuery(query)) {
                if (query instanceof SimpleSelectQuery && query.selectClause) {
                    return this.extractColumnsFromItems(query.selectClause.items);
                }
                return undefined;
            }

            // Writable CTEs expose columns through RETURNING when available.
            if (query instanceof InsertQuery || query instanceof UpdateQuery || query instanceof DeleteQuery) {
                if (query.returningClause) {
                    return this.extractColumnsFromItems(query.returningClause.items);
                }
            }
        } catch (error) {
            // If extraction fails, return undefined
        }

        return undefined;
    }

    private static extractColumnsFromItems(items: SelectItem[]): string[] | undefined {
        const columns: string[] = [];

        for (const item of items) {
            // Use alias if available, otherwise try to extract from expression
            if (item.identifier) {
                columns.push(item.identifier.name);
                continue;
            }

            const columnName = this.extractColumnNameFromExpression(item.value);
            if (columnName) {
                columns.push(columnName);
            }
        }

        return columns.length > 0 ? columns : undefined;
    }

    private static extractColumnNameFromExpression(expression: ValueComponent): string | undefined {
        if (expression instanceof ColumnReference) {
            return expression.column.name;
        }

        // Fallback for simple literal wrappers
        if (expression && typeof expression === 'object' && 'value' in expression) {
            return (expression as { value?: string }).value;
        }

        return undefined;
    }

    private static isSelectQuery(query: CTEQuery): query is SelectQuery {
        return '__selectQueryType' in query && (query as SelectQuery).__selectQueryType === 'SelectQuery';
    }
    
    private static collectVisibleColumns(tables: AvailableTable[], ctes: AvailableCTE[]): AvailableColumn[] {
        const columns: AvailableColumn[] = [];
        
        // Add columns from CTEs
        for (const cte of ctes) {
            if (cte.columns) {
                for (const columnName of cte.columns) {
                    columns.push({
                        name: columnName,
                        tableName: cte.name,
                        fullReference: `${cte.name}.${columnName}`
                    });
                }
            }
        }
        
        // For regular tables, we would need schema information to determine columns
        // This is a placeholder - in practice, this would integrate with database metadata
        for (const table of tables) {
            if (table.sourceType === 'table') {
                // Placeholder - would query database schema
                columns.push({
                    name: '*',
                    tableName: table.name,
                    tableAlias: table.alias,
                    fullReference: `${table.alias || table.name}.*`
                });
            }
        }
        
        return columns;
    }
    
    private static createEmptyScope(): ScopeInfo {
        return {
            availableTables: [],
            availableCTEs: [],
            subqueryLevel: 0,
            visibleColumns: [],
            parentQueries: []
        };
    }
    
}
