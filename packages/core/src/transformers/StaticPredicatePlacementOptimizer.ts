import {
    CommonTable,
    FromClause,
    JoinClause,
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
import { formatSqlComponent } from "./SqlComponentFormatter";

export type StaticPredicatePlacementInput = string | SelectQuery | SimpleSelectQuery;

/**
 * Safe-only placement for parameter-free static predicates.
 *
 * The optimizer only moves top-level AND terms whose outer column references can
 * be mechanically rebased to direct outputs of a single-use simple CTE or
 * derived table. Unsupported or ambiguous predicates stay in place.
 */
export interface StaticPredicatePlacementOptions {
    dryRun?: boolean;
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

interface UpstreamTarget {
    query: SimpleSelectQuery;
    scopeId: string;
    sourceBinding: SourceBinding;
    cteName?: string;
}

interface TargetColumnResolution {
    sourceColumn: ColumnReference;
    targetColumn: ColumnReference;
}

interface StaticPredicateCandidate {
    expression: ValueComponent;
    predicateSql: string;
    references: ColumnReference[];
}

type SkipDraft = Omit<StaticPredicateSkipped, "predicateSql" | "scopeId">;

const VOLATILE_OR_UNSUPPORTED_FUNCTION_REASON = "Predicate contains a function call; volatile and expression predicates are not moved in the safe-only implementation.";

const normalizeIdentifier = (value: string): string => value.trim().toLowerCase();

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

const cloneValueComponent = (expression: ValueComponent): ValueComponent => {
    return ValueParser.parse(formatSqlComponent(expression));
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
    return normalizeIdentifier(left.column.name) === normalizeIdentifier(right.column.name)
        && normalizeIdentifier(left.getNamespace()) === normalizeIdentifier(right.getNamespace());
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
        const parsed = this.parseInput(input);
        const warnings = [...parsed.warnings];
        const errors = [...parsed.errors];

        if (!parsed.query) {
            return this.buildResult({
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
            const candidate = this.analyzeCandidate(query, term);
            if (!candidate) {
                continue;
            }

            if ("code" in candidate) {
                skipped.push(this.makeSkipped(term, candidate));
                continue;
            }

            const target = this.resolveTarget(query, candidate);
            if ("code" in target) {
                skipped.push(this.makeSkipped(term, target));
                continue;
            }

            const targetColumns = this.resolveTargetColumns(target.query, candidate.references);
            if ("code" in targetColumns) {
                skipped.push(this.makeSkipped(term, targetColumns));
                continue;
            }

            const movedPredicate = this.rebasePredicate(candidate.expression, targetColumns);
            target.query.appendWhere(movedPredicate);
            movedTerms.push(term);

            applied.push({
                kind: "move_static_predicate",
                predicateSql: candidate.predicateSql,
                fromScopeId: "scope:root",
                toScopeId: target.scopeId,
                reason: "All outer references resolve to direct upstream outputs before unsafe query boundaries.",
                columnReferences: candidate.references.map(columnReferenceText)
            });
        }

        rebuildWhereWithoutTerms(query, new Set(movedTerms));

        const sql = applied.length > 0 ? formatSqlComponent(query) : parsed.sql;
        return this.buildResult({
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

    private parseInput(input: StaticPredicatePlacementInput): ParsedStaticPredicateInput {
        const warnings: StaticPredicatePlacementWarning[] = [];
        const errors: StaticPredicatePlacementError[] = [];

        try {
            const sourceSql = typeof input === "string"
                ? input
                : formatSqlComponent(input);

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

    private analyzeCandidate(root: SimpleSelectQuery, expression: ValueComponent): StaticPredicateCandidate | SkipDraft | null {
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
            predicateSql: formatSqlComponent(expression),
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
                if (candidate.operator.value.trim().toLowerCase() === "or") {
                    found = {
                        code: "OR_PREDICATE_UNSUPPORTED",
                        reason: "Predicate contains OR predicates, which are not moved in the first safe-only implementation."
                    };
                    return;
                }
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

            if (candidate instanceof BetweenExpression) {
                found = {
                    code: "BETWEEN_PREDICATE_UNSUPPORTED",
                    reason: "BETWEEN predicates are not moved in the first safe-only implementation."
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
        const boundary = this.findCurrentQueryBoundary(root);
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
            const binding = this.resolveSourceBinding(root, reference);
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
        const nullableSide = this.findNullableSideBoundary(root.fromClause, binding);
        if (nullableSide) {
            return nullableSide;
        }

        const upstream = this.resolveUpstreamQuery(root, binding);
        if ("code" in upstream) {
            return upstream;
        }

        const targetBoundary = this.findTargetQueryBoundary(upstream.query);
        if (targetBoundary) {
            return targetBoundary;
        }

        return upstream;
    }

    private findCurrentQueryBoundary(query: SimpleSelectQuery): SkipDraft | null {
        if (query.selectClause.distinct) {
            return {
                code: "DISTINCT_BOUNDARY",
                reason: "Predicate crosses DISTINCT boundary; moving it may change semantics."
            };
        }
        if (query.groupByClause || query.havingClause) {
            return {
                code: "GROUP_BY_BOUNDARY",
                reason: "Predicate crosses GROUP BY boundary; moving it may change semantics."
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

    private findTargetQueryBoundary(query: SimpleSelectQuery): SkipDraft | null {
        const commonBoundary = this.findCurrentQueryBoundary(query);
        if (commonBoundary) {
            return commonBoundary;
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
        return null;
    }

    private resolveSourceBinding(root: SimpleSelectQuery, column: ColumnReference): SourceBinding | SkipDraft {
        const fromClause = root.fromClause;
        if (!fromClause) {
            return {
                code: "NO_FROM_CLAUSE",
                reason: "Predicate has no FROM source that can receive it safely."
            };
        }

        const bindings = this.getSourceBindings(fromClause);
        const namespace = normalizeIdentifier(column.getNamespace());
        const columnName = column.column.name;

        if (namespace) {
            const matches = bindings.filter(binding => normalizeIdentifier(binding.alias) === namespace);
            if (matches.length !== 1) {
                return {
                    code: "AMBIGUOUS_COLUMN_SOURCE",
                    reason: `Column source alias '${column.getNamespace()}' is not uniquely resolvable.`
                };
            }

            if (this.resolveSourceQueryForColumns(root, matches[0]!.source) instanceof BinarySelectQuery) {
                return matches[0]!;
            }

            const matchCount = this.getOutputColumnMatchCount(root, matches[0]!, columnName);
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
        let unionSource: SourceBinding | null = null;
        for (const binding of bindings) {
            if (this.resolveSourceQueryForColumns(root, binding.source) instanceof BinarySelectQuery) {
                unionSource ??= binding;
                continue;
            }

            const matchCount = this.getOutputColumnMatchCount(root, binding, columnName);
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

        if (matches.length === 0 && unionSource) {
            return {
                code: "UNION_BOUNDARY",
                reason: "Predicate would need distribution into a UNION branch, which is unsupported."
            };
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

    private resolveUpstreamQuery(root: SimpleSelectQuery, binding: SourceBinding): UpstreamTarget | SkipDraft {
        const source = binding.source.datasource;
        if (source instanceof SubQuerySource) {
            if (source.query instanceof SimpleSelectQuery) {
                return {
                    query: source.query,
                    scopeId: `subquery:${binding.alias}`,
                    sourceBinding: binding
                };
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
            return {
                code: "UNION_BOUNDARY",
                reason: "Predicate would need distribution into a UNION branch, which is unsupported."
            };
        }

        if (!(commonTable.query instanceof SimpleSelectQuery)) {
            return {
                code: "UNSUPPORTED_CTE_QUERY",
                reason: "Writable or non-select CTE bodies are not moved into by static predicate placement."
            };
        }

        return {
            query: commonTable.query,
            scopeId: `cte:${commonTable.getSourceAliasName()}`,
            sourceBinding: binding,
            cteName: commonTable.getSourceAliasName()
        };
    }

    private resolveTargetColumns(query: SimpleSelectQuery, references: readonly ColumnReference[]): TargetColumnResolution[] | SkipDraft {
        const resolved: TargetColumnResolution[] = [];
        for (const reference of references) {
            const matches = query.selectClause.items.filter(item =>
                normalizeIdentifier(this.getSelectItemOutputName(item) ?? "") === normalizeIdentifier(reference.column.name)
            );

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

    private verifyColumnResolvableInQuery(query: SimpleSelectQuery, column: ColumnReference): SkipDraft | null {
        if (!query.fromClause) {
            return {
                code: "NO_TARGET_FROM_CLAUSE",
                reason: "Target query has no FROM clause where the moved column can be resolved."
            };
        }

        const bindings = this.getSourceBindings(query.fromClause);
        const namespace = normalizeIdentifier(column.getNamespace());
        if (namespace) {
            const matches = bindings.filter(binding => normalizeIdentifier(binding.alias) === namespace);
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

    private rebasePredicate(
        expression: ValueComponent,
        targetColumns: readonly TargetColumnResolution[]
    ): ValueComponent {
        const cloned = cloneValueComponent(expression);
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

    private getOutputColumnMatchCount(root: SimpleSelectQuery, binding: SourceBinding, columnName: string): number {
        const target = this.resolveSourceQueryForColumns(root, binding.source);
        if (!target || !(target instanceof SimpleSelectQuery)) {
            return 0;
        }
        return target.selectClause.items.filter(item =>
            normalizeIdentifier(this.getSelectItemOutputName(item) ?? "") === normalizeIdentifier(columnName)
        ).length;
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

    private getSelectItemOutputName(item: { value: ValueComponent; identifier: { name: string } | null }): string | null {
        if (item.identifier) {
            return item.identifier.name;
        }
        if (item.value instanceof ColumnReference) {
            return item.value.column.name;
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

    private makeSkipped(expression: ValueComponent, draft: SkipDraft): StaticPredicateSkipped {
        return {
            predicateSql: formatSqlComponent(expression),
            scopeId: "scope:root",
            ...draft
        };
    }

    private buildResult(params: {
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
