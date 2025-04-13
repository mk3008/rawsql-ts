import { FromClause, SelectClause, SelectItem, SourceAliasExpression, SourceExpression, SubQuerySource, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent } from "../models/SqlComponent";
import { ColumnReference, IdentifierString, RawString } from "../models/ValueComponent";
import { CommonTableCollector } from "./CommonTableCollector";
import { CTENormalizer } from "./CTENormalizer";

/**
 * Normalizes SELECT queries by converting different query types to a standard SimpleSelectQuery format.
 * - Simple SELECT queries are returned as-is
 * - Binary queries (UNION, etc.) are wrapped in a subquery: SELECT * FROM (original) AS bq
 * - VALUES queries are given sequentially numbered columns: SELECT * FROM (original) AS vq(column1, column2, ...)
 */
export class QueryNormalizer {
    /**
     * Normalizes a SELECT query to a standard form
     * 
     * @param query The query to normalize
     * @returns A normalized SimpleSelectQuery
     */
    public normalize(query: SelectQuery): SimpleSelectQuery {
        if (query instanceof SimpleSelectQuery) {
            // Simple queries are already in the desired format
            return query;
        }
        else if (query instanceof BinarySelectQuery) {
            // Wrap binary queries as subqueries
            return this.normalizeBinaryQuery(query);
        }
        else if (query instanceof ValuesQuery) {
            // Convert VALUES queries to simple queries with column names
            return this.normalizeValuesQuery(query);
        }

        // Fallback case, should not be reached with the current type system
        throw new Error("Unsupported query type for normalization");
    }

    /**
     * Converts a binary query (UNION, EXCEPT, etc.) to a simple query
     * by wrapping it in a SELECT * FROM (original) AS bq
     * 
     * @param query The binary query to normalize
     * @returns A normalized SimpleSelectQuery
     */
    private normalizeBinaryQuery(query: BinarySelectQuery): SimpleSelectQuery {
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
        const selectClause = this.createSelectAllClause();

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

        const cteNormalizer = new CTENormalizer();
        return cteNormalizer.normalize(q) as SimpleSelectQuery;
    }

    /**
     * Converts a VALUES query to a simple query with sequentially numbered columns
     * 
     * @param query The VALUES query to normalize
     * @returns A normalized SimpleSelectQuery
     */
    private normalizeValuesQuery(query: ValuesQuery): SimpleSelectQuery {
        // Determine how many columns are in the VALUES clause
        // by checking the first tuple (if available)
        const columnCount = query.tuples.length > 0 ? query.tuples[0].values.length : 0;

        // Generate column names (column1, column2, ...)
        const columnNames: string[] = [];
        for (let i = 1; i <= columnCount; i++) {
            columnNames.push(`column${i}`);
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
        const selectClause = this.createSelectAllClause();

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
    private createSelectAllClause(): SelectClause {
        // Create a column reference for *
        const columnRef = new ColumnReference(null, "*");

        // Create a SelectItem with the column reference
        const selectItem = new SelectItem(columnRef, "*");

        // Create and return a SelectClause with the item
        return new SelectClause([selectItem], null);
    }
}
