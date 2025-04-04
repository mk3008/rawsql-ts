import { CommonTable, CommonTableSource, ForClause, FromClause, GroupByClause, HavingClause, JoinClause, JoinOnClause, JoinUsingClause, LimitClause, OrderByClause, OrderByItem, ParenSource, PartitionByClause, SelectClause, SelectItem, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WithClause } from "./Clause";
import { BinarySelectQuery, SimpleSelectQuery, SelectQuery, ValuesQuery } from "./SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "./SqlComponent";
import {
    ArrayExpression, BetweenExpression, BinaryExpression, CaseExpression, CaseKeyValuePair,
    CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression,
    ParameterExpression, SwitchCaseArgument, TupleExpression, UnaryExpression, ValueComponent,
    OverExpression, WindowFrameExpression, IdentifierString, RawString,
    WindowFrameSpec,
    LiteralValue,
    TypeValue
} from "./ValueComponent";

/**
 * A visitor that collects all CommonTable instances from a SQL query structure.
 * This includes tables from:
 * - WITH clauses
 * - Subqueries
 * - Inline queries
 * - UNION queries
 * - Value components that may contain queries
 */
export class CommonTableCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private commonTables: CommonTable[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();

    constructor() {
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Setup handlers for all component types that might contain CommonTables

        // SelectQuery types
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
        this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));

        // WITH clause that directly contains CommonTables
        this.handlers.set(WithClause.kind, (expr) => this.visitWithClause(expr as WithClause));
        this.handlers.set(CommonTable.kind, (expr) => this.visitCommonTable(expr as CommonTable));

        // SelectComponent types
        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));

        // Identifiers and raw strings (leaf nodes that don't need traversal)
        this.handlers.set(IdentifierString.kind, (expr) => this.visitIdentifierString(expr as IdentifierString));
        this.handlers.set(RawString.kind, (expr) => this.visitRawString(expr as RawString));
        this.handlers.set(ColumnReference.kind, (expr) => this.visitColumnReference(expr as ColumnReference));
        this.handlers.set(ParameterExpression.kind, (expr) => this.visitParameterExpression(expr as ParameterExpression));
        this.handlers.set(LiteralValue.kind, (expr) => this.visitLiteralValue(expr as LiteralValue));

        // Source components
        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));
        this.handlers.set(CommonTableSource.kind, (expr) => this.visitCommonTableSource(expr as CommonTableSource));
        this.handlers.set(ParenSource.kind, (expr) => this.visitParenSource(expr as ParenSource));

        // Subqueries and inline queries
        this.handlers.set(SubQuerySource.kind, (expr) => this.visitSubQuerySource(expr as SubQuerySource));
        this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));

        // FROM and JOIN clauses
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(JoinClause.kind, (expr) => this.visitJoinClause(expr as JoinClause));
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        // WHERE clause
        this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));

        // Value components that might contain subqueries
        this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
        this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        this.handlers.set(CaseKeyValuePair.kind, (expr) => this.visitCaseKeyValuePair(expr as CaseKeyValuePair));
        this.handlers.set(SwitchCaseArgument.kind, (expr) => this.visitSwitchCaseArgument(expr as SwitchCaseArgument));
        this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
        this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
        this.handlers.set(TupleExpression.kind, (expr) => this.visitTupleExpression(expr as TupleExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        this.handlers.set(WindowFrameExpression.kind, (expr) => this.visitWindowFrameExpression(expr as WindowFrameExpression));
        this.handlers.set(WindowFrameSpec.kind, (expr) => this.visitWindowFrameSpec(expr as WindowFrameSpec));
        this.handlers.set(TypeValue.kind, (expr) => this.visitTypeValue(expr as TypeValue));

        // Add handlers for other clause types
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr as OrderByItem));
    }

    /**
     * Get all collected CommonTables
     */
    getCommonTables(): CommonTable[] {
        return this.commonTables;
    }

    /**
     * Reset the collection of CommonTables
     */
    reset(): void {
        this.commonTables = [];
        this.visitedNodes.clear();
    }

    /**
     * Main entry point for the visitor pattern
     */
    visit(arg: SqlComponent): void {
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

        // Provide more detailed error message
        const kindSymbol = arg.getKind()?.toString() || 'unknown';
        const constructor = arg.constructor?.name || 'unknown';
        throw new Error(`No handler for ${constructor} with kind ${kindSymbol}. Consider adding a handler for this type.`);
    }

    visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        // Check WITH clause
        if (query.WithClause) {
            query.WithClause.accept(this);
        }

        // Check SELECT clause
        query.selectClause.accept(this);

        // Check FROM clause
        if (query.fromClause) {
            query.fromClause.accept(this);
        }

        // Check WHERE clause
        if (query.whereClause) {
            query.whereClause.accept(this);
        }

        // Check GROUP BY clause
        if (query.groupByClause) {
            query.groupByClause.accept(this);
        }

        // Check HAVING clause
        if (query.havingClause) {
            query.havingClause.accept(this);
        }

        // Check ORDER BY clause
        if (query.orderByClause) {
            query.orderByClause.accept(this);
        }

        // Check WINDOW clause
        if (query.windowFrameClause) {
            query.windowFrameClause.accept(this);
        }

        // Check LIMIT clause
        if (query.rowLimitClause) {
            query.rowLimitClause.accept(this);
        }

        // Check FOR clause
        if (query.forClause) {
            query.forClause.accept(this);
        }
    }

    visitBinarySelectQuery(query: BinarySelectQuery): void {
        // Visit both sides of the binary query (UNION, EXCEPT, etc.)
        query.left.accept(this);
        query.right.accept(this);
    }

    visitValuesQuery(query: ValuesQuery): void {
        // VALUES queries might contain subqueries in tuple expressions
        for (const tuple of query.tuples) {
            tuple.accept(this);
        }
    }

    visitWithClause(withClause: WithClause): void {
        // Add all common tables from this WITH clause
        for (const commonTable of withClause.tables) {
            this.commonTables.push(commonTable);

            // Also check for nested CommonTables within the CommonTable's query
            commonTable.accept(this);
        }
    }

    visitCommonTable(commonTable: CommonTable): void {
        // Check for CommonTables in the query definition
        commonTable.query.accept(this);
    }

    visitSelectClause(clause: SelectClause): void {
        // Check each item in the select clause
        for (const item of clause.items) {
            item.accept(this);
        }
    }

    visitSelectItem(item: SelectItem): void {
        // Select items might contain subqueries
        item.value.accept(this);
    }

    visitFromClause(fromClause: FromClause): void {
        // Check the source
        fromClause.source.accept(this);

        // Check joins
        if (fromClause.joins) {
            for (const join of fromClause.joins) {
                join.accept(this);
            }
        }
    }

    visitSourceExpression(source: SourceExpression): void {
        source.datasource.accept(this);
        // The alias part doesn't contain subqueries so we skip it
    }

    visitTableSource(source: TableSource): void {
        // Table sources don't contain subqueries, nothing to do
    }

    visitCommonTableSource(source: CommonTableSource): void {
        // CTE sources themselves don't contain further CommonTables
    }

    visitParenSource(source: ParenSource): void {
        source.source.accept(this);
    }

    visitSubQuerySource(subQuery: SubQuerySource): void {
        subQuery.query.accept(this);
    }

    visitInlineQuery(inlineQuery: InlineQuery): void {
        inlineQuery.selectQuery.accept(this);
    }

    visitJoinClause(joinClause: JoinClause): void {
        // Check join source
        joinClause.source.accept(this);

        // Check join condition
        if (joinClause.condition) {
            joinClause.condition.accept(this);
        }
    }

    visitJoinOnClause(joinOn: JoinOnClause): void {
        joinOn.condition.accept(this);
    }

    visitJoinUsingClause(joinUsing: JoinUsingClause): void {
        joinUsing.condition.accept(this);
    }

    visitWhereClause(whereClause: WhereClause): void {
        whereClause.condition.accept(this);
    }

    visitGroupByClause(clause: GroupByClause): void {
        for (const item of clause.grouping) {
            item.accept(this);
        }
    }

    visitHavingClause(clause: HavingClause): void {
        clause.condition.accept(this);
    }

    visitOrderByClause(clause: OrderByClause): void {
        for (const item of clause.order) {
            item.accept(this);
        }
    }

    visitWindowFrameClause(clause: WindowFrameClause): void {
        clause.expression.accept(this);
    }

    visitLimitClause(clause: LimitClause): void {
        clause.limit.accept(this);
        if (clause.offset) {
            clause.offset.accept(this);
        }
    }

    visitForClause(clause: ForClause): void {
        // FOR clause doesn't contain subqueries
    }

    visitOrderByItem(item: OrderByItem): void {
        item.value.accept(this);
    }

    visitParenExpression(expr: ParenExpression): void {
        expr.expression.accept(this);
    }

    visitBinaryExpression(expr: BinaryExpression): void {
        expr.left.accept(this);
        expr.right.accept(this);
    }

    visitUnaryExpression(expr: UnaryExpression): void {
        expr.expression.accept(this);
    }

    visitCaseExpression(expr: CaseExpression): void {
        if (expr.condition) {
            expr.condition.accept(this);
        }
        expr.switchCase.accept(this);
    }

    visitSwitchCaseArgument(switchCase: SwitchCaseArgument): void {
        // Check all case expressions
        for (const caseItem of switchCase.cases) {
            caseItem.accept(this);
        }

        // Check ELSE expression
        if (switchCase.elseValue) {
            switchCase.elseValue.accept(this);
        }
    }

    visitCaseKeyValuePair(pair: CaseKeyValuePair): void {
        // Check the WHEN condition
        pair.key.accept(this);
        // Check the THEN value
        pair.value.accept(this);
    }

    visitBetweenExpression(expr: BetweenExpression): void {
        expr.expression.accept(this);
        expr.lower.accept(this);
        expr.upper.accept(this);
    }

    visitFunctionCall(func: FunctionCall): void {
        if (func.argument) {
            func.argument.accept(this);
        }

        // Check OVER clause if present
        if (func.over) {
            func.over.accept(this);
        }
    }

    visitArrayExpression(expr: ArrayExpression): void {
        expr.expression.accept(this);
    }

    visitTupleExpression(expr: TupleExpression): void {
        // Check each value in the tuple for possible subqueries
        for (const value of expr.values) {
            value.accept(this);
        }
    }

    visitCastExpression(expr: CastExpression): void {
        // Check the input expression
        expr.input.accept(this);
        // Check the type expression
        expr.castType.accept(this);
    }

    visitTypeValue(expr: TypeValue): void {
        // Visit the argument if present
        if (expr.argument) {
            expr.argument.accept(this);
        }
        // The type itself doesn't contain subqueries
    }

    visitWindowFrameExpression(expr: WindowFrameExpression): void {
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

    visitWindowFrameSpec(spec: WindowFrameSpec): void {
        // WindowFrameSpec is a simple value object, nothing to traverse
    }

    visitIdentifierString(ident: IdentifierString): void {
        // Leaf node, nothing to traverse
    }

    visitRawString(raw: RawString): void {
        // Leaf node, nothing to traverse
    }

    visitColumnReference(column: ColumnReference): void {
        // Column references don't have subqueries
    }

    visitParameterExpression(param: ParameterExpression): void {
        // Parameter expressions don't have child components
    }

    visitLiteralValue(value: LiteralValue): void {
        // Literal values are leaf nodes
    }
}