import { CommonTable, FetchClause, ForClause, FromClause, FunctionSource, GroupByClause, HavingClause, JoinClause, JoinOnClause, JoinUsingClause, LimitClause, OffsetClause, OrderByClause, OrderByItem, ParenSource, PartitionByClause, SelectClause, SelectItem, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WindowsClause, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import {
    ArrayExpression, ArrayQueryExpression, BetweenExpression, BinaryExpression, CaseExpression, CaseKeyValuePair,
    CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression,
    ParameterExpression, SwitchCaseArgument, TupleExpression, UnaryExpression, ValueComponent, ValueList,
    OverExpression, WindowFrameExpression, IdentifierString, RawString,
    WindowFrameSpec,
    LiteralValue,
    TypeValue,
    StringSpecifierExpression
} from "../models/ValueComponent";

/**
 * A specialized table source collector designed for CTE dependency analysis.
 * 
 * Unlike the general-purpose TableSourceCollector, this collector:
 * - Always includes CTE references in results (treats CTEs as valid table sources)
 * - Always performs deep traversal of subqueries, WHERE clauses, etc.
 * - Is optimized for dependency analysis rather than database schema analysis
 * 
 * This collector is specifically designed for use by CTEDependencyAnalyzer to track
 * which tables/CTEs are referenced by queries at any nesting level.
 */
export class CTETableReferenceCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private tableSources: TableSource[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();
    private tableNameMap: Map<string, boolean> = new Map<string, boolean>();
    private isRootVisit: boolean = true;

    constructor() {
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Setup handlers for query components
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
        this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));

        // Note: We intentionally do NOT handle WITH clause and CommonTable
        // These are processed separately by CTEDependencyAnalyzer for CTE-to-CTE dependencies

        // Handlers for FROM and JOIN components
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(JoinClause.kind, (expr) => this.visitJoinClause(expr as JoinClause));
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        // Source components
        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));
        this.handlers.set(FunctionSource.kind, (expr) => this.visitFunctionSource(expr as FunctionSource));
        this.handlers.set(ParenSource.kind, (expr) => this.visitParenSource(expr as ParenSource));
        this.handlers.set(SubQuerySource.kind, (expr) => this.visitSubQuerySource(expr as SubQuerySource));
        this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));

        // Additional clause handlers for full scanning
        this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(OffsetClause.kind, (expr) => this.visitOffsetClause(expr as OffsetClause));
        this.handlers.set(FetchClause.kind, (expr) => this.visitFetchClause(expr as FetchClause));
        this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr as OrderByItem));
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));

        // Value components that might contain table references
        this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
        this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        this.handlers.set(CaseKeyValuePair.kind, (expr) => this.visitCaseKeyValuePair(expr as CaseKeyValuePair));
        this.handlers.set(SwitchCaseArgument.kind, (expr) => this.visitSwitchCaseArgument(expr as SwitchCaseArgument));
        this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
        this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
        this.handlers.set(ArrayQueryExpression.kind, (expr) => this.visitArrayQueryExpression(expr as ArrayQueryExpression));
        this.handlers.set(TupleExpression.kind, (expr) => this.visitTupleExpression(expr as TupleExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        this.handlers.set(ValueList.kind, (expr) => this.visitValueList(expr as ValueList));
        this.handlers.set(StringSpecifierExpression.kind, (expr) => this.visitStringSpecifierExpression(expr as StringSpecifierExpression));
    }

    /**
     * Collects all table references from the given SQL component
     * @param query The SQL component to analyze
     * @returns Array of TableSource objects representing all table references
     */
    public collect(query: SqlComponent): TableSource[] {
        this.visit(query);
        return this.getTableSources();
    }

    /**
     * Gets all collected table sources
     */
    public getTableSources(): TableSource[] {
        return this.tableSources;
    }

    /**
     * Reset the collection of table sources
     */
    private reset(): void {
        this.tableSources = [];
        this.tableNameMap.clear();
        this.visitedNodes.clear();
    }

    /**
     * Gets a unique identifier for a table source
     */
    private getTableIdentifier(source: TableSource): string {
        // Use QualifiedName for identifier (dot-joined string)
        if (source.qualifiedName.namespaces && source.qualifiedName.namespaces.length > 0) {
            return source.qualifiedName.namespaces.map(ns => ns.name).join('.') + '.' + (source.qualifiedName.name instanceof RawString ? source.qualifiedName.name.value : source.qualifiedName.name.name);
        } else {
            return source.qualifiedName.name instanceof RawString ? source.qualifiedName.name.value : source.qualifiedName.name.name;
        }
    }

    /**
     * Main entry point for the visitor pattern.
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

    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        // Skip WITH clause processing - we only want to collect table references from the main query parts
        // The WITH clause is handled separately by CTEDependencyAnalyzer for CTE-to-CTE dependencies
        
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

        if (query.orderByClause) {
            query.orderByClause.accept(this);
        }

        if (query.windowClause) {
            for (const win of query.windowClause.windows) {
                win.accept(this);
            }
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

        query.selectClause.accept(this);
    }

    private visitBinarySelectQuery(query: BinarySelectQuery): void {
        // For UNION-like queries, visit both sides
        query.left.accept(this);
        query.right.accept(this);
    }

    private visitValuesQuery(query: ValuesQuery): void {
        // VALUES queries might contain subqueries in tuple expressions
        for (const tuple of query.tuples) {
            tuple.accept(this);
        }
    }


    private visitFromClause(fromClause: FromClause): void {
        // Check the main source in FROM clause
        fromClause.source.accept(this);

        // Check all JOIN clauses
        if (fromClause.joins) {
            for (const join of fromClause.joins) {
                join.accept(this);
            }
        }
    }

    private visitSourceExpression(source: SourceExpression): void {
        // Process the actual data source, ignoring aliases
        source.datasource.accept(this);
    }

    private visitTableSource(source: TableSource): void {
        // Get the table identifier for uniqueness check
        const identifier = this.getTableIdentifier(source);

        // Include all table sources (both real tables and CTEs)
        if (!this.tableNameMap.has(identifier)) {
            this.tableNameMap.set(identifier, true);
            this.tableSources.push(source);
        }
    }

    private visitFunctionSource(source: FunctionSource): void {
        // Function sources are not regular table sources, but may contain subqueries in their arguments
        if (source.argument) {
            this.visitValueComponent(source.argument);
        }
    }

    private visitValueComponent(value: ValueComponent): void {
        value.accept(this);
    }

    private visitParenSource(source: ParenSource): void {
        source.source.accept(this);
    }

    private visitSubQuerySource(subQuery: SubQuerySource): void {
        // Always check subqueries in CTE analysis mode
        subQuery.query.accept(this);
    }

    private visitInlineQuery(inlineQuery: InlineQuery): void {
        // Always visit inline queries
        inlineQuery.selectQuery.accept(this);
    }

    private visitJoinClause(joinClause: JoinClause): void {
        // Visit the source being joined
        joinClause.source.accept(this);

        // Visit the join condition
        if (joinClause.condition) {
            joinClause.condition.accept(this);
        }
    }

    private visitJoinOnClause(joinOn: JoinOnClause): void {
        joinOn.condition.accept(this);
    }

    private visitJoinUsingClause(joinUsing: JoinUsingClause): void {
        joinUsing.condition.accept(this);
    }

    // Additional visitor methods for comprehensive analysis

    private visitWhereClause(whereClause: WhereClause): void {
        whereClause.condition.accept(this);
    }

    private visitGroupByClause(clause: GroupByClause): void {
        for (const item of clause.grouping) {
            item.accept(this);
        }
    }

    private visitHavingClause(clause: HavingClause): void {
        clause.condition.accept(this);
    }

    private visitOrderByClause(clause: OrderByClause): void {
        for (const item of clause.order) {
            item.accept(this);
        }
    }

    private visitWindowFrameClause(clause: WindowFrameClause): void {
        clause.expression.accept(this);
    }

    private visitLimitClause(clause: LimitClause): void {
        clause.value.accept(this);
    }

    private visitOffsetClause(clause: OffsetClause): void {
        clause.value.accept(this);
    }

    private visitFetchClause(clause: FetchClause): void {
        clause.expression.accept(this);
    }

    private visitForClause(_clause: ForClause): void {
        // FOR clause doesn't contain table sources
    }

    private visitOrderByItem(item: OrderByItem): void {
        item.value.accept(this);
    }

    private visitSelectClause(clause: SelectClause): void {
        for (const item of clause.items) {
            item.accept(this);
        }
    }

    private visitSelectItem(item: SelectItem): void {
        item.value.accept(this);
    }

    private visitParenExpression(expr: ParenExpression): void {
        expr.expression.accept(this);
    }

    private visitBinaryExpression(expr: BinaryExpression): void {
        expr.left.accept(this);
        expr.right.accept(this);
    }

    private visitUnaryExpression(expr: UnaryExpression): void {
        expr.expression.accept(this);
    }

    private visitCaseExpression(expr: CaseExpression): void {
        if (expr.condition) {
            expr.condition.accept(this);
        }
        expr.switchCase.accept(this);
    }

    private visitSwitchCaseArgument(switchCase: SwitchCaseArgument): void {
        for (const caseItem of switchCase.cases) {
            caseItem.accept(this);
        }

        if (switchCase.elseValue) {
            switchCase.elseValue.accept(this);
        }
    }

    private visitCaseKeyValuePair(pair: CaseKeyValuePair): void {
        pair.key.accept(this);
        pair.value.accept(this);
    }

    private visitBetweenExpression(expr: BetweenExpression): void {
        expr.expression.accept(this);
        expr.lower.accept(this);
        expr.upper.accept(this);
    }

    private visitFunctionCall(func: FunctionCall): void {
        if (func.argument) {
            func.argument.accept(this);
        }

        if (func.over) {
            func.over.accept(this);
        }
    }

    private visitArrayExpression(expr: ArrayExpression): void {
        expr.expression.accept(this);
    }

    private visitArrayQueryExpression(expr: ArrayQueryExpression): void {
        expr.query.accept(this);
    }

    private visitTupleExpression(expr: TupleExpression): void {
        for (const value of expr.values) {
            value.accept(this);
        }
    }

    private visitCastExpression(expr: CastExpression): void {
        expr.input.accept(this);
        expr.castType.accept(this);
    }

    private visitValueList(valueList: ValueList): void {
        for (const value of valueList.values) {
            value.accept(this);
        }
    }

    private visitStringSpecifierExpression(_expr: StringSpecifierExpression): void {
        // StringSpecifierExpression doesn't contain table references
    }
}