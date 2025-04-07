// filepath: c:\Users\mssgm\Documents\GitHub\carbunqlex-ts\src\visitors\ColumnReferenceCollector.ts
import { CommonTable, ForClause, FromClause, GroupByClause, HavingClause, LimitClause, OrderByClause, SelectClause, WhereClause, WindowFrameClause, JoinClause, JoinOnClause, JoinUsingClause, TableSource, SubQuerySource, SourceExpression } from "../models/Clause";
import { SimpleSelectQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { ArrayExpression, BetweenExpression, BinaryExpression, CaseExpression, CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression, UnaryExpression, ValueComponent } from "../models/ValueComponent";
import { CommonTableCollector } from "./CommonTableCollector";
import { Formatter } from "./Formatter";
import { SelectValueCollector } from "./SelectValueCollector";

/**
 * A visitor that collects all ColumnReference instances from a SQL query structure.
 * This visitor scans through all clauses and collects all unique ColumnReference objects.
 * It does not scan Common Table Expressions (CTEs) or subqueries.
 * 
 * Important: Only collects column references to tables defined in the root FROM/JOIN clauses,
 * as these are the only columns that can be directly referenced in the query.
 */
export class SelectableColumnCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private columnReferenceMap: Map<string, ColumnReference> = new Map();
    private visitedNodes: Set<SqlComponent> = new Set();
    private formatter: Formatter;
    private isRootVisit: boolean = true;
    private commonTableCollector: CommonTableCollector;
    private selectValueCollector: SelectValueCollector;
    private commonTables: CommonTable[] = [];

    constructor() {
        this.formatter = new Formatter();
        this.selectValueCollector = new SelectValueCollector();
        this.commonTableCollector = new CommonTableCollector();
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Main entry point is the SimpleSelectQuery
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));

        // Handlers for each clause type that might contain column references
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));

        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));

        // Add handlers for JOIN conditions
        this.handlers.set(JoinClause.kind, (expr) => this.visitJoinClause(expr as JoinClause));
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        // For value components that might contain column references
        this.handlers.set(ColumnReference.kind, (expr) => this.visitColumnReference(expr as ColumnReference));
        this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
        this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));

        // Add handler for InlineQuery to process subqueries
        this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));
    }

    /**
     * Get all collected ColumnReferences as an array
     * @returns An array of unique ColumnReference objects
     */
    public getColumnReferences(): ColumnReference[] {
        return Array.from(this.columnReferenceMap.values());
    }

    /**
     * Reset the collection of ColumnReferences
     */
    private reset(): void {
        this.columnReferenceMap.clear();
        this.visitedNodes.clear();
        this.commonTables = [];
    }

    /**
     * Gets a unique string representation of a ColumnReference using the formatter
     * @param columnRef The column reference to convert to string
     * @returns A string representation of the column reference
     */
    private getColumnReferenceKey(columnRef: ColumnReference): string {
        return columnRef.toSqlString(this.formatter);
    }

    public collect(arg: SqlComponent): ColumnReference[] {
        // Visit the component and return the collected column references
        this.visit(arg);
        const columns = this.getColumnReferences();
        return columns;
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

        if (!(arg instanceof SimpleSelectQuery)) {
            throw new Error("Root visit must be a SimpleSelectQuery");
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

        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            handler(arg);
            return;
        }

        // For any other component types, we don't need to do anything
    }

    visitSourceExpression(arg: SourceExpression): void {
        if (arg.datasource instanceof TableSource) {
            // If the source is a table, we need to scan it for column references
            this.scanTableSource(arg.datasource);
        } else if (arg.datasource instanceof SubQuerySource) {
            const sourceName = arg.name?.table.name;
            if (sourceName) {
                const columns = this.selectValueCollector.collect(arg.datasource.query);
                this.addVirtualColumns(sourceName, columns);
            }
        }
    }

    private scanTableSource(arg: TableSource): void {
        // Find the matching CTE in a single pass instead of scanning twice
        const matchingCte = this.commonTables.find(cte =>
            cte.name.table && cte.name.table.name === arg.name.name
        );

        // If a matching CTE was found, visit the query inside the CTE
        if (matchingCte && matchingCte.query) {
            const columns = this.selectValueCollector.collect(matchingCte.query);
            if (columns.length > 0) {
                const sourceName = matchingCte.name.table.name;
                this.addVirtualColumns(sourceName, columns);
            }
        }

        // If it's not a CTE, it's a physical table which can't be processed offline
        // So we do nothing and exit
    }

    /**
     * Adds virtual columns from a source (CTE or subquery) to the column reference map
     * @param sourceName The name of the source
     * @param columns The columns to add
     */
    private addVirtualColumns(sourceName: string, columns: { name: string, value: SqlComponent }[]): void {
        // Use column names as keys to create a Map and eliminate duplicates
        const uniqueColumns = new Map<string, { name: string, value: SqlComponent }>();
        for (const column of columns) {
            uniqueColumns.set(column.name, column);
        }

        // Add deduplicated columns
        for (const column of uniqueColumns.values()) {
            const key = sourceName + '.' + column.name;
            if (!this.columnReferenceMap.has(key)) {
                const val = new ColumnReference([sourceName], column.name);
                this.columnReferenceMap.set(key, val);
            }
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

        if (query.windowFrameClause) {
            query.windowFrameClause.accept(this);
        }

        if (query.orderByClause) {
            query.orderByClause.accept(this);
        }

        if (query.rowLimitClause) {
            query.rowLimitClause.accept(this);
        }

        if (query.forClause) {
            query.forClause.accept(this);
        }

        // Explicitly NOT processing query.WithClause to avoid scanning CTEs
    }

    // Clause handlers
    private visitSelectClause(clause: SelectClause): void {
        if (clause.items) {
            for (const item of clause.items) {
                item.accept(this);
            }
        }
    }

    private visitFromClause(clause: FromClause): void {
        if (clause.source) {
            clause.source.accept(this);
        }

        if (clause.joins) {
            for (const join of clause.joins) {
                join.accept(this);
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
        if (clause.expression) {
            clause.expression.accept(this);
        }
    }

    private visitLimitClause(clause: LimitClause): void {
        if (clause.limit) {
            clause.limit.accept(this);
        }

        if (clause.offset) {
            clause.offset.accept(this);
        }
    }

    private visitForClause(clause: ForClause): void {
        // For clause typically doesn't contain column references
    }

    private visitJoinClause(joinClause: JoinClause): void {
        // Visit the source being joined
        if (joinClause.source) {
            joinClause.source.accept(this);
        }

        // Visit the join condition if it exists
        if (joinClause.condition) {
            joinClause.condition.accept(this);
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
        // Add the column reference to our collection using string representation as key
        const key = this.getColumnReferenceKey(columnRef);
        if (!this.columnReferenceMap.has(key)) {
            this.columnReferenceMap.set(key, columnRef);
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

    private visitInlineQuery(expr: InlineQuery): void {
        // Do not process the InlineQuery's content (subquery content)
        // We only care about column references from tables defined in the root FROM/JOIN clauses

        // Don't collect virtual columns from subqueries anymore
        // This prevents columns like 'user_id' from being collected when they're not part of root tables

        // The only time we should process a subquery's column references is when they reference
        // tables from the main query (like u.id in a WHERE clause inside the subquery)
        // but those will be handled elsewhere when processing the main query context

        // Important: We should NOT collect the subquery's output columns automatically
        // Using SelectComponentCollector was causing extra columns to be collected

        // DELIBERATELY EMPTY - No processing of subquery content
        // This ensures we only collect column references from the main query context
    }
}