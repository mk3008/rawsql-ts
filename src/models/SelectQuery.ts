import { SqlComponent } from "./SqlComponent";
// Add JoinClause, JoinOnClause, SourceExpression, SourceAliasExpression, TableSource
import { ForClause, FromClause, GroupByClause, HavingClause, JoinClause, JoinOnClause, LimitClause, OrderByClause, SelectClause, SourceAliasExpression, SourceExpression, TableSource, WhereClause, WindowFrameClause, WithClause, JoinConditionComponent } from "./Clause";
// Add ColumnReference
import { BinaryExpression, ColumnReference, RawString, TupleExpression, ValueComponent } from "./ValueComponent";
import { ValueParser } from "../parsers/ValueParser";
import { CTECollector } from "../visitors/CTECollector";
import { CTEDisabler } from "../visitors/CTEDisabler";
import { CTEInjector } from "../visitors/CTEInjector";
import { SelectableColumnCollector } from "../visitors/SelectableColumnCollector";
import { SourceParser } from "../parsers/SourceParser";
import { join } from "path";

export type SelectQuery = SimpleSelectQuery | BinarySelectQuery | ValuesQuery;

export class ValuesQuery extends SqlComponent {
    static kind = Symbol("ValuesQuery");
    tuples: TupleExpression[];
    constructor(tuples: TupleExpression[]) {
        super();
        this.tuples = tuples;
    }
}

export class SimpleSelectQuery extends SqlComponent {
    static kind = Symbol("SelectQuery");
    WithClause: WithClause | null = null;
    selectClause: SelectClause;
    fromClause: FromClause | null;
    whereClause: WhereClause | null;
    groupByClause: GroupByClause | null;
    havingClause: HavingClause | null;
    orderByClause: OrderByClause | null;
    windowFrameClause: WindowFrameClause | null;
    rowLimitClause: LimitClause | null;
    forClause: ForClause | null;

    constructor(
        withClause: WithClause | null,
        selectClause: SelectClause,
        fromClause: FromClause | null,
        whereClause: WhereClause | null,
        groupByClause: GroupByClause | null,
        havingClause: HavingClause | null,
        orderByClause: OrderByClause | null,
        windowFrameClause: WindowFrameClause | null,
        rowLimitClause: LimitClause | null,
        forClause: ForClause | null
    ) {
        super();
        this.WithClause = withClause;
        this.selectClause = selectClause;
        this.fromClause = fromClause;
        this.whereClause = whereClause;
        this.groupByClause = groupByClause;
        this.havingClause = havingClause;
        this.orderByClause = orderByClause;
        this.windowFrameClause = windowFrameClause;
        this.rowLimitClause = rowLimitClause;
        this.forClause = forClause;
    }

    /**
     * Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
     * using UNION as the operator.
     * 
     * @param rightQuery The right side of the UNION
     * @returns A new BinarySelectQuery representing "this UNION rightQuery"
     */
    public toUnion(rightQuery: SelectQuery): BinarySelectQuery {
        return this.toBinaryQuery('union', rightQuery);
    }

    /**
     * Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
     * using UNION ALL as the operator.
     * 
     * @param rightQuery The right side of the UNION ALL
     * @returns A new BinarySelectQuery representing "this UNION ALL rightQuery"
     */
    public toUnionAll(rightQuery: SelectQuery): BinarySelectQuery {
        return this.toBinaryQuery('union all', rightQuery);
    }

    /**
     * Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
     * using INTERSECT as the operator.
     * 
     * @param rightQuery The right side of the INTERSECT
     * @returns A new BinarySelectQuery representing "this INTERSECT rightQuery"
     */
    public toIntersect(rightQuery: SelectQuery): BinarySelectQuery {
        return this.toBinaryQuery('intersect', rightQuery);
    }

    /**
     * Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
     * using INTERSECT ALL as the operator.
     * 
     * @param rightQuery The right side of the INTERSECT ALL
     * @returns A new BinarySelectQuery representing "this INTERSECT ALL rightQuery"
     */
    public toIntersectAll(rightQuery: SelectQuery): BinarySelectQuery {
        return this.toBinaryQuery('intersect all', rightQuery);
    }

    /**
     * Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
     * using EXCEPT as the operator.
     * 
     * @param rightQuery The right side of the EXCEPT
     * @returns A new BinarySelectQuery representing "this EXCEPT rightQuery"
     */
    public toExcept(rightQuery: SelectQuery): BinarySelectQuery {
        return this.toBinaryQuery('except', rightQuery);
    }

    /**
     * Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
     * using EXCEPT ALL as the operator.
     * 
     * @param rightQuery The right side of the EXCEPT ALL
     * @returns A new BinarySelectQuery representing "this EXCEPT ALL rightQuery"
     */
    public toExceptAll(rightQuery: SelectQuery): BinarySelectQuery {
        return this.toBinaryQuery('except all', rightQuery);
    }

    /**
     * Creates a new BinarySelectQuery with this query as the left side and the provided query as the right side,
     * using the specified operator.
     * 
     * @param operator SQL operator to use (e.g. 'union', 'union all', 'intersect', 'except')
     * @param rightQuery The right side of the binary operation
     * @returns A new BinarySelectQuery representing "this [operator] rightQuery"
     */
    public toBinaryQuery(operator: string, rightQuery: SelectQuery): BinarySelectQuery {
        return new BinarySelectQuery(this, operator, rightQuery);
    }

    /**
     * Appends a new condition to the query's WHERE clause using AND logic.
     * The condition is provided as a raw SQL string which is parsed internally.
     * 
     * @param rawCondition Raw SQL string representing the condition (e.g. "status = 'active'")
     */
    public appendWhereRaw(rawCondition: string): void {
        // Parse the raw condition string into a ValueComponent
        const parsedCondition = ValueParser.parseFromText(rawCondition);
        this.appendWhere(parsedCondition);
    }

    /**
     * Appends a new condition to the query's WHERE clause using AND logic.
     * The condition is provided as a ValueComponent object.
     * 
     * @param condition ValueComponent representing the condition
     */
    public appendWhere(condition: ValueComponent): void {
        if (!this.whereClause) {
            // No existing WHERE clause, create a new one with the condition
            this.whereClause = new WhereClause(condition);
        } else {
            // Existing WHERE clause, wrap with AND expression
            this.whereClause.condition = new BinaryExpression(
                this.whereClause.condition,
                'and',
                condition
            );
        }
    }

    /**
     * Appends a new condition to the query's HAVING clause using AND logic.
     * The condition is provided as a raw SQL string which is parsed internally.
     * 
     * @param rawCondition Raw SQL string representing the condition (e.g. "count(*) > 5")
     */
    public appendHavingRaw(rawCondition: string): void {
        // Parse the raw condition string into a ValueComponent
        const parsedCondition = ValueParser.parseFromText(rawCondition);
        this.appendHaving(parsedCondition);
    }

    /**
     * Appends a new condition to the query's HAVING clause using AND logic.
     * The condition is provided as a ValueComponent object.
     * 
     * @param condition ValueComponent representing the condition
     */
    public appendHaving(condition: ValueComponent): void {
        if (!this.havingClause) {
            // No existing HAVING clause, create a new one with the condition
            this.havingClause = new HavingClause(condition);
        } else {
            // Existing HAVING clause, wrap with AND expression
            this.havingClause.condition = new BinaryExpression(
                this.havingClause.condition,
                'and',
                condition
            );
        }
    }

    /**
     * Appends an INNER JOIN clause to the query.
     * @param joinSourceRawText The table source text to join (e.g., "my_table", "schema.my_table")
     * @param alias The alias for the joined table
     * @param columns The columns to use for the join condition (e.g. ["user_id"])
     */
    public innerJoinRaw(joinSourceRawText: string, alias: string, columns: string[]): void {
        this.appendRawSource('inner join', joinSourceRawText, alias, columns);
    }

    /**
     * Appends a LEFT JOIN clause to the query.
     * @param joinSourceRawText The table source text to join
     * @param alias The alias for the joined table
     * @param columns The columns to use for the join condition
     */
    public leftJoinRaw(joinSourceRawText: string, alias: string, columns: string[]): void {
        this.appendRawSource('left join', joinSourceRawText, alias, columns);
    }

    /**
     * Appends a RIGHT JOIN clause to the query.
     * @param joinSourceRawText The table source text to join
     * @param alias The alias for the joined table
     * @param columns The columns to use for the join condition
     */
    public rightJoinRaw(joinSourceRawText: string, alias: string, columns: string[]): void {
        this.appendRawSource('right join', joinSourceRawText, alias, columns);
    }    /**
     * Internal helper to append a JOIN clause.
     * Parses the table source, finds the corresponding columns in the existing query context,
     * and builds the JOIN condition.
     * @param joinType Type of join (e.g., 'inner join', 'left join')
     * @param joinSourceRawText Raw text for the table/source to join (e.g., "my_table", "schema.another_table")
     * @param alias Alias for the table/source being joined
     * @param columns Array of column names to join on
     */
    private appendRawSource(joinType: string, joinSourceRawText: string, alias: string, columns: string[]): void {
        const tableSource = SourceParser.parseFromText(joinSourceRawText);
        const sourceExpr = new SourceExpression(tableSource, new SourceAliasExpression(alias, null));
        this.appendSource(joinType, sourceExpr, columns);
    }

    private appendSource(joinType: string, sourceExpr: SourceExpression, columns: string[]): void {
        if (!this.fromClause) {
            throw new Error('A FROM clause is required to add a JOIN condition.');
        }

        const collector = new SelectableColumnCollector();
        // Collect columns that match the join condition
        const valueSets = collector.collect(this);
        let joinCondition: ValueComponent | null = null; // Initialize JOIN condition
        let count = 0;

        const sourceAlias = sourceExpr.getAliasName();
        if (!sourceAlias) {
            throw new Error('An alias is required for the source expression to add a JOIN condition.');
        }

        for (const valueSet of valueSets) {
            if (columns.some(col => col == valueSet.name)) {
                // If the column matches, create the JOIN condition
                const expr = new BinaryExpression(
                    valueSet.value,
                    '=',
                    new ColumnReference([sourceAlias], valueSet.name)
                );
                if (joinCondition) {
                    joinCondition = new BinaryExpression(
                        joinCondition,
                        'and',
                        expr
                    );
                } else {
                    joinCondition = expr;
                }
                count++;
            }
        }

        if (!joinCondition || count !== columns.length) {
            throw new Error(`Invalid JOIN condition. The specified columns were not found: ${columns.join(', ')}`);
        }

        const joinOnClause = new JoinOnClause(joinCondition);
        const joinClause = new JoinClause(joinType, sourceExpr, joinOnClause, false);

        if (this.fromClause) {
            if (this.fromClause.joins) {
                this.fromClause.joins.push(joinClause);
            } else {
                this.fromClause.joins = [joinClause];
            }
        }
    }
}

export class BinarySelectQuery extends SqlComponent {
    static kind = Symbol("BinarySelectQuery");
    left: SelectQuery;
    operator: RawString; // e.g. UNION, INTERSECT, EXCEPT
    right: SelectQuery;

    constructor(left: SelectQuery, operator: string, right: SelectQuery) {
        super();
        this.left = left;
        this.operator = new RawString(operator);
        this.right = right;
    }

    /**
     * Appends another query to this binary query using UNION as the operator.
     * This creates a new BinarySelectQuery where the left side is this binary query
     * and the right side is the provided query.
     * 
     * @param query The query to append with UNION
     * @returns A new BinarySelectQuery representing "(this) UNION query"
     */
    public appendUnion(query: SelectQuery): BinarySelectQuery {
        return this.appendSelectQuery('union', query);
    }

    /**
     * Appends another query to this binary query using UNION ALL as the operator.
     * This creates a new BinarySelectQuery where the left side is this binary query
     * and the right side is the provided query.
     * 
     * @param query The query to append with UNION ALL
     * @returns A new BinarySelectQuery representing "(this) UNION ALL query"
     */
    public appendUnionAll(query: SelectQuery): BinarySelectQuery {
        return this.appendSelectQuery('union all', query);
    }

    /**
     * Appends another query to this binary query using INTERSECT as the operator.
     * This creates a new BinarySelectQuery where the left side is this binary query
     * and the right side is the provided query.
     * 
     * @param query The query to append with INTERSECT
     * @returns A new BinarySelectQuery representing "(this) INTERSECT query"
     */
    public appendIntersect(query: SelectQuery): BinarySelectQuery {
        return this.appendSelectQuery('intersect', query);
    }

    /**
     * Appends another query to this binary query using INTERSECT ALL as the operator.
     * This creates a new BinarySelectQuery where the left side is this binary query
     * and the right side is the provided query.
     * 
     * @param query The query to append with INTERSECT ALL
     * @returns A new BinarySelectQuery representing "(this) INTERSECT ALL query"
     */
    public appendIntersectAll(query: SelectQuery): BinarySelectQuery {
        return this.appendSelectQuery('intersect all', query);
    }

    /**
     * Appends another query to this binary query using EXCEPT as the operator.
     * This creates a new BinarySelectQuery where the left side is this binary query
     * and the right side is the provided query.
     * 
     * @param query The query to append with EXCEPT
     * @returns A new BinarySelectQuery representing "(this) EXCEPT query"
     */
    public appendExcept(query: SelectQuery): BinarySelectQuery {
        return this.appendSelectQuery('except', query);
    }

    /**
     * Appends another query to this binary query using EXCEPT ALL as the operator.
     * This creates a new BinarySelectQuery where the left side is this binary query
     * and the right side is the provided query.
     * 
     * @param query The query to append with EXCEPT ALL
     * @returns A new BinarySelectQuery representing "(this) EXCEPT ALL query"
     */
    public appendExceptAll(query: SelectQuery): BinarySelectQuery {
        return this.appendSelectQuery('except all', query);
    }

    /**
     * Appends another query to this binary query using the specified operator.
     * This creates a new BinarySelectQuery where the left side is this binary query
     * and the right side is the provided query.
     * 
     * @param operator SQL operator to use (e.g. 'union', 'union all', 'intersect', 'except')
     * @param query The query to append with the specified operator
     * @returns A new BinarySelectQuery representing "(this) [operator] query"
     */
    public appendSelectQuery(operator: string, query: SelectQuery): BinarySelectQuery {
        const collector = new CTECollector();
        let allCommonTables = collector.collect(this);
        allCommonTables.push(...collector.collect(query));

        const disabler = new CTEDisabler();
        const injector = new CTEInjector();

        this.left = injector.inject(disabler.execute(this), allCommonTables);
        this.operator = new RawString(operator);
        this.right = disabler.execute(query);

        return this;
    }
}
