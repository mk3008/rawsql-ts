// filepath: c:\Users\mssgm\Documents\GitHub\carbunqlex-ts\src\visitors\ColumnReferenceCollector.ts
import { CommonTable, ForClause, FromClause, GroupByClause, HavingClause, LimitClause, OrderByClause, SelectClause, WhereClause, WindowFrameClause } from "../models/Clause";
import { SimpleSelectQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { ArrayExpression, BetweenExpression, BinaryExpression, CaseExpression, CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression, UnaryExpression, ValueComponent } from "../models/ValueComponent";
import { Formatter } from "./Formatter";

/**
 * A visitor that collects all ColumnReference instances from a SQL query structure.
 * This visitor scans through all clauses and collects all unique ColumnReference objects.
 * It does not scan Common Table Expressions (CTEs) or subqueries.
 */
export class ColumnReferenceCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private columnReferenceMap: Map<string, ColumnReference> = new Map();
    private visitedNodes: Set<SqlComponent> = new Set();
    private formatter: Formatter;
    private isRootVisit: boolean = true;

    constructor() {
        this.formatter = new Formatter();
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
    }

    /**
     * Gets a unique string representation of a ColumnReference using the formatter
     * @param columnRef The column reference to convert to string
     * @returns A string representation of the column reference
     */
    private getColumnReferenceKey(columnRef: ColumnReference): string {
        return columnRef.toSqlString(this.formatter);
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

        // If this is a root visit, we need to reset the state
        this.reset();
        this.isRootVisit = false;

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

    // Helper to process any value component
    private processValueComponent(value: ValueComponent | null): void {
        if (value) {
            value.accept(this);
        }
    }
}