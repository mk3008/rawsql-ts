import { SqlComponent, SqlComponentVisitor } from '../models/SqlComponent';
import { CommonTable, SubQuerySource, TableSource } from '../models/Clause';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { CTECollector } from './CTECollector';
import { SelectableColumnCollector, DuplicateDetectionMode } from './SelectableColumnCollector';
import { ColumnReference, ValueComponent } from '../models/ValueComponent';
import { BinarySelectQuery } from '../models/SelectQuery';
import { SourceExpression } from '../models/Clause';
import { TableColumnResolver } from './TableColumnResolver';

export class TableSchema {
    public name: string;
    public columns: string[];

    constructor(name: string, columns: string[]) {
        this.name = name;
        this.columns = columns;
    }
}

export interface SchemaAnalysisResult {
    success: boolean;
    schemas: TableSchema[];
    unresolvedColumns: string[];
    error?: string;
}

/**
 * A visitor that collects schema information (table names and column names) from a SQL query structure.
 */
export class SchemaCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;

    private tableSchemas: TableSchema[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();
    private commonTables: CommonTable[] = [];
    private running = false;
    
    // For analyze method
    private unresolvedColumns: string[] = [];
    private analysisError: string | undefined = undefined;
    private isAnalyzeMode = false;

    constructor(
        private tableColumnResolver: TableColumnResolver | null = null,
        private allowWildcardWithoutResolver: boolean = false
    ) {
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Setup handlers for query components
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
    }

    /**
     * Collects schema information (table names and column names) from a SQL query structure.
     * This method ensures that the collected schema information is unique and sorted.
     * The resulting schemas and columns are sorted alphabetically to ensure deterministic ordering.
     *
     * @param arg The SQL query structure to analyze.
     */
    public collect(arg: SqlComponent): TableSchema[] {
        this.visit(arg);
        return this.tableSchemas;
    }

    /**
     * Analyzes schema information from a SQL query structure without throwing errors.
     * Returns a result object containing successfully resolved schemas, unresolved columns,
     * and error information if any issues were encountered.
     *
     * @param arg The SQL query structure to analyze.
     * @returns Analysis result containing schemas, unresolved columns, and success status.
     */
    public analyze(arg: SqlComponent): SchemaAnalysisResult {
        // Set analyze mode flag
        this.isAnalyzeMode = true;
        
        try {
            this.visit(arg);
            
            // If we got here without errors, it's a success
            return {
                success: this.unresolvedColumns.length === 0 && !this.analysisError,
                schemas: this.tableSchemas,
                unresolvedColumns: this.unresolvedColumns,
                error: this.analysisError
            };
        } finally {
            // Reset analyze mode flag
            this.isAnalyzeMode = false;
        }
    }

    /**
     * Main entry point for the visitor pattern.
     * Implements the shallow visit pattern to distinguish between root and recursive visits.
     *
     * This method ensures that schema information is collected uniquely and sorted.
     * The resulting schemas and columns are sorted alphabetically to ensure deterministic ordering.
     *
     * @param arg The SQL component to visit.
     */
    public visit(arg: SqlComponent): void {
        // If not a root visit, just visit the node and return
        if (this.running) {
            this.visitNode(arg);
            return;
        }

        // If this is a root visit, we need to reset the state
        this.reset();
        this.running = true;

        try {
            // Ensure the argument is a SelectQuery
            if (!(arg instanceof SimpleSelectQuery || arg instanceof BinarySelectQuery)) {
                throw new Error(`Unsupported SQL component type for schema collection. Received: ${arg.constructor.name}. Expected: SimpleSelectQuery or BinarySelectQuery.`);
            }

            // Collects Common Table Expressions (CTEs) using CTECollector
            const cteCollector = new CTECollector();
            this.commonTables = cteCollector.collect(arg);

            this.visitNode(arg);

            // Consolidate tableSchemas
            this.consolidateTableSchemas();
        } finally {
            // Regardless of success or failure, reset the root visit flag
            this.running = false;
        }
    }

    /**
     * Internal visit method used for all nodes.
     * This separates the visit flag management from the actual node visitation logic.
     */
    private visitNode(arg: SqlComponent): void {
        // Skip if we've already visited this node to prevent infinite recursion
        if (this.visitedNodes.has(arg)) {
            return;
        }

        // Mark as visited
        this.visitedNodes.add(arg);

        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            handler(arg);
            return;
        }

        // If no handler found, that's ok - we only care about specific components
    }

    /**
     * Resets the state of the collector for a new root visit.
     */
    private reset(): void {
        this.tableSchemas = [];
        this.visitedNodes = new Set();
        this.commonTables = [];
        this.unresolvedColumns = [];
        this.analysisError = undefined;
    }

    /**
     * Consolidates table schemas by merging columns for tables with the same name.
     * This ensures that each table name appears only once in the final schema list,
     * with all its columns combined while removing duplicates.
     *
     * Note: The resulting schemas and columns are sorted alphabetically to ensure deterministic ordering.
     */
    private consolidateTableSchemas(): void {
        const consolidatedSchemas: Map<string, Set<string>> = new Map();

        for (const schema of this.tableSchemas) {
            if (!consolidatedSchemas.has(schema.name)) {
                consolidatedSchemas.set(schema.name, new Set(schema.columns));
            } else {
                const existingColumns = consolidatedSchemas.get(schema.name);
                schema.columns.forEach(column => existingColumns?.add(column));
            }
        }

        this.tableSchemas = Array.from(consolidatedSchemas.entries())
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB)) // Sort by table name
            .map(([name, columns]) => {
                return new TableSchema(name, Array.from(columns).sort()); // Sort columns alphabetically
            });
    }

    private handleSourceExpression(source: SourceExpression, queryColumns: { table: string, column: string }[], includeUnnamed: boolean): void {
        if (source.datasource instanceof TableSource) {
            const tableName = source.datasource.getSourceName();
            const cte = this.commonTables.filter((table) => table.getSourceAliasName() === tableName);
            if (cte.length > 0) {
                // Process the CTE query recursively
                cte[0].query.accept(this);
                
                // Also collect schema information for the CTE itself
                const cteAlias = source.getAliasName() ?? tableName;
                this.processCTETableSchema(cte[0], cteAlias, queryColumns, includeUnnamed);
            } else {
                const tableAlias = source.getAliasName() ?? tableName;
                this.processCollectTableSchema(tableName, tableAlias, queryColumns, includeUnnamed);
            }
        } else if (source.datasource instanceof SubQuerySource) {
            // Process subqueries recursively
            this.visitNode(source.datasource.query);
            
            // For subqueries, we don't add schema information directly as they're derived
            // The schema will be collected from the inner query
        } else {
            // For other source types (FunctionSource, ParenSource), we skip schema collection
            // as they don't represent table schemas in the traditional sense
        }
    }

    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        if (query.fromClause === null) {
            return;
        }

        // Collect columns used in the query
        const columnCollector = new SelectableColumnCollector(this.tableColumnResolver, true, DuplicateDetectionMode.FullName);
        const columns = columnCollector.collect(query);
        
        let queryColumns: { table: string, column: string }[];
        
        // Only filter JOIN condition columns when allowWildcardWithoutResolver is true
        // This preserves backward compatibility for existing tests
        if (this.allowWildcardWithoutResolver) {
            // Filter to include only columns that are actually selected, not those used in JOIN conditions
            const selectColumns = this.getSelectClauseColumns(query);
            
            queryColumns = columns.filter((column) => column.value instanceof ColumnReference)
                .map(column => column.value as ColumnReference)
                .filter(columnRef => {
                    // Only include columns that are either:
                    // 1. Explicitly mentioned in SELECT clause (not wildcards)
                    // 2. Part of wildcard expansion from SELECT clause (only if we have a resolver)
                    const tableName = columnRef.getNamespace();
                    const columnName = columnRef.column.name;
                    
                    return selectColumns.some(selectCol => {
                        if (selectCol.value instanceof ColumnReference) {
                            const selectTableName = selectCol.value.getNamespace();
                            const selectColumnName = selectCol.value.column.name;
                            
                            // Exact match for explicit columns
                            if (selectTableName === tableName && selectColumnName === columnName) {
                                return true;
                            }
                            
                            // Wildcard match (table.* or *) - only include if we have a resolver
                            if (selectColumnName === "*") {
                                // If allowWildcardWithoutResolver is true and no resolver, exclude wildcard expansions
                                if (this.allowWildcardWithoutResolver && this.tableColumnResolver === null) {
                                    return false;
                                }
                                
                                // Full wildcard (*) matches all tables
                                if (selectTableName === "") {
                                    return true;
                                }
                                // Table wildcard (table.*) matches specific table
                                if (selectTableName === tableName) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    });
                })
                .map(columnRef => ({
                    table: columnRef.getNamespace(),
                    column: columnRef.column.name
                }));
        } else {
            // Original behavior: include all columns including JOIN conditions
            queryColumns = columns.filter((column) => column.value instanceof ColumnReference)
                .map(column => column.value as ColumnReference)
                .map(columnRef => ({
                    table: columnRef.getNamespace(),
                    column: columnRef.column.name
                }));
        }

        // Handle columns without table names in queries with joins
        if (query.fromClause.joins !== null && query.fromClause.joins.length > 0) {
            const columnsWithoutTable = queryColumns.filter((columnRef) => columnRef.table === "").map((columnRef) => columnRef.column);
            if (columnsWithoutTable.length > 0) {
                if (this.isAnalyzeMode) {
                    // In analyze mode, collect unresolved columns
                    this.unresolvedColumns.push(...columnsWithoutTable);
                    this.analysisError = `Column reference(s) without table name found in query: ${columnsWithoutTable.join(', ')}`;
                } else {
                    // In collect mode, throw error as before
                    throw new Error(`Column reference(s) without table name found in query: ${columnsWithoutTable.join(', ')}`);
                }
            }
        }

        // Handle the main FROM clause table
        if (query.fromClause.source.datasource instanceof TableSource) {
            this.handleSourceExpression(query.fromClause.source, queryColumns, true);
        } else if (query.fromClause.source.datasource instanceof SubQuerySource) {
            query.fromClause.source.datasource.query.accept(this);
        }

        // Handle JOIN clause tables
        if (query.fromClause?.joins) {
            for (const join of query.fromClause.joins) {
                if (join.source.datasource instanceof TableSource) {
                    this.handleSourceExpression(join.source, queryColumns, false);
                } else if (join.source.datasource instanceof SubQuerySource) {
                    join.source.datasource.query.accept(this);
                }
            }
        }
    }

    private visitBinarySelectQuery(query: BinarySelectQuery): void {
        // Visit the left and right queries
        this.visitNode(query.left);
        this.visitNode(query.right);
    }

    /**
     * Extract column references from the SELECT clause only
     */
    private getSelectClauseColumns(query: SimpleSelectQuery): { name: string, value: ValueComponent }[] {
        if (!query.selectClause) {
            return [];
        }
        
        const selectColumns: { name: string, value: ValueComponent }[] = [];
        
        for (const item of query.selectClause.items) {
            if (item.value instanceof ColumnReference) {
                const columnName = item.value.column.name;
                selectColumns.push({ name: columnName, value: item.value });
            }
        }
        
        return selectColumns;
    }


    private processCollectTableSchema(tableName: string, tableAlias: string, queryColumns: { table: string, column: string }[], includeUnnamed: boolean = false): void {
        // Check if wildcard is present and handle based on configuration
        if (this.tableColumnResolver === null) {
            const hasWildcard = queryColumns
                .filter((columnRef) => columnRef.table === tableAlias || (includeUnnamed && columnRef.table === ""))
                .filter((columnRef) => columnRef.column === "*")
                .length > 0;
            
            // Handle error if wildcard is found and allowWildcardWithoutResolver is false (default behavior)
            if (hasWildcard && !this.allowWildcardWithoutResolver) {
                const errorMessage = tableName
                    ? `Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards. Target table: ${tableName}`
                    : "Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards.";
                
                if (this.isAnalyzeMode) {
                    // In analyze mode, record the error but continue processing
                    this.analysisError = errorMessage;
                    // Add wildcard columns to unresolved list
                    const wildcardColumns = queryColumns
                        .filter((columnRef) => columnRef.table === tableAlias || (includeUnnamed && columnRef.table === ""))
                        .filter((columnRef) => columnRef.column === "*")
                        .map((columnRef) => columnRef.table ? `${columnRef.table}.*` : "*");
                    this.unresolvedColumns.push(...wildcardColumns);
                } else {
                    // In collect mode, throw error as before
                    throw new Error(errorMessage);
                }
            }
        }

        let tableColumns = queryColumns
            .filter((columnRef) => columnRef.column !== "*")
            .filter((columnRef) => columnRef.table === tableAlias || (includeUnnamed && columnRef.table === ""))
            .map((columnRef) => columnRef.column);

        const tableSchema = new TableSchema(tableName, tableColumns);
        this.tableSchemas.push(tableSchema);
    }

    private processCTETableSchema(cte: CommonTable, cteAlias: string, queryColumns: { table: string, column: string }[], includeUnnamed: boolean = false): void {
        const cteName = cte.getSourceAliasName();
        
        // Get the columns that the CTE exposes by analyzing its SELECT clause
        const cteColumns = this.getCTEColumns(cte);
        
        // Filter query columns that reference this CTE
        const cteReferencedColumns = queryColumns
            .filter((columnRef) => columnRef.table === cteAlias || (includeUnnamed && columnRef.table === ""))
            .map((columnRef) => columnRef.column);

        // Handle wildcards for CTEs
        if (cteReferencedColumns.includes("*")) {
            if (this.tableColumnResolver !== null) {
                // Try to resolve columns using the resolver first
                const resolvedColumns = this.tableColumnResolver(cteName);
                if (resolvedColumns.length > 0) {
                    const tableSchema = new TableSchema(cteName, resolvedColumns);
                    this.tableSchemas.push(tableSchema);
                    return;
                }
            }
            
            // If we can determine CTE columns, use them for wildcard expansion
            if (cteColumns.length > 0) {
                const tableSchema = new TableSchema(cteName, cteColumns);
                this.tableSchemas.push(tableSchema);
                return;
            } else if (this.allowWildcardWithoutResolver) {
                // Allow wildcards but with empty columns since we can't determine them
                const tableSchema = new TableSchema(cteName, []);
                this.tableSchemas.push(tableSchema);
                return;
            } else {
                // Handle wildcard error
                const errorMessage = `Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards. Target table: ${cteName}`;
                if (this.isAnalyzeMode) {
                    this.analysisError = errorMessage;
                    this.unresolvedColumns.push(cteAlias ? `${cteAlias}.*` : "*");
                } else {
                    throw new Error(errorMessage);
                }
                return;
            }
        }

        // Process specific column references
        let tableColumns = cteReferencedColumns.filter((column) => column !== "*");
        
        // Validate column references against CTE columns in analyze mode
        if (this.isAnalyzeMode) {
            let availableColumns = cteColumns;
            
            // Try to get columns from resolver first if available
            if (this.tableColumnResolver) {
                const resolvedColumns = this.tableColumnResolver(cteName);
                if (resolvedColumns.length > 0) {
                    availableColumns = resolvedColumns;
                }
            }
            
            // Only validate columns if we have available columns to validate against
            // If allowWildcardWithoutResolver is true and we have no available columns,
            // skip validation as the wildcard expansion couldn't be determined
            if (availableColumns.length > 0) {
                const invalidColumns = tableColumns.filter((column) => !availableColumns.includes(column));
                if (invalidColumns.length > 0) {
                    this.unresolvedColumns.push(...invalidColumns);
                    if (!this.analysisError) {
                        this.analysisError = `Undefined column(s) found in CTE "${cteName}": ${invalidColumns.join(', ')}`;
                    }
                }
            } else if (!this.allowWildcardWithoutResolver) {
                // Only report error if wildcards are not allowed without resolver
                const invalidColumns = tableColumns;
                if (invalidColumns.length > 0) {
                    this.unresolvedColumns.push(...invalidColumns);
                    if (!this.analysisError) {
                        this.analysisError = `Undefined column(s) found in CTE "${cteName}": ${invalidColumns.join(', ')}`;
                    }
                }
            }
        }

        // Add the CTE schema
        const tableSchema = new TableSchema(cteName, tableColumns);
        this.tableSchemas.push(tableSchema);
    }

    private getCTEColumns(cte: CommonTable): string[] {
        try {
            if (cte.query instanceof SimpleSelectQuery && cte.query.selectClause) {
                return this.extractColumnsFromSelectItems(cte.query.selectClause.items, cte);
            }
            
            return this.extractColumnsUsingCollector(cte.query);
        } catch (error) {
            return [];
        }
    }

    private extractColumnsFromSelectItems(selectItems: any[], cte: CommonTable): string[] {
        const columns: string[] = [];
        
        for (const item of selectItems) {
            if (item.value instanceof ColumnReference) {
                const columnName = item.identifier?.name || item.value.column.name;
                
                if (item.value.column.name === "*") {
                    const wildcardColumns = this.resolveWildcardInCTE(item.value, cte);
                    if (wildcardColumns === null) {
                        return []; // Wildcard couldn't be resolved
                    }
                    columns.push(...wildcardColumns);
                } else {
                    columns.push(columnName);
                }
            } else if (item.identifier) {
                columns.push(item.identifier.name);
            }
        }
        
        return this.removeDuplicates(columns);
    }

    private resolveWildcardInCTE(columnRef: ColumnReference, cte: CommonTable): string[] | null {
        const tableNamespace = columnRef.getNamespace();
        
        if (tableNamespace) {
            return this.resolveQualifiedWildcard(tableNamespace);
        } else {
            return this.resolveUnqualifiedWildcard(cte);
        }
    }

    private resolveQualifiedWildcard(tableNamespace: string): string[] | null {
        const referencedCTE = this.commonTables.find(cte => cte.getSourceAliasName() === tableNamespace);
        if (referencedCTE) {
            const referencedColumns = this.getCTEColumns(referencedCTE);
            if (referencedColumns.length > 0) {
                return referencedColumns;
            }
        }
        return null;
    }

    private resolveUnqualifiedWildcard(cte: CommonTable): string[] | null {
        if (!(cte.query instanceof SimpleSelectQuery) || !cte.query.fromClause) {
            return null;
        }

        const fromSource = cte.query.fromClause.source;
        
        if (fromSource.datasource instanceof TableSource) {
            return this.resolveTableWildcard(fromSource.datasource.table.name);
        } else if (fromSource.datasource instanceof SubQuerySource) {
            return null; // Too complex to resolve
        }
        
        return null;
    }

    private resolveTableWildcard(tableName: string): string[] | null {
        if (this.tableColumnResolver) {
            const resolvedColumns = this.tableColumnResolver(tableName);
            if (resolvedColumns.length > 0) {
                return resolvedColumns;
            }
        }
        
        // If allowWildcardWithoutResolver is true, return null to indicate unknown columns
        return this.allowWildcardWithoutResolver ? null : null;
    }

    private extractColumnsUsingCollector(query: any): string[] {
        const columnCollector = new SelectableColumnCollector(null, true, DuplicateDetectionMode.FullName);
        const columns = columnCollector.collect(query);
        
        return columns
            .filter((column) => column.value instanceof ColumnReference)
            .map(column => column.value as ColumnReference)
            .map(columnRef => columnRef.column.name)
            .filter((name, index, array) => array.indexOf(name) === index);
    }

    private removeDuplicates(columns: string[]): string[] {
        return columns.filter((name, index, array) => array.indexOf(name) === index);
    }
}
