import {
    FunctionSource,
    HavingClause,
    JoinOnClause,
    OrderByItem,
    ParenSource,
    SourceExpression,
    SubQuerySource,
    WhereClause
} from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import {
    ArrayExpression,
    ArrayIndexExpression,
    ArrayQueryExpression,
    ArraySliceExpression,
    BetweenExpression,
    BinaryExpression,
    CaseExpression,
    CastExpression,
    FunctionCall,
    InlineQuery,
    JsonPredicateExpression,
    ParenExpression,
    TupleExpression,
    TypeValue,
    UnaryExpression,
    ValueComponent,
    ValueList
} from "../models/ValueComponent";
import { SqlComponentFormatOptions } from "./SqlComponentFormatter";
import { dedupeTopLevelAndConditionsWithMetadata } from "./TopLevelAndConditionDeduper";

export interface ConditionDeduplicationApplied {
    kind: "dedupe_condition";
    conditionSql: string;
    scopeId: string;
    reason: string;
}

export interface ConditionDeduplicationResult {
    /** API output shape review: this phase mutates and returns the model only; ConditionOptimization remains responsible for compatibility sql output. */
    query: SelectQuery | null;
    applied: readonly ConditionDeduplicationApplied[];
}

export class ConditionDeduplicationOptimizer {
    private visited = new WeakSet<object>();
    private applied: ConditionDeduplicationApplied[] = [];

    public optimize(
        query: SelectQuery | null,
        options: SqlComponentFormatOptions
    ): ConditionDeduplicationResult {
        this.visited = new WeakSet<object>();
        this.applied = [];

        if (!query) {
            return { query: null, applied: [] };
        }

        this.visitSelectQuery(query, "root", options);
        return {
            query,
            applied: [...this.applied]
        };
    }

    private visitSelectQuery(
        query: SelectQuery,
        scopeId: string,
        options: SqlComponentFormatOptions
    ): void {
        if (this.visited.has(query)) {
            return;
        }
        this.visited.add(query);

        if (query instanceof BinarySelectQuery) {
            this.visitSelectQuery(query.left, `${scopeId}.left`, options);
            this.visitSelectQuery(query.right, `${scopeId}.right`, options);
            return;
        }

        if (!(query instanceof SimpleSelectQuery)) {
            return;
        }

        for (const cte of query.withClause?.tables ?? []) {
            const cteQuery = cte.query;
            if (cteQuery instanceof SimpleSelectQuery || cteQuery instanceof BinarySelectQuery) {
                this.visitSelectQuery(cteQuery, `${scopeId}.cte:${cte.getSourceAliasName()}`, options);
            }
        }

        for (const item of query.selectClause.items) {
            this.visitValueComponent(item.value, `${scopeId}.select`, options);
        }

        if (query.fromClause) {
            this.visitSourceExpression(query.fromClause.source, `${scopeId}.from`, options);
            for (const join of query.fromClause.joins ?? []) {
                const joinScope = `${scopeId}.join:${join.source.getAliasName() ?? "unknown"}`;
                this.visitSourceExpression(join.source, joinScope, options);
                if (join.condition instanceof JoinOnClause) {
                    join.condition.condition = this.dedupeCondition(
                        join.condition.condition,
                        `${joinScope}.on`,
                        "Removed a duplicate top-level AND condition from a JOIN ON clause.",
                        options
                    );
                    this.visitValueComponent(join.condition.condition, `${joinScope}.on`, options);
                }
            }
        }

        if (query.whereClause) {
            query.whereClause = new WhereClause(this.dedupeCondition(
                query.whereClause.condition,
                `${scopeId}.where`,
                "Removed a duplicate top-level AND condition from a WHERE clause.",
                options
            ));
            this.visitValueComponent(query.whereClause.condition, `${scopeId}.where`, options);
        }

        if (query.havingClause) {
            query.havingClause = new HavingClause(this.dedupeCondition(
                query.havingClause.condition,
                `${scopeId}.having`,
                "Removed a duplicate top-level AND condition from a HAVING clause.",
                options
            ));
            this.visitValueComponent(query.havingClause.condition, `${scopeId}.having`, options);
        }

        for (const item of query.groupByClause?.grouping ?? []) {
            this.visitValueComponent(item, `${scopeId}.group_by`, options);
        }
        for (const item of query.orderByClause?.order ?? []) {
            if (item instanceof OrderByItem) {
                this.visitValueComponent(item.value, `${scopeId}.order_by`, options);
            } else {
                this.visitValueComponent(item, `${scopeId}.order_by`, options);
            }
        }
    }

    private visitSourceExpression(
        source: SourceExpression,
        scopeId: string,
        options: SqlComponentFormatOptions
    ): void {
        const datasource = source.datasource;
        if (datasource instanceof SubQuerySource) {
            this.visitSelectQuery(datasource.query, `${scopeId}.subquery`, options);
            return;
        }
        if (datasource instanceof ParenSource) {
            const nested = datasource.source;
            if (nested instanceof SubQuerySource) {
                this.visitSelectQuery(nested.query, `${scopeId}.subquery`, options);
            }
            return;
        }
        if (datasource instanceof FunctionSource && datasource.argument) {
            this.visitValueComponent(datasource.argument, `${scopeId}.function`, options);
        }
    }

    private visitValueComponent(
        value: ValueComponent,
        scopeId: string,
        options: SqlComponentFormatOptions
    ): void {
        if (this.visited.has(value)) {
            return;
        }
        this.visited.add(value);

        if (value instanceof InlineQuery) {
            this.visitSelectQuery(value.selectQuery, `${scopeId}.inline_query`, options);
            return;
        }
        if (value instanceof ArrayQueryExpression) {
            this.visitSelectQuery(value.query, `${scopeId}.array_query`, options);
            return;
        }
        if (value instanceof ParenExpression) {
            this.visitValueComponent(value.expression, scopeId, options);
            return;
        }
        if (value instanceof BinaryExpression) {
            this.visitValueComponent(value.left, scopeId, options);
            this.visitValueComponent(value.right, scopeId, options);
            return;
        }
        if (value instanceof UnaryExpression) {
            this.visitValueComponent(value.expression, scopeId, options);
            return;
        }
        if (value instanceof FunctionCall) {
            if (value.argument) {
                this.visitValueComponent(value.argument, scopeId, options);
            }
            if (value.filterCondition) {
                this.visitValueComponent(value.filterCondition, `${scopeId}.filter`, options);
            }
            return;
        }
        if (value instanceof CastExpression) {
            this.visitValueComponent(value.input, scopeId, options);
            if (value.castType.argument) {
                this.visitValueComponent(value.castType.argument, scopeId, options);
            }
            return;
        }
        if (value instanceof CaseExpression) {
            if (value.condition) {
                this.visitValueComponent(value.condition, scopeId, options);
            }
            for (const item of value.switchCase.cases) {
                this.visitValueComponent(item.key, scopeId, options);
                this.visitValueComponent(item.value, scopeId, options);
            }
            if (value.switchCase.elseValue) {
                this.visitValueComponent(value.switchCase.elseValue, scopeId, options);
            }
            return;
        }
        if (value instanceof BetweenExpression) {
            this.visitValueComponent(value.expression, scopeId, options);
            this.visitValueComponent(value.lower, scopeId, options);
            this.visitValueComponent(value.upper, scopeId, options);
            return;
        }
        if (value instanceof JsonPredicateExpression) {
            this.visitValueComponent(value.expression, scopeId, options);
            return;
        }
        if (value instanceof ArrayExpression) {
            this.visitValueComponent(value.expression, scopeId, options);
            return;
        }
        if (value instanceof ArrayIndexExpression) {
            this.visitValueComponent(value.array, scopeId, options);
            this.visitValueComponent(value.index, scopeId, options);
            return;
        }
        if (value instanceof ArraySliceExpression) {
            this.visitValueComponent(value.array, scopeId, options);
            if (value.startIndex) {
                this.visitValueComponent(value.startIndex, scopeId, options);
            }
            if (value.endIndex) {
                this.visitValueComponent(value.endIndex, scopeId, options);
            }
            return;
        }
        if (value instanceof ValueList || value instanceof TupleExpression) {
            value.values.forEach(item => this.visitValueComponent(item, scopeId, options));
            return;
        }
        if (value instanceof TypeValue && value.argument) {
            this.visitValueComponent(value.argument, scopeId, options);
        }
    }

    private dedupeCondition(
        condition: ValueComponent,
        scopeId: string,
        reason: string,
        options: SqlComponentFormatOptions
    ): ValueComponent {
        const result = dedupeTopLevelAndConditionsWithMetadata(condition, options);
        for (const conditionSql of result.removedConditionSql) {
            this.applied.push({
                kind: "dedupe_condition",
                conditionSql,
                scopeId,
                reason
            });
        }
        return result.expression;
    }
}
