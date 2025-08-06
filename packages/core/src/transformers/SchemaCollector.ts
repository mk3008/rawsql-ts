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

        const queryColumns = this.collectQueryColumns(query);
        this.validateColumnsInJoinQueries(query, queryColumns);
        this.processFromClause(query, queryColumns);
        this.processJoinClauses(query, queryColumns);
    }

    private visitBinarySelectQuery(query: BinarySelectQuery): void {
        // Visit the left and right queries
        this.visitNode(query.left);
        this.visitNode(query.right);
    }

    /**
     * Collects column references from a query's SELECT clause and other relevant clauses
     */
    private collectQueryColumns(query: SimpleSelectQuery): { table: string, column: string }[] {
        const queryColumns: { table: string, column: string }[] = [];
        
        if (query.selectClause) {
            for (const item of query.selectClause.items) {
                if (item.value instanceof ColumnReference) {
                    const namespace = item.value.getNamespace();
                    queryColumns.push({
                        table: namespace || "",
                        column: item.value.column.name
                    });
                }
            }
        }
        
        return queryColumns;
    }

    /**
     * Validates that columns referenced in JOIN conditions exist in the query
     */
    private validateColumnsInJoinQueries(_query: SimpleSelectQuery, _queryColumns: { table: string, column: string }[]): void {
        // For now, this is a placeholder - actual validation logic would check JOIN conditions
        // against available columns from tables and CTEs
    }

    /**
     * Processes the FROM clause to collect schema information
     */
    private processFromClause(query: SimpleSelectQuery, queryColumns: { table: string, column: string }[]): void {
        if (!query.fromClause) {
            return;
        }

        // Process the main source
        this.handleSourceExpression(query.fromClause.source, queryColumns, false);
    }

    /**
     * Processes JOIN clauses to collect schema information
     */
    private processJoinClauses(query: SimpleSelectQuery, queryColumns: { table: string, column: string }[]): void {
        if (!query.fromClause?.joins) {
            return;
        }

        for (const join of query.fromClause.joins) {
            this.handleSourceExpression(join.source, queryColumns, false);
        }
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

        // For schemas without explicit table prefixes in SELECT clause, include all non-wildcard columns
        // This handles cases like "SELECT id, name FROM users" where columns don't have table prefixes
        let tableColumns = queryColumns
            .filter((columnRef) => columnRef.column !== "*")
            .filter((columnRef) => 
                columnRef.table === tableAlias || 
                (includeUnnamed && columnRef.table === "") ||
                // When table name is not specified in column reference, assume it belongs to the main table
                columnRef.table === ""
            )
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
            
            const invalidColumns = tableColumns.filter((column) => !availableColumns.includes(column));
            if (invalidColumns.length > 0) {
                this.unresolvedColumns.push(...invalidColumns);
                if (!this.analysisError) {
                    this.analysisError = `Undefined column(s) found in CTE "${cteName}": ${invalidColumns.join(', ')}`;
                }
            }
        }

        // Add the CTE schema
        const tableSchema = new TableSchema(cteName, tableColumns);
        this.tableSchemas.push(tableSchema);
    }

    private getCTEColumns(cte: CommonTable): string[] {
        try {
            // Try to get select items from the CTE query
            if (cte.query instanceof SimpleSelectQuery && cte.query.selectClause) {
                const selectItems = cte.query.selectClause.items;
                const columns: string[] = [];
                
                for (const item of selectItems) {
                    if (item.value instanceof ColumnReference) {
                        const columnName = item.identifier?.name || item.value.column.name;
                        if (item.value.column.name === "*") {
                            // For wildcards in CTE definitions, we need special handling
                            const tableNamespace = item.value.getNamespace();
                            if (tableNamespace) {
                                // Try to find the referenced CTE or table
                                const referencedCTE = this.commonTables.find(cte => cte.getSourceAliasName() === tableNamespace);
                                if (referencedCTE) {
                                    // Recursively get columns from the referenced CTE
                                    const referencedColumns = this.getCTEColumns(referencedCTE);
                                    if (referencedColumns.length > 0) {
                                        columns.push(...referencedColumns);
                                        continue;
                                    }
                                }
                            }
                            // If we can't resolve the wildcard, we mark this CTE as having unknown columns
                            // This will be handled by the wildcard processing logic later
                            return [];
                        } else {
                            columns.push(columnName);
                        }
                    } else {
                        // For expressions, functions, etc., use the identifier if available
                        if (item.identifier) {
                            columns.push(item.identifier.name);
                        }
                    }
                }
                
                return columns.filter((name, index, array) => array.indexOf(name) === index); // Remove duplicates
            }
            
            // Fallback: try using SelectableColumnCollector
            const columnCollector = new SelectableColumnCollector(null, true, DuplicateDetectionMode.FullName);
            const columns = columnCollector.collect(cte.query);
            
            return columns
                .filter((column) => column.value instanceof ColumnReference)
                .map(column => column.value as ColumnReference)
                .map(columnRef => columnRef.column.name)
                .filter((name, index, array) => array.indexOf(name) === index); // Remove duplicates
        } catch (error) {
            // If we can't determine the columns, return empty array
            return [];
        }
    }
}
