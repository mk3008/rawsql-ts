import { QueryBuilder } from "../transformers/QueryBuilder";
import { SimpleSelectQuery } from "./SimpleSelectQuery";
import { SqlComponent } from "./SqlComponent";
import { TupleExpression } from "./ValueComponent";

/**
 * Represents a VALUES query in SQL.
 */
export class ValuesQuery extends SqlComponent {
    static kind = Symbol("ValuesQuery");
    tuples: TupleExpression[];
    /**
     * Column aliases for the VALUES query.
     * These represent the logical column names for each value tuple.
     * Note: This property is optional and is not referenced during SQL output, but is used when converting to a SimpleSelectQuery.
     */
    columnAliases: string[] | null;

    constructor(tuples: TupleExpression[], columnAliases: string[] | null = null) {
        super();
        this.tuples = tuples;
        this.columnAliases = columnAliases;
    }

    public toSimpleSelectQuery(): SimpleSelectQuery {
        return QueryBuilder.buildSimpleQuery(this);
    }
}
