import { CommonTable, ForClause, FromClause, GroupByClause, HavingClause, LimitClause, OrderByClause, SelectClause, WhereClause, WindowFrameClause, WindowsClause, JoinClause, JoinOnClause, JoinUsingClause, TableSource, SubQuerySource, SourceExpression, SelectItem, PartitionByClause, FetchClause, OffsetClause, WithClause } from "../models/Clause";
import { SimpleSelectQuery, BinarySelectQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { ArrayExpression, ArrayQueryExpression, BetweenExpression, BinaryExpression, CaseExpression, CastExpression, ColumnReference, FunctionCall, InlineQuery, ParenExpression, UnaryExpression, ValueComponent, ValueList, WindowFrameExpression } from "../models/ValueComponent";

/**
 * A comprehensive collector for all ColumnReference instances in SQL query structures.
 * 
 * This collector extends beyond the capabilities of SelectableColumnCollector by traversing
 * CTE internal queries, subqueries, and all nested SQL components to collect every column
 * reference instance in the query tree. It's specifically designed for transformation
 * scenarios where all column references need to be identified and potentially modified.
 * 
 * ## Key Differences from SelectableColumnCollector
 * 
 * | Feature | SelectableColumnCollector | ColumnReferenceCollector |
 * |---------|---------------------------|---------------------------|
 * | CTE Internal Scanning | ❌ Skipped | ✅ Included |
 * | Subquery Traversal | ❌ Limited | ✅ Comprehensive |
 * | Deduplication | ✅ Yes | ❌ No (preserves all instances) |
 * | Use Case | Column selection analysis | Column reference transformation |
 * 
 * ## Supported Query Types
 * 
 * - **SimpleSelectQuery**: Standard SELECT statements with all clauses
 * - **BinarySelectQuery**: UNION, INTERSECT, EXCEPT operations
 * - **Nested CTEs**: WITH clauses and their internal queries
 * - **Subqueries**: All subquery types in FROM, WHERE, SELECT clauses
 * - **Complex Expressions**: CASE, functions, binary operations, etc.
 * 
 * @example
 * ```typescript
 * import { ColumnReferenceCollector, SelectQueryParser } from 'rawsql-ts';
 * 
 * const sql = `
 *   WITH user_data AS (
 *     SELECT id, name FROM users WHERE status = 'active'
 *   ),
 *   order_summary AS (
 *     SELECT user_data.id, COUNT(*) as order_count
 *     FROM user_data
 *     JOIN orders ON user_data.id = orders.user_id
 *     GROUP BY user_data.id
 *   )
 *   SELECT * FROM order_summary
 * `;
 * 
 * const query = SelectQueryParser.parse(sql);
 * const collector = new ColumnReferenceCollector();
 * const columnRefs = collector.collect(query);
 * 
 * console.log(`Found ${columnRefs.length} column references:`);
 * columnRefs.forEach(ref => {
 *   const tableName = ref.namespaces?.[0]?.name || 'NO_TABLE';
 *   console.log(`- ${tableName}.${ref.column.name}`);
 * });
 * 
 * // Output includes references from:
 * // - CTE definitions: users.id, users.name, users.status
 * // - Main query: user_data.id, orders.user_id, etc.
 * ```
 * 
 * @example
 * ```typescript
 * // Use for column reference transformation
 * const columnRefs = collector.collect(query);
 * 
 * // Update all references to 'old_table' to 'new_table'
 * columnRefs.forEach(ref => {
 *   if (ref.namespaces?.[0]?.name === 'old_table') {
 *     ref.namespaces[0].name = 'new_table';
 *   }
 * });
 * ```
 * 
 * @since 0.11.16
 */
export class ColumnReferenceCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private columnReferences: ColumnReference[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();

    constructor() {
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Note: We don't handle SimpleSelectQuery/BinarySelectQuery here as they're handled directly in collect()

        // Clause handlers
        this.handlers.set(WithClause.kind, (clause) => this.visitWithClause(clause as WithClause));
        this.handlers.set(CommonTable.kind, (table) => this.visitCommonTable(table as CommonTable));
        this.handlers.set(SelectClause.kind, (clause) => this.visitSelectClause(clause as SelectClause));
        this.handlers.set(FromClause.kind, (clause) => this.visitFromClause(clause as FromClause));
        this.handlers.set(WhereClause.kind, (clause) => this.visitWhereClause(clause as WhereClause));
        this.handlers.set(GroupByClause.kind, (clause) => this.visitGroupByClause(clause as GroupByClause));
        this.handlers.set(HavingClause.kind, (clause) => this.visitHavingClause(clause as HavingClause));
        this.handlers.set(OrderByClause.kind, (clause) => this.visitOrderByClause(clause as OrderByClause));
        this.handlers.set(WindowsClause.kind, (clause) => this.visitWindowsClause(clause as WindowsClause));
        this.handlers.set(LimitClause.kind, (clause) => this.visitLimitClause(clause as LimitClause));
        this.handlers.set(OffsetClause.kind, (clause) => this.visitOffsetClause(clause as OffsetClause));
        this.handlers.set(FetchClause.kind, (clause) => this.visitFetchClause(clause as FetchClause));
        this.handlers.set(ForClause.kind, (clause) => this.visitForClause(clause as ForClause));

        // JOIN handlers
        this.handlers.set(JoinClause.kind, (clause) => this.visitJoinClause(clause as JoinClause));
        this.handlers.set(JoinOnClause.kind, (clause) => this.visitJoinOnClause(clause as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (clause) => this.visitJoinUsingClause(clause as JoinUsingClause));

        // Source handlers
        this.handlers.set(SourceExpression.kind, (source) => this.visitSourceExpression(source as SourceExpression));
        this.handlers.set(SubQuerySource.kind, (source) => this.visitSubQuerySource(source as SubQuerySource));

        // Value component handlers
        this.handlers.set(ColumnReference.kind, (ref) => this.visitColumnReference(ref as ColumnReference));
        this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        this.handlers.set(FunctionCall.kind, (func) => this.visitFunctionCall(func as FunctionCall));
        this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
        this.handlers.set(InlineQuery.kind, (query) => this.visitInlineQuery(query as InlineQuery));
        this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
        this.handlers.set(ArrayQueryExpression.kind, (expr) => this.visitArrayQueryExpression(expr as ArrayQueryExpression));
        this.handlers.set(ValueList.kind, (list) => this.visitValueList(list as ValueList));
        this.handlers.set(WindowFrameExpression.kind, (expr) => this.visitWindowFrameExpression(expr as WindowFrameExpression));
    }

    /**
     * Collects all ColumnReference instances from the given SQL query component.
     * 
     * This method performs a comprehensive traversal of the entire query structure,
     * including CTE definitions, subqueries, and all expression types to collect
     * every ColumnReference instance. The returned references are actual instances
     * from the query tree, allowing for direct modification.
     * 
     * @param query - The SQL query component to analyze. Can be SimpleSelectQuery, BinarySelectQuery, or any SqlComponent.
     * @returns An array of all ColumnReference instances found in the query. Each reference maintains its original object identity for modification purposes.
     * 
     * @example
     * ```typescript
     * const collector = new ColumnReferenceCollector();
     * const columnRefs = collector.collect(query);
     * 
     * // Analyze collected references
     * const tableReferences = new Map<string, number>();
     * columnRefs.forEach(ref => {
     *   const tableName = ref.namespaces?.[0]?.name || 'unqualified';
     *   tableReferences.set(tableName, (tableReferences.get(tableName) || 0) + 1);
     * });
     * 
     * console.log('Table reference counts:', tableReferences);
     * ```
     * 
     * @example
     * ```typescript
     * // Transform references during collection
     * const columnRefs = collector.collect(query);
     * 
     * // Replace all references to 'old_schema.table' with 'new_schema.table'
     * columnRefs.forEach(ref => {
     *   if (ref.namespaces?.length === 2 && 
     *       ref.namespaces[0].name === 'old_schema' && 
     *       ref.namespaces[1].name === 'table') {
     *     ref.namespaces[0].name = 'new_schema';
     *   }
     * });
     * ```
     * 
     * @since 0.11.16
     */
    public collect(query: SqlComponent): ColumnReference[] {
        this.columnReferences = [];
        this.visitedNodes.clear();
        // Handle queries directly - bypass visitor pattern issues
        if (query instanceof SimpleSelectQuery) {
            this.collectFromSimpleQuery(query);
        } else if (query instanceof BinarySelectQuery) {
            // Convert BinarySelectQuery to SimpleSelectQuery for consistent handling
            this.collectFromSimpleQuery(query.toSimpleQuery());
        } else {
            query.accept(this);
        }
        return [...this.columnReferences];
    }

    private collectFromSimpleQuery(query: SimpleSelectQuery): void {
        // First collect from CTEs (this is the key difference from SelectableColumnCollector)
        if (query.withClause && query.withClause.tables) {
            for (const cte of query.withClause.tables) {
                this.collectFromSimpleQuery(cte.query as SimpleSelectQuery);
            }
        }

        // Then collect from main query clauses
        this.collectFromSelectClause(query.selectClause);
        if (query.fromClause) this.collectFromFromClause(query.fromClause);
        if (query.whereClause) this.collectFromValueComponent(query.whereClause.condition);
        if (query.groupByClause && query.groupByClause.grouping) {
            for (const item of query.groupByClause.grouping) {
                this.collectFromValueComponent(item);
            }
        }
        if (query.havingClause) this.collectFromValueComponent(query.havingClause.condition);
        if (query.orderByClause && query.orderByClause.order) {
            for (const item of query.orderByClause.order) {
                if (typeof item === 'object' && 'value' in item && item.value) {
                    this.collectFromValueComponent((item as any).value);
                } else {
                    this.collectFromValueComponent(item as ValueComponent);
                }
            }
        }
    }


    private collectFromSelectClause(clause: SelectClause): void {
        for (const item of clause.items) {
            this.collectFromValueComponent(item.value);
        }
    }

    private collectFromFromClause(clause: FromClause): void {
        this.collectFromSourceExpression(clause.source);
        if (clause.joins) {
            for (const join of clause.joins) {
                this.collectFromSourceExpression(join.source);
                if (join.condition) {
                    this.collectFromValueComponent((join.condition as any).condition);
                }
            }
        }
    }

    private collectFromSourceExpression(source: SourceExpression): void {
        if (source.datasource instanceof SubQuerySource) {
            if (source.datasource.query instanceof SimpleSelectQuery) {
                this.collectFromSimpleQuery(source.datasource.query);
            } else if (source.datasource.query instanceof BinarySelectQuery) {
                this.collectFromSimpleQuery(source.datasource.query.toSimpleQuery());
            }
        }
    }

    private collectFromValueComponent(value: ValueComponent): void {
        if (value instanceof ColumnReference) {
            this.columnReferences.push(value);
        } else if (value instanceof BinaryExpression) {
            this.collectFromValueComponent(value.left);
            this.collectFromValueComponent(value.right);
        } else if (value instanceof UnaryExpression) {
            this.collectFromValueComponent(value.expression);
        } else if (value instanceof FunctionCall && value.argument) {
            this.collectFromValueComponent(value.argument);
        } else if (value instanceof CaseExpression) {
            if (value.condition) this.collectFromValueComponent(value.condition);
            if (value.switchCase && value.switchCase.cases) {
                for (const pair of value.switchCase.cases) {
                    this.collectFromValueComponent(pair.key);
                    this.collectFromValueComponent(pair.value);
                }
            }
            if (value.switchCase && value.switchCase.elseValue) this.collectFromValueComponent(value.switchCase.elseValue);
        } else if (value instanceof ParenExpression) {
            this.collectFromValueComponent(value.expression);
        } else if (value instanceof InlineQuery) {
            if (value.selectQuery instanceof SimpleSelectQuery) {
                this.collectFromSimpleQuery(value.selectQuery);
            } else if (value.selectQuery instanceof BinarySelectQuery) {
                this.collectFromSimpleQuery(value.selectQuery.toSimpleQuery());
            }
        }
        // Add more value component types as needed
    }

    public visit(component: SqlComponent): void {
        if (this.visitedNodes.has(component)) {
            return;
        }
        this.visitedNodes.add(component);

        const handler = this.handlers.get(component.getKind());
        if (handler) {
            handler(component);
        } else {
            // Unhandled component type - this is expected for some components
        }
    }

    // Query visitors
    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        if (query.withClause) query.withClause.accept(this);
        query.selectClause.accept(this);
        if (query.fromClause) query.fromClause.accept(this);
        if (query.whereClause) query.whereClause.accept(this);
        if (query.groupByClause) query.groupByClause.accept(this);
        if (query.havingClause) query.havingClause.accept(this);
        if (query.orderByClause) query.orderByClause.accept(this);
        if (query.windowClause) query.windowClause.accept(this);
        if (query.limitClause) query.limitClause.accept(this);
        if (query.offsetClause) query.offsetClause.accept(this);
        if (query.fetchClause) query.fetchClause.accept(this);
        if (query.forClause) query.forClause.accept(this);
    }


    // WITH clause and CTE visitors (this is the key difference from SelectableColumnCollector)
    private visitWithClause(clause: WithClause): void {
        for (const table of clause.tables) {
            table.accept(this);
        }
    }

    private visitCommonTable(table: CommonTable): void {
        // Visit the CTE query to collect column references within it
        table.query.accept(this);
    }

    // Clause visitors
    private visitSelectClause(clause: SelectClause): void {
        for (const item of clause.items) {
            item.value.accept(this);
        }
    }

    private visitFromClause(clause: FromClause): void {
        clause.source.accept(this);
        if (clause.joins) {
            for (const join of clause.joins) {
                join.accept(this);
            }
        }
    }

    private visitWhereClause(clause: WhereClause): void {
        clause.condition.accept(this);
    }

    private visitGroupByClause(clause: GroupByClause): void {
        if (clause.grouping) {
            for (const item of clause.grouping) {
                item.accept(this);
            }
        }
    }

    private visitHavingClause(clause: HavingClause): void {
        clause.condition.accept(this);
    }

    private visitOrderByClause(clause: OrderByClause): void {
        if (clause.order) {
            for (const item of clause.order) {
                if (typeof item === 'object' && 'value' in item && item.value) {
                    if (typeof item.value === 'object' && 'accept' in item.value) {
                        (item.value as ValueComponent).accept(this);
                    }
                } else if (typeof item === 'object' && 'accept' in item) {
                    (item as ValueComponent).accept(this);
                }
            }
        }
    }

    private visitWindowsClause(clause: WindowsClause): void {
        for (const window of clause.windows) {
            window.expression.accept(this);
        }
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

    private visitForClause(clause: ForClause): void {
        // ForClause typically doesn't contain column references
    }

    // JOIN visitors
    private visitJoinClause(clause: JoinClause): void {
        clause.source.accept(this);
        if (clause.condition) {
            clause.condition.accept(this);
        }
    }

    private visitJoinOnClause(clause: JoinOnClause): void {
        clause.condition.accept(this);
    }

    private visitJoinUsingClause(clause: JoinUsingClause): void {
        clause.condition.accept(this);
    }

    // Source visitors
    private visitSourceExpression(source: SourceExpression): void {
        source.datasource.accept(this);
    }

    private visitSubQuerySource(source: SubQuerySource): void {
        source.query.accept(this);
    }

    // Value component visitors
    private visitColumnReference(ref: ColumnReference): void {
        this.columnReferences.push(ref);
    }

    private visitBinaryExpression(expr: BinaryExpression): void {
        expr.left.accept(this);
        expr.right.accept(this);
    }

    private visitUnaryExpression(expr: UnaryExpression): void {
        expr.expression.accept(this);
    }

    private visitFunctionCall(func: FunctionCall): void {
        if (func.argument) {
            func.argument.accept(this);
        }
    }

    private visitCaseExpression(expr: CaseExpression): void {
        if (expr.condition) expr.condition.accept(this);
        if (expr.switchCase && expr.switchCase.cases) {
            for (const pair of expr.switchCase.cases) {
                pair.key.accept(this);
                pair.value.accept(this);
            }
        }
        if (expr.switchCase && expr.switchCase.elseValue) expr.switchCase.elseValue.accept(this);
    }

    private visitCastExpression(expr: CastExpression): void {
        expr.input.accept(this);
    }

    private visitBetweenExpression(expr: BetweenExpression): void {
        expr.expression.accept(this);
        expr.lower.accept(this);
        expr.upper.accept(this);
    }

    private visitParenExpression(expr: ParenExpression): void {
        expr.expression.accept(this);
    }

    private visitInlineQuery(query: InlineQuery): void {
        query.selectQuery.accept(this);
    }

    private visitArrayExpression(expr: ArrayExpression): void {
        if (expr.expression) {
            expr.expression.accept(this);
        }
    }

    private visitArrayQueryExpression(expr: ArrayQueryExpression): void {
        expr.query.accept(this);
    }

    private visitValueList(list: ValueList): void {
        if (list.values) {
            for (const item of list.values) {
                item.accept(this);
            }
        }
    }

    private visitWindowFrameExpression(expr: WindowFrameExpression): void {
        if (expr.partition) expr.partition.accept(this);
        if (expr.order) expr.order.accept(this);
    }
}