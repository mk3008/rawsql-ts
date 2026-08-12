import { BinarySelectQuery } from "../models/BinarySelectQuery";
import {
    FunctionSource,
    ParenSource,
    SubQuerySource,
    WithClause,
} from "../models/Clause";
import type { CommonTable, SourceComponent, SourceExpression } from "../models/Clause";
import type { SelectQuery } from "../models/SelectQuery";
import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import { SqlComponent } from "../models/SqlComponent";
import {
    ArrayQueryExpression,
    BinaryExpression,
    InlineQuery,
    ParenExpression,
    UnaryExpression,
} from "../models/ValueComponent";
import { ValuesQuery } from "../models/ValuesQuery";

export type QueryScopeKind =
    | "root"
    | "cte"
    | "derived"
    | "scalar_subquery"
    | "exists"
    | "in_subquery"
    | "set_operation";

export type QueryScopeExpressionClause =
    | "select"
    | "from"
    | "join"
    | "where"
    | "group_by"
    | "having"
    | "order_by"
    | "window"
    | "limit"
    | "offset"
    | "fetch"
    | "values";

export type QueryScopePathSegmentV1 =
    | { kind: "root" }
    | { index: number; kind: "cte"; name: string }
    | { index: number; kind: "source_subquery"; source: "from" | "join" }
    | {
        clause: QueryScopeExpressionClause;
        index: number;
        kind: "expression_subquery";
        subqueryKind: "scalar_subquery" | "exists" | "in_subquery";
    }
    | { kind: "set_branch"; side: "left" | "right" };

/**
 * Identifies one query scope by its semantic location in a parsed query.
 *
 * The same SQL parsed by the same AST model yields the same selector. Selectors
 * are intentionally not stable across edits to the SQL text.
 */
export interface QueryScopeSelectorV1 {
    path: QueryScopePathSegmentV1[];
    version: 1;
}

/** A collected scope retaining its parsed AST identity for later transformations. */
export interface QueryScopeAstV1 {
    /** Whether row sources from the containing scope are visible to this scope. */
    allowsOuterReferences: boolean;
    kind: QueryScopeKind;
    parentSelector?: QueryScopeSelectorV1;
    query: SelectQuery;
    selector: QueryScopeSelectorV1;
    /** CTE names visible to the main body of this scope, after lexical shadowing. */
    visibleCteNames: string[];
}

export type QueryScopeResolutionV1 =
    | { scope: QueryScopeAstV1; status: "found" }
    | { status: "not_found" }
    | { matches: QueryScopeAstV1[]; status: "ambiguous" };

interface CollectScopeOptions {
    allowsOuterReferences: boolean;
    consumedWithClause?: WithClause;
    inheritedCteNames: string[];
    kind: QueryScopeKind;
    parentSelector?: QueryScopeSelectorV1;
    query: SelectQuery;
    selector: QueryScopeSelectorV1;
}

/** Collects every parser-backed SELECT scope without formatting or reparsing SQL. */
export class QueryScopeCollector {
    private readonly collected: QueryScopeAstV1[] = [];
    private readonly selectorKeys = new Set<string>();

    collect(query: SelectQuery): QueryScopeAstV1[] {
        this.collected.length = 0;
        this.selectorKeys.clear();
        this.collectScope({
            allowsOuterReferences: false,
            inheritedCteNames: [],
            kind: "root",
            query,
            selector: { path: [{ kind: "root" }], version: 1 },
        });
        return [...this.collected];
    }

    private collectScope(options: CollectScopeOptions): void {
        const ownWithClause = leadingWithClause(options.query);
        const shouldCollectWithClause = ownWithClause !== null && ownWithClause !== options.consumedWithClause;
        const declaredCteNames = shouldCollectWithClause
            ? ownWithClause.tables.map((table) => table.getSourceAliasName())
            : [];
        const visibleCteNames = mergeVisibleCteNames(options.inheritedCteNames, declaredCteNames);
        this.addScope({
            allowsOuterReferences: options.allowsOuterReferences,
            kind: options.kind,
            ...(options.parentSelector ? { parentSelector: cloneSelector(options.parentSelector) } : {}),
            query: options.query,
            selector: cloneSelector(options.selector),
            visibleCteNames,
        });

        if (shouldCollectWithClause) {
            this.collectCtes(ownWithClause, options.selector, options.inheritedCteNames);
        }

        if (options.query instanceof BinarySelectQuery) {
            this.collectSetBranch(options.query.left, "left", options.selector, visibleCteNames, ownWithClause ?? undefined);
            this.collectSetBranch(options.query.right, "right", options.selector, visibleCteNames);
            return;
        }

        if (options.query instanceof SimpleSelectQuery) {
            this.collectSimpleQueryChildren(options.query, options.selector, visibleCteNames);
            return;
        }

        if (options.query instanceof ValuesQuery) {
            this.collectExpressionSubqueries(options.query.tuples, "values", options.selector, visibleCteNames);
        }
    }

    private collectCtes(withClause: WithClause, parentSelector: QueryScopeSelectorV1, inheritedCteNames: string[]): void {
        const allNames = withClause.tables.map((table) => table.getSourceAliasName());
        for (const [index, cte] of withClause.tables.entries()) {
            if (!isSelectQuery(cte.query)) {
                continue;
            }
            const accessibleNames = withClause.recursive
                ? mergeVisibleCteNames(inheritedCteNames, allNames)
                : mergeVisibleCteNames(inheritedCteNames, allNames.slice(0, index));
            const selector = appendSegment(parentSelector, {
                index,
                kind: "cte",
                name: cte.getSourceAliasName(),
            });
            this.collectScope({
                allowsOuterReferences: false,
                inheritedCteNames: accessibleNames,
                kind: "cte",
                parentSelector,
                query: cte.query,
                selector,
            });
        }
    }

    private collectSetBranch(
        query: SelectQuery,
        side: "left" | "right",
        parentSelector: QueryScopeSelectorV1,
        inheritedCteNames: string[],
        consumedWithClause?: WithClause,
    ): void {
        this.collectScope({
            allowsOuterReferences: true,
            ...(consumedWithClause ? { consumedWithClause } : {}),
            inheritedCteNames,
            kind: "set_operation",
            parentSelector,
            query,
            selector: appendSegment(parentSelector, { kind: "set_branch", side }),
        });
    }

    private collectSimpleQueryChildren(
        query: SimpleSelectQuery,
        parentSelector: QueryScopeSelectorV1,
        visibleCteNames: string[],
    ): void {
        const expressionCounters = new Map<string, number>();
        if (query.fromClause) {
            this.collectSourceSubquery(query.fromClause.source, "from", 0, parentSelector, visibleCteNames, false);
            this.collectSourceExpressionSubqueries(query.fromClause.source, "from", parentSelector, visibleCteNames, expressionCounters);
            for (const [index, join] of (query.fromClause.joins ?? []).entries()) {
                this.collectSourceSubquery(join.source, "join", index, parentSelector, visibleCteNames, join.lateral);
                this.collectSourceExpressionSubqueries(join.source, "join", parentSelector, visibleCteNames, expressionCounters);
                this.collectExpressionSubqueries(join.condition, "join", parentSelector, visibleCteNames, expressionCounters);
            }
        }

        this.collectExpressionSubqueries(query.selectClause, "select", parentSelector, visibleCteNames, expressionCounters);
        this.collectExpressionSubqueries(query.whereClause, "where", parentSelector, visibleCteNames, expressionCounters);
        this.collectExpressionSubqueries(query.groupByClause, "group_by", parentSelector, visibleCteNames, expressionCounters);
        this.collectExpressionSubqueries(query.havingClause, "having", parentSelector, visibleCteNames, expressionCounters);
        this.collectExpressionSubqueries(query.orderByClause, "order_by", parentSelector, visibleCteNames, expressionCounters);
        this.collectExpressionSubqueries(query.windowClause, "window", parentSelector, visibleCteNames, expressionCounters);
        this.collectExpressionSubqueries(query.limitClause, "limit", parentSelector, visibleCteNames, expressionCounters);
        this.collectExpressionSubqueries(query.offsetClause, "offset", parentSelector, visibleCteNames, expressionCounters);
        this.collectExpressionSubqueries(query.fetchClause, "fetch", parentSelector, visibleCteNames, expressionCounters);
    }

    private collectSourceSubquery(
        source: SourceExpression,
        sourceKind: "from" | "join",
        index: number,
        parentSelector: QueryScopeSelectorV1,
        visibleCteNames: string[],
        allowsOuterReferences: boolean,
    ): void {
        const subquery = unwrapSubquerySource(source.datasource);
        if (!subquery) {
            return;
        }
        const selector = appendSegment(parentSelector, {
            index,
            kind: "source_subquery",
            source: sourceKind,
        });
        this.collectScope({
            allowsOuterReferences,
            inheritedCteNames: visibleCteNames,
            kind: "derived",
            parentSelector,
            query: subquery.query,
            selector,
        });
    }

    private collectSourceExpressionSubqueries(
        source: SourceExpression,
        clause: "from" | "join",
        parentSelector: QueryScopeSelectorV1,
        visibleCteNames: string[],
        counters: Map<string, number>,
    ): void {
        const datasource = unwrapParenSource(source.datasource);
        if (datasource instanceof FunctionSource) {
            this.collectExpressionSubqueries(datasource.argument, clause, parentSelector, visibleCteNames, counters);
        }
    }

    private collectExpressionSubqueries(
        value: unknown,
        clause: QueryScopeExpressionClause,
        parentSelector: QueryScopeSelectorV1,
        visibleCteNames: string[],
        counters = new Map<string, number>(),
    ): void {
        const visited = new Set<unknown>();

        const visit = (current: unknown, ancestors: SqlComponent[]): void => {
            if (!current || typeof current !== "object" || visited.has(current)) {
                return;
            }
            visited.add(current);

            if (current instanceof InlineQuery) {
                const kind = classifyInlineQuery(ancestors);
                const counterKey = `${clause}:${kind}`;
                const index = counters.get(counterKey) ?? 0;
                counters.set(counterKey, index + 1);
                this.collectScope({
                    allowsOuterReferences: true,
                    inheritedCteNames: visibleCteNames,
                    kind,
                    parentSelector,
                    query: current.selectQuery,
                    selector: appendSegment(parentSelector, {
                        clause,
                        index,
                        kind: "expression_subquery",
                        subqueryKind: kind,
                    }),
                });
                return;
            }

            if (current instanceof ArrayQueryExpression) {
                const kind = "scalar_subquery" as const;
                const counterKey = `${clause}:${kind}`;
                const index = counters.get(counterKey) ?? 0;
                counters.set(counterKey, index + 1);
                this.collectScope({
                    allowsOuterReferences: true,
                    inheritedCteNames: visibleCteNames,
                    kind,
                    parentSelector,
                    query: current.query,
                    selector: appendSegment(parentSelector, {
                        clause,
                        index,
                        kind: "expression_subquery",
                        subqueryKind: kind,
                    }),
                });
                return;
            }

            if (Array.isArray(current)) {
                current.forEach((item) => visit(item, ancestors));
                return;
            }

            if (!(current instanceof SqlComponent)) {
                return;
            }

            const nextAncestors = [...ancestors, current];
            for (const key of Object.keys(current).sort()) {
                visit((current as unknown as Record<string, unknown>)[key], nextAncestors);
            }
        };

        visit(value, []);
    }

    private addScope(scope: QueryScopeAstV1): void {
        const key = queryScopeSelectorKey(scope.selector);
        if (this.selectorKeys.has(key)) {
            throw new Error(`Query scope selector collision: ${key}`);
        }
        this.selectorKeys.add(key);
        this.collected.push(scope);
    }
}

/** Resolves exactly one AST scope and never returns an arbitrary first match. */
export function resolveQueryScope(
    scopes: readonly QueryScopeAstV1[],
    selector: QueryScopeSelectorV1,
): QueryScopeResolutionV1 {
    const key = queryScopeSelectorKey(selector);
    const matches = scopes.filter((scope) => queryScopeSelectorKey(scope.selector) === key);
    if (matches.length === 0) {
        return { status: "not_found" };
    }
    if (matches.length > 1) {
        return { matches, status: "ambiguous" };
    }
    return { scope: matches[0], status: "found" };
}

/** Returns a deterministic comparison key independent of object property order. */
export function queryScopeSelectorKey(selector: QueryScopeSelectorV1): string {
    const segments = selector.path.map((segment) => {
        switch (segment.kind) {
            case "root":
                return "root";
            case "cte":
                return `cte:${segment.index}:${encodeURIComponent(segment.name)}`;
            case "source_subquery":
                return `source:${segment.source}:${segment.index}`;
            case "expression_subquery":
                return `expression:${segment.clause}:${segment.subqueryKind}:${segment.index}`;
            case "set_branch":
                return `set:${segment.side}`;
        }
    });
    return `v${selector.version}/${segments.join("/")}`;
}

function classifyInlineQuery(ancestors: SqlComponent[]): "scalar_subquery" | "exists" | "in_subquery" {
    for (let index = ancestors.length - 1; index >= 0; index -= 1) {
        const ancestor = ancestors[index];
        if (ancestor instanceof ParenExpression) {
            continue;
        }
        if (ancestor instanceof UnaryExpression) {
            const operator = normalizeOperator(ancestor.operator.value);
            return operator === "exists" || operator === "not exists" ? "exists" : "scalar_subquery";
        }
        if (ancestor instanceof BinaryExpression) {
            const operator = normalizeOperator(ancestor.operator.value);
            return operator === "in" || operator === "not in" ? "in_subquery" : "scalar_subquery";
        }
        return "scalar_subquery";
    }
    return "scalar_subquery";
}

function normalizeOperator(operator: string): string {
    return operator.trim().replace(/\s+/g, " ").toLowerCase();
}

function appendSegment(selector: QueryScopeSelectorV1, segment: QueryScopePathSegmentV1): QueryScopeSelectorV1 {
    return { path: [...selector.path.map(cloneSegment), cloneSegment(segment)], version: 1 };
}

function cloneSelector(selector: QueryScopeSelectorV1): QueryScopeSelectorV1 {
    return { path: selector.path.map(cloneSegment), version: 1 };
}

function cloneSegment(segment: QueryScopePathSegmentV1): QueryScopePathSegmentV1 {
    return { ...segment };
}

function leadingWithClause(query: SelectQuery): WithClause | null {
    if (query instanceof SimpleSelectQuery || query instanceof ValuesQuery) {
        return query.withClause;
    }
    if (query instanceof BinarySelectQuery) {
        return leadingWithClause(query.left);
    }
    return null;
}

function isSelectQuery(query: CommonTable["query"]): query is SelectQuery {
    return typeof query === "object" && query !== null && "__selectQueryType" in query;
}

function unwrapSubquerySource(source: SourceComponent): SubQuerySource | null {
    const unwrapped = unwrapParenSource(source);
    return unwrapped instanceof SubQuerySource ? unwrapped : null;
}

function unwrapParenSource(source: SourceComponent): SourceComponent {
    let current = source;
    while (current instanceof ParenSource) {
        current = current.source;
    }
    return current;
}

function mergeVisibleCteNames(outer: string[], inner: string[]): string[] {
    const result = [...outer];
    for (const name of inner) {
        const existing = result.findIndex((candidate) => candidate === name);
        if (existing >= 0) {
            result.splice(existing, 1);
        }
        result.push(name);
    }
    return result;
}
