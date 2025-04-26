import { FromClause, SelectClause, SelectItem, SourceAliasExpression, SourceExpression, SubQuerySource, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent } from "../models/SqlComponent";
import { ColumnReference, IdentifierString, RawString } from "../models/ValueComponent";
import { CTECollector } from "./CTECollector";
import { CTENormalizer } from "./CTENormalizer";
import { CreateTableQuery } from "../models/CreateTableQuery";

/**
 * Converts various SELECT query types to a standard SimpleSelectQuery format.
 * - SimpleSelectQuery is returned as-is
 * - BinarySelectQuery (UNION, etc.) is wrapped in a subquery: SELECT * FROM (original) AS bq
 * - ValuesQuery is wrapped with sequentially numbered columns: SELECT * FROM (original) AS vq(column1, column2, ...)
 */
export class QueryConverter {
    /**
     * Private constructor to prevent instantiation of this utility class.
     */
    private constructor() {
        // This class is not meant to be instantiated.
    }

    /**
     * Converts a SELECT query to a standard SimpleSelectQuery form.
     * 
     * @param query The query to convert
     * @returns A SimpleSelectQuery
     */
    public static toSimple(query: SelectQuery): SimpleSelectQuery {
        if (query instanceof SimpleSelectQuery) {
            // Already a simple query, just return it
            return query;
        }
        else if (query instanceof BinarySelectQuery) {
            // Convert binary queries to a simple query
            return QueryConverter.toSimpleBinaryQuery(query);
        }
        else if (query instanceof ValuesQuery) {
            // Convert VALUES queries to a simple query
            return QueryConverter.toSimpleValuesQuery(query);
        }

        // Should not reach here with current type system
        throw new Error("Unsupported query type for toSimple");
    }

    /**
     * Converts a BinarySelectQuery (UNION, EXCEPT, etc.) to a SimpleSelectQuery
     * by wrapping it in SELECT * FROM (original) AS bq
     * 
     * @param query The binary query to convert
     * @returns A SimpleSelectQuery
     */
    private static toSimpleBinaryQuery(query: BinarySelectQuery): SimpleSelectQuery {
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
        const selectClause = QueryConverter.createSelectAllClause();

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
     * Converts a ValuesQuery to a SimpleSelectQuery with sequentially numbered columns
     * 
     * @param query The VALUES query to convert
     * @returns A SimpleSelectQuery
     */
    private static toSimpleValuesQuery(query: ValuesQuery): SimpleSelectQuery {
        // Figure out how many columns are in the VALUES clause
        // by checking the first tuple (if available)
        const columnCount = query.tuples.length > 0 ? query.tuples[0].values.length : 0;

        // Use provided column aliases if available, otherwise generate column names (column1, column2, ...)
        const columnNames: string[] = query.columnAliases ?? [];
        if (columnNames.length === 0) {
            for (let i = 1; i <= columnCount; i++) {
                columnNames.push(`column${i}`);
            }
        }

        // Create a subquery source from the VALUES query
        const subQuerySource = new SubQuerySource(query);

        const sourceExpr = new SourceExpression(
            subQuerySource,
            new SourceAliasExpression("vq", columnNames)
        );

        // Create FROM clause with the source expression
        const fromClause = new FromClause(sourceExpr, null);

        // Create SELECT clause with * (all columns)
        const selectClause = QueryConverter.createSelectAllClause();

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
    public static toCreateTableQuery(query: SelectQuery, tableName: string, isTemporary: boolean = false): CreateTableQuery {
        return new CreateTableQuery({
            tableName,
            isTemporary,
            asSelectQuery: query
        });
    }
}
