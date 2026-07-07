import {
    CommonTable,
    DistinctOn,
    FromClause,
    JoinClause,
    JoinOnClause,
    SourceExpression,
    SubQuerySource,
    TableSource,
    WhereClause
} from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
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
    ParameterExpression,
    ParenExpression,
    TupleExpression,
    TypeValue,
    UnaryExpression,
    ValueComponent,
    ValueList
} from "../models/ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { ValueParser } from "../parsers/ValueParser";
import {
    formatSqlComponent,
    hasSqlComponentFormatOverride,
    SqlComponentFormatOptions
} from "./SqlComponentFormatter";
import { SelectOutputCollector, SelectOutputColumn } from "./SelectOutputCollector";
import {
    dedupeTopLevelAndConditions,
    dedupeWhereTopLevelAndConditions
} from "./TopLevelAndConditionDeduper";

export type StaticPredicatePlacementInput = string | SelectQuery | SimpleSelectQuery;

/**
 * Safe-only placement for parameter-free static predicates.
 *
 * The optimizer only moves top-level AND terms whose outer column references can
 * be mechanically rebased to direct outputs of a single-use simple CTE or
 * derived table. Unsupported or ambiguous predicates stay in place.
 */
export interface StaticPredicatePlacementOptions extends SqlComponentFormatOptions {
    dryRun?: boolean;
    /**
     * Whether AST/model inputs should be cloned before optimization.
     * Defaults to true for public-call safety. Internal pipelines can pass false
     * when they own the model and want to avoid AST -> SQL -> AST round trips.
     */
    cloneInput?: boolean;
}

export interface StaticPredicatePlacementWarning {
    code: string;
    message: string;
    detail?: unknown;
}

export interface StaticPredicatePlacementError {
    code: string;
    message: string;
    detail?: unknown;
}

export interface StaticPredicateMove {
    kind: "move_static_predicate";
    predicateSql: string;
    fromScopeId: string;
    toScopeId: string;
    reason: string;
    columnReferences: readonly string[];
}

export interface StaticPredicateSkipped {
    predicateSql: string;
    scopeId: string;
    reason: string;
    code: string;
}

export interface StaticPredicatePlacementSafety {
    mode: "safe_only";
    unsafeRewriteApplied: false;
    dryRun: boolean;
    formatterGeneratedSource: boolean;
}

export interface StaticPredicatePlacementResult {
    ok: boolean;
    sql: string;
    query: SelectQuery | null;
    applied: readonly StaticPredicateMove[];
    skipped: readonly StaticPredicateSkipped[];
    warnings: readonly StaticPredicatePlacementWarning[];
    errors: readonly StaticPredicatePlacementError[];
    safety: StaticPredicatePlacementSafety;
    staticPredicateMoves: readonly StaticPredicateMove[];
}

interface ParsedStaticPredicateInput {
    query: SelectQuery | null;
    sql: string;
    formatterGeneratedSource: boolean;
    warnings: StaticPredicatePlacementWarning[];
    errors: StaticPredicatePlacementError[];
}

interface SourceBinding {
    source: SourceExpression;
    alias: string;
    join: JoinClause | null;
    joinIndex: number;
    isPrimary: boolean;
}

interface SimpleUpstreamTarget {
    kind: "simple";
    query: SimpleSelectQuery;
    scopeId: string;
    sourceBinding: SourceBinding;
    cteName?: string;
}

interface UnionBranchTarget {
    query: SimpleSelectQuery;
    targetColumns: TargetColumnResolution[];
}

interface UnionUpstreamTarget {
    kind: "union";
    scopeId: string;
    branches: UnionBranchTarget[];
}

interface JoinOnTarget {
    kind: "join_on";
    join: JoinClause;
    scopeId: string;
    reason: string;
}

type UpstreamTarget = SimpleUpstreamTarget | UnionUpstreamTarget | JoinOnTarget;

interface TargetColumnResolution {
    sourceColumn: ColumnReference;
    targetColumn: ColumnReference;
}

interface TargetPlacement {
    reason: string;
}

interface StaticPredicateCandidate {
    expression: ValueComponent;
    predicateSql: string;
    references: ColumnReference[];
}

type SkipDraft = Omit<StaticPredicateSkipped, "predicateSql" | "scopeId">;

const VOLATILE_OR_UNSUPPORTED_FUNCTION_REASON = "Predicate contains a function call; volatile and expression predicates are not moved in the safe-only implementation.";

const normalizeIdentifier = (value: string): string => value.trim().toLowerCase();
const isCaseSensitiveIdentifier = (value: string): boolean => /[A-Z]/.test(value.trim());
const identifiersEqual = (left: string, right: string): boolean => {
    const trimmedLeft = left.trim();
    const trimmedRight = right.trim();
    return isCaseSensitiveIdentifier(trimmedLeft) || isCaseSensitiveIdentifier(trimmedRight)
        ? trimmedLeft === trimmedRight
        : trimmedLeft.toLowerCase() === trimmedRight.toLowerCase();
};

const unwrapParens = (expression: ValueComponent): ValueComponent => {
    let candidate = expression;
    while (candidate instanceof ParenExpression) {
        candidate = candidate.expression;
    }
    return candidate;
};

const isBinaryOperator = (expression: ValueComponent, operator: string): expression is BinaryExpression => {
    const candidate = unwrapParens(expression);
    return candidate instanceof BinaryExpression
        && candidate.operator.value.trim().toLowerCase() === operator;
};

const collectTopLevelAndTerms = (expression: ValueComponent): ValueComponent[] => {
    const candidate = unwrapParens(expression);
    if (!isBinaryOperator(candidate, "and")) {
        return [expression];
    }

    return [
        ...collectTopLevelAndTerms(candidate.left),
        ...collectTopLevelAndTerms(candidate.right)
    ];
};

const rebuildWhereWithoutTerms = (query: SimpleSelectQuery, termsToRemove: ReadonlySet<ValueComponent>): void => {
    if (!query.whereClause || termsToRemove.size === 0) {
        return;
    }

    const remaining = collectTopLevelAndTerms(query.whereClause.condition)
        .filter(term => !termsToRemove.has(term));

    if (remaining.length === 0) {
        query.whereClause = null;
        return;
    }

    let rebuilt = remaining[0]!;
    for (let index = 1; index < remaining.length; index += 1) {
        rebuilt = new BinaryExpression(rebuilt, "and", remaining[index]!);
    }
    query.whereClause = new WhereClause(rebuilt);
};

const cloneValueComponent = (
    expression: ValueComponent,
    options: SqlComponentFormatOptions
): ValueComponent => {
    return ValueParser.parse(formatSqlComponent(expression, options));
};

const cloneColumnReference = (reference: ColumnReference): ColumnReference => {
    const namespaces = reference.namespaces?.map(namespace => namespace.name) ?? null;
    return new ColumnReference(namespaces, reference.column.name);
};

const columnReferenceText = (reference: ColumnReference): string => {
    const namespace = reference.getNamespace();
    return namespace ? `${namespace}.${reference.column.name}` : reference.column.name;
};

const sameColumnReference = (left: ColumnReference, right: ColumnReference): boolean => {
    return identifiersEqual(left.column.name, right.column.name)
        && identifiersEqual(left.getNamespace(), right.getNamespace());
};

const appendUnique = <T>(items: T[], value: T): void => {
    if (!items.includes(value)) {
        items.push(value);
    }
};

export class StaticPredicatePlacementOptimizer {
    public plan(
        input: StaticPredicatePlacementInput,
        options: StaticPredicatePlacementOptions = {}
    ): StaticPredicatePlacementResult {
        const parsed = this.parseInput(input, options);
        const warnings = [...parsed.warnings];
        const errors = [...parsed.errors];

        if (!parsed.query) {
            return this.buildResult({
                query: null,
                sql: parsed.sql,
                applied: [],
                skipped: [],
                warnings,
                errors,
                dryRun: options.dryRun ?? true,
                formatterGeneratedSource: parsed.formatterGeneratedSource
            });
        }

        if (!(parsed.query instanceof SimpleSelectQuery)) {
            warnings.push({
                code: "UNSUPPORTED_ROOT_QUERY",
                message: "Static predicate placement currently supports only SimpleSelectQuery roots."
            });
            return this.buildResult({
                query: parsed.query,
                sql: parsed.sql,
                applied: [],
                skipped: [],
                warnings,
                errors,
                dryRun: options.dryRun ?? true,
                formatterGeneratedSource: parsed.formatterGeneratedSource
            });
        }

        const query = parsed.query;
        const applied: StaticPredicateMove[] = [];
        const skipped: StaticPredicateSkipped[] = [];
        const movedTerms: ValueComponent[] = [];

        for (const term of query.whereClause ? collectTopLevelAndTerms(query.whereClause.condition) : []) {
            const candidate = this.analyzeCandidate(query, term, options);
            if (!candidate) {
                continue;
            }

            if ("code" in candidate) {
                skipped.push(this.makeSkipped(term, candidate, options));
                continue;
            }

            const target = this.resolveTarget(query, candidate);
            if ("code" in target) {
                skipped.push(this.makeSkipped(term, target, options));
                continue;
            }

            let appliedReason = "";
            if (target.kind === "join_on") {
                this.appendJoinOnPredicate(target.join, candidate.expression, options);
                appliedReason = target.reason;
            } else if (target.kind === "simple") {
                const targetColumns = this.resolveTargetColumns(query, target.query, candidate.references);
                if ("code" in targetColumns) {
                    skipped.push(this.makeSkipped(term, targetColumns, options));
                    continue;
                }

                const placement = this.resolveTargetPlacement(target.query, targetColumns);
                if ("code" in placement) {
                    skipped.push(this.makeSkipped(term, placement, options));
                    continue;
                }

                const movedPredicate = this.rebasePredicate(candidate.expression, targetColumns, options);
                target.query.appendWhere(movedPredicate);
                dedupeWhereTopLevelAndConditions(target.query, options);
                appliedReason = placement.reason;
            } else {
                const placements: TargetPlacement[] = [];
                let skip: SkipDraft | null = null;
                for (const branch of target.branches) {
                    const placement = this.resolveTargetPlacement(branch.query, branch.targetColumns);
                    if ("code" in placement) {
                        skip = placement;
                        break;
                    }
                    placements.push(placement);
                }
                if (skip) {
                    skipped.push(this.makeSkipped(term, skip, options));
                    continue;
                }

                for (const branch of target.branches) {
                    const movedPredicate = this.rebasePredicate(candidate.expression, branch.targetColumns, options);
                    branch.query.appendWhere(movedPredicate);
                    dedupeWhereTopLevelAndConditions(branch.query, options);
                }
                appliedReason = placements.some(item => /group by/i.test(item.reason))
                    ? "Predicate is distributed to every UNION branch by output column position; grouped branches only receive GROUP BY-key predicates."
                    : "Predicate is distributed to every UNION branch by output column position before unsafe query boundaries.";
            }
            movedTerms.push(term);

            applied.push({
                kind: "move_static_predicate",
                predicateSql: candidate.predicateSql,
                fromScopeId: "scope:root",
                toScopeId: target.scopeId,
                reason: appliedReason,
                columnReferences: candidate.references.map(columnReferenceText)
            });
        }

        rebuildWhereWithoutTerms(query, new Set(movedTerms));

        const sql = applied.length > 0 || hasSqlComponentFormatOverride(options)
            ? formatSqlComponent(query, options)
            : parsed.sql;
        return this.buildResult({
            query,
            sql,
            applied,
            skipped,
            warnings,
            errors,
            dryRun: options.dryRun ?? true,
            formatterGeneratedSource: parsed.formatterGeneratedSource
        });
    }

    public optimize(
        input: StaticPredicatePlacementInput,
        options: StaticPredicatePlacementOptions = {}
    ): StaticPredicatePlacementResult {
        return this.plan(input, { ...options, dryRun: options.dryRun ?? false });
    }

    private parseInput(
        input: StaticPredicatePlacementInput,
        options: StaticPredicatePlacementOptions
    ): ParsedStaticPredicateInput {
        const warnings: StaticPredicatePlacementWarning[] = [];
        const errors: StaticPredicatePlacementError[] = [];

        try {
            const sourceSql = typeof input === "string"
                ? input
                : formatSqlComponent(input, options);

            if (typeof input !== "string" && options.cloneInput === false) {
                return {
                    query: input,
                    sql: sourceSql,
                    formatterGeneratedSource: false,
                    warnings,
                    errors
                };
            }

            if (typeof input !== "string") {
                warnings.push({
                    code: "AST_INPUT_FORMATTED",
                    message: "AST input is cloned through formatter output so the caller-owned query is not mutated."
                });
            }

            return {
                query: SelectQueryParser.parse(sourceSql),
                sql: sourceSql,
                formatterGeneratedSource: typeof input !== "string",
                warnings,
                errors
            };
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            errors.push({
                code: "PARSE_FAILED",
                message: "Static predicate placement could not parse the input SQL.",
                detail
            });
            return {
                query: null,
                sql: typeof input === "string" ? input : "",
                formatterGeneratedSource: typeof input !== "string",
                warnings,
                errors
            };
        }
    }

    private analyzeCandidate(
        root: SimpleSelectQuery,
        expression: ValueComponent,
        options: SqlComponentFormatOptions
    ): StaticPredicateCandidate | SkipDraft | null {
        if (this.collectParameterNames(expression).length > 0) {
            return null;
        }

        const unsupported = this.findUnsupportedExpression(expression, this.isExistsPredicate(expression));
        if (unsupported) {
            return unsupported;
        }

        const references = this.collectRootColumnReferences(root, expression);
        if (references.length === 0) {
            return {
                code: "NO_COLUMN_REFERENCE",
                reason: "Static predicate has no outer column reference to anchor the move."
            };
        }

        return {
            expression,
            predicateSql: formatSqlComponent(expression, options),
            references
        };
    }

    private isExistsPredicate(expression: ValueComponent): boolean {
        const candidate = unwrapParens(expression);
        if (!(candidate instanceof UnaryExpression)) {
            return false;
        }

        const operator = candidate.operator.value.trim().toLowerCase();
        return operator === "exists" && unwrapParens(candidate.expression) instanceof InlineQuery;
    }

    private findUnsupportedExpression(expression: ValueComponent, allowExistsSubquery: boolean): SkipDraft | null {
        let found: SkipDraft | null = null;

        const visitSelect = (query: SelectQuery): void => {
            if (found) {
                return;
            }
            if (query instanceof BinarySelectQuery) {
                found = {
                    code: "UNION_BOUNDARY",
                    reason: "Static predicate would need distribution into a UNION branch, which is unsupported."
                };
                return;
            }
            if (!(query instanceof SimpleSelectQuery)) {
                found = {
                    code: "UNSUPPORTED_SUBQUERY",
                    reason: "Static predicate contains a non-simple subquery, which is unsupported."
                };
                return;
            }

            query.selectClause.items.forEach(item => visit(item.value));
            for (const join of query.fromClause?.joins ?? []) {
                if (join.condition) {
                    visit(join.condition.condition);
                }
                const source = join.source.datasource;
                if (source instanceof SubQuerySource) {
                    visitSelect(source.query);
                }
            }
            if (query.whereClause) {
                visit(query.whereClause.condition);
            }
            if (query.havingClause) {
                visit(query.havingClause.condition);
            }
            for (const cte of query.withClause?.tables ?? []) {
                if (cte.query instanceof SimpleSelectQuery || cte.query instanceof BinarySelectQuery) {
                    visitSelect(cte.query);
                }
            }
        };

        const visit = (value: ValueComponent): void => {
            if (found) {
                return;
            }

            const candidate = unwrapParens(value);
            if (candidate instanceof BinaryExpression) {
                visit(candidate.left);
                visit(candidate.right);
                return;
            }

            if (candidate instanceof FunctionCall) {
                found = {
                    code: "FUNCTION_PREDICATE_UNSUPPORTED",
                    reason: VOLATILE_OR_UNSUPPORTED_FUNCTION_REASON
                };
                return;
            }

            if (candidate instanceof CaseExpression) {
                found = {
                    code: "CASE_PREDICATE_UNSUPPORTED",
                    reason: "CASE predicates are not moved in the first safe-only implementation."
                };
                return;
            }

            if (candidate instanceof InlineQuery) {
                if (!allowExistsSubquery) {
                    found = {
                        code: "SUBQUERY_PREDICATE_UNSUPPORTED",
                        reason: "Subquery predicates are only moved when they are simple EXISTS predicates."
                    };
                    return;
                }
                visitSelect(candidate.selectQuery);
                return;
            }

            if (candidate instanceof ArrayQueryExpression) {
                found = {
                    code: "SUBQUERY_PREDICATE_UNSUPPORTED",
                    reason: "Array subquery predicates are not moved in the first safe-only implementation."
                };
                return;
            }

            if (candidate instanceof UnaryExpression) {
                visit(candidate.expression);
                return;
            }
            if (candidate instanceof CastExpression) {
                visit(candidate.input);
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
        return found;
    }

    private resolveTarget(root: SimpleSelectQuery, candidate: StaticPredicateCandidate): UpstreamTarget | SkipDraft {
        const boundary = this.findRootQueryBoundary(root);
        if (boundary) {
            return boundary;
        }

        if (!root.fromClause) {
            return {
                code: "NO_FROM_CLAUSE",
                reason: "Predicate has no FROM source that can receive it safely."
            };
        }

        const bindings: SourceBinding[] = [];
        for (const reference of candidate.references) {
            const binding = this.resolveSourceBinding(root, root, reference);
            if ("code" in binding) {
                return binding;
            }
            if (!bindings.some(item => item.source === binding.source)) {
                bindings.push(binding);
            }
        }

        if (bindings.length !== 1) {
            return {
                code: "MULTIPLE_SOURCE_REFERENCES",
                reason: "Static predicate references multiple source query blocks; moving it may change semantics."
            };
        }

        const binding = bindings[0]!;
        if (binding.join?.lateral) {
            return {
                code: "LATERAL_JOIN_BOUNDARY",
                reason: "Predicate crosses a LATERAL JOIN boundary; moving it may change semantics."
            };
        }
        const nullableSide = this.findNullableSideBoundary(root.fromClause, binding);
        if (nullableSide) {
            return nullableSide;
        }

        const upstream = this.resolveUpstreamQuery(root, binding, candidate.references);
        if ("code" in upstream) {
            if (upstream.code === "NO_SAFE_UPSTREAM_QUERY") {
                const joinOnTarget = this.resolveBaseTableJoinOnTarget(root, binding);
                if (!("code" in joinOnTarget)) {
                    return joinOnTarget;
                }
                return joinOnTarget;
            }
            return upstream;
        }

        return upstream;
    }

    private findRootQueryBoundary(query: SimpleSelectQuery): SkipDraft | null {
        if (this.hasDistinctOnBoundary(query)) {
            return {
                code: "DISTINCT_BOUNDARY",
                reason: "Predicate crosses DISTINCT ON boundary; moving it may change semantics."
            };
        }
        if (this.hasWindowUsage(query)) {
            return {
                code: "WINDOW_BOUNDARY",
                reason: "Predicate crosses WINDOW boundary; moving it may change semantics."
            };
        }
        return null;
    }

    private resolveTargetPlacement(
        query: SimpleSelectQuery,
        targetColumns: readonly TargetColumnResolution[]
    ): TargetPlacement | SkipDraft {
        const hasOrdinaryDistinct = this.hasOrdinaryDistinct(query);
        if (this.hasDistinctOnBoundary(query)) {
            return {
                code: "DISTINCT_BOUNDARY",
                reason: "Predicate crosses DISTINCT ON boundary; moving it may change semantics."
            };
        }
        if (this.hasWindowUsage(query)) {
            return {
                code: "WINDOW_BOUNDARY",
                reason: "Predicate crosses WINDOW boundary; moving it may change semantics."
            };
        }
        if (query.limitClause || query.offsetClause || query.fetchClause) {
            return {
                code: "ROW_LIMIT_BOUNDARY",
                reason: "Predicate crosses LIMIT/OFFSET/FETCH boundary; moving it may change row selection semantics."
            };
        }
        if (query.fromClause && this.hasOuterJoin(query.fromClause)) {
            return {
                code: "OUTER_JOIN_BOUNDARY",
                reason: "Target query contains an OUTER JOIN boundary that is not moved across in the safe-only implementation."
            };
        }
        if (query.groupByClause) {
            const allReferencesAreGroupKeys = targetColumns.every(item =>
                this.isGroupKeyColumn(query, item.targetColumn)
            );
            if (!allReferencesAreGroupKeys) {
                return {
                    code: "GROUP_BY_BOUNDARY",
                    reason: "Predicate references a target column that is not proven to be a GROUP BY key."
                };
            }
            return {
                reason: "Predicate references only GROUP BY keys; it is moved into pre-aggregation WHERE."
            };
        }
        if (query.havingClause) {
            return {
                code: "GROUP_BY_BOUNDARY",
                reason: "Predicate crosses HAVING aggregation boundary; moving it may change semantics."
            };
        }
        if (hasOrdinaryDistinct) {
            return {
                reason: "Predicate references direct ordinary DISTINCT output columns; it is moved into the DISTINCT input WHERE."
            };
        }
        return {
            reason: "All outer references resolve to direct upstream outputs before unsafe query boundaries."
        };
    }

    private resolveSourceBinding(
        contextRoot: SimpleSelectQuery,
        query: SimpleSelectQuery,
        column: ColumnReference
    ): SourceBinding | SkipDraft {
        const fromClause = query.fromClause;
        if (!fromClause) {
            return {
                code: "NO_FROM_CLAUSE",
                reason: "Predicate has no FROM source that can receive it safely."
            };
        }

        const bindings = this.getSourceBindings(fromClause);
        const namespace = column.getNamespace();
        const columnName = column.column.name;

        if (namespace) {
            const matches = bindings.filter(binding => identifiersEqual(binding.alias, namespace));
            if (matches.length !== 1) {
                return {
                    code: "AMBIGUOUS_COLUMN_SOURCE",
                    reason: `Column source alias '${column.getNamespace()}' is not uniquely resolvable.`
                };
            }

            const matchCount = this.getOutputColumnMatchCount(contextRoot, matches[0]!, columnName);
            if (matchCount === 0 && this.isBaseTableBinding(contextRoot, matches[0]!)) {
                return matches[0]!;
            }
            if (matchCount === 0) {
                return {
                    code: "COLUMN_NOT_AVAILABLE_UPSTREAM",
                    reason: `Column '${columnReferenceText(column)}' is not a direct output of the referenced source.`
                };
            }
            if (matchCount > 1) {
                return {
                    code: "AMBIGUOUS_COLUMN_REFERENCE",
                    reason: `Column '${columnReferenceText(column)}' resolves to multiple outputs in the referenced source.`
                };
            }
            return matches[0]!;
        }

        const matches: SourceBinding[] = [];
        for (const binding of bindings) {
            const matchCount = this.getOutputColumnMatchCount(contextRoot, binding, columnName);
            if (matchCount > 1) {
                return {
                    code: "AMBIGUOUS_COLUMN_REFERENCE",
                    reason: `Column '${columnName}' resolves to multiple outputs in source '${binding.alias}'.`
                };
            }
            if (matchCount === 1) {
                matches.push(binding);
            }
        }

        if (matches.length !== 1) {
            return {
                code: "AMBIGUOUS_COLUMN_REFERENCE",
                reason: matches.length === 0
                    ? `Column '${columnName}' is not uniquely resolvable to a safe upstream source.`
                    : `Column '${columnName}' is ambiguous across source query blocks.`
            };
        }

        return matches[0]!;
    }

    private resolveUpstreamQuery(
        root: SimpleSelectQuery,
        binding: SourceBinding,
        references: readonly ColumnReference[]
    ): UpstreamTarget | SkipDraft {
        const source = binding.source.datasource;
        if (source instanceof SubQuerySource) {
            if (source.query instanceof SimpleSelectQuery) {
                return {
                    kind: "simple",
                    query: source.query,
                    scopeId: `subquery:${binding.alias}`,
                    sourceBinding: binding
                };
            }
            if (source.query instanceof BinarySelectQuery) {
                return this.resolveUnionTarget(root, source.query, `subquery:${binding.alias}`, references);
            }
            return {
                code: "UNION_BOUNDARY",
                reason: "Predicate would need distribution into a UNION or non-simple subquery, which is unsupported."
            };
        }

        if (!(source instanceof TableSource)) {
            return {
                code: "UNSUPPORTED_SOURCE",
                reason: "Only CTE and simple derived-table sources can receive moved static predicates."
            };
        }

        const cteName = source.table.name;
        const commonTable = this.findCte(root, cteName);
        if (!commonTable) {
            return {
                code: "NO_SAFE_UPSTREAM_QUERY",
                reason: "The referenced source is a base table, so there is no upstream query block to move into."
            };
        }

        const referenceCount = this.countTableSourceReferences(root, cteName);
        if (referenceCount !== 1) {
            return {
                code: "CTE_REUSE_UNSUPPORTED",
                reason: `CTE '${cteName}' is referenced ${referenceCount} times; moving a predicate into it may affect other consumers.`
            };
        }

        if (commonTable.query instanceof BinarySelectQuery) {
            return this.resolveUnionTarget(
                root,
                commonTable.query,
                `cte:${commonTable.getSourceAliasName()}`,
                references
            );
        }

        if (!(commonTable.query instanceof SimpleSelectQuery)) {
            return {
                code: "UNSUPPORTED_CTE_QUERY",
                reason: "Writable or non-select CTE bodies are not moved into by static predicate placement."
            };
        }

        return {
            kind: "simple",
            query: commonTable.query,
            scopeId: `cte:${commonTable.getSourceAliasName()}`,
            sourceBinding: binding,
            cteName: commonTable.getSourceAliasName()
        };
    }

    private resolveUnionTarget(
        root: SimpleSelectQuery,
        query: BinarySelectQuery,
        scopeId: string,
        references: readonly ColumnReference[]
    ): UnionUpstreamTarget | SkipDraft {
        const branches = this.collectUnionBranches(query);
        if ("code" in branches) {
            return branches;
        }

        const outputIndexes = new Map<ColumnReference, number>();
        for (const reference of references) {
            const outputIndex = this.resolveUnionOutputIndex(root, branches[0]!, reference.column.name);
            if ("code" in outputIndex) {
                return outputIndex;
            }
            outputIndexes.set(reference, outputIndex.index);
        }

        const branchTargets: UnionBranchTarget[] = [];
        for (const branch of branches) {
            const targetColumns: TargetColumnResolution[] = [];
            for (const [reference, outputIndex] of outputIndexes.entries()) {
                const targetColumn = this.resolveTargetColumnByOutputIndex(root, branch, outputIndex, reference);
                if ("code" in targetColumn) {
                    return targetColumn;
                }
                targetColumns.push(targetColumn);
            }
            branchTargets.push(this.resolveDeepestBranchTarget(root, branch, targetColumns));
        }

        return {
            kind: "union",
            scopeId,
            branches: branchTargets
        };
    }

    private resolveTargetColumns(
        root: SimpleSelectQuery,
        query: SimpleSelectQuery,
        references: readonly ColumnReference[]
    ): TargetColumnResolution[] | SkipDraft {
        const resolved: TargetColumnResolution[] = [];
        for (const reference of references) {
            const matches = this.collectDirectOutputMatches(root, query, reference.column.name);

            if (matches.length !== 1) {
                return {
                    code: "AMBIGUOUS_TARGET_COLUMN",
                    reason: matches.length === 0
                        ? `Target query does not expose '${reference.column.name}' as a direct output column.`
                        : `Target query exposes multiple '${reference.column.name}' columns.`
                };
            }

            const value = matches[0]!.value;
            if (!(value instanceof ColumnReference)) {
                return {
                    code: "EXPRESSION_OUTPUT_UNSUPPORTED",
                    reason: `Target output '${reference.column.name}' is an expression, not a direct column reference.`
                };
            }

            const sourceResolution = this.verifyColumnResolvableInQuery(query, value);
            if (sourceResolution) {
                return sourceResolution;
            }

            resolved.push({
                sourceColumn: reference,
                targetColumn: value
            });
        }

        return resolved;
    }

    private resolveBaseTableJoinOnTarget(root: SimpleSelectQuery, binding: SourceBinding): JoinOnTarget | SkipDraft {
        if (!root.fromClause || !this.isBaseTableBinding(root, binding)) {
            return {
                code: "NO_SAFE_UPSTREAM_QUERY",
                reason: "The referenced source is a base table, so there is no upstream query block to move into."
            };
        }

        if (this.hasOuterJoin(root.fromClause)) {
            return {
                code: "OUTER_JOIN_BOUNDARY",
                reason: "Predicate crosses an OUTER JOIN boundary; moving it into JOIN ON may change semantics."
            };
        }

        const join = binding.isPrimary
            ? root.fromClause.joins?.[0] ?? null
            : binding.join;
        if (join?.lateral) {
            return {
                code: "LATERAL_JOIN_BOUNDARY",
                reason: "Predicate crosses a LATERAL JOIN boundary; moving it into JOIN ON may change semantics."
            };
        }
        if (!join || !this.isInnerJoin(join)) {
            return {
                code: "NO_SAFE_JOIN_ON_TARGET",
                reason: "Base-table predicates are moved only into INNER JOIN ON clauses in the safe-only implementation."
            };
        }
        if (!(join.condition instanceof JoinOnClause)) {
            return {
                code: "NO_SAFE_JOIN_ON_TARGET",
                reason: "Base-table predicates are moved only into existing JOIN ON clauses, not USING or conditionless joins."
            };
        }

        return {
            kind: "join_on",
            join,
            scopeId: `join_on:${join.source.getAliasName() ?? "unknown"}`,
            reason: binding.isPrimary
                ? "Predicate references the primary source of an INNER JOIN; it is moved into the first JOIN ON clause."
                : "Predicate references the joined source of an INNER JOIN; it is moved into that JOIN ON clause."
        };
    }

    private appendJoinOnPredicate(
        join: JoinClause,
        expression: ValueComponent,
        options: SqlComponentFormatOptions
    ): void {
        if (!(join.condition instanceof JoinOnClause)) {
            return;
        }
        join.condition.condition = new BinaryExpression(
            join.condition.condition,
            "and",
            cloneValueComponent(expression, options)
        );
        join.condition.condition = dedupeTopLevelAndConditions(join.condition.condition, options);
    }

    private resolveDeepestBranchTarget(
        contextRoot: SimpleSelectQuery,
        query: SimpleSelectQuery,
        targetColumns: readonly TargetColumnResolution[],
        visited: ReadonlySet<SimpleSelectQuery> = new Set()
    ): UnionBranchTarget {
        if (visited.has(query) || targetColumns.length === 0) {
            return { query, targetColumns: [...targetColumns] };
        }

        const nextVisited = new Set(visited);
        nextVisited.add(query);

        const bindings: SourceBinding[] = [];
        for (const item of targetColumns) {
            const binding = this.resolveSourceBinding(contextRoot, query, item.targetColumn);
            if ("code" in binding) {
                return { query, targetColumns: [...targetColumns] };
            }
            if (!bindings.some(existing => existing.source === binding.source)) {
                bindings.push(binding);
            }
        }

        if (bindings.length !== 1) {
            return { query, targetColumns: [...targetColumns] };
        }

        const binding = bindings[0]!;
        const nullableSide = query.fromClause
            ? this.findNullableSideBoundary(query.fromClause, binding)
            : null;
        if (nullableSide) {
            return { query, targetColumns: [...targetColumns] };
        }

        const upstream = this.resolveUpstreamQuery(
            contextRoot,
            binding,
            targetColumns.map(item => item.targetColumn)
        );
        if ("code" in upstream) {
            return { query, targetColumns: [...targetColumns] };
        }
        if (upstream.kind !== "simple") {
            return { query, targetColumns: [...targetColumns] };
        }

        const upstreamColumns = this.resolveTargetColumns(
            contextRoot,
            upstream.query,
            targetColumns.map(item => item.targetColumn)
        );
        if ("code" in upstreamColumns) {
            return { query, targetColumns: [...targetColumns] };
        }

        const placement = this.resolveTargetPlacement(upstream.query, upstreamColumns);
        if ("code" in placement) {
            return { query, targetColumns: [...targetColumns] };
        }

        const rebasedColumns = upstreamColumns.map((item, index) => ({
            sourceColumn: targetColumns[index]!.sourceColumn,
            targetColumn: item.targetColumn
        }));

        return this.resolveDeepestBranchTarget(contextRoot, upstream.query, rebasedColumns, nextVisited);
    }

    private verifyColumnResolvableInQuery(query: SimpleSelectQuery, column: ColumnReference): SkipDraft | null {
        if (!query.fromClause) {
            return {
                code: "NO_TARGET_FROM_CLAUSE",
                reason: "Target query has no FROM clause where the moved column can be resolved."
            };
        }

        const bindings = this.getSourceBindings(query.fromClause);
        const namespace = column.getNamespace();
        if (namespace) {
            const matches = bindings.filter(binding => identifiersEqual(binding.alias, namespace));
            return matches.length === 1
                ? null
                : {
                    code: "AMBIGUOUS_TARGET_COLUMN",
                    reason: `Target column '${columnReferenceText(column)}' is not uniquely resolvable in the destination query.`
                };
        }

        if (bindings.length === 1) {
            return null;
        }

        return {
            code: "AMBIGUOUS_TARGET_COLUMN",
            reason: `Unqualified target column '${column.column.name}' is ambiguous in a multi-source destination query.`
        };
    }

    private isGroupKeyColumn(query: SimpleSelectQuery, column: ColumnReference): boolean {
        const groupBy = query.groupByClause;
        if (!groupBy || groupBy.mode || groupBy.grouping.length === 0) {
            return false;
        }

        return groupBy.grouping.some(grouping => {
            const candidate = unwrapParens(grouping);
            return candidate instanceof ColumnReference
                && this.sameResolvableColumnInQuery(query, candidate, column);
        });
    }

    private sameResolvableColumnInQuery(
        query: SimpleSelectQuery,
        left: ColumnReference,
        right: ColumnReference
    ): boolean {
        if (sameColumnReference(left, right)) {
            return true;
        }
        if (!identifiersEqual(left.column.name, right.column.name)) {
            return false;
        }
        const leftSource = this.resolveColumnSourceAlias(query, left);
        const rightSource = this.resolveColumnSourceAlias(query, right);
        return leftSource !== null && leftSource === rightSource;
    }

    private resolveColumnSourceAlias(query: SimpleSelectQuery, column: ColumnReference): string | null {
        if (!query.fromClause) {
            return null;
        }
        const bindings = this.getSourceBindings(query.fromClause);
        const namespace = column.getNamespace();
        if (namespace) {
            const matches = bindings.filter(binding => identifiersEqual(binding.alias, namespace));
            return matches.length === 1 ? matches[0]!.alias : null;
        }
        return bindings.length === 1 ? bindings[0]!.alias : null;
    }

    private rebasePredicate(
        expression: ValueComponent,
        targetColumns: readonly TargetColumnResolution[],
        options: SqlComponentFormatOptions
    ): ValueComponent {
        const cloned = cloneValueComponent(expression, options);
        const visitSelect = (query: SelectQuery, inheritedLocalAliases: ReadonlySet<string>): void => {
            if (!(query instanceof SimpleSelectQuery)) {
                return;
            }

            const localAliases = new Set(inheritedLocalAliases);
            for (const alias of this.collectSourceAliases(query)) {
                localAliases.add(alias);
            }

            query.selectClause.items.forEach(item => visit(item.value, localAliases));
            for (const join of query.fromClause?.joins ?? []) {
                if (join.condition) {
                    visit(join.condition.condition, localAliases);
                }
                const source = join.source.datasource;
                if (source instanceof SubQuerySource) {
                    visitSelect(source.query, localAliases);
                }
            }
            if (query.whereClause) {
                visit(query.whereClause.condition, localAliases);
            }
            if (query.havingClause) {
                visit(query.havingClause.condition, localAliases);
            }
            for (const cte of query.withClause?.tables ?? []) {
                if (cte.query instanceof SimpleSelectQuery || cte.query instanceof BinarySelectQuery) {
                    visitSelect(cte.query, localAliases);
                }
            }
        };

        const visit = (value: ValueComponent, localAliases: ReadonlySet<string>): void => {
            const candidate = unwrapParens(value);
            if (candidate instanceof ColumnReference) {
                const namespace = normalizeIdentifier(candidate.getNamespace());
                if (namespace && localAliases.has(namespace)) {
                    return;
                }
                const target = targetColumns.find(item => sameColumnReference(candidate, item.sourceColumn));
                if (target) {
                    candidate.qualifiedName = cloneColumnReference(target.targetColumn).qualifiedName;
                }
                return;
            }
            if (candidate instanceof BinaryExpression) {
                visit(candidate.left, localAliases);
                visit(candidate.right, localAliases);
                return;
            }
            if (candidate instanceof UnaryExpression) {
                visit(candidate.expression, localAliases);
                return;
            }
            if (candidate instanceof InlineQuery) {
                visitSelect(candidate.selectQuery, localAliases);
                return;
            }
            if (candidate instanceof FunctionCall) {
                if (candidate.argument) {
                    visit(candidate.argument, localAliases);
                }
                if (candidate.filterCondition) {
                    visit(candidate.filterCondition, localAliases);
                }
                return;
            }
            if (candidate instanceof CastExpression) {
                visit(candidate.input, localAliases);
                return;
            }
            if (candidate instanceof CaseExpression) {
                if (candidate.condition) {
                    visit(candidate.condition, localAliases);
                }
                for (const pair of candidate.switchCase.cases) {
                    visit(pair.key, localAliases);
                    visit(pair.value, localAliases);
                }
                if (candidate.switchCase.elseValue) {
                    visit(candidate.switchCase.elseValue, localAliases);
                }
                return;
            }
            if (candidate instanceof BetweenExpression) {
                visit(candidate.expression, localAliases);
                visit(candidate.lower, localAliases);
                visit(candidate.upper, localAliases);
                return;
            }
            if (candidate instanceof JsonPredicateExpression) {
                visit(candidate.expression, localAliases);
                return;
            }
            if (candidate instanceof ArrayExpression) {
                visit(candidate.expression, localAliases);
                return;
            }
            if (candidate instanceof ValueList) {
                candidate.values.forEach(item => visit(item, localAliases));
                return;
            }
            if (candidate instanceof TupleExpression) {
                candidate.values.forEach(item => visit(item, localAliases));
                return;
            }
            if (candidate instanceof TypeValue && candidate.argument) {
                visit(candidate.argument, localAliases);
            }
        };

        visit(cloned, new Set());
        return cloned;
    }

    private getSourceBindings(fromClause: FromClause): SourceBinding[] {
        const bindings: SourceBinding[] = [{
            source: fromClause.source,
            alias: fromClause.source.getAliasName() ?? "",
            join: null,
            joinIndex: -1,
            isPrimary: true
        }];

        for (let index = 0; index < (fromClause.joins ?? []).length; index += 1) {
            const join = fromClause.joins![index]!;
            bindings.push({
                source: join.source,
                alias: join.source.getAliasName() ?? "",
                join,
                joinIndex: index,
                isPrimary: false
            });
        }

        return bindings;
    }

    private isBaseTableBinding(root: SimpleSelectQuery, binding: SourceBinding): boolean {
        const source = binding.source.datasource;
        return source instanceof TableSource && !this.findCte(root, source.table.name);
    }

    private isInnerJoin(join: JoinClause): boolean {
        const joinType = join.joinType.value.trim().toLowerCase();
        return joinType === "join" || joinType === "inner join";
    }

    private findNullableSideBoundary(fromClause: FromClause, binding: SourceBinding): SkipDraft | null {
        const joins = fromClause.joins ?? [];
        if (binding.isPrimary) {
            return this.hasLaterJoinThatNullsPriorSources(joins, -1)
                ? {
                    code: "OUTER_JOIN_NULLABLE_SIDE",
                    reason: "Predicate crosses OUTER JOIN nullable side; moving it may change semantics."
                }
                : null;
        }

        const join = binding.join;
        if (!join) {
            return null;
        }

        const joinType = join.joinType.value.toLowerCase();
        if (joinType.includes("left")) {
            return {
                code: "OUTER_JOIN_NULLABLE_SIDE",
                reason: "Predicate crosses LEFT JOIN nullable side; moving it may change semantics."
            };
        }
        if (joinType.includes("full")) {
            return {
                code: "OUTER_JOIN_NULLABLE_SIDE",
                reason: "Predicate crosses FULL JOIN nullable side; moving it may change semantics."
            };
        }
        if (this.hasLaterJoinThatNullsPriorSources(joins, binding.joinIndex)) {
            return {
                code: "OUTER_JOIN_NULLABLE_SIDE",
                reason: "Predicate crosses later RIGHT/FULL JOIN nullable side; moving it may change semantics."
            };
        }

        return null;
    }

    private hasLaterJoinThatNullsPriorSources(joins: readonly JoinClause[], sourceJoinIndex: number): boolean {
        return joins
            .slice(sourceJoinIndex + 1)
            .some(join => {
                const joinType = join.joinType.value.toLowerCase();
                return joinType.includes("right") || joinType.includes("full");
            });
    }

    private hasOuterJoin(fromClause: FromClause): boolean {
        return (fromClause.joins ?? []).some(join => {
            const joinType = join.joinType.value.toLowerCase();
            return joinType.includes("left") || joinType.includes("right") || joinType.includes("full") || joinType.includes("outer");
        });
    }

    private hasDistinctOnBoundary(query: SimpleSelectQuery): boolean {
        return query.selectClause.distinct instanceof DistinctOn;
    }

    private hasOrdinaryDistinct(query: SimpleSelectQuery): boolean {
        return query.selectClause.distinct !== null && !this.hasDistinctOnBoundary(query);
    }

    private getOutputColumnMatchCount(root: SimpleSelectQuery, binding: SourceBinding, columnName: string): number {
        const target = this.resolveSourceQueryForColumns(root, binding.source);
        if (!target) {
            return 0;
        }
        if (target instanceof BinarySelectQuery) {
            const branches = this.collectUnionBranches(target);
            if ("code" in branches) {
                return 0;
            }
            return this.collectDirectOutputMatches(root, branches[0]!, columnName).length;
        }
        if (!(target instanceof SimpleSelectQuery)) {
            return 0;
        }
        return this.collectDirectOutputMatches(root, target, columnName).length;
    }

    private collectUnionBranches(query: BinarySelectQuery): SimpleSelectQuery[] | SkipDraft {
        const branches: SimpleSelectQuery[] = [];
        const visit = (select: SelectQuery): SkipDraft | null => {
            if (select instanceof SimpleSelectQuery) {
                branches.push(select);
                return null;
            }
            if (!(select instanceof BinarySelectQuery)) {
                return {
                    code: "UNION_BOUNDARY",
                    reason: "Predicate would need distribution into a non-simple UNION branch, which is unsupported."
                };
            }

            const operator = select.operator.value.trim().toLowerCase();
            if (operator !== "union" && operator !== "union all") {
                return {
                    code: "UNION_BOUNDARY",
                    reason: `Predicate would need distribution through '${select.operator.value}', which is unsupported.`
                };
            }

            return visit(select.left) ?? visit(select.right);
        };

        const skip = visit(query);
        return skip ?? branches;
    }

    private resolveUnionOutputIndex(
        root: SimpleSelectQuery,
        firstBranch: SimpleSelectQuery,
        outputColumnName: string
    ): { index: number } | SkipDraft {
        const matches: number[] = [];
        this.collectSelectOutputs(root, firstBranch).forEach((item, index) => {
            if (identifiersEqual(item.name, outputColumnName)) {
                matches.push(index);
            }
        });

        if (matches.length !== 1) {
            return {
                code: "AMBIGUOUS_TARGET_COLUMN",
                reason: matches.length === 0
                    ? `UNION output does not expose '${outputColumnName}' from its first branch.`
                    : `UNION first branch exposes multiple '${outputColumnName}' columns.`
            };
        }

        return { index: matches[0]! };
    }

    private resolveTargetColumnByOutputIndex(
        root: SimpleSelectQuery,
        query: SimpleSelectQuery,
        outputIndex: number,
        sourceColumn: ColumnReference
    ): TargetColumnResolution | SkipDraft {
        const output = this.collectSelectOutputs(root, query)[outputIndex];
        if (!output) {
            return {
                code: "UNION_COLUMN_MISMATCH",
                reason: `UNION branch does not expose column '${sourceColumn.column.name}' at output position ${outputIndex + 1}.`
            };
        } else if (identifiersEqual(output.name, sourceColumn.column.name)) {
            const matches = this.collectDirectOutputMatches(root, query, sourceColumn.column.name);
            if (matches.length > 1) {
                return {
                    code: "AMBIGUOUS_TARGET_COLUMN",
                    reason: `UNION branch exposes multiple '${sourceColumn.column.name}' columns.`
                };
            }
        }

        if (!(output.value instanceof ColumnReference)) {
            return {
                code: "EXPRESSION_OUTPUT_UNSUPPORTED",
                reason: `UNION branch output at position ${outputIndex + 1} for '${sourceColumn.column.name}' is an expression, not a direct column reference.`
            };
        }

        const sourceResolution = this.verifyColumnResolvableInQuery(query, output.value);
        if (sourceResolution) {
            return sourceResolution;
        }

        return {
            sourceColumn,
            targetColumn: output.value
        };
    }

    private collectSelectOutputs(root: SimpleSelectQuery, query: SimpleSelectQuery): SelectOutputColumn[] {
        const commonTables = [
            ...(query.withClause?.tables ?? []),
            ...(root.withClause?.tables ?? [])
        ];
        const collector = new SelectOutputCollector(null, commonTables.length > 0 ? commonTables : null);
        return collector.collect(query);
    }

    private collectDirectOutputMatches(root: SimpleSelectQuery, query: SimpleSelectQuery, columnName: string): SelectOutputColumn[] {
        const collectedMatches = this.collectSelectOutputs(root, query).filter(item =>
            identifiersEqual(item.name, columnName)
        );
        if (collectedMatches.length > 0) {
            return this.hasExplicitOutputMatch(query, columnName)
                ? [...collectedMatches, ...this.inferWildcardOutputMatches(root, query, columnName, true)]
                : collectedMatches;
        }

        return this.inferWildcardOutputMatches(root, query, columnName, false);
    }

    private hasExplicitOutputMatch(query: SimpleSelectQuery, columnName: string): boolean {
        return query.selectClause.items.some(item => {
            if (item.identifier) {
                return identifiersEqual(item.identifier.name, columnName);
            }

            return item.value instanceof ColumnReference
                && item.value.column.name !== "*"
                && identifiersEqual(item.value.column.name, columnName);
        });
    }

    private inferWildcardOutputMatches(
        root: SimpleSelectQuery,
        query: SimpleSelectQuery,
        columnName: string,
        includeUnprovenPotential: boolean
    ): SelectOutputColumn[] {
        const matches: SelectOutputColumn[] = [];
        query.selectClause.items.forEach((item, outputIndex) => {
            if (item.identifier || !(item.value instanceof ColumnReference) || item.value.column.name !== "*") {
                return;
            }

            const targetColumn = this.inferWildcardTargetColumn(root, query, item.value, columnName, includeUnprovenPotential);
            if (!targetColumn) {
                return;
            }

            if (targetColumn === "ambiguous") {
                matches.push(
                    this.createInferredOutputColumn(columnName, new ColumnReference(null, columnName), outputIndex),
                    this.createInferredOutputColumn(columnName, new ColumnReference(null, columnName), outputIndex)
                );
                return;
            }

            matches.push(this.createInferredOutputColumn(columnName, targetColumn, outputIndex));
        });
        return matches;
    }

    private inferWildcardTargetColumn(
        root: SimpleSelectQuery,
        query: SimpleSelectQuery,
        wildcard: ColumnReference,
        columnName: string,
        includeUnprovenPotential: boolean
    ): ColumnReference | "ambiguous" | null {
        if (!query.fromClause) {
            return null;
        }

        const bindings = this.getSourceBindings(query.fromClause);
        if (wildcard.namespaces === null) {
            if (bindings.length !== 1) {
                return "ambiguous";
            }
            return this.resolveWildcardColumnFromBinding(root, query, bindings[0]!, columnName, includeUnprovenPotential);
        }

        const namespace = wildcard.getNamespace();
        const matches = bindings.filter(binding => identifiersEqual(binding.alias, namespace));
        if (matches.length === 0) {
            return null;
        }
        return matches.length === 1
            ? this.resolveWildcardColumnFromBinding(root, query, matches[0]!, columnName, includeUnprovenPotential)
            : "ambiguous";
    }

    private resolveWildcardColumnFromBinding(
        root: SimpleSelectQuery,
        query: SimpleSelectQuery,
        binding: SourceBinding,
        columnName: string,
        includeUnprovenPotential: boolean
    ): ColumnReference | "ambiguous" | null {
        const matches = this.collectSourceOutputMatches(root, query, binding.source, columnName);
        if (matches.length > 1) {
            return "ambiguous";
        }
        if (matches.length === 1) {
            const value = matches[0]!.value;
            return value instanceof ColumnReference ? value : null;
        }
        return includeUnprovenPotential ? this.createColumnForBinding(binding, columnName) : null;
    }

    private collectSourceOutputMatches(
        root: SimpleSelectQuery,
        query: SimpleSelectQuery,
        source: SourceExpression,
        columnName: string
    ): SelectOutputColumn[] {
        const commonTables = [
            ...(query.withClause?.tables ?? []),
            ...(root.withClause?.tables ?? [])
        ];
        const collector = new SelectOutputCollector(null, commonTables.length > 0 ? commonTables : null);
        return collector.collect(source).filter(item => identifiersEqual(item.name, columnName));
    }

    private createColumnForBinding(binding: SourceBinding, columnName: string): ColumnReference {
        return new ColumnReference(binding.alias ? [binding.alias] : null, columnName);
    }

    private createInferredOutputColumn(name: string, value: ColumnReference, outputIndex: number): SelectOutputColumn {
        return {
            name,
            value,
            outputIndex,
            sourceAlias: value.getNamespace() || null,
            sourceName: null,
            sourceColumnName: name
        };
    }

    private resolveSourceQueryForColumns(root: SimpleSelectQuery, source: SourceExpression): SelectQuery | null {
        if (source.datasource instanceof SubQuerySource) {
            return source.datasource.query;
        }
        if (source.datasource instanceof TableSource) {
            const cteQuery = this.findCte(root, source.datasource.table.name)?.query;
            return cteQuery instanceof SimpleSelectQuery || cteQuery instanceof BinarySelectQuery
                ? cteQuery
                : null;
        }
        return null;
    }

    private findCte(root: SimpleSelectQuery, name: string): CommonTable | null {
        const normalized = normalizeIdentifier(name);
        const matches = (root.withClause?.tables ?? [])
            .filter(table => normalizeIdentifier(table.getSourceAliasName()) === normalized);
        return matches.length === 1 ? matches[0]! : null;
    }

    private countTableSourceReferences(query: SelectQuery, tableName: string): number {
        const normalized = normalizeIdentifier(tableName);
        let count = 0;
        const visitSelect = (select: SelectQuery): void => {
            if (select instanceof BinarySelectQuery) {
                visitSelect(select.left);
                visitSelect(select.right);
                return;
            }
            if (!(select instanceof SimpleSelectQuery)) {
                return;
            }

            if (select.fromClause) {
                for (const binding of this.getSourceBindings(select.fromClause)) {
                    const source = binding.source.datasource;
                    if (source instanceof TableSource && normalizeIdentifier(source.table.name) === normalized) {
                        count += 1;
                    }
                    if (source instanceof SubQuerySource) {
                        visitSelect(source.query);
                    }
                }
            }

            for (const cte of select.withClause?.tables ?? []) {
                if (cte.query instanceof SimpleSelectQuery || cte.query instanceof BinarySelectQuery) {
                    visitSelect(cte.query);
                }
            }
        };

        visitSelect(query);
        return count;
    }

    private collectSourceAliases(query: SimpleSelectQuery): Set<string> {
        const aliases = new Set<string>();
        for (const source of query.fromClause?.getSources() ?? []) {
            const alias = source.getAliasName();
            if (alias) {
                aliases.add(normalizeIdentifier(alias));
            }
        }
        return aliases;
    }

    private collectRootColumnReferences(root: SimpleSelectQuery, expression: ValueComponent): ColumnReference[] {
        const references: ColumnReference[] = [];
        const rootAliases = this.collectSourceAliases(root);

        const visitSelect = (query: SelectQuery, inheritedLocalAliases: ReadonlySet<string>): void => {
            if (!(query instanceof SimpleSelectQuery)) {
                return;
            }

            const localAliases = new Set(inheritedLocalAliases);
            for (const alias of this.collectSourceAliases(query)) {
                localAliases.add(alias);
            }

            query.selectClause.items.forEach(item => visit(item.value, localAliases));
            for (const join of query.fromClause?.joins ?? []) {
                if (join.condition) {
                    visit(join.condition.condition, localAliases);
                }
                const source = join.source.datasource;
                if (source instanceof SubQuerySource) {
                    visitSelect(source.query, localAliases);
                }
            }
            if (query.whereClause) {
                visit(query.whereClause.condition, localAliases);
            }
            if (query.havingClause) {
                visit(query.havingClause.condition, localAliases);
            }
            for (const cte of query.withClause?.tables ?? []) {
                if (cte.query instanceof SimpleSelectQuery || cte.query instanceof BinarySelectQuery) {
                    visitSelect(cte.query, localAliases);
                }
            }
        };

        const collect = (reference: ColumnReference): void => {
            if (!references.some(existing => sameColumnReference(existing, reference))) {
                references.push(reference);
            }
        };

        const visit = (value: ValueComponent, localAliases: ReadonlySet<string>): void => {
            const candidate = unwrapParens(value);
            if (candidate instanceof ColumnReference) {
                const namespace = normalizeIdentifier(candidate.getNamespace());
                if (namespace) {
                    if (rootAliases.has(namespace) && !localAliases.has(namespace)) {
                        collect(candidate);
                    }
                    return;
                }
                if (localAliases.size === 0) {
                    collect(candidate);
                }
                return;
            }
            if (candidate instanceof BinaryExpression) {
                visit(candidate.left, localAliases);
                visit(candidate.right, localAliases);
                return;
            }
            if (candidate instanceof UnaryExpression) {
                visit(candidate.expression, localAliases);
                return;
            }
            if (candidate instanceof InlineQuery) {
                visitSelect(candidate.selectQuery, localAliases);
                return;
            }
            if (candidate instanceof FunctionCall) {
                if (candidate.argument) {
                    visit(candidate.argument, localAliases);
                }
                if (candidate.filterCondition) {
                    visit(candidate.filterCondition, localAliases);
                }
                return;
            }
            if (candidate instanceof CastExpression) {
                visit(candidate.input, localAliases);
                return;
            }
            if (candidate instanceof CaseExpression) {
                if (candidate.condition) {
                    visit(candidate.condition, localAliases);
                }
                for (const pair of candidate.switchCase.cases) {
                    visit(pair.key, localAliases);
                    visit(pair.value, localAliases);
                }
                if (candidate.switchCase.elseValue) {
                    visit(candidate.switchCase.elseValue, localAliases);
                }
                return;
            }
            if (candidate instanceof BetweenExpression) {
                visit(candidate.expression, localAliases);
                visit(candidate.lower, localAliases);
                visit(candidate.upper, localAliases);
                return;
            }
            if (candidate instanceof JsonPredicateExpression) {
                visit(candidate.expression, localAliases);
                return;
            }
            if (candidate instanceof ArrayExpression) {
                visit(candidate.expression, localAliases);
                return;
            }
            if (candidate instanceof ArrayQueryExpression) {
                visitSelect(candidate.query, localAliases);
                return;
            }
            if (candidate instanceof ValueList) {
                candidate.values.forEach(item => visit(item, localAliases));
                return;
            }
            if (candidate instanceof TupleExpression) {
                candidate.values.forEach(item => visit(item, localAliases));
                return;
            }
            if (candidate instanceof TypeValue && candidate.argument) {
                visit(candidate.argument, localAliases);
            }
        };

        visit(expression, new Set());
        return references;
    }

    private hasWindowUsage(query: SimpleSelectQuery): boolean {
        if (query.windowClause) {
            return true;
        }

        let found = false;
        const visit = (value: ValueComponent): void => {
            if (found) {
                return;
            }
            const candidate = unwrapParens(value);
            if (candidate instanceof FunctionCall) {
                if (candidate.over) {
                    found = true;
                    return;
                }
                if (candidate.argument) {
                    visit(candidate.argument);
                }
                if (candidate.filterCondition) {
                    visit(candidate.filterCondition);
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
            if (candidate instanceof ValueList) {
                candidate.values.forEach(visit);
            }
        };

        query.selectClause.items.forEach(item => visit(item.value));
        return found;
    }

    private collectParameterNames(expression: ValueComponent): string[] {
        const names: string[] = [];
        const visitSelect = (query: SelectQuery): void => {
            if (query instanceof BinarySelectQuery) {
                visitSelect(query.left);
                visitSelect(query.right);
                return;
            }
            if (!(query instanceof SimpleSelectQuery)) {
                return;
            }

            query.selectClause.items.forEach(item => visit(item.value));
            for (const join of query.fromClause?.joins ?? []) {
                if (join.condition) {
                    visit(join.condition.condition);
                }
                const source = join.source.datasource;
                if (source instanceof SubQuerySource) {
                    visitSelect(source.query);
                }
            }
            if (query.whereClause) {
                visit(query.whereClause.condition);
            }
            if (query.havingClause) {
                visit(query.havingClause.condition);
            }
            for (const cte of query.withClause?.tables ?? []) {
                if (cte.query instanceof SimpleSelectQuery || cte.query instanceof BinarySelectQuery) {
                    visitSelect(cte.query);
                }
            }
        };

        const visit = (value: ValueComponent): void => {
            const candidate = unwrapParens(value);
            if (candidate instanceof ParameterExpression) {
                appendUnique(names, candidate.name.value);
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
                visitSelect(candidate.selectQuery);
                return;
            }
            if (candidate instanceof ArrayQueryExpression) {
                visitSelect(candidate.query);
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
        return names;
    }

    private makeSkipped(
        expression: ValueComponent,
        draft: SkipDraft,
        options: SqlComponentFormatOptions
    ): StaticPredicateSkipped {
        return {
            predicateSql: formatSqlComponent(expression, options),
            scopeId: "scope:root",
            ...draft
        };
    }

    private buildResult(params: {
        query: SelectQuery | null;
        sql: string;
        applied: StaticPredicateMove[];
        skipped: StaticPredicateSkipped[];
        warnings: StaticPredicatePlacementWarning[];
        errors: StaticPredicatePlacementError[];
        dryRun: boolean;
        formatterGeneratedSource: boolean;
    }): StaticPredicatePlacementResult {
        return {
            ok: params.errors.length === 0,
            sql: params.sql,
            query: params.query,
            applied: params.applied,
            skipped: params.skipped,
            warnings: params.warnings,
            errors: params.errors,
            safety: {
                mode: "safe_only",
                unsafeRewriteApplied: false,
                dryRun: params.dryRun,
                formatterGeneratedSource: params.formatterGeneratedSource
            },
            staticPredicateMoves: params.applied
        };
    }
}

export const planStaticPredicatePlacement = (
    input: StaticPredicatePlacementInput,
    options: StaticPredicatePlacementOptions = {}
): StaticPredicatePlacementResult => {
    return new StaticPredicatePlacementOptimizer().plan(input, options);
};

export const optimizeStaticPredicatePlacement = (
    input: StaticPredicatePlacementInput,
    options: StaticPredicatePlacementOptions = {}
): StaticPredicatePlacementResult => {
    return new StaticPredicatePlacementOptimizer().optimize(input, options);
};
