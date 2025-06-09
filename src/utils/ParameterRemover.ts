import { CommonTable, Distinct, DistinctComponent, DistinctOn, ForClause, FromClause, GroupByClause, HavingClause, JoinClause, JoinConditionComponent, JoinOnClause, JoinUsingClause, LimitClause, OffsetClause, FetchClause, FetchExpression, FetchType, FetchUnit, OrderByClause, OrderByComponent, OrderByItem, ParenSource, PartitionByClause, SelectClause, SelectItem, SourceAliasExpression, SourceComponent, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WindowsClause, WithClause } from "../models/Clause";
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
 * Helper visitor to detect if a component tree contains any ParameterExpression
 */
class ParameterDetector implements SqlComponentVisitor<boolean> {
    private handlers: Map<symbol, (arg: any) => boolean>;

    constructor() {
        this.handlers = new Map();

        // ParameterExpression always returns true
        this.handlers.set(ParameterExpression.kind, () => true);

        // Binary expressions check both sides
        this.handlers.set(BinaryExpression.kind, (expr: BinaryExpression) =>
            this.visit(expr.left) || this.visit(expr.right));

        // Parenthesized expressions check inner expression
        this.handlers.set(ParenExpression.kind, (expr: ParenExpression) =>
            this.visit(expr.expression));

        // Unary expressions check inner expression
        this.handlers.set(UnaryExpression.kind, (expr: UnaryExpression) =>
            this.visit(expr.expression));

        // Function calls check argument if present
        this.handlers.set(FunctionCall.kind, (expr: FunctionCall) =>
            expr.argument ? this.visit(expr.argument) : false);

        // Case expressions check condition and switch cases
        this.handlers.set(CaseExpression.kind, (expr: CaseExpression) => {
            const conditionHasParam = expr.condition ? this.visit(expr.condition) : false;
            const switchCaseHasParam = this.visit(expr.switchCase as ValueComponent);
            return conditionHasParam || switchCaseHasParam;
        });

        // Between expressions check all three parts
        this.handlers.set(BetweenExpression.kind, (expr: BetweenExpression) =>
            this.visit(expr.expression) || this.visit(expr.lower) || this.visit(expr.upper));

        // Default case: no parameters for simple types
        // (ColumnReference, LiteralValue, IdentifierString, etc.)
    }

    visit(component: SqlComponent): boolean {
        const handler = this.handlers.get(component.getKind());
        if (handler) {
            return handler(component);
        }
        return false; // Default: no parameters
    }

    static detect(component: ValueComponent): boolean {
        const detector = new ParameterDetector();
        return detector.visit(component);
    }
}

/**
 * Helper to analyze SQL expression structure safely
 */
class ExpressionAnalyzer {
    /**
     * Check if a component is a binary expression with logical operator (AND/OR)
     */
    static isLogicalBinaryExpression(component: SqlComponent): boolean {
        if (component.getKind() !== BinaryExpression.kind) {
            return false;
        }

        const expr = component as BinaryExpression;
        const operator = expr.operator.value.toLowerCase();
        return operator === 'and' || operator === 'or';
    }

    /**
     * Check if a string is a logical operator
     */
    static isLogicalOperator(operator: string): boolean {
        const lowerOp = operator.toLowerCase();
        return lowerOp === 'and' || lowerOp === 'or';
    }

    /**
     * Check if a component is a comparison operator
     */
    static isComparisonBinaryExpression(component: SqlComponent): boolean {
        if (component.getKind() !== BinaryExpression.kind) {
            return false;
        }

        const expr = component as BinaryExpression;
        return this.isComparisonOperator(expr.operator.value);
    }

    /**
     * Check if a string is a comparison operator
     */
    static isComparisonOperator(operator: string): boolean {
        const lowerOp = operator.toLowerCase();
        return ['=', '!=', '<>', '<', '>', '<=', '>=', 'like', 'ilike', 'in', 'not in'].includes(lowerOp);
    }
}

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
        this.handlers.set(FetchExpression.kind, (expr) => this.visitFetchExpression(expr as FetchExpression));
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

        const operation = query.operator;
        return new BinarySelectQuery(left, operation.value, right);
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

        return new WithClause(clause.recursive, tables);
    }

    /**
     * Visit CommonTable node
     */
    private visitCommonTable(table: CommonTable): CommonTable | null {
        if (!table.aliasExpression || !table.query) {
            return null;
        }

        const aliasExpression = this.visit(table.aliasExpression) as SourceAliasExpression;
        if (!aliasExpression) {
            return null;
        }

        const selectQuery = this.visit(table.query) as SelectQuery;
        if (!selectQuery) {
            return null;
        }

        return new CommonTable(selectQuery, aliasExpression, table.materialized);
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
    // Simple visitor methods that return the node unchanged
    private visitIdentifierString(identifier: IdentifierString): IdentifierString { return identifier; }
    private visitRawString(str: RawString): RawString { return str; }
    private visitColumnReference(ref: ColumnReference): ColumnReference { return ref; }
    private visitParameterExpression(param: ParameterExpression): null { return null; }
    private visitLiteralValue(literal: LiteralValue): LiteralValue { return literal; }
    private visitTableSource(source: TableSource): TableSource { return source; }
    private visitForClause(clause: ForClause): ForClause { return clause; }
    private visitDistinctComponent(component: DistinctComponent): DistinctComponent { return component; }

    /**
     * Visit SourceExpression node
     */
    private visitSourceExpression(source: SourceExpression): SourceExpression | null {
        if (!source.datasource) {
            return source; // Return as is instead of null
        }

        const sourceComponent = this.visit(source.datasource) as SourceComponent;
        if (!sourceComponent) {
            return source; // Return as is instead of null
        }

        return new SourceExpression(sourceComponent, source.aliasExpression);
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
        const columnNames = columns ? columns.map(col => col.name) : null;
        return new SourceAliasExpression(table.name, columnNames);
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
        return new JoinClause(clause.joinType.value, source, condition, clause.lateral);
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
     * Visit BinaryExpression node - improved logic for right-associative parser structure
     */
    private visitBinaryExpression(expr: BinaryExpression): ValueComponent | null {
        const operator = expr.operator.value.toLowerCase();

        if (ExpressionAnalyzer.isLogicalOperator(operator)) {
            // Handle logical operators normally
            const left = this.visit(expr.left) as ValueComponent | null;
            const right = this.visit(expr.right) as ValueComponent | null;

            if (!left && !right) {
                return null;
            }

            if (!left && right) {
                return right;
            }

            if (left && !right) {
                return left;
            }

            return new BinaryExpression(left!, expr.operator.value, right!);
        } else {
            // For comparison operators, handle right-associative parser structure
            return this.handleComparisonExpression(expr);
        }
    }

    /**
     * Handle comparison expressions, accounting for right-associative parser structure
     */
    private handleComparisonExpression(expr: BinaryExpression): ValueComponent | null {
        const left = this.visit(expr.left) as ValueComponent | null;

        // Check if the right side is a logical expression (AND/OR) using type-safe analysis
        if (ExpressionAnalyzer.isLogicalBinaryExpression(expr.right)) {
            // This is the problematic case: comparison = (logical expression)
            // We need to restructure this as: (comparison) logical (other parts)
            return this.restructureComparisonWithLogical(expr, left);
        }

        // Normal comparison processing
        const right = this.visit(expr.right) as ValueComponent | null;

        if (!left || !right) {
            return null;
        }

        return new BinaryExpression(left, expr.operator.value, right);
    }

    /**
     * Restructure expressions like "id = (1 AND ...)" to "(id = 1) AND ..."
     */
    private restructureComparisonWithLogical(expr: BinaryExpression, processedLeft: ValueComponent | null): ValueComponent | null {
        if (!processedLeft) {
            return null;
        }

        const rightBinary = expr.right as BinaryExpression;
        const logicalOperator = rightBinary.operator.value;

        // Process the logical expression's left side as the right side of our comparison
        const comparisonRight = this.visit(rightBinary.left) as ValueComponent | null;
        if (!comparisonRight) {
            // If the comparison right side contains only parameters, 
            // try to process the logical expression's right side
            return this.visit(rightBinary.right) as ValueComponent | null;
        }

        // Create the restructured comparison: "id = 1"
        const restructuredComparison = new BinaryExpression(processedLeft, expr.operator.value, comparisonRight);

        // Process the remaining logical expression's right side
        const logicalRight = this.visit(rightBinary.right) as ValueComponent | null;

        if (!logicalRight) {
            // Only the left comparison is valid
            return restructuredComparison;
        }

        // Combine: "(id = 1) AND (remaining expression)"
        return new BinaryExpression(restructuredComparison, logicalOperator, logicalRight);
    }

    /**
     * Check if an operator is a logical operator     */

    /**
     * Check if the resulting expression would be nonsensical
     * This is a heuristic to detect cases like "name = age > 18"
     */
    private wouldCreateNonsensicalExpression(left: ValueComponent, operator: string, right: ValueComponent): boolean {
        // Only apply this check for simple cases where we have a direct comparison operator
        // followed by another comparison operator in the right side
        if (ExpressionAnalyzer.isComparisonOperator(operator) && ExpressionAnalyzer.isComparisonBinaryExpression(right)) {
            const rightBinary = right as any;
            if (rightBinary.operator && ExpressionAnalyzer.isComparisonOperator(rightBinary.operator.value)) {
                // Additional check: make sure this isn't a legitimate nested case
                // If the left side is a simple column and the right side is a comparison,
                // this is likely nonsensical (like "name = age > 18")
                if (left.getKind().toString().includes('ColumnReference')) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check if a ValueComponent contains a ParameterExpression anywhere in its tree
     */
    private containsParameter(component: ValueComponent): boolean {
        return ParameterDetector.detect(component);
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
        if (this.containsParameter(pair.key) || this.containsParameter(pair.value)) {
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
        if (this.containsParameter(expr.expression) ||
            this.containsParameter(expr.lower) ||
            this.containsParameter(expr.upper)) {
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
        if (this.containsParameter(expr.input)) {
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
        if (!clause.grouping || clause.grouping.length === 0) {
            return null;
        }

        const grouping = clause.grouping
            .map(expr => this.visit(expr) as ValueComponent)
            .filter(expr => expr !== null) as ValueComponent[];

        if (grouping.length === 0) {
            return null;
        }

        return new GroupByClause(grouping);
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
        const items = clause.order
            .map((item: OrderByComponent) => this.visit(item) as OrderByComponent)
            .filter((item: OrderByComponent) => item !== null) as OrderByComponent[];
        return new OrderByClause(items);
    }

    /**
     * Visit OrderByItem node
     */
    private visitOrderByItem(item: OrderByItem): OrderByItem {
        const value = this.visit(item.value) as ValueComponent;
        return new OrderByItem(value, item.sortDirection, item.nullsPosition);
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
        const expression = this.visit(clause.expression) as FetchExpression;
        return new FetchClause(expression);
    }

    /**
     * Visit FetchExpression node
     */
    private visitFetchExpression(expression: FetchExpression): FetchExpression {
        const count = this.visit(expression.count) as ValueComponent; return new FetchExpression(expression.type, count, expression.unit);
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