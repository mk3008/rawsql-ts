import {
    FromClause,
    JoinClause,
    JoinOnClause,
    SourceExpression,
    SubQuerySource,
    TableSource
} from "../models/Clause";
import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import {
    ArrayExpression,
    ArrayQueryExpression,
    BetweenExpression,
    BinaryExpression,
    CaseExpression,
    CastExpression,
    ColumnReference,
    FunctionCall,
    InlineQuery,
    JsonPredicateExpression,
    TupleExpression,
    TypeValue,
    UnaryExpression,
    ValueComponent,
    ValueList
} from "../models/ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { formatSqlComponent, SqlComponentFormatOptions } from "./SqlComponentFormatter";
import { SelectOutputCollector, SelectOutputColumn } from "./SelectOutputCollector";
import {
    cloneColumnReference,
    cloneValueComponent,
    collectTopLevelAndTerms,
    columnReferenceText,
    identifiersEqual,
    isBinaryOperator,
    normalizeIdentifier,
    sameColumnReference,
    unwrapParens
} from "./PredicateExpressionUtils";

export type PredicateReachabilityInput = string | SelectQuery | SimpleSelectQuery;

export interface PredicateReachabilityOptions extends SqlComponentFormatOptions {
    cloneInput?: boolean;
}

export interface PredicateReachabilityWarning {
    code: string;
    message: string;
    detail?: unknown;
}

export interface PredicateReachabilityError {
    code: string;
    message: string;
    detail?: unknown;
}

export type PredicateReachabilityMode = "rewrite_safe" | "debug_only";
export type PredicateReachabilityRelation = "origin" | "direct_output" | "join_equivalence";
export type PredicateReachabilityProbeKind = "count" | "sample";

export interface PredicateReachabilityScopeTarget {
    kind: "scope" | "cte" | "table" | "subquery" | "source";
    name: string;
}

export interface PredicateReachabilityTarget {
    scopeId: string;
    relation: PredicateReachabilityRelation;
    mode: PredicateReachabilityMode;
    predicateSql: string;
    targetPredicateSql?: string;
    via?: readonly string[];
}

export interface PredicateReachabilityBlocked {
    scopeId: string;
    relation: PredicateReachabilityRelation;
    code: string;
    reason: string;
    via?: readonly string[];
}

export interface PredicateReachabilityProbeTarget {
    scopeId: string;
    relation: PredicateReachabilityRelation;
    mode: PredicateReachabilityMode;
    predicateSql: string;
    targetPredicateSql?: string;
    target: PredicateReachabilityScopeTarget;
    probeKinds: readonly PredicateReachabilityProbeKind[];
    caution?: string;
}

export interface PredicateReachabilityPredicate {
    predicateSql: string;
    originScopeId: string;
    columnReferences: readonly string[];
    reaches: readonly PredicateReachabilityTarget[];
    blocked: readonly PredicateReachabilityBlocked[];
    probeTargets: readonly PredicateReachabilityProbeTarget[];
}

export interface PredicateReachabilitySafety {
    mode: "debug_only";
    sqlRewritten: false;
}

export interface PredicateReachabilityResult {
    ok: boolean;
    query: SelectQuery | null;
    predicates: readonly PredicateReachabilityPredicate[];
    warnings: readonly PredicateReachabilityWarning[];
    errors: readonly PredicateReachabilityError[];
    safety: PredicateReachabilitySafety;
}

interface SourceBinding {
    source: SourceExpression;
    alias: string;
    join: JoinClause | null;
    isPrimary: boolean;
}

interface DirectOutputResolution {
    query: SimpleSelectQuery;
    scopeId: string;
    targetColumns: TargetColumnResolution[];
}

interface TargetColumnResolution {
    sourceColumn: ColumnReference;
    targetColumn: ColumnReference;
}

export class PredicateReachabilityAnalyzer {
    public analyze(
        input: PredicateReachabilityInput,
        options: PredicateReachabilityOptions = {}
    ): PredicateReachabilityResult {
        const warnings: PredicateReachabilityWarning[] = [];
        const errors: PredicateReachabilityError[] = [];
        let query: SelectQuery | null = null;

        try {
            if (typeof input === "string") {
                query = SelectQueryParser.parse(input);
            } else if (options.cloneInput === false) {
                query = input;
            } else {
                query = SelectQueryParser.parse(formatSqlComponent(input, options));
            }
        } catch (error) {
            errors.push({
                code: "PARSE_FAILED",
                message: "Predicate reachability analysis could not parse the input SQL.",
                detail: error instanceof Error ? error.message : String(error)
            });
            return this.buildResult(null, [], warnings, errors);
        }

        if (!(query instanceof SimpleSelectQuery)) {
            warnings.push({
                code: "UNSUPPORTED_ROOT_QUERY",
                message: "Predicate reachability analysis currently supports only SimpleSelectQuery roots."
            });
            return this.buildResult(query, [], warnings, errors);
        }

        const predicates = this.analyzeScope(query, query, "scope:root", options);
        return this.buildResult(query, predicates, warnings, errors);
    }

    private analyzeScope(
        contextRoot: SimpleSelectQuery,
        query: SimpleSelectQuery,
        scopeId: string,
        options: SqlComponentFormatOptions
    ): PredicateReachabilityPredicate[] {
        if (!query.whereClause) {
            return [];
        }

        return collectTopLevelAndTerms(query.whereClause.condition).map(term => {
            const references = this.collectOuterColumnReferences(query, term);
            const reaches: PredicateReachabilityTarget[] = [{
                scopeId,
                relation: "origin",
                mode: "rewrite_safe",
                predicateSql: formatSqlComponent(term, options)
            }];
            const blocked: PredicateReachabilityBlocked[] = [];

            const direct = this.resolveDirectOutputReach(contextRoot, query, references);
            if (direct) {
                const rebased = this.rebasePredicate(term, direct.targetColumns, options);
                reaches.push({
                    scopeId: direct.scopeId,
                    relation: "direct_output",
                    mode: "rewrite_safe",
                    predicateSql: formatSqlComponent(rebased, options)
                });
            }

            const joinReachability = this.resolveJoinEquivalenceReach(contextRoot, query, references, term, options);
            reaches.push(...joinReachability.reaches);
            blocked.push(...joinReachability.blocked);

            return {
                predicateSql: formatSqlComponent(term, options),
                originScopeId: scopeId,
                columnReferences: references.map(columnReferenceText),
                reaches,
                blocked,
                probeTargets: this.buildProbeTargets(reaches)
            };
        });
    }

    private buildProbeTargets(
        reaches: readonly PredicateReachabilityTarget[]
    ): PredicateReachabilityProbeTarget[] {
        return reaches.map(reach => ({
            scopeId: reach.scopeId,
            relation: reach.relation,
            mode: reach.mode,
            predicateSql: reach.predicateSql,
            ...(reach.targetPredicateSql ? { targetPredicateSql: reach.targetPredicateSql } : {}),
            target: this.describeScopeTarget(reach.scopeId),
            probeKinds: ["count", "sample"],
            ...(reach.mode === "debug_only"
                ? {
                    caution: "This target is inferred through a debug-only relationship and is not a safe SQL rewrite target."
                }
                : {})
        }));
    }

    private describeScopeTarget(scopeId: string): PredicateReachabilityScopeTarget {
        const [kind, ...rest] = scopeId.split(":");
        const name = rest.join(":") || scopeId;
        switch (kind) {
            case "cte":
                return { kind: "cte", name };
            case "table":
                return { kind: "table", name };
            case "subquery":
                return { kind: "subquery", name };
            case "source":
                return { kind: "source", name };
            default:
                return { kind: "scope", name };
        }
    }

    private resolveDirectOutputReach(
        contextRoot: SimpleSelectQuery,
        query: SimpleSelectQuery,
        references: readonly ColumnReference[]
    ): DirectOutputResolution | null {
        if (references.length === 0 || !query.fromClause) {
            return null;
        }

        const bindings: SourceBinding[] = [];
        for (const reference of references) {
            const binding = this.resolveSourceBinding(query, reference);
            if (!binding) {
                return null;
            }
            if (!bindings.some(item => item.source === binding.source)) {
                bindings.push(binding);
            }
        }
        if (bindings.length !== 1) {
            return null;
        }

        const binding = bindings[0]!;
        const target = this.resolveSourceQuery(contextRoot, binding);
        if (!target) {
            return null;
        }

        const targetColumns: TargetColumnResolution[] = [];
        for (const reference of references) {
            const output = this.resolveDirectOutputColumn(contextRoot, target.query, reference.column.name);
            if (!output || !(output.value instanceof ColumnReference)) {
                return null;
            }
            targetColumns.push({
                sourceColumn: reference,
                targetColumn: output.value
            });
        }

        return {
            query: target.query,
            scopeId: target.scopeId,
            targetColumns
        };
    }

    private resolveJoinEquivalenceReach(
        contextRoot: SimpleSelectQuery,
        query: SimpleSelectQuery,
        references: readonly ColumnReference[],
        predicate: ValueComponent,
        options: SqlComponentFormatOptions
    ): {
        reaches: PredicateReachabilityTarget[];
        blocked: PredicateReachabilityBlocked[];
    } {
        const reaches: PredicateReachabilityTarget[] = [];
        const blocked: PredicateReachabilityBlocked[] = [];
        if (!query.fromClause || references.length === 0) {
            return { reaches, blocked };
        }

        const bindings = this.getSourceBindings(query.fromClause);
        for (const join of query.fromClause.joins ?? []) {
            if (!(join.condition instanceof JoinOnClause)) {
                continue;
            }
            const equalities = this.collectJoinEqualities(join.condition.condition);
            for (const equality of equalities) {
                for (const reference of references) {
                    const equivalent = sameColumnReference(reference, equality.left)
                        ? equality.right
                        : sameColumnReference(reference, equality.right)
                            ? equality.left
                            : null;
                    if (!equivalent) {
                        continue;
                    }
                    const referenceBinding = this.resolveSourceBindingFromList(bindings, reference);
                    if (!referenceBinding) {
                        continue;
                    }
                    const targetBinding = this.resolveSourceBindingFromList(bindings, equivalent);
                    if (!targetBinding) {
                        continue;
                    }
                    const via = [formatSqlComponent(equality.expression, options)];
                    const rebased = this.rebasePredicate(predicate, [{
                        sourceColumn: reference,
                        targetColumn: equivalent
                    }], options);
                    const scopeId = this.scopeIdForBinding(contextRoot, targetBinding);
                    const joinEquivalenceAllowed = this.isInnerJoin(join)
                        || this.isLeftJoinPreservedToNullableReach(join, referenceBinding, targetBinding);
                    if (!joinEquivalenceAllowed) {
                        blocked.push({
                            scopeId,
                            relation: "join_equivalence",
                            code: "OUTER_JOIN_EQUIVALENCE_UNSUPPORTED",
                            reason: "JOIN equivalence debug reachability is reported for INNER JOIN predicates and LEFT JOIN preserved-side predicates only.",
                            via
                        });
                        continue;
                    }
                    const targetPredicate = this.rebasePredicateToSourceQuery(
                        contextRoot,
                        targetBinding,
                        equivalent,
                        rebased,
                        options
                    );
                    reaches.push({
                        scopeId,
                        relation: "join_equivalence",
                        mode: "debug_only",
                        predicateSql: formatSqlComponent(rebased, options),
                        ...(targetPredicate ? { targetPredicateSql: formatSqlComponent(targetPredicate, options) } : {}),
                        via
                    });
                }
            }
        }

        return { reaches, blocked };
    }

    private collectJoinEqualities(expression: ValueComponent): Array<{
        expression: BinaryExpression;
        left: ColumnReference;
        right: ColumnReference;
    }> {
        const candidate = unwrapParens(expression);
        if (isBinaryOperator(candidate, "and")) {
            return [
                ...this.collectJoinEqualities(candidate.left),
                ...this.collectJoinEqualities(candidate.right)
            ];
        }
        if (
            candidate instanceof BinaryExpression
            && candidate.operator.value.trim() === "="
            && unwrapParens(candidate.left) instanceof ColumnReference
            && unwrapParens(candidate.right) instanceof ColumnReference
        ) {
            return [{
                expression: candidate,
                left: unwrapParens(candidate.left) as ColumnReference,
                right: unwrapParens(candidate.right) as ColumnReference
            }];
        }
        return [];
    }

    private resolveSourceQuery(
        contextRoot: SimpleSelectQuery,
        binding: SourceBinding
    ): { query: SimpleSelectQuery; scopeId: string } | null {
        const source = binding.source.datasource;
        if (source instanceof SubQuerySource && source.query instanceof SimpleSelectQuery) {
            return {
                query: source.query,
                scopeId: `subquery:${binding.alias}`
            };
        }
        if (!(source instanceof TableSource)) {
            return null;
        }

        const cte = this.findCte(contextRoot, source.table.name);
        if (!cte || !(cte.query instanceof SimpleSelectQuery)) {
            return null;
        }
        return {
            query: cte.query,
            scopeId: `cte:${cte.getSourceAliasName()}`
        };
    }

    private resolveDirectOutputColumn(
        contextRoot: SimpleSelectQuery,
        query: SimpleSelectQuery,
        columnName: string
    ): SelectOutputColumn | null {
        const matches = this.collectSelectOutputs(contextRoot, query)
            .filter(item => identifiersEqual(item.name, columnName));
        return matches.length === 1 ? matches[0]! : null;
    }

    private collectSelectOutputs(root: SimpleSelectQuery, query: SimpleSelectQuery): SelectOutputColumn[] {
        const commonTables = [
            ...(query.withClause?.tables ?? []),
            ...(root.withClause?.tables ?? [])
        ];
        const collector = new SelectOutputCollector(null, commonTables.length > 0 ? commonTables : null);
        return collector.collect(query);
    }

    private findCte(root: SimpleSelectQuery, name: string) {
        const normalized = normalizeIdentifier(name);
        const matches = (root.withClause?.tables ?? [])
            .filter(table => normalizeIdentifier(table.getSourceAliasName()) === normalized);
        return matches.length === 1 ? matches[0]! : null;
    }

    private resolveSourceBinding(query: SimpleSelectQuery, column: ColumnReference): SourceBinding | null {
        if (!query.fromClause) {
            return null;
        }
        return this.resolveSourceBindingFromList(this.getSourceBindings(query.fromClause), column);
    }

    private resolveSourceBindingFromList(
        bindings: readonly SourceBinding[],
        column: ColumnReference
    ): SourceBinding | null {
        const namespace = column.getNamespace();
        if (namespace) {
            const matches = bindings.filter(binding => identifiersEqual(binding.alias, namespace));
            return matches.length === 1 ? matches[0]! : null;
        }
        return bindings.length === 1 ? bindings[0]! : null;
    }

    private getSourceBindings(fromClause: FromClause): SourceBinding[] {
        const bindings: SourceBinding[] = [{
            source: fromClause.source,
            alias: fromClause.source.getAliasName() ?? "",
            join: null,
            isPrimary: true
        }];

        for (const join of fromClause.joins ?? []) {
            bindings.push({
                source: join.source,
                alias: join.source.getAliasName() ?? "",
                join,
                isPrimary: false
            });
        }

        return bindings;
    }

    private scopeIdForBinding(contextRoot: SimpleSelectQuery | null, binding: SourceBinding): string {
        const source = binding.source.datasource;
        if (source instanceof SubQuerySource) {
            return `subquery:${binding.alias}`;
        }
        if (source instanceof TableSource) {
            if (contextRoot && this.findCte(contextRoot, source.table.name)) {
                return `cte:${source.table.name}`;
            }
            return `table:${source.getSourceName()}`;
        }
        return `source:${binding.alias || "unknown"}`;
    }

    private isInnerJoin(join: JoinClause): boolean {
        const joinType = join.joinType.value.trim().toLowerCase();
        return joinType === "join" || joinType === "inner join";
    }

    private isLeftJoinPreservedToNullableReach(
        join: JoinClause,
        referenceBinding: SourceBinding,
        targetBinding: SourceBinding
    ): boolean {
        const joinType = join.joinType.value.trim().toLowerCase();
        return (joinType === "left join" || joinType === "left outer join")
            && targetBinding.source === join.source
            && referenceBinding.source !== join.source;
    }

    private rebasePredicateToSourceQuery(
        contextRoot: SimpleSelectQuery,
        targetBinding: SourceBinding,
        equivalentColumn: ColumnReference,
        predicate: ValueComponent,
        options: SqlComponentFormatOptions
    ): ValueComponent | null {
        const target = this.resolveSourceQuery(contextRoot, targetBinding);
        if (!target) {
            return null;
        }

        const output = this.resolveDirectOutputColumn(contextRoot, target.query, equivalentColumn.column.name);
        if (!output || !(output.value instanceof ColumnReference)) {
            return null;
        }

        return this.rebasePredicate(predicate, [{
            sourceColumn: equivalentColumn,
            targetColumn: output.value
        }], options);
    }

    private rebasePredicate(
        expression: ValueComponent,
        targetColumns: readonly TargetColumnResolution[],
        options: SqlComponentFormatOptions
    ): ValueComponent {
        const cloned = cloneValueComponent(expression, options);

        const visit = (value: ValueComponent): void => {
            const candidate = unwrapParens(value);
            if (candidate instanceof ColumnReference) {
                const target = targetColumns.find(item => sameColumnReference(candidate, item.sourceColumn));
                if (target) {
                    candidate.qualifiedName = cloneColumnReference(target.targetColumn).qualifiedName;
                }
                return;
            }
            if (candidate instanceof BinaryExpression) {
                visit(candidate.left);
                visit(candidate.right);
                return;
            }
            if (candidate instanceof UnaryExpression) {
                visit(candidate.expression);
                return;
            }
            if (candidate instanceof InlineQuery) {
                return;
            }
            if (candidate instanceof FunctionCall) {
                if (candidate.argument) {
                    visit(candidate.argument);
                }
                if (candidate.filterCondition) {
                    visit(candidate.filterCondition);
                }
                return;
            }
            if (candidate instanceof CastExpression) {
                visit(candidate.input);
                return;
            }
            if (candidate instanceof CaseExpression) {
                if (candidate.condition) {
                    visit(candidate.condition);
                }
                for (const pair of candidate.switchCase.cases) {
                    visit(pair.key);
                    visit(pair.value);
                }
                if (candidate.switchCase.elseValue) {
                    visit(candidate.switchCase.elseValue);
                }
                return;
            }
            if (candidate instanceof BetweenExpression) {
                visit(candidate.expression);
                visit(candidate.lower);
                visit(candidate.upper);
                return;
            }
            if (candidate instanceof JsonPredicateExpression) {
                visit(candidate.expression);
                return;
            }
            if (candidate instanceof ArrayExpression) {
                visit(candidate.expression);
                return;
            }
            if (candidate instanceof ArrayQueryExpression) {
                return;
            }
            if (candidate instanceof ValueList) {
                candidate.values.forEach(visit);
                return;
            }
            if (candidate instanceof TupleExpression) {
                candidate.values.forEach(visit);
                return;
            }
            if (candidate instanceof TypeValue && candidate.argument) {
                visit(candidate.argument);
            }
        };

        visit(cloned);
        return cloned;
    }

    private collectOuterColumnReferences(query: SimpleSelectQuery, expression: ValueComponent): ColumnReference[] {
        const references: ColumnReference[] = [];
        const sourceAliases = new Set((query.fromClause?.getSources() ?? [])
            .map(source => source.getAliasName())
            .filter((alias): alias is string => alias !== null)
            .map(normalizeIdentifier));

        const collect = (reference: ColumnReference): void => {
            if (!references.some(existing => sameColumnReference(existing, reference))) {
                references.push(reference);
            }
        };

        const visit = (value: ValueComponent): void => {
            const candidate = unwrapParens(value);
            if (candidate instanceof ColumnReference) {
                const namespace = normalizeIdentifier(candidate.getNamespace());
                if (!namespace || sourceAliases.has(namespace)) {
                    collect(candidate);
                }
                return;
            }
            if (candidate instanceof BinaryExpression) {
                visit(candidate.left);
                visit(candidate.right);
                return;
            }
            if (candidate instanceof UnaryExpression) {
                visit(candidate.expression);
                return;
            }
            if (candidate instanceof InlineQuery) {
                return;
            }
            if (candidate instanceof FunctionCall) {
                if (candidate.argument) {
                    visit(candidate.argument);
                }
                if (candidate.filterCondition) {
                    visit(candidate.filterCondition);
                }
                return;
            }
            if (candidate instanceof CastExpression) {
                visit(candidate.input);
                return;
            }
            if (candidate instanceof CaseExpression) {
                if (candidate.condition) {
                    visit(candidate.condition);
                }
                for (const pair of candidate.switchCase.cases) {
                    visit(pair.key);
                    visit(pair.value);
                }
                if (candidate.switchCase.elseValue) {
                    visit(candidate.switchCase.elseValue);
                }
                return;
            }
            if (candidate instanceof BetweenExpression) {
                visit(candidate.expression);
                visit(candidate.lower);
                visit(candidate.upper);
                return;
            }
            if (candidate instanceof JsonPredicateExpression) {
                visit(candidate.expression);
                return;
            }
            if (candidate instanceof ArrayExpression) {
                visit(candidate.expression);
                return;
            }
            if (candidate instanceof ArrayQueryExpression) {
                return;
            }
            if (candidate instanceof ValueList) {
                candidate.values.forEach(visit);
                return;
            }
            if (candidate instanceof TupleExpression) {
                candidate.values.forEach(visit);
                return;
            }
            if (candidate instanceof TypeValue && candidate.argument) {
                visit(candidate.argument);
            }
        };

        visit(expression);
        return references;
    }

    private buildResult(
        query: SelectQuery | null,
        predicates: PredicateReachabilityPredicate[],
        warnings: PredicateReachabilityWarning[],
        errors: PredicateReachabilityError[]
    ): PredicateReachabilityResult {
        // API output shape review: this diagnostic API reports structured reachability only and never emits rewritten SQL.
        return {
            ok: errors.length === 0,
            query,
            predicates,
            warnings,
            errors,
            safety: {
                mode: "debug_only",
                sqlRewritten: false
            }
        };
    }
}

export const analyzePredicateReachability = (
    input: PredicateReachabilityInput,
    options: PredicateReachabilityOptions = {}
): PredicateReachabilityResult => {
    return new PredicateReachabilityAnalyzer().analyze(input, options);
};
