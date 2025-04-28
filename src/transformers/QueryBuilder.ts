import { FromClause, SelectClause, SelectItem, SourceAliasExpression, SourceExpression, SubQuerySource, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent } from "../models/SqlComponent";
import { ColumnReference, IdentifierString, RawString } from "../models/ValueComponent";
import { CTECollector } from "./CTECollector";
import { CTENormalizer } from "./CTENormalizer";
import { CreateTableQuery } from "../models/CreateTableQuery";
import { InsertQuery } from "../models/InsertQuery";
import { SelectValueCollector } from "./SelectValueCollector";

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
        // Create a subquery source from the binary query
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

        // Create the final simple select query
        const q = new SimpleSelectQuery(
            null, // No WITH clause
            selectClause,
            fromClause,
            null, // No WHERE
            null, // No GROUP BY
            null, // No HAVING
            null, // No ORDER BY
            null, // No WINDOW
            null, // No LIMIT
            null  // No FOR
        );

        return CTENormalizer.normalize(q) as SimpleSelectQuery;
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
            null, // No WITH clause
            selectClause,
            fromClause,
            null, // No WHERE
            null, // No GROUP BY
            null, // No HAVING
            null, // No ORDER BY
            null, // No WINDOW
            null, // No LIMIT
            null  // No FOR
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
    public static buildCreateTableQuery(query: SelectQuery, tableName: string, isTemporary: boolean = false): CreateTableQuery {
        return new CreateTableQuery({
            tableName,
            isTemporary,
            asSelectQuery: query
        });
    }

    /**
     * Converts a SELECT query to an INSERT query (INSERT INTO ... SELECT ...)
     * @param selectQuery The SELECT query to use as the source
     * @param tableName The name of the table to insert into
     * @param columns Optional: array of column names. If omitted, columns are inferred from the selectQuery
     * @returns An InsertQuery instance
     */
    public static buildInsertQuery(selectQuery: SimpleSelectQuery, tableName: string): InsertQuery {
        let cols: string[];

        const count = selectQuery.selectClause.items.length;

        // Try to infer columns from the selectQuery
        const collector = new SelectValueCollector();
        const items = collector.collect(selectQuery);
        cols = items.map(item => item.name);
        if (!cols.length || count !== cols.length) {
            throw new Error(
                `Columns cannot be inferred from the selectQuery. ` +
                `Make sure you are not using wildcards or unnamed columns.\n` +
                `Select clause column count: ${count}, ` +
                `Columns with valid names: ${cols.length}\n` +
                `Detected column names: [${cols.join(", ")}]`
            );
        }

        return new InsertQuery({
            namespaces: null,
            table: tableName,
            columns: cols,
            selectQuery: selectQuery
        });
    }
}
