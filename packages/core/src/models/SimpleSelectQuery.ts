import { SqlComponent } from "./SqlComponent";
import { ForClause, FromClause, GroupByClause, HavingClause, JoinClause, JoinOnClause, LimitClause, OrderByClause, SelectClause, SourceExpression, SubQuerySource, SourceAliasExpression, WhereClause, WindowsClause as WindowClause, WithClause, CommonTable, OffsetClause, FetchClause } from "./Clause";
import { BinaryExpression, ColumnReference, ValueComponent, SqlParameterValue } from "./ValueComponent";
import { ValueParser } from "../parsers/ValueParser";
import { CTENormalizer } from "../transformers/CTENormalizer";
import { SelectableColumnCollector } from "../transformers/SelectableColumnCollector";
import { SourceParser } from "../parsers/SourceParser";
import { BinarySelectQuery } from "./BinarySelectQuery";
import type {
    SelectQuery,
    CTEOptions,
    CTEManagement,
    InsertQueryConversionOptions,
    UpdateQueryConversionOptions,
    DeleteQueryConversionOptions,
    MergeQueryConversionOptions
} from "./SelectQuery";
import { DuplicateCTEError, InvalidCTENameError, CTENotFoundError } from "./CTEError";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { Formatter } from "../transformers/Formatter";
import { TableColumnResolver } from "../transformers/TableColumnResolver";
import { UpstreamSelectQueryFinder } from "../transformers/UpstreamSelectQueryFinder";
import { QueryBuilder } from "../transformers/QueryBuilder";
import { ParameterHelper } from "../utils/ParameterHelper";
import type { InsertQuery } from "./InsertQuery";
import type { UpdateQuery } from "./UpdateQuery";
import type { DeleteQuery } from "./DeleteQuery";
import type { MergeQuery } from "./MergeQuery";

/**
 * Represents a single SELECT statement with full clause support (WITH, JOIN, GROUP BY, etc.).
 * Provides the fluent CTE management API used throughout packages/core/tests/models/SelectQuery.cte-management.test.ts.
 *
 * @example
 * ```typescript
 * const query = SelectQueryParser.parse('SELECT id, email FROM users').toSimpleQuery();
 * const active = SelectQueryParser.parse('SELECT id FROM users WHERE active = true');
 *
 * query
 *   .addCTE('active_users', active)
 *   .toUnionAll(SelectQueryParser.parse('SELECT id, email FROM legacy_users'));
 * ```
 */
export class SimpleSelectQuery extends SqlComponent implements SelectQuery, CTEManagement {

    static kind = Symbol("SelectQuery");
    readonly __selectQueryType: 'SelectQuery' = 'SelectQuery'; // Discriminator for type safety
    headerComments: string[] | null = null; // Comments that appear before WITH clause
    withClause: WithClause | null;
    selectClause: SelectClause;
    fromClause: FromClause | null;
    whereClause: WhereClause | null;
    groupByClause: GroupByClause | null;
    havingClause: HavingClause | null;
    orderByClause: OrderByClause | null;
    windowClause: WindowClause | null;
    limitClause: LimitClause | null;
    offsetClause: OffsetClause | null;
    fetchClause: FetchClause | null;
    forClause: ForClause | null;
    
    // Performance optimization: O(1) CTE name lookups
    private cteNameCache: Set<string> = new Set();

    constructor(params: {
        selectClause: SelectClause,
        fromClause?: FromClause | null,
        whereClause?: WhereClause | null,
        groupByClause?: GroupByClause | null,
        havingClause?: HavingClause | null,
        orderByClause?: OrderByClause | null,
        windowClause?: WindowClause | null,
        limitClause?: LimitClause | null,
        offsetClause?: OffsetClause | null,
        fetchClause?: FetchClause | null,
        forClause?: ForClause | null,
        withClause?: WithClause | null,
    }) {
        super();
        this.withClause = params.withClause ?? null;
        this.selectClause = params.selectClause;
        this.fromClause = params.fromClause ?? null;
        this.whereClause = params.whereClause ?? null;
        this.groupByClause = params.groupByClause ?? null;
        this.havingClause = params.havingClause ?? null;
        this.orderByClause = params.orderByClause ?? null;
        this.windowClause = params.windowClause ?? null;
        this.limitClause = params.limitClause ?? null;
        this.offsetClause = params.offsetClause ?? null;
        this.fetchClause = params.fetchClause ?? null;
        this.forClause = params.forClause ?? null;
        
        // Initialize CTE name cache from existing withClause
        this.initializeCTECache();
    }

    /**
     * Initializes the CTE name cache from existing withClause.
     * Called during construction and when withClause is modified externally.
     * @private
     */
    private initializeCTECache(): void {
        this.cteNameCache.clear();
        if (this.withClause?.tables) {
            for (const table of this.withClause.tables) {
                this.cteNameCache.add(table.aliasExpression.table.name);
            }
        }
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

    public toInsertQuery(options: InsertQueryConversionOptions): InsertQuery {
        return QueryBuilder.buildInsertQuery(this, options);
    }

    public toUpdateQuery(options: UpdateQueryConversionOptions): UpdateQuery {
        return QueryBuilder.buildUpdateQuery(this, options);
    }

    public toDeleteQuery(options: DeleteQueryConversionOptions): DeleteQuery {
        return QueryBuilder.buildDeleteQuery(this, options);
    }

    public toMergeQuery(options: MergeQueryConversionOptions): MergeQuery {
        return QueryBuilder.buildMergeQuery(this, options);
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
        return QueryBuilder.buildBinaryQuery([this, rightQuery], operator);
    }

    /**
     * Appends a new condition to the query's WHERE clause using AND logic.
     * The condition is provided as a raw SQL string which is parsed internally.
     * 
     * @param rawCondition Raw SQL string representing the condition (e.g. "status = 'active'")
     */
    public appendWhereRaw(rawCondition: string): void {
        const parsedCondition = ValueParser.parse(rawCondition);
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
            this.whereClause = new WhereClause(condition);
        } else {
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
        const parsedCondition = ValueParser.parse(rawCondition);
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
            this.havingClause = new HavingClause(condition);
        } else {
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
     * @param columns The columns to use for the join condition (e.g. ["user_id"] or "user_id")
     */
    public innerJoinRaw(joinSourceRawText: string, alias: string, columns: string | string[], resolver: TableColumnResolver | null = null): void {
        this.joinSourceRaw('inner join', joinSourceRawText, alias, columns, resolver);
    }

    /**
     * Appends a LEFT JOIN clause to the query.
     * @param joinSourceRawText The table source text to join
     * @param alias The alias for the joined table
     * @param columns The columns to use for the join condition
     */
    public leftJoinRaw(joinSourceRawText: string, alias: string, columns: string | string[], resolver: TableColumnResolver | null = null): void {
        this.joinSourceRaw('left join', joinSourceRawText, alias, columns, resolver);
    }

    /**
     * Appends a RIGHT JOIN clause to the query.
     * @param joinSourceRawText The table source text to join
     * @param alias The alias for the joined table
     * @param columns The columns to use for the join condition
     */
    public rightJoinRaw(joinSourceRawText: string, alias: string, columns: string | string[], resolver: TableColumnResolver | null = null): void {
        this.joinSourceRaw('right join', joinSourceRawText, alias, columns, resolver);
    }

    /**
     * Appends an INNER JOIN clause to the query using a SourceExpression.
     * @param sourceExpr The source expression to join
     * @param columns The columns to use for the join condition
     */
    public innerJoin(sourceExpr: SourceExpression, columns: string | string[], resolver: TableColumnResolver | null = null): void {
        this.joinSource('inner join', sourceExpr, columns, resolver);
    }

    /**
     * Appends a LEFT JOIN clause to the query using a SourceExpression.
     * @param sourceExpr The source expression to join
     * @param columns The columns to use for the join condition
     */
    public leftJoin(sourceExpr: SourceExpression, columns: string | string[], resolver: TableColumnResolver | null = null): void {
        this.joinSource('left join', sourceExpr, columns, resolver);
    }

    /**
     * Appends a RIGHT JOIN clause to the query using a SourceExpression.
     * @param sourceExpr The source expression to join
     * @param columns The columns to use for the join condition
     */
    public rightJoin(sourceExpr: SourceExpression, columns: string | string[], resolver: TableColumnResolver | null = null): void {
        this.joinSource('right join', sourceExpr, columns, resolver);
    }

    /**
     * Internal helper to append a JOIN clause.
     * Parses the table source, finds the corresponding columns in the existing query context,
     * and builds the JOIN condition.
     * @param joinType Type of join (e.g., 'inner join', 'left join')
     * @param joinSourceRawText Raw text for the table/source to join (e.g., "my_table", "schema.another_table")
     * @param alias Alias for the table/source being joined
     * @param columns Array or string of column names to join on
     */
    private joinSourceRaw(joinType: string, joinSourceRawText: string, alias: string, columns: string | string[], resolver: TableColumnResolver | null = null): void {
        const tableSource = SourceParser.parse(joinSourceRawText);
        const sourceExpr = new SourceExpression(tableSource, new SourceAliasExpression(alias, null));
        this.joinSource(joinType, sourceExpr, columns, resolver);
    }

    /**
     * Internal helper to append a JOIN clause using a SourceExpression.
     * @param joinType Type of join (e.g., 'inner join', 'left join')
     * @param sourceExpr The source expression to join
     * @param columns Array or string of column names to join on
     */
    private joinSource(joinType: string, sourceExpr: SourceExpression, columns: string | string[], resolver: TableColumnResolver | null = null): void {
        if (!this.fromClause) {
            throw new Error('A FROM clause is required to add a JOIN condition.');
        }

        // Always treat columns as array
        const columnsArr = Array.isArray(columns) ? columns : [columns];

        const collector = new SelectableColumnCollector(resolver);
        const valueSets = collector.collect(this);
        let joinCondition: ValueComponent | null = null;
        let count = 0;

        const sourceAlias = sourceExpr.getAliasName();
        if (!sourceAlias) {
            throw new Error('An alias is required for the source expression to add a JOIN condition.');
        }

        for (const valueSet of valueSets) {
            if (columnsArr.some(col => col == valueSet.name)) {
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

        if (!joinCondition || count !== columnsArr.length) {
            throw new Error(`Invalid JOIN condition. The specified columns were not found: ${columnsArr.join(', ')}`);
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

        CTENormalizer.normalize(this);
    }

    // Returns a SourceExpression wrapping this query as a subquery source.
    // Alias is required for correct SQL generation and join logic.
    public toSource(alias: string): SourceExpression {
        if (!alias || alias.trim() === "") {
            throw new Error("Alias is required for toSource(). Please specify a non-empty alias name.");
        }
        return new SourceExpression(
            new SubQuerySource(this),
            new SourceAliasExpression(alias, null)
        );
    }

    public appendWith(commonTable: CommonTable | CommonTable[]): void {
        // Always treat as array for simplicity
        const tables = Array.isArray(commonTable) ? commonTable : [commonTable];
        if (!this.withClause) {
            this.withClause = new WithClause(false, tables);
        } else {
            this.withClause.tables.push(...tables);
        }

        CTENormalizer.normalize(this);
    }

    /**
     * Appends a CommonTable (CTE) to the WITH clause from raw SQL text and alias.
     * If alias is provided, it will be used as the CTE name.
     *
     * @param rawText Raw SQL string representing the CTE body (e.g. '(SELECT ...)')
     * @param alias Optional alias for the CTE (e.g. 'cte_name')
     */
    public appendWithRaw(rawText: string, alias: string): void {
        const query = SelectQueryParser.parse(rawText);
        const commonTable = new CommonTable(query, alias, null);
        this.appendWith(commonTable);
    }

    /**
     * Overrides a select item using a template literal function.
     * The callback receives the SQL string of the original expression and must return a new SQL string.
     * The result is parsed and set as the new select item value.
     *
     * Example usage:
     *   query.overrideSelectItemRaw("journal_date", expr => `greatest(${expr}, DATE '2025-01-01')`)
     *
     * @param columnName The name of the column to override
     * @param fn Callback that receives the SQL string of the original expression and returns a new SQL string
     */
    public overrideSelectItemExpr(columnName: string, fn: (expr: string) => string): void {
        const items = this.selectClause.items.filter(item => item.identifier?.name === columnName);
        if (items.length === 0) {
            throw new Error(`Column ${columnName} not found in the query`);
        }
        if (items.length > 1) {
            throw new Error(`Duplicate column name ${columnName} found in the query`);
        }
        const item = items[0];
        const formatter = new Formatter();
        const exprSql = formatter.visit(item.value);
        const newValue = fn(exprSql);
        item.value = ValueParser.parse(newValue);
    }

    /**
     * Appends a WHERE clause using the expression for the specified column.
     * If `options.upstream` is true, applies to all upstream queries containing the column.
     * If false or omitted, applies only to the current query.
     *
     * @param columnName The name of the column to target.
     * @param exprBuilder Function that receives the column expression as a string and returns the WHERE condition string.
     * @param options Optional settings. If `upstream` is true, applies to upstream queries.
     */
    public appendWhereExpr(
        columnName: string,
        exprBuilder: (expr: string) => string,
        options?: { upstream?: boolean }
    ): void {
        // If upstream option is true, find all upstream queries containing the column
        if (options && options.upstream) {
            // Use UpstreamSelectQueryFinder to find all relevant queries
            // (Assume UpstreamSelectQueryFinder is imported)
            const finder = new UpstreamSelectQueryFinder();
            const queries = finder.find(this, [columnName]);
            const collector = new SelectableColumnCollector();
            const formatter = new Formatter();
            for (const q of queries) {
                const exprs = collector.collect(q).filter(item => item.name === columnName).map(item => item.value);
                if (exprs.length !== 1) {
                    throw new Error(`Expected exactly one expression for column '${columnName}'`);
                }
                const exprStr = formatter.format(exprs[0]);
                q.appendWhereRaw(exprBuilder(exprStr));
            }
        } else {
            // Only apply to the current query
            const collector = new SelectableColumnCollector();
            const formatter = new Formatter();
            const exprs = collector.collect(this).filter(item => item.name === columnName).map(item => item.value);
            if (exprs.length !== 1) {
                throw new Error(`Expected exactly one expression for column '${columnName}'`);
            }
            const exprStr = formatter.format(exprs[0]);
            this.appendWhereRaw(exprBuilder(exprStr));
        }
    }

    /**
     * Sets the value of a parameter by name in this query.
     * @param name Parameter name
     * @param value Value to set
     */
    public setParameter(name: string, value: SqlParameterValue): this {
        ParameterHelper.set(this, name, value);
        return this;
    }

    /**
     * Returns this SimpleSelectQuery instance (identity function).
     * @returns This SimpleSelectQuery instance
     */
    public toSimpleQuery(): SimpleSelectQuery {
        return this;
    }

    /**
     * Adds a CTE (Common Table Expression) to the query.
     * 
     * @param name CTE name/alias (must be non-empty)
     * @param query SelectQuery to use as CTE
     * @param options Optional configuration
     * @param options.materialized PostgreSQL-specific: true = MATERIALIZED, false = NOT MATERIALIZED, null/undefined = no hint
     * 
     * @throws {InvalidCTENameError} When name is empty or whitespace-only
     * @throws {DuplicateCTEError} When CTE with same name already exists
     * 
     * @example
     * ```typescript
     * // Basic CTE
     * query.addCTE('active_users', 
     *   SelectQueryParser.parse('SELECT * FROM users WHERE active = true')
     * );
     * 
     * // PostgreSQL MATERIALIZED CTE (forces materialization)
     * query.addCTE('expensive_calc', expensiveQuery, { materialized: true });
     * 
     * // PostgreSQL NOT MATERIALIZED CTE (prevents materialization)
     * query.addCTE('simple_view', simpleQuery, { materialized: false });
     * ```
     * 
     * @remarks
     * - MATERIALIZED/NOT MATERIALIZED is PostgreSQL-specific syntax
     * - Other databases will ignore the materialized hint
     * - CTE names must be unique within the query
     * - Method supports fluent chaining
     */
    public addCTE(name: string, query: SelectQuery, options?: CTEOptions): this {
        // Validate CTE name
        if (!name || name.trim() === '') {
            throw new InvalidCTENameError(name, 'name cannot be empty or whitespace-only');
        }
        
        // Check for duplicate CTE name
        if (this.hasCTE(name)) {
            throw new DuplicateCTEError(name);
        }
        
        const materialized = options?.materialized ?? null;
        const commonTable = new CommonTable(query, name, materialized);
        this.appendWith(commonTable);
        
        // Update cache for O(1) future lookups
        this.cteNameCache.add(name);
        return this;
    }

    /**
     * Removes a CTE by name from the query.
     * 
     * @param name CTE name to remove
     * 
     * @throws {CTENotFoundError} When CTE with specified name doesn't exist
     * 
     * @example
     * ```typescript
     * query.addCTE('temp_data', tempQuery);
     * query.removeCTE('temp_data'); // Removes the CTE
     * 
     * // Throws CTENotFoundError
     * query.removeCTE('non_existent'); 
     * ```
     * 
     * @remarks
     * - Throws error if CTE doesn't exist (strict mode for safety)
     * - Use hasCTE() to check existence before removal if needed
     * - Method supports fluent chaining
     */
    public removeCTE(name: string): this {
        if (!this.hasCTE(name)) {
            throw new CTENotFoundError(name);
        }
        
        if (this.withClause) {
            this.withClause.tables = this.withClause.tables.filter(table => table.aliasExpression.table.name !== name);
            if (this.withClause.tables.length === 0) {
                this.withClause = null;
            }
        }
        
        // Update cache for O(1) future lookups
        this.cteNameCache.delete(name);
        return this;
    }

    /**
     * Checks if a CTE with the given name exists in the query.
     * Optimized with O(1) lookup using internal cache.
     * 
     * @param name CTE name to check
     * @returns true if CTE exists, false otherwise
     * 
     * @example
     * ```typescript
     * query.addCTE('user_stats', statsQuery);
     * 
     * if (query.hasCTE('user_stats')) {
     *   console.log('CTE exists');
     * }
     * 
     * query.removeCTE('user_stats');
     * console.log(query.hasCTE('user_stats')); // false
     * ```
     * 
     * @remarks
     * - Performs case-sensitive name matching
     * - Returns false for queries without any CTEs
     * - Useful for conditional CTE operations
     * - O(1) performance using internal cache
     */
    public hasCTE(name: string): boolean {
        return this.cteNameCache.has(name);
    }

    /**
     * Returns an array of all CTE names in the query.
     * 
     * @returns Array of CTE names in the order they were defined
     * 
     * @example
     * ```typescript
     * const query = SelectQueryParser.parse('SELECT * FROM data').toSimpleQuery();
     * 
     * // Empty query
     * console.log(query.getCTENames()); // []
     * 
     * // Add CTEs
     * query.addCTE('users', userQuery);
     * query.addCTE('orders', orderQuery);
     * 
     * console.log(query.getCTENames()); // ['users', 'orders']
     * 
     * // Use for validation
     * const expectedCTEs = ['users', 'orders', 'products'];
     * const actualCTEs = query.getCTENames();
     * const missingCTEs = expectedCTEs.filter(name => !actualCTEs.includes(name));
     * ```
     * 
     * @remarks
     * - Returns empty array for queries without CTEs
     * - Names are returned in definition order
     * - Useful for debugging and validation
     * - Names reflect actual CTE aliases, not table references
     * - Performance: O(n) but avoids redundant array mapping
     */
    public getCTENames(): string[] {
        return this.withClause?.tables.map(table => table.aliasExpression.table.name) ?? [];
    }

    /**
     * Replaces an existing CTE or adds a new one with the given name.
     * 
     * @param name CTE name to replace/add (must be non-empty)
     * @param query SelectQuery to use as CTE
     * @param options Optional configuration
     * @param options.materialized PostgreSQL-specific: true = MATERIALIZED, false = NOT MATERIALIZED, null/undefined = no hint
     * 
     * @throws {InvalidCTENameError} When name is empty or whitespace-only
     * 
     * @example
     * ```typescript
     * const query = SelectQueryParser.parse('SELECT * FROM final_data').toSimpleQuery();
     * const oldQuery = SelectQueryParser.parse('SELECT id FROM old_table');
     * const newQuery = SelectQueryParser.parse('SELECT id, status FROM new_table WHERE active = true');
     * 
     * // Add initial CTE
     * query.addCTE('data_source', oldQuery);
     * 
     * // Replace with improved version
     * query.replaceCTE('data_source', newQuery, { materialized: true });
     * 
     * // Safe replacement - adds if doesn't exist
     * query.replaceCTE('new_cte', newQuery); // Won't throw error
     * 
     * // Chaining replacements
     * query
     *   .replaceCTE('cte1', query1, { materialized: false })
     *   .replaceCTE('cte2', query2, { materialized: true });
     * ```
     * 
     * @remarks
     * - Unlike addCTE(), this method won't throw error if CTE already exists
     * - Unlike removeCTE(), this method won't throw error if CTE doesn't exist
     * - Useful for upsert-style CTE operations
     * - MATERIALIZED/NOT MATERIALIZED is PostgreSQL-specific
     * - Method supports fluent chaining
     * - Maintains CTE order when replacing existing CTEs
     */
    public replaceCTE(name: string, query: SelectQuery, options?: CTEOptions): this {
        // Validate CTE name
        if (!name || name.trim() === '') {
            throw new InvalidCTENameError(name, 'name cannot be empty or whitespace-only');
        }
        
        // Remove existing CTE if it exists (don't throw error if not found)
        if (this.hasCTE(name)) {
            this.removeCTE(name);
        }
        
        // Add new CTE (but skip duplicate check since we just removed it)
        const materialized = options?.materialized ?? null;
        const commonTable = new CommonTable(query, name, materialized);
        this.appendWith(commonTable);
        
        // Update cache for O(1) future lookups
        this.cteNameCache.add(name);
        return this;
    }
}
