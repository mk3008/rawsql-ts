import { CommonTable, Distinct, DistinctComponent, DistinctOn, ForClause, FromClause, GroupByClause, HavingClause, JoinClause, JoinConditionComponent, JoinOnClause, JoinUsingClause, LimitClause, OffsetClause, FetchClause, OrderByClause, OrderByComponent, OrderByItem, ParenSource, PartitionByClause, SelectClause, SelectItem, SourceAliasExpression, SourceComponent, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WindowsClause, WithClause } from "../models/Clause";
import { BinarySelectQuery, SimpleSelectQuery, SelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import {
    ArrayExpression, BetweenExpression, BinaryExpression, CaseExpression, CaseKeyValuePair,
    CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression,
    ParameterExpression, SwitchCaseArgument, TupleExpression, UnaryExpression, ValueComponent,
    OverExpression, WindowFrameExpression, IdentifierString, RawString,
    WindowFrameSpec,
    LiteralValue,
    TypeValue
} from "../models/ValueComponent";

/**
 * Utility class to traverse and remove ParameterExpression nodes from the SQL AST.
 * This removes any binary expression containing a ParameterExpression as a whole.
 * For compound logical expressions (AND/OR), only the parameterized parts are removed.
 * If all conditions are removed from a logical expression, the parent node is removed as well.
 */
export class ParameterRemover implements SqlComponentVisitor<SqlComponent | null> {
    private handlers: Map<symbol, (arg: any) => SqlComponent | null>;
    private visitedNodes: Set<SqlComponent> = new Set();
    private isRootVisit: boolean = true;

    constructor() {
        this.handlers = new Map<symbol, (arg: any) => SqlComponent | null>();

        // Setup handlers for all component types
        // SelectQuery types
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
        this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));

        // WithClause and CommonTable
        this.handlers.set(WithClause.kind, (expr) => this.visitWithClause(expr as WithClause));
        this.handlers.set(CommonTable.kind, (expr) => this.visitCommonTable(expr as CommonTable));

        // SelectClause and SelectItem
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));
        this.handlers.set(Distinct.kind, (expr) => this.visitDistinctComponent(expr as DistinctComponent));
        this.handlers.set(DistinctOn.kind, (expr) => this.visitDistinctComponent(expr as DistinctComponent));

        // Identifiers and raw strings
        this.handlers.set(IdentifierString.kind, (expr) => this.visitIdentifierString(expr as IdentifierString));
        this.handlers.set(RawString.kind, (expr) => this.visitRawString(expr as RawString));
        this.handlers.set(ColumnReference.kind, (expr) => this.visitColumnReference(expr as ColumnReference));
        this.handlers.set(ParameterExpression.kind, (expr) => this.visitParameterExpression(expr as ParameterExpression));
        this.handlers.set(LiteralValue.kind, (expr) => this.visitLiteralValue(expr as LiteralValue));

        // Source components
        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));
        this.handlers.set(ParenSource.kind, (expr) => this.visitParenSource(expr as ParenSource));
        this.handlers.set(SourceAliasExpression.kind, (expr) => this.visitSourceAliasExpression(expr as SourceAliasExpression));

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

        // Value components that might contain subqueries or parameters
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

        // Other clauses
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr as OrderByItem));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        this.handlers.set(WindowsClause.kind, (expr) => this.visitWindowsClause(expr as WindowsClause));
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));
        this.handlers.set(OffsetClause.kind, (expr) => this.visitOffsetClause(expr as OffsetClause));
        this.handlers.set(FetchClause.kind, (expr) => this.visitFetchClause(expr as FetchClause));
    }

    /**
     * Reset the visited nodes tracking
     */
    private reset(): void {
        this.visitedNodes.clear();
    }

    /**
     * Main entry point for the visitor pattern.
     * @param arg The SQL component to visit
     * @returns The component with parameter expressions removed, or null if the entire component should be removed
     */
    public visit(arg: SqlComponent): SqlComponent | null {
        // If not a root visit, just visit the node and return
        if (!this.isRootVisit) {
            return this.visitNode(arg);
        }

        // If this is a root visit, we need to reset the state
        this.reset();
        this.isRootVisit = false;

        try {
            return this.visitNode(arg);
        } finally {
            // Regardless of success or failure, reset the root visit flag
            this.isRootVisit = true;
        }
    }

    /**
     * Internal visit method used for all nodes.
     * This separates the visit flag management from the actual node visitation logic.
     */
    private visitNode(arg: SqlComponent): SqlComponent | null {
        // Check for circular references - if node already visited, return as is
        if (this.visitedNodes.has(arg)) {
            return arg;
        }

        // Mark as visited node
        this.visitedNodes.add(arg);

        // Handle null values
        if (!arg) {
            return null;
        }

        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            return handler(arg);
        }

        // Provide more detailed error message
        const kindSymbol = arg.getKind()?.toString() || 'unknown';
        const constructor = arg.constructor?.name || 'unknown';
        throw new Error(`[ParameterRemover] No handler for ${constructor} with kind ${kindSymbol}.`);
    }

    /**
     * Visit SimpleSelectQuery node
     */
    private visitSimpleSelectQuery(query: SimpleSelectQuery): SimpleSelectQuery {
        const withClause = query.withClause ? this.visit(query.withClause) as WithClause | null : null;
        
        // SelectClause is required
        if (!query.selectClause) {
            throw new Error("[ParameterRemover] SimpleSelectQuery missing required selectClause");
        }
        const selectClause = this.visit(query.selectClause) as SelectClause;
        
        const fromClause = query.fromClause ? this.visit(query.fromClause) as FromClause | null : null;
        const whereClause = query.whereClause ? this.visit(query.whereClause) as WhereClause | null : null;
        const groupByClause = query.groupByClause ? this.visit(query.groupByClause) as GroupByClause | null : null;
        const havingClause = query.havingClause ? this.visit(query.havingClause) as HavingClause | null : null;
        const orderByClause = query.orderByClause ? this.visit(query.orderByClause) as OrderByClause | null : null;
        const windowClause = query.windowClause ? this.visit(query.windowClause) as WindowsClause | null : null;
        const limitClause = query.limitClause ? this.visit(query.limitClause) as LimitClause | null : null;
        const offsetClause = query.offsetClause ? this.visit(query.offsetClause) as OffsetClause | null : null;
        const fetchClause = query.fetchClause ? this.visit(query.fetchClause) as FetchClause | null : null;
        const forClause = query.forClause ? this.visit(query.forClause) as ForClause | null : null;

        return new SimpleSelectQuery({
            withClause,
            selectClause,
            fromClause,
            whereClause,
            groupByClause,
            havingClause,
            orderByClause,
            windowClause,
            limitClause,
            offsetClause,
            fetchClause,
            forClause
        });
    }

    /**
     * Visit BinarySelectQuery node
     */
    private visitBinarySelectQuery(query: BinarySelectQuery): BinarySelectQuery | null {
        if (!query.left || !query.right) {
            return null;
        }
        
        const left = this.visit(query.left) as SelectQuery;
        if (!left) {
            return null;
        }
        
        const right = this.visit(query.right) as SelectQuery;
        if (!right) {
            return null;
        }
        
        const operation = query.operation;
        return new BinarySelectQuery(left, operation, right);
    }

    /**
     * Visit ValuesQuery node
     */
    private visitValuesQuery(query: ValuesQuery): ValuesQuery {
        // Since ValuesQuery doesn't typically contain parameters in WHERE conditions,
        // we'll just return it as is for now
        return query;
    }

    /**
     * Visit WithClause node
     */
    private visitWithClause(clause: WithClause): WithClause | null {
        if (!clause.tables) {
            return null;
        }
        
        const tables = clause.tables
            .map(table => this.visit(table) as CommonTable)
            .filter(table => table !== null) as CommonTable[];
            
        if (tables.length === 0) {
            return null;
        }
        
        return new WithClause(tables, clause.isRecursive);
    }

    /**
     * Visit CommonTable node
     */
    private visitCommonTable(table: CommonTable): CommonTable | null {
        if (!table.aliasExpression || !table.selectQuery) {
            return null;
        }
        
        const aliasExpression = this.visit(table.aliasExpression) as SourceAliasExpression;
        if (!aliasExpression) {
            return null;
        }
        
        const selectQuery = this.visit(table.selectQuery) as SelectQuery;
        if (!selectQuery) {
            return null;
        }
        
        return new CommonTable(aliasExpression, selectQuery);
    }

    /**
     * Visit SelectClause node
     */
    private visitSelectClause(clause: SelectClause): SelectClause {
        if (!clause.items) {
            throw new Error("[ParameterRemover] SelectClause missing required items");
        }
        
        const items = clause.items
            .map(item => this.visit(item) as SelectItem)
            .filter(item => item !== null) as SelectItem[];
            
        const distinct = clause.distinct ? this.visit(clause.distinct) as DistinctComponent : null;
        
        if (items.length === 0) {
            throw new Error("[ParameterRemover] SelectClause must have at least one item");
        }
        
        return new SelectClause(items, distinct);
    }

    /**
     * Visit SelectItem node
     */
    private visitSelectItem(item: SelectItem): SelectItem | null {
        if (!item.value) {
            return null;
        }
        
        const value = this.visit(item.value) as ValueComponent;
        if (!value) {
            return null;
        }
        
        return new SelectItem(value, item.identifier?.name || null);
    }

    /**
     * Visit IdentifierString node
     */
    private visitIdentifierString(identifier: IdentifierString): IdentifierString {
        return identifier;
    }

    /**
     * Visit RawString node
     */
    private visitRawString(str: RawString): RawString {
        return str;
    }

    /**
     * Visit ColumnReference node
     */
    private visitColumnReference(ref: ColumnReference): ColumnReference {
        return ref;
    }

    /**
     * Visit ParameterExpression node
     */
    private visitParameterExpression(param: ParameterExpression): ParameterExpression {
        return param;
    }

    /**
     * Visit LiteralValue node
     */
    private visitLiteralValue(literal: LiteralValue): LiteralValue {
        return literal;
    }

    /**
     * Visit SourceExpression node
     */
    private visitSourceExpression(source: SourceExpression): SourceExpression | null {
        if (!source.source) {
            return source; // Return as is instead of null
        }
        
        const sourceComponent = this.visit(source.source) as SourceComponent;
        if (!sourceComponent) {
            return source; // Return as is instead of null
        }
        
        return new SourceExpression(sourceComponent);
    }

    /**
     * Visit TableSource node
     */
    private visitTableSource(source: TableSource): TableSource {
        return source;
    }

    /**
     * Visit ParenSource node
     */
    private visitParenSource(source: ParenSource): ParenSource {
        return new ParenSource(this.visit(source.source) as SourceComponent);
    }

    /**
     * Visit SourceAliasExpression node
     */
    private visitSourceAliasExpression(expr: SourceAliasExpression): SourceAliasExpression {
        const table = expr.table;
        const columns = expr.columns;
        return new SourceAliasExpression(table, columns);
    }

    /**
     * Visit SubQuerySource node
     */
    private visitSubQuerySource(source: SubQuerySource): SubQuerySource | null {
        if (!source.query) {
            return null;
        }
        
        const query = this.visit(source.query) as SelectQuery;
        if (!query) {
            return null;
        }
        
        return new SubQuerySource(query);
    }

    /**
     * Visit InlineQuery node
     */
    private visitInlineQuery(query: InlineQuery): InlineQuery | null {
        if (!query.selectQuery) {
            return null;
        }
        
        const selectQuery = this.visit(query.selectQuery) as SelectQuery;
        if (!selectQuery) {
            return null;
        }
        
        return new InlineQuery(selectQuery);
    }

    /**
     * Visit FromClause node
     */
    private visitFromClause(clause: FromClause): FromClause | null {
        if (!clause.source) {
            return clause; // Return as is instead of null
        }
        
        // Always keep the source, even if something inside might change
        const source = this.visit(clause.source) as SourceExpression;
        
        let joins: JoinClause[] | null = null;
        if (clause.joins) {
            const processedJoins = clause.joins
                .map(join => this.visit(join) as JoinClause)
                .filter(join => join !== null) as JoinClause[];
                
            if (processedJoins.length > 0) {
                joins = processedJoins;
            }
        }
        
        return new FromClause(source || clause.source, joins);
    }

    /**
     * Visit JoinClause node
     */
    private visitJoinClause(clause: JoinClause): JoinClause | null {
        if (!clause.source) {
            return null;
        }
        
        const source = this.visit(clause.source) as SourceExpression;
        if (!source) {
            return null;
        }
        
        const condition = clause.condition ? this.visit(clause.condition) as JoinConditionComponent : null;
        return new JoinClause(clause.joinType, source, condition);
    }

    /**
     * Visit JoinOnClause node
     */
    private visitJoinOnClause(clause: JoinOnClause): JoinOnClause | null {
        const condition = this.visit(clause.condition) as ValueComponent;
        // If condition has been removed (contains only parameters), return null
        if (!condition) {
            return null;
        }
        return new JoinOnClause(condition);
    }

    /**
     * Visit JoinUsingClause node
     */
    private visitJoinUsingClause(clause: JoinUsingClause): JoinUsingClause {
        return clause;
    }

    /**
     * Visit WhereClause node - key method for parameter removal
     */
    private visitWhereClause(clause: WhereClause): WhereClause | null {
        const condition = this.visit(clause.condition) as ValueComponent;
        // If the entire condition has been removed (contains only parameters), return null
        if (!condition) {
            return null;
        }
        return new WhereClause(condition);
    }

    /**
     * Visit ParenExpression node
     */
    private visitParenExpression(expr: ParenExpression): ParenExpression | null {
        const innerExpression = this.visit(expr.expression) as ValueComponent;
        // If the inner expression has been removed (contains only parameters), return null
        if (!innerExpression) {
            return null;
        }
        return new ParenExpression(innerExpression);
    }

    /**
     * Visit BinaryExpression node - key method for parameter removal
     * This is where we remove binary expressions containing parameters.
     */
    private visitBinaryExpression(expr: BinaryExpression): BinaryExpression | null {
        // First, check if this is a logical operator (AND, OR)
        const isLogicalOperator = expr.operator.value.toLowerCase() === 'and' || expr.operator.value.toLowerCase() === 'or';

        // For logical operators, we handle each side separately
        if (isLogicalOperator) {
            const left = this.visit(expr.left) as ValueComponent;
            const right = this.visit(expr.right) as ValueComponent;

            // If both sides contain only parameters, remove the entire expression
            if (!left && !right) {
                return null;
            }

            // If only one side contains parameters, return the other side
            if (!left) {
                return right as BinaryExpression;
            }
            if (!right) {
                return left as BinaryExpression;
            }

            // Both sides are valid, create a new BinaryExpression
            return new BinaryExpression(left, expr.operator.value, right);
        } else {
            // For non-logical operators, check if either side contains a parameter
            const containsParameter = this.hasParameterExpression(expr.left) || this.hasParameterExpression(expr.right);
            if (containsParameter) {
                // If the expression contains a parameter, remove it entirely
                return null;
            }

            // Otherwise, visit both sides and keep the expression
            const left = this.visit(expr.left) as ValueComponent;
            const right = this.visit(expr.right) as ValueComponent;
            return new BinaryExpression(left, expr.operator.value, right);
        }
    }

    /**
     * Check if a ValueComponent contains a ParameterExpression
     */
    private hasParameterExpression(node: ValueComponent): boolean {
        if (node instanceof ParameterExpression) {
            return true;
        }

        // For other node types, we need to check their properties
        if (node instanceof BinaryExpression) {
            return this.hasParameterExpression(node.left) || this.hasParameterExpression(node.right);
        }

        if (node instanceof UnaryExpression) {
            return this.hasParameterExpression(node.expression);
        }

        if (node instanceof ParenExpression) {
            return this.hasParameterExpression(node.expression);
        }

        if (node instanceof BetweenExpression) {
            return this.hasParameterExpression(node.expression) || 
                this.hasParameterExpression(node.lower) || 
                this.hasParameterExpression(node.upper);
        }

        if (node instanceof CaseExpression) {
            if (node.condition && this.hasParameterExpression(node.condition)) {
                return true;
            }
            // Check switch cases
            for (const caseKeyValue of node.switchCase.cases) {
                if (this.hasParameterExpression(caseKeyValue.key) || this.hasParameterExpression(caseKeyValue.value)) {
                    return true;
                }
            }
            if (node.switchCase.elseValue && this.hasParameterExpression(node.switchCase.elseValue)) {
                return true;
            }
            return false;
        }

        if (node instanceof FunctionCall && node.argument) {
            return this.hasParameterExpression(node.argument);
        }

        // For other types, assume no parameters
        return false;
    }

    /**
     * Visit UnaryExpression node
     */
    private visitUnaryExpression(expr: UnaryExpression): UnaryExpression | null {
        const expression = this.visit(expr.expression) as ValueComponent;
        // If the expression has been removed (contains only parameters), return null
        if (!expression) {
            return null;
        }
        return new UnaryExpression(expr.operator.value, expression);
    }

    /**
     * Visit CaseExpression node
     */
    private visitCaseExpression(expr: CaseExpression): CaseExpression | null {
        const condition = expr.condition ? this.visit(expr.condition) as ValueComponent : null;
        const switchCase = this.visit(expr.switchCase) as SwitchCaseArgument;
        // If switchCase has been removed (contains only parameters), return null
        if (!switchCase) {
            return null;
        }
        return new CaseExpression(condition, switchCase);
    }

    /**
     * Visit CaseKeyValuePair node
     */
    private visitCaseKeyValuePair(pair: CaseKeyValuePair): CaseKeyValuePair | null {
        // If either key or value contains parameters, remove the entire pair
        if (this.hasParameterExpression(pair.key) || this.hasParameterExpression(pair.value)) {
            return null;
        }
        const key = this.visit(pair.key) as ValueComponent;
        const value = this.visit(pair.value) as ValueComponent;
        return new CaseKeyValuePair(key, value);
    }

    /**
     * Visit SwitchCaseArgument node
     */
    private visitSwitchCaseArgument(arg: SwitchCaseArgument): SwitchCaseArgument | null {
        // Process all case pairs, filter out null results
        const cases = arg.cases
            .map(caseItem => this.visit(caseItem) as CaseKeyValuePair)
            .filter(caseItem => caseItem !== null) as CaseKeyValuePair[];

        // Process the else value if it exists
        const elseValue = arg.elseValue ? this.visit(arg.elseValue) as ValueComponent : null;

        // If no cases remain and no else value, remove the entire switch case
        if (cases.length === 0 && !elseValue) {
            return null;
        }

        return new SwitchCaseArgument(cases, elseValue);
    }

    /**
     * Visit BetweenExpression node
     */
    private visitBetweenExpression(expr: BetweenExpression): BetweenExpression | null {
        // If any part of the expression contains a parameter, remove the entire expression
        if (this.hasParameterExpression(expr.expression) || 
            this.hasParameterExpression(expr.lower) || 
            this.hasParameterExpression(expr.upper)) {
            return null;
        }

        const expression = this.visit(expr.expression) as ValueComponent;
        const lower = this.visit(expr.lower) as ValueComponent;
        const upper = this.visit(expr.upper) as ValueComponent;
        return new BetweenExpression(expression, lower, upper, expr.negated);
    }

    /**
     * Visit FunctionCall node
     */
    private visitFunctionCall(call: FunctionCall): FunctionCall {
        const argument = call.argument ? this.visit(call.argument) as ValueComponent : null;
        const over = call.over ? this.visit(call.over) as OverExpression : null;
        return new FunctionCall(
            call.qualifiedName.namespaces,
            call.qualifiedName.name,
            argument,
            over
        );
    }

    /**
     * Visit ArrayExpression node
     */
    private visitArrayExpression(expr: ArrayExpression): ArrayExpression | null {
        const expression = this.visit(expr.expression) as ValueComponent;
        // If the expression has been removed (contains only parameters), return null
        if (!expression) {
            return null;
        }
        return new ArrayExpression(expression);
    }

    /**
     * Visit TupleExpression node
     */
    private visitTupleExpression(expr: TupleExpression): TupleExpression {
        const values = expr.values
            .map(value => this.visit(value) as ValueComponent)
            .filter(value => value !== null) as ValueComponent[];
        return new TupleExpression(values);
    }

    /**
     * Visit CastExpression node
     */
    private visitCastExpression(expr: CastExpression): CastExpression | null {
        // If the input contains a parameter, remove the entire expression
        if (this.hasParameterExpression(expr.input)) {
            return null;
        }

        const input = this.visit(expr.input) as ValueComponent;
        const castType = this.visit(expr.castType) as TypeValue;
        // If the input has been removed, return null
        if (!input) {
            return null;
        }
        return new CastExpression(input, castType);
    }

    /**
     * Visit WindowFrameExpression node
     */
    private visitWindowFrameExpression(expr: WindowFrameExpression): WindowFrameExpression {
        const partition = expr.partition ? this.visit(expr.partition) as PartitionByClause : null;
        const order = expr.order ? this.visit(expr.order) as OrderByClause : null;
        const frameSpec = expr.frameSpec ? this.visit(expr.frameSpec) as WindowFrameSpec : null;
        return new WindowFrameExpression(partition, order, frameSpec);
    }

    /**
     * Visit WindowFrameSpec node
     */
    private visitWindowFrameSpec(spec: WindowFrameSpec): WindowFrameSpec {
        return spec;
    }

    /**
     * Visit TypeValue node
     */
    private visitTypeValue(type: TypeValue): TypeValue {
        const argument = type.argument ? this.visit(type.argument) as ValueComponent : null;
        return new TypeValue(
            type.qualifiedName.namespaces,
            type.qualifiedName.name,
            argument
        );
    }

    /**
     * Visit GroupByClause node
     */
    private visitGroupByClause(clause: GroupByClause): GroupByClause | null {
        if (!clause.value) {
            return null;
        }
        
        const value = this.visit(clause.value) as ValueComponent;
        if (!value) {
            return null;
        }
        
        // Make sure the property is named correctly
        if ('grouping' in clause) {
            // @ts-ignore - If the property has a different name in the model
            return { kind: GroupByClause.kind, grouping: value };
        }
        
        return new GroupByClause(value);
    }

    /**
     * Visit HavingClause node
     */
    private visitHavingClause(clause: HavingClause): HavingClause | null {
        const condition = this.visit(clause.condition) as ValueComponent;
        // If the condition has been removed (contains only parameters), return null
        if (!condition) {
            return null;
        }
        return new HavingClause(condition);
    }

    /**
     * Visit OrderByClause node
     */
    private visitOrderByClause(clause: OrderByClause): OrderByClause {
        const items = clause.items
            .map(item => this.visit(item) as OrderByComponent)
            .filter(item => item !== null) as OrderByComponent[];
        return new OrderByClause(items);
    }

    /**
     * Visit OrderByItem node
     */
    private visitOrderByItem(item: OrderByItem): OrderByItem {
        const value = this.visit(item.value) as ValueComponent;
        return new OrderByItem(value, item.direction, item.nulls);
    }

    /**
     * Visit WindowFrameClause node
     */
    private visitWindowFrameClause(clause: WindowFrameClause): WindowFrameClause {
        const expression = this.visit(clause.expression) as WindowFrameExpression;
        return new WindowFrameClause(clause.name.name, expression);
    }

    /**
     * Visit WindowsClause node
     */
    private visitWindowsClause(clause: WindowsClause): WindowsClause {
        const windows = clause.windows.map(window => this.visit(window) as WindowFrameClause);
        return new WindowsClause(windows);
    }

    /**
     * Visit LimitClause node
     */
    private visitLimitClause(clause: LimitClause): LimitClause {
        const value = this.visit(clause.value) as ValueComponent;
        return new LimitClause(value);
    }

    /**
     * Visit ForClause node
     */
    private visitForClause(clause: ForClause): ForClause {
        return clause;
    }

    /**
     * Visit OffsetClause node
     */
    private visitOffsetClause(clause: OffsetClause): OffsetClause {
        const value = this.visit(clause.value) as ValueComponent;
        return new OffsetClause(value);
    }

    /**
     * Visit FetchClause node
     */
    private visitFetchClause(clause: FetchClause): FetchClause {
        const count = clause.count ? this.visit(clause.count) as ValueComponent : null;
        return new FetchClause(clause.first, clause.rowOrRows, count);
    }

    /**
     * Visit DistinctComponent node
     */
    private visitDistinctComponent(component: DistinctComponent): DistinctComponent {
        return component;
    }

    /**
     * Static method to apply parameter removal transformation on an SQL AST
     * @param node The SQL AST node to transform
     * @returns The transformed SQL AST with parameter expressions removed
     */
    public static remove(node: SqlComponent): SqlComponent | null {
        const remover = new ParameterRemover();
        return remover.visit(node);
    }
}