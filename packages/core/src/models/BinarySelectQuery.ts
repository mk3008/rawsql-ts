import { SourceExpression, SubQuerySource, SourceAliasExpression } from "./Clause";
import type { SelectQuery, CTEOptions } from "./SelectQuery";
import { SqlComponent } from "./SqlComponent";
import { RawString, SqlParameterValue } from "./ValueComponent";
import { CTENormalizer } from "../transformers/CTENormalizer";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { ParameterCollector } from "../transformers/ParameterCollector";
import { ParameterHelper } from "../utils/ParameterHelper";
import { QueryBuilder } from "../transformers/QueryBuilder";
import { SimpleSelectQuery } from "./SimpleSelectQuery";

/**
 * Represents a binary SELECT query (e.g., UNION, INTERSECT, EXCEPT).
 */
export class BinarySelectQuery extends SqlComponent implements SelectQuery {
    static kind = Symbol("BinarySelectQuery");
    headerComments: string[] | null = null; // Comments that appear before the first query
    left: SelectQuery;
    operator: RawString;
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
    public union(query: SelectQuery): BinarySelectQuery {
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
    public unionAll(query: SelectQuery): BinarySelectQuery {
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
    public intersect(query: SelectQuery): BinarySelectQuery {
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
    public intersectAll(query: SelectQuery): BinarySelectQuery {
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
    public except(query: SelectQuery): BinarySelectQuery {
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
    public exceptAll(query: SelectQuery): BinarySelectQuery {
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
        this.left = new BinarySelectQuery(this.left, this.operator.value, this.right);
        this.operator = new RawString(operator);
        this.right = query;

        CTENormalizer.normalize(this);

        return this;
    }

    /**
     * Appends another query to this binary query using UNION as the operator, accepting a raw SQL string.
     * This method parses the SQL string and appends the resulting query using UNION.
     * @param sql The SQL string to parse and union
     * @returns A new BinarySelectQuery representing "(this) UNION (parsed query)"
     */
    public unionRaw(sql: string): BinarySelectQuery {
        const parsedQuery = SelectQueryParser.parse(sql);
        return this.union(parsedQuery);
    }
    public unionAllRaw(sql: string): BinarySelectQuery {
        const parsedQuery = SelectQueryParser.parse(sql);
        return this.unionAll(parsedQuery);
    }
    public intersectRaw(sql: string): BinarySelectQuery {
        const parsedQuery = SelectQueryParser.parse(sql);
        return this.intersect(parsedQuery);
    }
    public intersectAllRaw(sql: string): BinarySelectQuery {
        const parsedQuery = SelectQueryParser.parse(sql);
        return this.intersectAll(parsedQuery);
    }
    public exceptRaw(sql: string): BinarySelectQuery {
        const parsedQuery = SelectQueryParser.parse(sql);
        return this.except(parsedQuery);
    }
    public exceptAllRaw(sql: string): BinarySelectQuery {
        const parsedQuery = SelectQueryParser.parse(sql);
        return this.exceptAll(parsedQuery);
    }

    // Returns a SourceExpression wrapping this query as a subquery source.
    // Optionally takes an alias name (default: "subq")
    public toSource(alias: string = "subq"): SourceExpression {
        return new SourceExpression(
            new SubQuerySource(this),
            new SourceAliasExpression(alias, null)
        );
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
     * Converts this BinarySelectQuery to a SimpleSelectQuery using QueryBuilder.
     * This enables CTE management on binary queries by wrapping them as subqueries.
     * @returns A SimpleSelectQuery representation of this binary query
     */
    public toSimpleQuery(): SimpleSelectQuery {
        return QueryBuilder.buildSimpleQuery(this);
    }
}
