import { SetClause, SetClauseItem, FromClause, WhereClause, SelectClause, SelectItem, SourceAliasExpression, SourceExpression, SubQuerySource, WithClause, TableSource, UpdateClause, InsertClause, OrderByClause, DeleteClause } from '../models/Clause';
import { UpdateQuery } from '../models/UpdateQuery';
import { DeleteQuery } from '../models/DeleteQuery';
import { MergeQuery, MergeWhenClause, MergeUpdateAction, MergeDeleteAction, MergeInsertAction, MergeDoNothingAction } from '../models/MergeQuery';
import { BinaryExpression, ColumnReference, InlineQuery, LiteralValue, UnaryExpression, ValueList } from '../models/ValueComponent';
import { SelectValueCollector } from './SelectValueCollector';
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { CTECollector } from "./CTECollector";
import { CTENormalizer } from "./CTENormalizer";
import { CreateTableQuery } from "../models/CreateTableQuery";
import { InsertQuery } from "../models/InsertQuery";
import { CTEDisabler } from './CTEDisabler';
import { SourceExpressionParser } from '../parsers/SourceExpressionParser';
import type { InsertQueryConversionOptions, UpdateQueryConversionOptions, DeleteQueryConversionOptions, MergeQueryConversionOptions } from "../models/SelectQuery";
import { InsertQuerySelectValuesConverter } from "./InsertQuerySelectValuesConverter";
import { InsertResultSelectConverter, InsertResultSelectOptions } from "./InsertResultSelectConverter";

/**
 * QueryBuilder provides static methods to build or convert various SQL query objects.
 */
export class QueryBuilder {
    /**
     * Builds a BinarySelectQuery by combining an array of SelectQuery using the specified operator.
     * Throws if less than two queries are provided.
     * @param queries Array of SelectQuery to combine
     * @param operator SQL operator to use (e.g. 'union', 'union all', 'intersect', 'except')
     * @returns BinarySelectQuery
     */
    public static buildBinaryQuery(queries: SelectQuery[], operator: string): BinarySelectQuery {
        if (!queries || queries.length === 0) {
            throw new Error("No queries provided to combine.");
        }
        if (queries.length === 1) {
            throw new Error("At least two queries are required to create a BinarySelectQuery.");
        }

        // Always create a new BinarySelectQuery instance (never mutate input)
        // Note: ValuesQuery requires conversion to SimpleSelectQuery because it lacks SELECT clause structure
        // BinarySelectQuery and SimpleSelectQuery can be used directly in binary operations
        const wrap = (q: SelectQuery) => q instanceof ValuesQuery ? QueryBuilder.buildSimpleQuery(q) : q;
        let result: BinarySelectQuery = new BinarySelectQuery(wrap(queries[0]), operator, wrap(queries[1]));
        CTENormalizer.normalize(result);

        for (let i = 2; i < queries.length; i++) {
            result.appendSelectQuery(operator, wrap(queries[i]));
        }

        return result;
    }

    private constructor() {
        // This class is not meant to be instantiated.
    }

    /**
     * Converts a SELECT query to a standard SimpleSelectQuery form.
     * @param query The query to convert
     * @returns A SimpleSelectQuery
     */
    public static buildSimpleQuery(query: SelectQuery): SimpleSelectQuery {
        if (query instanceof SimpleSelectQuery) {
            return query;
        }
        else if (query instanceof BinarySelectQuery) {
            return QueryBuilder.buildSimpleBinaryQuery(query);
        }
        else if (query instanceof ValuesQuery) {
            return QueryBuilder.buildSimpleValuesQuery(query);
        }
        throw new Error("Unsupported query type for buildSimpleQuery");
    }

    private static buildSimpleBinaryQuery(query: BinarySelectQuery): SimpleSelectQuery {
        // Extract ORDER BY from the rightmost query in the binary tree and remove it
        const extractedOrderBy = QueryBuilder.extractAndRemoveOrderByFromBinaryQuery(query);
        
        // Create a subquery source from the binary query (now without ORDER BY)
        const subQuerySource = new SubQuerySource(query);

        // Create a source expression with alias
        const sourceExpr = new SourceExpression(
            subQuerySource,
            new SourceAliasExpression("bq", null)
        );

        // Create FROM clause with the source expression
        const fromClause = new FromClause(sourceExpr, null);

        // Create SELECT clause with * (all columns)
        const selectClause = QueryBuilder.createSelectAllClause();

        // Create the final simple select query with extracted ORDER BY
        const q = new SimpleSelectQuery(
            {
                selectClause,
                fromClause,
                orderByClause: extractedOrderBy
            }
        );

        return CTENormalizer.normalize(q) as SimpleSelectQuery;
    }

    /**
     * Extracts ORDER BY clause from the rightmost query in a binary query tree and removes it.
     * This clarifies the semantics by moving the ORDER BY from the ambiguous position 
     * in the UNION to the explicit outer SimpleSelectQuery level.
     * 
     * NOTE: ORDER BY in UNION context applies to the entire result set, not individual subqueries.
     * Therefore, table prefixes (e.g., "a.column") in ORDER BY are invalid SQL and would cause 
     * syntax errors. Valid ORDER BY clauses should only reference column names without prefixes
     * or use positional notation (ORDER BY 1, 2). Since we only process valid SQL, the current
     * implementation correctly handles legitimate cases without additional prefix processing.
     * 
     * @param query BinarySelectQuery to process
     * @returns Extracted OrderByClause or null if none found
     */
    private static extractAndRemoveOrderByFromBinaryQuery(query: BinarySelectQuery): OrderByClause | null {
        return QueryBuilder.findAndRemoveRightmostOrderBy(query);
    }

    /**
     * Recursively finds and removes ORDER BY from the rightmost query in a binary tree.
     * 
     * @param query Current query being processed
     * @returns Extracted OrderByClause or null
     */
    private static findAndRemoveRightmostOrderBy(query: SelectQuery): OrderByClause | null {
        if (query instanceof BinarySelectQuery) {
            // For binary queries, check right side first (rightmost takes precedence)
            const rightOrderBy = QueryBuilder.findAndRemoveRightmostOrderBy(query.right);
            if (rightOrderBy) {
                return rightOrderBy;
            }
            
            // If no ORDER BY on right side, check left side
            return QueryBuilder.findAndRemoveRightmostOrderBy(query.left);
        }
        else if (query instanceof SimpleSelectQuery) {
            // Extract ORDER BY from SimpleSelectQuery and remove it
            const orderBy = query.orderByClause;
            if (orderBy) {
                query.orderByClause = null;
                return orderBy;
            }
        }
        
        return null;
    }

    /**
     * Converts a ValuesQuery to a SimpleSelectQuery with sequentially numbered columns or user-specified columns
     * 
     * @param query The VALUES query to convert
     * @param columns Optional: column names
     * @returns A SimpleSelectQuery
     */
    private static buildSimpleValuesQuery(query: ValuesQuery): SimpleSelectQuery {
        // Figure out how many columns are in the VALUES clause
        const columnCount = query.tuples.length > 0 ? query.tuples[0].values.length : 0;
        if (query.tuples.length === 0) {
            throw new Error("Empty VALUES clause cannot be converted to a SimpleSelectQuery");
        }
        if (!query.columnAliases) {
            throw new Error("Column aliases are required to convert a VALUES clause to SimpleSelectQuery. Please specify column aliases.");
        }
        if (query.columnAliases.length !== columnCount) {
            throw new Error(`The number of column aliases (${query.columnAliases.length}) does not match the number of columns in the first tuple (${columnCount}).`);
        }

        // Create a subquery source from the VALUES query
        const subQuerySource = new SubQuerySource(query);
        const sourceExpr = new SourceExpression(
            subQuerySource,
            new SourceAliasExpression("vq", query.columnAliases)
        );

        // Create FROM clause with the source expression
        const fromClause = new FromClause(sourceExpr, null);

        // Create SELECT clause with all columns
        const selectItems = query.columnAliases.map(name => new SelectItem(new ColumnReference("vq", name), name));
        const selectClause = new SelectClause(selectItems, null);

        // Create the final simple select query
        return new SimpleSelectQuery(
            {
                selectClause,
                fromClause
            }
        );
    }

    /**
     * Creates a SELECT clause with a single * (all columns) item
     * 
     * @returns A SELECT clause with *
     */
    private static createSelectAllClause(): SelectClause {
        // Create a column reference for *
        const columnRef = new ColumnReference(null, "*");

        // Create a SelectItem with the column reference
        const selectItem = new SelectItem(columnRef, "*");

        // Create and return a SelectClause with the item
        return new SelectClause([selectItem], null);
    }

    /**
     * Converts a SELECT query to a CREATE TABLE query (CREATE [TEMPORARY] TABLE ... AS SELECT ...)
     * @param query The SELECT query to use as the source
     * @param tableName The name of the table to create
     * @param isTemporary If true, creates a temporary table
     * @returns A CreateTableQuery instance
     */
    public static buildCreateTableQuery(query: SelectQuery, tableName: string, isTemporary: boolean = false, ifNotExists: boolean = false): CreateTableQuery {
        return new CreateTableQuery({
            tableName,
            isTemporary,
            ifNotExists,
            asSelectQuery: query
        });
    }

    /**
     * Converts a SELECT query to an INSERT query (INSERT INTO ... SELECT ...).
     */
    public static buildInsertQuery(selectQuery: SimpleSelectQuery, targetOrOptions: string | InsertQueryConversionOptions, explicitColumns?: string[]): InsertQuery {
        // Derive normalized options while preserving the legacy signature for backward compatibility.
        const options = QueryBuilder.normalizeInsertOptions(targetOrOptions, explicitColumns);
        // Determine the final column order either from user-provided options or by inferring from the select list.
        const columnNames = QueryBuilder.prepareInsertColumns(selectQuery, options.columns ?? null);

        const sourceExpr = SourceExpressionParser.parse(options.target);
        return new InsertQuery({
            insertClause: new InsertClause(sourceExpr, columnNames),
            selectQuery
        });
    }

    /**
     * Converts an INSERT ... VALUES query into INSERT ... SELECT form using UNION ALL.
     * @param insertQuery The VALUES-based InsertQuery to convert.
     * @returns A new InsertQuery that selects rows instead of using VALUES.
     */
    public static convertInsertValuesToSelect(insertQuery: InsertQuery): InsertQuery {
        return InsertQuerySelectValuesConverter.toSelectUnion(insertQuery);
    }

    /**
     * Converts an INSERT ... SELECT (optionally with UNION ALL) into INSERT ... VALUES form.
     * @param insertQuery The SELECT-based InsertQuery to convert.
     * @returns A new InsertQuery that uses VALUES tuples.
     */
    public static convertInsertSelectToValues(insertQuery: InsertQuery): InsertQuery {
        return InsertQuerySelectValuesConverter.toValues(insertQuery);
    }

    /**
     * Builds a SELECT query that reflects the INSERT's RETURNING output (or count when RETURNING is absent).
     */
    public static convertInsertToReturningSelect(
        insertQuery: InsertQuery,
        options?: InsertResultSelectOptions
    ): SimpleSelectQuery {
        return InsertResultSelectConverter.toSelectQuery(insertQuery, options);
    }

    /**
     * Builds an UPDATE query from a SELECT query and conversion options.
     */
    public static buildUpdateQuery(selectQuery: SimpleSelectQuery, selectSourceOrOptions: string | UpdateQueryConversionOptions, updateTableExprRaw?: string, primaryKeys?: string | string[]): UpdateQuery {
        // Normalize the function arguments into a single configuration object.
        const options = QueryBuilder.normalizeUpdateOptions(selectSourceOrOptions, updateTableExprRaw, primaryKeys);
        // Collect select-list metadata and align columns before mutating the query during WITH extraction.
        const updateColumns = QueryBuilder.prepareUpdateColumns(selectQuery, options.primaryKeys, options.columns ?? null);
        const updateClause = new UpdateClause(SourceExpressionParser.parse(options.target));
        const targetAlias = updateClause.getSourceAliasName();
        if (!targetAlias) {
            throw new Error(`Source expression does not have an alias. Please provide an alias for the source expression.`);
        }

        // Move CTE definitions to the UPDATE statement for cleaner SQL.
        const withClause = QueryBuilder.extractWithClause(selectQuery);

        const setItems = updateColumns.map(column => new SetClauseItem(column, QueryBuilder.toColumnReference(options.sourceAlias, column)));
        if (setItems.length === 0) {
            throw new Error(`No updatable columns found. Ensure the select list contains at least one column other than the specified primary keys.`);
        }
        const setClause = new SetClause(setItems);

        const fromClause = new FromClause(selectQuery.toSource(options.sourceAlias), null);
        const whereClause = new WhereClause(QueryBuilder.buildEqualityPredicate(targetAlias, options.sourceAlias, options.primaryKeys));

        return new UpdateQuery({
            updateClause,
            setClause,
            fromClause,
            whereClause,
            withClause: withClause ?? undefined
        });
    }

    /**
     * Builds a DELETE query that deletes the rows matched by the SELECT query output.
     */
    public static buildDeleteQuery(selectQuery: SimpleSelectQuery, options: DeleteQueryConversionOptions): DeleteQuery {
        // Normalise options to guarantee arrays and alias defaults.
        const normalized = QueryBuilder.normalizeDeleteOptions(options);
        const predicateColumns = QueryBuilder.prepareDeleteColumns(selectQuery, normalized.primaryKeys, normalized.columns ?? null);
        const deleteClause = new DeleteClause(SourceExpressionParser.parse(normalized.target));
        const targetAlias = deleteClause.getSourceAliasName();
        if (!targetAlias) {
            throw new Error(`Source expression does not have an alias. Please provide an alias for the delete target.`);
        }

        const withClause = QueryBuilder.extractWithClause(selectQuery);

        // Build correlated EXISTS predicate instead of Postgres-specific USING clause.
        const predicate = QueryBuilder.buildEqualityPredicate(targetAlias, normalized.sourceAlias, predicateColumns);
        const sourceExpression = selectQuery.toSource(normalized.sourceAlias);
        const existsSelectClause = new SelectClause([new SelectItem(new LiteralValue(1))]);
        const existsSubquery = new SimpleSelectQuery({
            selectClause: existsSelectClause,
            fromClause: new FromClause(sourceExpression, null),
            whereClause: new WhereClause(predicate)
        });
        const whereClause = new WhereClause(new UnaryExpression('exists', new InlineQuery(existsSubquery)));

        return new DeleteQuery({
            deleteClause,
            whereClause,
            withClause: withClause ?? undefined
        });
    }

    /**
     * Builds a MERGE query (upsert) that coordinates actions based on row matches.
     */
    public static buildMergeQuery(selectQuery: SimpleSelectQuery, options: MergeQueryConversionOptions): MergeQuery {
        // Ensure the configuration is fully expanded before inspection.
        const normalized = QueryBuilder.normalizeMergeOptions(options);
        const mergeColumnPlan = QueryBuilder.prepareMergeColumns(
            selectQuery,
            normalized.primaryKeys,
            normalized.updateColumns ?? null,
            normalized.insertColumns ?? null,
            normalized.matchedAction ?? 'update',
            normalized.notMatchedAction ?? 'insert'
        );

        const targetExpression = SourceExpressionParser.parse(normalized.target);
        const targetAlias = targetExpression.getAliasName();
        if (!targetAlias) {
            throw new Error(`Source expression does not have an alias. Please provide an alias for the merge target.`);
        }

        const withClause = QueryBuilder.extractWithClause(selectQuery);

        const onCondition = QueryBuilder.buildEqualityPredicate(targetAlias, normalized.sourceAlias, normalized.primaryKeys);
        const sourceExpression = selectQuery.toSource(normalized.sourceAlias);

        const whenClauses: MergeWhenClause[] = [];

        const matchedAction = normalized.matchedAction ?? 'update';
        if (matchedAction === 'update') {
            if (mergeColumnPlan.updateColumns.length === 0) {
                throw new Error(`No columns available for MERGE update action. Provide updateColumns or ensure the select list includes non-key columns.`);
            }
            const setItems = mergeColumnPlan.updateColumns.map(column => new SetClauseItem(column, QueryBuilder.toColumnReference(normalized.sourceAlias, column)));
            whenClauses.push(new MergeWhenClause("matched", new MergeUpdateAction(new SetClause(setItems))));
        } else if (matchedAction === 'delete') {
            whenClauses.push(new MergeWhenClause("matched", new MergeDeleteAction()));
        } else if (matchedAction === 'doNothing') {
            whenClauses.push(new MergeWhenClause("matched", new MergeDoNothingAction()));
        }

        const notMatchedAction = normalized.notMatchedAction ?? 'insert';
        if (notMatchedAction === 'insert') {
            if (mergeColumnPlan.insertColumns.length === 0) {
                throw new Error('Unable to infer MERGE insert columns. Provide insertColumns explicitly.');
            }
            const insertValues = new ValueList(mergeColumnPlan.insertColumns.map(column => QueryBuilder.toColumnReference(normalized.sourceAlias, column)));
            whenClauses.push(new MergeWhenClause("not_matched", new MergeInsertAction({
                columns: mergeColumnPlan.insertColumns,
                values: insertValues
            })));
        } else if (notMatchedAction === 'doNothing') {
            whenClauses.push(new MergeWhenClause("not_matched", new MergeDoNothingAction()));
        }

        const notMatchedBySourceAction = normalized.notMatchedBySourceAction ?? 'doNothing';
        if (notMatchedBySourceAction === 'delete') {
            whenClauses.push(new MergeWhenClause("not_matched_by_source", new MergeDeleteAction()));
        } else if (notMatchedBySourceAction === 'doNothing') {
            whenClauses.push(new MergeWhenClause("not_matched_by_source", new MergeDoNothingAction()));
        }

        if (whenClauses.length === 0) {
            throw new Error(`At least one MERGE action must be generated. Adjust the merge conversion options.`);
        }

        return new MergeQuery({
            withClause: withClause ?? undefined,
            target: targetExpression,
            source: sourceExpression,
            onCondition,
            whenClauses
        });
    }

    private static normalizeInsertOptions(targetOrOptions: string | InsertQueryConversionOptions, explicitColumns?: string[]): InsertQueryConversionOptions {
        if (typeof targetOrOptions === 'string') {
            return {
                target: targetOrOptions,
                columns: explicitColumns
            };
        }
        if (explicitColumns && explicitColumns.length > 0) {
            return {
                ...targetOrOptions,
                columns: explicitColumns
            };
        }
        return { ...targetOrOptions };
    }

    private static normalizeUpdateOptions(selectSourceOrOptions: string | UpdateQueryConversionOptions, updateTableExprRaw?: string, primaryKeys?: string | string[]): { target: string; primaryKeys: string[]; sourceAlias: string; columns?: string[] } {
        if (typeof selectSourceOrOptions === 'string') {
            if (!updateTableExprRaw) {
                throw new Error('updateTableExprRaw is required when using the legacy buildUpdateQuery signature.');
            }
            if (primaryKeys === undefined) {
                throw new Error('primaryKeys are required when using the legacy buildUpdateQuery signature.');
            }
            return {
                target: updateTableExprRaw,
                primaryKeys: QueryBuilder.normalizeColumnArray(primaryKeys),
                sourceAlias: selectSourceOrOptions
            };
        }

        return {
            target: selectSourceOrOptions.target,
            primaryKeys: QueryBuilder.normalizeColumnArray(selectSourceOrOptions.primaryKeys),
            sourceAlias: selectSourceOrOptions.sourceAlias ?? 'src',
            columns: selectSourceOrOptions.columns
        };
    }

    private static normalizeDeleteOptions(options: DeleteQueryConversionOptions): DeleteQueryConversionOptions & { primaryKeys: string[]; sourceAlias: string } {
        return {
            ...options,
            primaryKeys: QueryBuilder.normalizeColumnArray(options.primaryKeys),
            sourceAlias: options.sourceAlias ?? 'src'
        };
    }

    private static normalizeMergeOptions(options: MergeQueryConversionOptions): MergeQueryConversionOptions & { primaryKeys: string[]; sourceAlias: string } {
        return {
            ...options,
            primaryKeys: QueryBuilder.normalizeColumnArray(options.primaryKeys),
            sourceAlias: options.sourceAlias ?? 'src'
        };
    }

    private static normalizeColumnArray(columns: string | string[]): string[] {
        const array = Array.isArray(columns) ? columns : [columns];
        const normalized = array.map(col => col.trim()).filter(col => col.length > 0);
        if (!normalized.length) {
            throw new Error('At least one column must be specified.');
        }
        return normalized;
    }

    private static collectSelectItems(selectQuery: SimpleSelectQuery) {
        const collector = new SelectValueCollector();
        return collector.collect(selectQuery);
    }

    private static collectSelectColumnNames(selectQuery: SimpleSelectQuery): string[] {
        const items = QueryBuilder.collectSelectItems(selectQuery);
        const names: string[] = [];
        for (const item of items) {
            if (!item.name || item.name === '*') {
                throw new Error(
                    `Columns cannot be inferred from the selectQuery. ` +
                    `Make sure you are not using wildcards or unnamed columns.`
                );
            }
            if (!names.includes(item.name)) {
                names.push(item.name);
            }
        }
        if (!names.length) {
            throw new Error('Unable to determine any column names from selectQuery.');
        }
        return names;
    }

    private static ensurePrimaryKeys(selectColumns: string[], primaryKeys: string[]): void {
        const available = new Set(selectColumns);
        for (const pk of primaryKeys) {
            if (!available.has(pk)) {
                throw new Error(`Primary key column '${pk}' is not present in selectQuery select list.`);
            }
        }
    }

    private static prepareInsertColumns(selectQuery: SimpleSelectQuery, optionColumns: string[] | null): string[] {
        const selectColumns = QueryBuilder.collectSelectColumnNames(selectQuery);
        if (optionColumns && optionColumns.length > 0) {
            const normalized = QueryBuilder.normalizeColumnArray(optionColumns);
            const uniqueNormalized = normalized.filter((name, idx) => normalized.indexOf(name) === idx);
            const missing = uniqueNormalized.filter(name => !selectColumns.includes(name));
            if (missing.length > 0) {
                throw new Error(`Columns specified in conversion options were not found in selectQuery select list: [${missing.join(', ')}].`);
            }
            QueryBuilder.rebuildSelectClause(selectQuery, uniqueNormalized);
            QueryBuilder.ensureSelectClauseSize(selectQuery, uniqueNormalized.length);
            return uniqueNormalized;
        }
        QueryBuilder.ensureSelectClauseSize(selectQuery, selectColumns.length);
        return selectColumns;
    }

    private static prepareUpdateColumns(selectQuery: SimpleSelectQuery, primaryKeys: string[], explicitColumns: string[] | null): string[] {
        const selectColumns = QueryBuilder.collectSelectColumnNames(selectQuery);
        QueryBuilder.ensurePrimaryKeys(selectColumns, primaryKeys);

        const primaryKeySet = new Set(primaryKeys);
        const updateCandidates = selectColumns.filter(name => !primaryKeySet.has(name));

        let updateColumnsOrdered: string[];
        if (explicitColumns && explicitColumns.length > 0) {
            const normalized = QueryBuilder.normalizeColumnArray(explicitColumns);
            const uniqueNormalized = normalized.filter((name, idx) => normalized.indexOf(name) === idx);
            const missing = uniqueNormalized.filter(name => primaryKeySet.has(name) || !updateCandidates.includes(name));
            if (missing.length > 0) {
                throw new Error(`Provided update columns were not found in selectQuery output or are primary keys: [${missing.join(', ')}].`);
            }
            updateColumnsOrdered = uniqueNormalized;
        } else {
            updateColumnsOrdered = Array.from(new Set(updateCandidates));
        }

        const desiredOrder = Array.from(new Set([
            ...primaryKeys,
            ...updateColumnsOrdered
        ]));
        QueryBuilder.rebuildSelectClause(selectQuery, desiredOrder);
        QueryBuilder.ensureSelectClauseSize(selectQuery, desiredOrder.length);

        return updateColumnsOrdered;
    }

    private static prepareDeleteColumns(selectQuery: SimpleSelectQuery, primaryKeys: string[], explicitColumns: string[] | null): string[] {
        const selectColumns = QueryBuilder.collectSelectColumnNames(selectQuery);
        QueryBuilder.ensurePrimaryKeys(selectColumns, primaryKeys);

        const primaryKeySet = new Set(primaryKeys);
        let matchColumns: string[] = [];
        if (explicitColumns && explicitColumns.length > 0) {
            const normalized = QueryBuilder.normalizeColumnArray(explicitColumns);
            const preferred = new Set(normalized);
            matchColumns = selectColumns.filter(name => preferred.has(name) && !primaryKeySet.has(name));
        }

        const requiredColumns = new Set<string>();
        primaryKeys.forEach(key => requiredColumns.add(key));
        matchColumns.forEach(col => requiredColumns.add(col));

        const desiredOrder = selectColumns.filter(name => requiredColumns.has(name));
        QueryBuilder.rebuildSelectClause(selectQuery, desiredOrder);
        QueryBuilder.ensureSelectClauseSize(selectQuery, desiredOrder.length);

        return desiredOrder;
    }

    private static prepareMergeColumns(
        selectQuery: SimpleSelectQuery,
        primaryKeys: string[],
        explicitUpdateColumns: string[] | null,
        explicitInsertColumns: string[] | null,
        matchedAction: string,
        notMatchedAction: string
    ): { updateColumns: string[]; insertColumns: string[] } {
        const selectColumns = QueryBuilder.collectSelectColumnNames(selectQuery);
        QueryBuilder.ensurePrimaryKeys(selectColumns, primaryKeys);

        const primaryKeySet = new Set(primaryKeys);

        let updateColumnsOrdered: string[] = [];
        if (matchedAction === 'update') {
            const candidates = selectColumns.filter(name => !primaryKeySet.has(name));
            if (explicitUpdateColumns && explicitUpdateColumns.length > 0) {
                const normalized = QueryBuilder.normalizeColumnArray(explicitUpdateColumns);
                const uniqueNormalized = normalized.filter((name, idx) => normalized.indexOf(name) === idx);
                const missing = uniqueNormalized.filter(name => primaryKeySet.has(name) || !candidates.includes(name));
                if (missing.length > 0) {
                    throw new Error(`Provided update columns were not found in selectQuery output or are primary keys: [${missing.join(', ')}].`);
                }
                updateColumnsOrdered = uniqueNormalized;
            } else {
                updateColumnsOrdered = Array.from(new Set(candidates));
            }
        }

        let insertColumnsOrdered: string[] = [];
        if (notMatchedAction === 'insert') {
            if (explicitInsertColumns && explicitInsertColumns.length > 0) {
                const normalized = QueryBuilder.normalizeColumnArray(explicitInsertColumns);
                const uniqueNormalized = normalized.filter((name, idx) => normalized.indexOf(name) === idx);
                const missing = uniqueNormalized.filter(name => !selectColumns.includes(name));
                if (missing.length > 0) {
                    throw new Error(`Provided insert columns were not found in selectQuery output: [${missing.join(', ')}].`);
                }
                insertColumnsOrdered = uniqueNormalized;
            } else {
                insertColumnsOrdered = Array.from(new Set(selectColumns));
            }
        }

        const desiredOrder = Array.from(new Set([
            ...primaryKeys,
            ...updateColumnsOrdered,
            ...insertColumnsOrdered,
            ...selectColumns
        ])).filter(name => selectColumns.includes(name));
        QueryBuilder.rebuildSelectClause(selectQuery, desiredOrder);
        QueryBuilder.ensureSelectClauseSize(selectQuery, desiredOrder.length);

        const finalUpdateColumns = matchedAction === 'update'
            ? updateColumnsOrdered
            : [];
        const finalInsertColumns = notMatchedAction === 'insert'
            ? insertColumnsOrdered
            : [];

        return {
            updateColumns: finalUpdateColumns,
            insertColumns: finalInsertColumns
        };
    }

    private static rebuildSelectClause(selectQuery: SimpleSelectQuery, desiredColumns: string[]): void {
        const itemMap = new Map<string, SelectItem>();
        for (const item of selectQuery.selectClause.items) {
            const name = QueryBuilder.getSelectItemName(item);
            if (!name) {
                continue;
            }
            if (!itemMap.has(name)) {
                itemMap.set(name, item);
            }
        }

        const rebuiltItems: SelectItem[] = [];
        const seen = new Set<string>();
        for (const column of desiredColumns) {
            if (seen.has(column)) {
                continue;
            }
            const item = itemMap.get(column);
            if (!item) {
                throw new Error(`Column '${column}' not found in select clause.`);
            }
            rebuiltItems.push(item);
            seen.add(column);
        }

        if (!rebuiltItems.length) {
            throw new Error('Unable to rebuild select clause with the requested columns.');
        }

        selectQuery.selectClause.items = rebuiltItems;
    }

    private static getSelectItemName(item: SelectItem): string | null {
        if (item.identifier) {
            return item.identifier.name;
        }
        if (item.value instanceof ColumnReference) {
            return item.value.column.name;
        }
        return null;
    }

    private static ensureSelectClauseSize(selectQuery: SimpleSelectQuery, expected: number): void {
        if (selectQuery.selectClause.items.length !== expected) {
            throw new Error(
                `Select clause column count (${selectQuery.selectClause.items.length}) does not match expected count (${expected}).`
            );
        }
    }

    private static extractWithClause(selectQuery: SimpleSelectQuery): WithClause | null {
        const cteCollector = new CTECollector();
        const collected = cteCollector.collect(selectQuery);
        if (collected.length === 0) {
            return null;
        }
        const cteDisabler = new CTEDisabler();
        cteDisabler.execute(selectQuery);
        return new WithClause(false, collected);
    }

    private static buildEqualityPredicate(leftAlias: string, rightAlias: string, columns: string[]): BinaryExpression {
        const uniqueColumns = QueryBuilder.mergeUniqueColumns(columns);
        if (!uniqueColumns.length) {
            throw new Error('At least one column is required to build a comparison predicate.');
        }

        let predicate: BinaryExpression | null = null;
        for (const column of uniqueColumns) {
            const comparison = new BinaryExpression(
                QueryBuilder.toColumnReference(leftAlias, column),
                '=',
                QueryBuilder.toColumnReference(rightAlias, column)
            );
            predicate = predicate ? new BinaryExpression(predicate, 'and', comparison) : comparison;
        }
        return predicate!;
    }

    private static toColumnReference(alias: string, column: string): ColumnReference {
        return new ColumnReference(alias, column);
    }

    private static mergeUniqueColumns(columns: string[]): string[] {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const column of columns) {
            if (!seen.has(column)) {
                seen.add(column);
                result.push(column);
            }
        }
        return result;
    }
}
