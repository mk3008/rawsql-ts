import { InsertQuery } from "../models/InsertQuery";
import { ValuesQuery } from "../models/ValuesQuery";
import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import { BinarySelectQuery } from "../models/BinarySelectQuery";
import { SelectClause, SelectItem } from "../models/Clause";
import { TupleExpression, ValueComponent } from "../models/ValueComponent";
import { SelectQueryWithClauseHelper } from "../utils/SelectQueryWithClauseHelper";
import type { SelectQuery } from "../models/SelectQuery";

/**
 * Utility to convert INSERT ... VALUES statements into INSERT ... SELECT UNION ALL form and vice versa.
 * Enables easier column-by-column comparison across multi-row inserts.
 */
export class InsertQuerySelectValuesConverter {
    /**
     * Converts an INSERT query that uses VALUES into an equivalent INSERT ... SELECT UNION ALL form.
     * The original InsertQuery remains untouched; the returned InsertQuery references cloned structures.
     */
    public static toSelectUnion(insertQuery: InsertQuery): InsertQuery {
        const valuesQuery = insertQuery.selectQuery;
        if (!(valuesQuery instanceof ValuesQuery)) {
            throw new Error("InsertQuery selectQuery is not a VALUES query.");
        }
        if (!valuesQuery.tuples.length) {
            throw new Error("VALUES query does not contain any tuples.");
        }

        const preservedWithClause = SelectQueryWithClauseHelper.getWithClause(valuesQuery);

        const columns = insertQuery.insertClause.columns;
        if (!columns || columns.length === 0) {
            throw new Error("Cannot convert to SELECT form without explicit column list.");
        }

        const columnNames = columns.map(col => col.name);
        const selectQueries: SimpleSelectQuery[] = valuesQuery.tuples.map(tuple => {
            if (tuple.values.length !== columnNames.length) {
                throw new Error("Tuple value count does not match column count.");
            }
            const items = columnNames.map((name, idx) => new SelectItem(tuple.values[idx], name));
            const selectClause = new SelectClause(items);
            return new SimpleSelectQuery({ selectClause });
        });

        let combined: SelectQuery = selectQueries[0];
        for (let i = 1; i < selectQueries.length; i++) {
            if (combined instanceof SimpleSelectQuery) {
                combined = combined.toUnionAll(selectQueries[i]);
            } else if (combined instanceof BinarySelectQuery) {
                combined.appendSelectQuery("union all", selectQueries[i]);
            } else {
                throw new Error("Unsupported SelectQuery type during UNION ALL construction.");
            }
        }

        SelectQueryWithClauseHelper.setWithClause(combined, preservedWithClause);

        return new InsertQuery({
            insertClause: insertQuery.insertClause,
            selectQuery: combined,
            returning: insertQuery.returningClause
        });
    }

    /**
     * Converts an INSERT query that leverages SELECT statements (with optional UNION ALL)
     * into an equivalent INSERT ... VALUES representation.
     */
    public static toValues(insertQuery: InsertQuery): InsertQuery {
        const columns = insertQuery.insertClause.columns;
        if (!columns || columns.length === 0) {
            throw new Error("Cannot convert to VALUES form without explicit column list.");
        }
        if (!insertQuery.selectQuery) {
            throw new Error("InsertQuery does not have a selectQuery to convert.");
        }

        const preservedWithClause = SelectQueryWithClauseHelper.getWithClause(insertQuery.selectQuery);

        const columnNames = columns.map(col => col.name);
        const simpleQueries = this.flattenSelectQueries(insertQuery.selectQuery);
        if (!simpleQueries.length) {
            throw new Error("No SELECT components found to convert.");
        }

        const tuples = simpleQueries.map(query => {
            if (query.fromClause || (query.whereClause && query.whereClause.condition)) {
                throw new Error("SELECT queries with FROM or WHERE clauses cannot be converted to VALUES.");
            }
            const valueMap = new Map<string, ValueComponent>();
            for (const item of query.selectClause.items) {
                const identifier = item.identifier?.name ?? null;
                if (!identifier) {
                    throw new Error("Each SELECT item must have an alias matching target columns.");
                }
                if (!valueMap.has(identifier)) {
                    valueMap.set(identifier, item.value);
                }
            }

            const rowValues = columnNames.map(name => {
                const value = valueMap.get(name);
                if (!value) {
                    throw new Error(`Column '${name}' is not provided by the SELECT query.`);
                }
                return value;
            });
            return new TupleExpression(rowValues);
        });

        const valuesQuery = new ValuesQuery(tuples, columnNames);
        SelectQueryWithClauseHelper.setWithClause(valuesQuery, preservedWithClause);

        return new InsertQuery({
            insertClause: insertQuery.insertClause,
            selectQuery: valuesQuery,
            returning: insertQuery.returningClause
        });
    }

    private static flattenSelectQueries(selectQuery: SelectQuery): SimpleSelectQuery[] {
        if (selectQuery instanceof SimpleSelectQuery) {
            return [selectQuery];
        }
        if (selectQuery instanceof BinarySelectQuery) {
            return [
                ...this.flattenSelectQueries(selectQuery.left),
                ...this.flattenSelectQueries(selectQuery.right)
            ];
        }
        throw new Error("Unsupported SelectQuery subtype for conversion.");
    }
}
