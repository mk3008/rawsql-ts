import {
    DistinctOn,
    FetchClause,
    GroupByClause,
    HavingClause,
    JoinOnClause,
    JoinUsingClause,
    LimitClause,
    OffsetClause,
    OrderByClause,
    OrderByItem,
    SelectClause,
    WhereClause,
    WindowsClause,
} from "../models/Clause";
import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import {
    ArrayExpression,
    ArrayIndexExpression,
    ArrayQueryExpression,
    ArraySliceExpression,
    BetweenExpression,
    BinaryExpression,
    CaseExpression,
    CastExpression,
    ColumnReference,
    FunctionCall,
    IdentifierString,
    InlineQuery,
    JsonPredicateExpression,
    ParenExpression,
    RawString,
    TupleExpression,
    TypeValue,
    UnaryExpression,
    ValueComponent,
    ValueList,
    WindowFrameBoundaryValue,
    WindowFrameExpression,
} from "../models/ValueComponent";

export type ClauseScopedColumnReferenceClause =
    | "select"
    | "where"
    | "joinOn"
    | "groupBy"
    | "having"
    | "orderBy"
    | "window"
    | "limitOffset";

export interface ClauseScopedColumnReferenceInfo {
    clause: ClauseScopedColumnReferenceClause;
    reference: ColumnReference;
    qualifiedName: string;
    namespaces: string[];
    namespace: string | null;
    column: string;
    expression: ValueComponent;
}

export interface ClauseScopedColumnReferences {
    select: ClauseScopedColumnReferenceInfo[];
    where: ClauseScopedColumnReferenceInfo[];
    joinOn: ClauseScopedColumnReferenceInfo[];
    groupBy: ClauseScopedColumnReferenceInfo[];
    having: ClauseScopedColumnReferenceInfo[];
    orderBy: ClauseScopedColumnReferenceInfo[];
    window: ClauseScopedColumnReferenceInfo[];
    limitOffset: ClauseScopedColumnReferenceInfo[];
}

/**
 * Collects ColumnReference nodes grouped by the root SimpleSelectQuery clause that owns them.
 *
 * Subquery and CTE bodies are intentionally not traversed because they have their own query-body
 * ownership. Use ColumnReferenceCollector when comprehensive tree traversal is required.
 */
export class ClauseScopedColumnReferenceCollector {
    public collect(query: SimpleSelectQuery): ClauseScopedColumnReferences {
        if (!(query instanceof SimpleSelectQuery)) {
            throw new Error("ClauseScopedColumnReferenceCollector requires a SimpleSelectQuery.");
        }

        const result = this.createEmptyResult();

        this.collectFromSelectClause(query.selectClause, result);
        this.collectFromJoinClauses(query, result);

        if (query.whereClause) {
            this.collectFromWhereClause(query.whereClause, result);
        }
        if (query.groupByClause) {
            this.collectFromGroupByClause(query.groupByClause, result);
        }
        if (query.havingClause) {
            this.collectFromHavingClause(query.havingClause, result);
        }
        if (query.orderByClause) {
            this.collectFromOrderByClause(query.orderByClause, "orderBy", result);
        }
        if (query.windowClause) {
            this.collectFromWindowsClause(query.windowClause, result);
        }
        if (query.limitClause) {
            this.collectFromLimitClause(query.limitClause, result);
        }
        if (query.offsetClause) {
            this.collectFromOffsetClause(query.offsetClause, result);
        }
        if (query.fetchClause) {
            this.collectFromFetchClause(query.fetchClause, result);
        }

        return result;
    }

    private createEmptyResult(): ClauseScopedColumnReferences {
        return {
            select: [],
            where: [],
            joinOn: [],
            groupBy: [],
            having: [],
            orderBy: [],
            window: [],
            limitOffset: [],
        };
    }

    private collectFromSelectClause(clause: SelectClause, result: ClauseScopedColumnReferences): void {
        if (clause.distinct instanceof DistinctOn) {
            this.collectFromValueComponent(clause.distinct.value, "select", result);
        }

        for (const item of clause.items) {
            this.collectFromValueComponent(item.value, "select", result);
        }
    }

    private collectFromJoinClauses(query: SimpleSelectQuery, result: ClauseScopedColumnReferences): void {
        if (!query.fromClause?.joins) {
            return;
        }

        for (const join of query.fromClause.joins) {
            if (join.condition instanceof JoinOnClause || join.condition instanceof JoinUsingClause) {
                this.collectFromValueComponent(join.condition.condition, "joinOn", result);
            }
        }
    }

    private collectFromWhereClause(clause: WhereClause, result: ClauseScopedColumnReferences): void {
        this.collectFromValueComponent(clause.condition, "where", result);
    }

    private collectFromGroupByClause(clause: GroupByClause, result: ClauseScopedColumnReferences): void {
        for (const item of clause.grouping) {
            this.collectFromValueComponent(item, "groupBy", result);
        }
    }

    private collectFromHavingClause(clause: HavingClause, result: ClauseScopedColumnReferences): void {
        this.collectFromValueComponent(clause.condition, "having", result);
    }

    private collectFromOrderByClause(
        clause: OrderByClause,
        target: ClauseScopedColumnReferenceClause,
        result: ClauseScopedColumnReferences
    ): void {
        for (const item of clause.order) {
            if (item instanceof OrderByItem) {
                this.collectFromValueComponent(item.value, target, result);
            } else {
                this.collectFromValueComponent(item, target, result);
            }
        }
    }

    private collectFromLimitClause(clause: LimitClause, result: ClauseScopedColumnReferences): void {
        this.collectFromValueComponent(clause.value, "limitOffset", result);
    }

    private collectFromOffsetClause(clause: OffsetClause, result: ClauseScopedColumnReferences): void {
        this.collectFromValueComponent(clause.value, "limitOffset", result);
    }

    private collectFromFetchClause(clause: FetchClause, result: ClauseScopedColumnReferences): void {
        this.collectFromValueComponent(clause.expression.count, "limitOffset", result);
    }

    private collectFromWindowsClause(clause: WindowsClause, result: ClauseScopedColumnReferences): void {
        for (const window of clause.windows) {
            this.collectFromWindowFrameExpression(window.expression, "window", result);
        }
    }

    private collectFromValueComponent(
        value: ValueComponent,
        target: ClauseScopedColumnReferenceClause,
        result: ClauseScopedColumnReferences,
        expression: ValueComponent = value
    ): void {
        if (value instanceof ColumnReference) {
            result[target].push(this.createInfo(value, target, expression));
            return;
        }

        if (value instanceof BinaryExpression) {
            this.collectFromValueComponent(value.left, target, result, value);
            this.collectFromValueComponent(value.right, target, result, value);
        } else if (value instanceof UnaryExpression) {
            this.collectFromValueComponent(value.expression, target, result, value);
        } else if (value instanceof FunctionCall) {
            this.collectFromFunctionCall(value, target, result);
        } else if (value instanceof CaseExpression) {
            if (value.condition) {
                this.collectFromValueComponent(value.condition, target, result, value);
            }
            for (const pair of value.switchCase.cases) {
                this.collectFromValueComponent(pair.key, target, result, value);
                this.collectFromValueComponent(pair.value, target, result, value);
            }
            if (value.switchCase.elseValue) {
                this.collectFromValueComponent(value.switchCase.elseValue, target, result, value);
            }
        } else if (value instanceof ParenExpression) {
            this.collectFromValueComponent(value.expression, target, result, value);
        } else if (value instanceof CastExpression) {
            this.collectFromValueComponent(value.input, target, result, value);
        } else if (value instanceof BetweenExpression) {
            this.collectFromValueComponent(value.expression, target, result, value);
            this.collectFromValueComponent(value.lower, target, result, value);
            this.collectFromValueComponent(value.upper, target, result, value);
        } else if (value instanceof JsonPredicateExpression) {
            this.collectFromValueComponent(value.expression, target, result, value);
        } else if (value instanceof ArrayExpression) {
            this.collectFromValueComponent(value.expression, target, result, value);
        } else if (value instanceof ArraySliceExpression) {
            this.collectFromValueComponent(value.array, target, result, value);
            if (value.startIndex) {
                this.collectFromValueComponent(value.startIndex, target, result, value);
            }
            if (value.endIndex) {
                this.collectFromValueComponent(value.endIndex, target, result, value);
            }
        } else if (value instanceof ArrayIndexExpression) {
            this.collectFromValueComponent(value.array, target, result, value);
            this.collectFromValueComponent(value.index, target, result, value);
        } else if (value instanceof ValueList) {
            for (const item of value.values) {
                this.collectFromValueComponent(item, target, result, value);
            }
        } else if (value instanceof TupleExpression) {
            for (const item of value.values) {
                this.collectFromValueComponent(item, target, result, value);
            }
        } else if (value instanceof TypeValue && value.argument) {
            this.collectFromValueComponent(value.argument, target, result, value);
        } else if (value instanceof InlineQuery || value instanceof ArrayQueryExpression) {
            return;
        }
    }

    private collectFromFunctionCall(
        value: FunctionCall,
        target: ClauseScopedColumnReferenceClause,
        result: ClauseScopedColumnReferences
    ): void {
        if (value.argument) {
            this.collectFromValueComponent(value.argument, target, result, value);
        }
        if (value.filterCondition) {
            this.collectFromValueComponent(value.filterCondition, target, result, value);
        }
        if (value.withinGroup) {
            this.collectFromOrderByClause(value.withinGroup, target, result);
        }
        if (value.internalOrderBy) {
            this.collectFromOrderByClause(value.internalOrderBy, target, result);
        }
        if (value.over instanceof WindowFrameExpression) {
            this.collectFromWindowFrameExpression(value.over, target, result);
        }
    }

    private collectFromWindowFrameExpression(
        value: WindowFrameExpression,
        target: ClauseScopedColumnReferenceClause,
        result: ClauseScopedColumnReferences
    ): void {
        if (value.partition) {
            this.collectFromValueComponent(value.partition.value, target, result);
        }
        if (value.order) {
            this.collectFromOrderByClause(value.order, target, result);
        }
        if (value.frameSpec) {
            if (value.frameSpec.startBound instanceof WindowFrameBoundaryValue) {
                this.collectFromValueComponent(value.frameSpec.startBound.value, target, result);
            }
            if (value.frameSpec.endBound instanceof WindowFrameBoundaryValue) {
                this.collectFromValueComponent(value.frameSpec.endBound.value, target, result);
            }
        }
    }

    private createInfo(
        reference: ColumnReference,
        clause: ClauseScopedColumnReferenceClause,
        expression: ValueComponent
    ): ClauseScopedColumnReferenceInfo {
        const namespaces = reference.namespaces?.map(namespace => namespace.name) ?? [];
        const columnName = this.getNameText(reference.qualifiedName.name);

        return {
            clause,
            reference,
            qualifiedName: reference.qualifiedName.toString(),
            namespaces,
            namespace: namespaces.length > 0 ? namespaces.join(".") : null,
            column: columnName,
            expression,
        };
    }

    private getNameText(name: IdentifierString | RawString): string {
        return name instanceof IdentifierString ? name.name : name.value;
    }
}
