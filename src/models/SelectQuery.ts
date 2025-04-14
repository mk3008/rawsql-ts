import { SqlComponent } from "./SqlComponent";
import { ForClause, FromClause, GroupByClause, HavingClause, LimitClause, OrderByClause, SelectClause, WhereClause, WindowFrameClause, WithClause } from "./Clause";
import { BinaryExpression, RawString, TupleExpression, ValueComponent } from "./ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { ValueParser } from "../parsers/ValueParser";

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
        return new BinarySelectQuery(this, operator, query);
    }
}
