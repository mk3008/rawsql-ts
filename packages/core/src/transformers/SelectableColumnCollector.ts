/**
 * Enum for duplicate detection modes in SelectableColumnCollector.
 * Determines how duplicates are identified during column collection.
 */
export enum DuplicateDetectionMode {
    /**
     * Detect duplicates based only on column names.
     * This mode ignores the table name, so columns with the same name
     * from different tables are considered duplicates.
     */
    ColumnNameOnly = 'columnNameOnly',
    /**
     * Detect duplicates based on both table and column names.
     * This mode ensures that columns with the same name from different
     * tables are treated as distinct.
     */
    FullName = 'fullName',
}
import { CommonTable, ForClause, FromClause, GroupByClause, HavingClause, LimitClause, OrderByClause, SelectClause, WhereClause, WindowFrameClause, WindowsClause, JoinClause, JoinOnClause, JoinUsingClause, TableSource, SubQuerySource, SourceExpression, SelectItem, PartitionByClause, FetchClause, OffsetClause, ParenSource } from "../models/Clause";
import { SimpleSelectQuery, BinarySelectQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { ArrayExpression, ArrayQueryExpression, BetweenExpression, BinaryExpression, CaseExpression, CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression, UnaryExpression, ValueComponent, ValueList, WindowFrameExpression, IdentifierString } from "../models/ValueComponent";
import { CTECollector } from "./CTECollector";
import { SelectValueCollector } from "./SelectValueCollector";
import { TableColumnResolver } from "./TableColumnResolver";

/**
 * A visitor that collects all ColumnReference instances from SQL query structures.
 * This visitor scans through all clauses and collects all unique ColumnReference objects.
 * It supports both regular column collection and upstream column collection for maximum
 * search conditions in DynamicQuery scenarios.
 * 
 * Supported query types:
 * - SimpleSelectQuery: Basic SELECT queries with all standard clauses
 * - BinarySelectQuery: UNION, INTERSECT, EXCEPT queries (collects from both sides)
 * - Common Table Expressions (CTEs) within queries
 * - Subqueries and nested queries
 * 
 * Behavioral notes:
 * - Collects column references to tables defined in the root FROM/JOIN clauses
 * - For aliased columns (e.g., 'title as name'), collects both the original column 
 *   reference ('title') AND the alias ('name') to enable complete dependency tracking
 * - When upstream option is enabled, collects all available columns from upstream sources
 *   (CTEs, subqueries, and tables) for maximum search conditions in DynamicQuery
 * - Automatically removes duplicates based on the specified duplicate detection mode
 * 
 * Use cases:
 * - Dependency analysis and schema migration tools
 * - Column usage tracking across complex queries including unions and CTEs
 * - Security analysis for column-level access control
 * - DynamicQuery maximum search condition column discovery
 * 
 * @example
 * ```typescript
 * // Basic usage - collect only referenced columns
 * const collector = new SelectableColumnCollector();
 * const columns = collector.collect(query);
 * 
 * // With upstream collection for DynamicQuery
 * const upstreamCollector = new SelectableColumnCollector(
 *   null, false, DuplicateDetectionMode.ColumnNameOnly, 
 *   { upstream: true }
 * );
 * const allColumns = upstreamCollector.collect(query);
 * 
 * // Works with union queries and CTEs
 * const unionQuery = SelectQueryParser.parse(`
 *   SELECT name, email FROM users 
 *   UNION 
 *   SELECT name, email FROM customers
 * `);
 * const unionColumns = collector.collect(unionQuery);
 * ```
 */
export class SelectableColumnCollector implements SqlComponentVisitor<void> {
    private handlers!: Map<symbol, (arg: any) => void>;
    private selectValues: { name: string, value: ValueComponent }[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();
    private uniqueKeys: Set<string> = new Set();
    private isRootVisit: boolean = true;
    private tableColumnResolver: TableColumnResolver | null = null;
    private commonTableCollector!: CTECollector;
    private commonTables: CommonTable[] = [];
    private includeWildCard!: boolean; // This option controls whether wildcard columns are included in the collection.
    private duplicateDetection!: DuplicateDetectionMode;
    private options!: { ignoreCaseAndUnderscore?: boolean; upstream?: boolean };

    /**
     * Creates a new instance of SelectableColumnCollector.
     *
     * @param {TableColumnResolver | null} [tableColumnResolver=null] - The resolver used to resolve column references to their respective tables.
     * @param {boolean} [includeWildCard=false] - If true, wildcard columns (e.g., `*`) are included in the collection.
     * @param {DuplicateDetectionMode} [duplicateDetection=DuplicateDetectionMode.ColumnNameOnly] - Specifies the duplicate detection mode: 'columnNameOnly' (default, only column name is used), or 'fullName' (table name + column name).
     * @param {Object} [options={}] - Additional options for the collector.
     * @param {boolean} [options.ignoreCaseAndUnderscore=false] - If true, column names are compared without considering case and underscores.
     * @param {boolean} [options.upstream=false] - If true, collect all columns available from upstream sources for maximum search conditions in DynamicQuery.
     */
    constructor(
        tableColumnResolver?: TableColumnResolver | null,
        includeWildCard: boolean = false,
        duplicateDetection: DuplicateDetectionMode = DuplicateDetectionMode.ColumnNameOnly,
        options?: { ignoreCaseAndUnderscore?: boolean; upstream?: boolean }
    ) {
        this.initializeProperties(tableColumnResolver, includeWildCard, duplicateDetection, options);
        this.initializeHandlers();
    }

    /**
     * Initialize instance properties.
     */
    private initializeProperties(
        tableColumnResolver: TableColumnResolver | null | undefined,
        includeWildCard: boolean,
        duplicateDetection: DuplicateDetectionMode,
        options: { ignoreCaseAndUnderscore?: boolean; upstream?: boolean } | undefined
    ): void {
        this.tableColumnResolver = tableColumnResolver ?? null;
        this.includeWildCard = includeWildCard;
        this.commonTableCollector = new CTECollector();
        this.commonTables = [];
        this.duplicateDetection = duplicateDetection;
        this.options = options || {};
    }

    /**
     * Initialize the handler map for different SQL component types.
     */
    private initializeHandlers(): void {
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Main entry point handlers
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));

        // Clause handlers
        this.initializeClauseHandlers();
        
        // Value component handlers
        this.initializeValueComponentHandlers();
    }

    /**
     * Initialize handlers for SQL clause types.
     */
    private initializeClauseHandlers(): void {
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(OffsetClause.kind, (expr) => this.offsetClause(expr as OffsetClause));
        this.handlers.set(FetchClause.kind, (expr) => this.visitFetchClause(expr as FetchClause));

        // JOIN condition handlers
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));
    }

    /**
     * Initialize handlers for value component types.
     */
    private initializeValueComponentHandlers(): void {
        this.handlers.set(ColumnReference.kind, (expr) => this.visitColumnReference(expr as ColumnReference));
        this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
        this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
        this.handlers.set(ArrayQueryExpression.kind, (expr) => this.visitArrayQueryExpression(expr as ArrayQueryExpression));
        this.handlers.set(ValueList.kind, (expr) => this.visitValueList(expr as ValueList));
        this.handlers.set(WindowFrameExpression.kind, (expr) => this.visitWindowFrameExpression(expr as WindowFrameExpression));
        this.handlers.set(PartitionByClause.kind, (expr) => this.visitPartitionByClause(expr as PartitionByClause));
    }

    public getValues(): { name: string, value: ValueComponent }[] {
        return this.selectValues;
    }

    public collect(arg: SqlComponent): { name: string, value: ValueComponent }[] {
        // Input validation
        if (!arg) {
            throw new Error("Input argument cannot be null or undefined");
        }
        
        // Visit the component and return the collected select items
        this.visit(arg);
        const items = this.getValues();
        this.reset(); // Reset after collection
        return items;
    }

    /**
     * Reset the collection of ColumnReferences
     */
    private reset(): void {
        this.selectValues = []
        this.visitedNodes.clear();
        this.uniqueKeys.clear();
        this.commonTables = [];
    }

    /**
     * Add a select value as unique, according to the duplicate detection option.
     * Uses efficient Set-based duplicate detection for better performance.
     */
    private addSelectValueAsUnique(name: string, value: ValueComponent): void {
        const key = this.generateUniqueKey(name, value);
        
        if (!this.uniqueKeys.has(key)) {
            this.uniqueKeys.add(key);
            this.selectValues.push({ name, value });
        }
    }

    /**
     * Generate a unique key based on the duplicate detection mode.
     */
    private generateUniqueKey(name: string, value: ValueComponent): string {
        if (this.duplicateDetection === DuplicateDetectionMode.ColumnNameOnly) {
            // Apply case and underscore normalization if specified
            return this.normalizeColumnName(name);
        } else {
            // FullName mode: include table name
            let tableName = '';
            if (value && typeof (value as any).getNamespace === 'function') {
                tableName = (value as any).getNamespace() || '';
            }
            const fullName = tableName ? tableName + '.' + name : name;
            return this.normalizeColumnName(fullName);
        }
    }

    /**
     * Normalize column name based on options.
     * Ensures safe string handling to prevent injection attacks.
     */
    private normalizeColumnName(name: string): string {
        if (typeof name !== 'string') {
            throw new Error("Column name must be a string");
        }
        
        if (this.options.ignoreCaseAndUnderscore) {
            return name.toLowerCase().replace(/_/g, '');
        }
        return name;
    }

    /**
     * Main entry point for the visitor pattern.
     * Implements the shallow visit pattern to distinguish between root and recursive visits.
     */
    public visit(arg: SqlComponent): void {
        // If not a root visit, just visit the node and return
        if (!this.isRootVisit) {
            this.visitNode(arg);
            return;
        }

        if (!(arg instanceof SimpleSelectQuery || arg instanceof BinarySelectQuery)) {
            throw new Error("Root visit requires a SimpleSelectQuery or BinarySelectQuery.");
        }

        // If this is a root visit, we need to reset the state
        this.reset();
        this.isRootVisit = false;
        this.commonTables = this.commonTableCollector.collect(arg);

        try {
            this.visitNode(arg);
        } finally {
            // Regardless of success or failure, reset the root visit flag
            this.isRootVisit = true;
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

        try {
            const handler = this.handlers.get(arg.getKind());
            if (handler) {
                handler(arg);
            }
            // For any other component types, we don't need to do anything
        } catch (error) {
            // Re-throw with additional context
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Error processing SQL component of type ${arg.getKind().toString()}: ${errorMessage}`);
        }
    }

    /**
      * Process a SimpleSelectQuery to collect ColumnReferences from all its clauses
      */
    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        // Visit all clauses that might contain column references
        if (query.selectClause) {
            query.selectClause.accept(this);
        }

        if (query.fromClause) {
            query.fromClause.accept(this);
        }

        if (query.whereClause) {
            query.whereClause.accept(this);
        }

        if (query.groupByClause) {
            query.groupByClause.accept(this);
        }

        if (query.havingClause) {
            query.havingClause.accept(this);
        }

        if (query.windowClause) {
            for (const win of query.windowClause.windows) {
                win.accept(this);
            }
        }

        if (query.orderByClause) {
            query.orderByClause.accept(this);
        }

        if (query.limitClause) {
            query.limitClause.accept(this);
        }

        if (query.offsetClause) {
            query.offsetClause.accept(this);
        }

        if (query.fetchClause) {
            query.fetchClause.accept(this);
        }
        if (query.forClause) {
            query.forClause.accept(this);
        }
        // Explicitly NOT processing query.WithClause to avoid scanning CTEs
    }

    /**
     * Process a BinarySelectQuery (UNION, INTERSECT, EXCEPT) to collect ColumnReferences from both sides
     */
    private visitBinarySelectQuery(query: BinarySelectQuery): void {
        // Collect from the left side
        if (query.left instanceof SimpleSelectQuery) {
            this.visitSimpleSelectQuery(query.left);
        } else if (query.left instanceof BinarySelectQuery) {
            this.visitBinarySelectQuery(query.left);
        }

        // Collect from the right side
        if (query.right instanceof SimpleSelectQuery) {
            this.visitSimpleSelectQuery(query.right);
        } else if (query.right instanceof BinarySelectQuery) {
            this.visitBinarySelectQuery(query.right);
        }
    }

    // Clause handlers
    private visitSelectClause(clause: SelectClause): void {
        for (const item of clause.items) {
            if (item.identifier) {
                this.addSelectValueAsUnique(item.identifier.name, item.value);
            }
            item.value.accept(this);
        }
    }

    private visitFromClause(clause: FromClause): void {
        // import source values
        const collector = new SelectValueCollector(this.tableColumnResolver, this.commonTables);
        const sourceValues = collector.collect(clause);
        for (const item of sourceValues) {
            // Add the select value as unique to avoid duplicates
            this.addSelectValueAsUnique(item.name, item.value);
        }

        // If upstream option is enabled, collect all available columns from upstream sources
        if (this.options.upstream) {
            this.collectUpstreamColumns(clause);
        }

        if (clause.joins) {
            for (const join of clause.joins) {
                if (join.condition) {
                    join.condition.accept(this);
                }
            }
        }
    }

    private visitWhereClause(clause: WhereClause): void {
        if (clause.condition) {
            clause.condition.accept(this);
        }
    }

    private visitGroupByClause(clause: GroupByClause): void {
        if (clause.grouping) {
            for (const item of clause.grouping) {
                item.accept(this);
            }
        }
    }

    private visitHavingClause(clause: HavingClause): void {
        if (clause.condition) {
            clause.condition.accept(this);
        }
    }

    private visitOrderByClause(clause: OrderByClause): void {
        if (clause.order) {
            for (const item of clause.order) {
                item.accept(this);
            }
        }
    }

    private visitWindowFrameClause(clause: WindowFrameClause): void {
        clause.expression.accept(this);
    }

    private visitWindowFrameExpression(expr: WindowFrameExpression): void {
        if (expr.partition) {
            expr.partition.accept(this);
        }
        if (expr.order) {
            expr.order.accept(this);
        }
        if (expr.frameSpec) {
            expr.frameSpec.accept(this);
        }
    }

    private visitLimitClause(clause: LimitClause): void {
        if (clause.value) {
            clause.value.accept(this);
        }
    }

    private offsetClause(clause: OffsetClause): void {
        if (clause.value) {
            clause.value.accept(this);
        }
    }

    private visitFetchClause(clause: FetchClause): void {
        if (clause.expression) {
            clause.expression.accept(this);
        }
    }

    private visitJoinOnClause(joinOnClause: JoinOnClause): void {
        // Visit the join condition
        if (joinOnClause.condition) {
            joinOnClause.condition.accept(this);
        }
    }

    private visitJoinUsingClause(joinUsingClause: JoinUsingClause): void {
        // Visit the columns in the USING clause
        if (joinUsingClause.condition) {
            joinUsingClause.condition.accept(this);
        }
    }

    // Value component handlers
    private visitColumnReference(columnRef: ColumnReference): void {
        if (columnRef.column.name !== "*") {
            this.addSelectValueAsUnique(columnRef.column.name, columnRef);
        } else if (!this.includeWildCard) {
            return;
        } else {
            this.addSelectValueAsUnique(columnRef.column.name, columnRef);
        }
    }

    private visitBinaryExpression(expr: BinaryExpression): void {
        // Visit both sides of the expression
        if (expr.left) {
            expr.left.accept(this);
        }
        if (expr.right) {
            expr.right.accept(this);
        }
    }

    private visitUnaryExpression(expr: UnaryExpression): void {
        if (expr.expression) {
            expr.expression.accept(this);
        }
    }

    private visitFunctionCall(func: FunctionCall): void {
        if (func.argument) {
            func.argument.accept(this);
        }
        if (func.over) {
            func.over.accept(this);
        }
    }

    private visitParenExpression(expr: ParenExpression): void {
        if (expr.expression) {
            expr.expression.accept(this);
        }
    }

    private visitCaseExpression(expr: CaseExpression): void {
        if (expr.condition) {
            expr.condition.accept(this);
        }

        if (expr.switchCase) {
            expr.switchCase.accept(this);
        }
    }

    private visitCastExpression(expr: CastExpression): void {
        if (expr.input) {
            expr.input.accept(this);
        }
    }

    private visitBetweenExpression(expr: BetweenExpression): void {
        if (expr.expression) {
            expr.expression.accept(this);
        }

        if (expr.lower) {
            expr.lower.accept(this);
        }

        if (expr.upper) {
            expr.upper.accept(this);
        }
    }

    private visitArrayExpression(expr: ArrayExpression): void {
        if (expr.expression) {
            expr.expression.accept(this);
        }
    }

    private visitArrayQueryExpression(expr: ArrayQueryExpression): void {
        expr.query.accept(this);
    }

    private visitValueList(expr: ValueList): void {
        if (expr.values) {
            for (const value of expr.values) {
                value.accept(this);
            }
        }
    }

    private visitPartitionByClause(clause: PartitionByClause): void {
        clause.value.accept(this);
    }

    /**
     * Collect all upstream columns available for DynamicQuery maximum search conditions.
     * This includes columns from CTEs, subqueries, and tables that can be used for filtering.
     */
    private collectUpstreamColumns(clause: FromClause): void {
        // Collect columns from primary source
        this.collectUpstreamColumnsFromSource(clause.source);

        // Collect columns from JOIN sources
        if (clause.joins) {
            for (const join of clause.joins) {
                this.collectUpstreamColumnsFromSource(join.source);
            }
        }
    }

    /**
     * Collect upstream columns from a specific source (table, subquery, or CTE).
     */
    private collectUpstreamColumnsFromSource(source: SourceExpression): void {
        if (source.datasource instanceof TableSource) {
            // Check if this is a CTE reference first
            const cteTable = this.findCTEByName(source.datasource.table.name);
            
            if (cteTable) {
                this.collectUpstreamColumnsFromCTE(cteTable);
            } else {
                // For regular table sources, use table column resolver if available
                this.collectUpstreamColumnsFromTable(source.datasource);
            }
        } else if (source.datasource instanceof SubQuerySource) {
            // For subquery sources, collect columns from the subquery
            this.collectUpstreamColumnsFromSubquery(source.datasource);
        } else if (source.datasource instanceof ParenSource) {
            // For parenthesized sources, recursively collect
            this.collectUpstreamColumnsFromSource(new SourceExpression(source.datasource.source, null));
        }
    }

    /**
     * Collect upstream columns from a table source using table column resolver.
     */
    private collectUpstreamColumnsFromTable(tableSource: TableSource): void {
        if (this.tableColumnResolver) {
            const tableName = tableSource.table.name;
            const columns = this.tableColumnResolver(tableName);
            for (const columnName of columns) {
                // Create a column reference for each available column
                const columnRef = new ColumnReference(
                    tableSource.table.name,
                    columnName
                );
                this.addSelectValueAsUnique(columnName, columnRef);
            }
        }
    }

    /**
     * Collect upstream columns from a subquery source.
     */
    private collectUpstreamColumnsFromSubquery(subquerySource: SubQuerySource): void {
        if (subquerySource.query instanceof SimpleSelectQuery) {
            // Create a new collector for the subquery
            const subqueryCollector = new SelectableColumnCollector(
                this.tableColumnResolver,
                this.includeWildCard,
                this.duplicateDetection,
                { ...this.options, upstream: true }
            );
            
            // Collect columns from the subquery
            const subqueryColumns = subqueryCollector.collect(subquerySource.query);
            
            // Add all columns from the subquery
            for (const item of subqueryColumns) {
                this.addSelectValueAsUnique(item.name, item.value);
            }
        }
    }

    /**
     * Collect upstream columns from a CTE.
     */
    private collectUpstreamColumnsFromCTE(cteTable: CommonTable): void {
        if (cteTable.query instanceof SimpleSelectQuery) {
            // Use SelectValueCollector to get the columns defined in the CTE's SELECT clause
            const cteCollector = new SelectValueCollector(this.tableColumnResolver, this.commonTables);
            const cteColumns = cteCollector.collect(cteTable.query.selectClause);
            
            // Add all columns from the CTE
            for (const item of cteColumns) {
                this.addSelectValueAsUnique(item.name, item.value);
            }
        }
    }

    /**
     * Find a CTE by name in the common tables.
     */
    private findCTEByName(name: string): CommonTable | null {
        return this.commonTables.find(cte => cte.getSourceAliasName() === name) || null;
    }
}