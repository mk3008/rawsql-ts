import { ParameterHelper } from "../utils/ParameterHelper";
import { QueryBuilder } from "../transformers/QueryBuilder";
import type {
    SelectQuery,
    InsertQueryConversionOptions,
    UpdateQueryConversionOptions,
    DeleteQueryConversionOptions,
    MergeQueryConversionOptions
} from "./SelectQuery";
import { SimpleSelectQuery } from "./SimpleSelectQuery";
import { SqlParameterValue } from "./ValueComponent";
import { SqlComponent } from "./SqlComponent";
import { TupleExpression } from "./ValueComponent";
import type { InsertQuery } from "./InsertQuery";
import type { UpdateQuery } from "./UpdateQuery";
import type { DeleteQuery } from "./DeleteQuery";
import type { MergeQuery } from "./MergeQuery";

/**
 * Represents a VALUES query in SQL.
 */
export class ValuesQuery extends SqlComponent implements SelectQuery {
    static kind = Symbol("ValuesQuery");
    readonly __selectQueryType: 'SelectQuery' = 'SelectQuery'; // Discriminator for type safety
    headerComments: string[] | null = null; // Comments that appear before VALUES clause
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

    public toSimpleQuery(): SimpleSelectQuery {
        return QueryBuilder.buildSimpleQuery(this);
    }

    public toInsertQuery(options: InsertQueryConversionOptions): InsertQuery {
        return this.toSimpleQuery().toInsertQuery(options);
    }

    public toUpdateQuery(options: UpdateQueryConversionOptions): UpdateQuery {
        return this.toSimpleQuery().toUpdateQuery(options);
    }

    public toDeleteQuery(options: DeleteQueryConversionOptions): DeleteQuery {
        return this.toSimpleQuery().toDeleteQuery(options);
    }

    public toMergeQuery(options: MergeQueryConversionOptions): MergeQuery {
        return this.toSimpleQuery().toMergeQuery(options);
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
}
