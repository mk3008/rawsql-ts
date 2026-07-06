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
import {
    formatSqlComponent,
    hasSqlComponentFormatOverride,
    SqlComponentFormatOptions
} from "./SqlComponentFormatter";
import { SelectOutputCollector, SelectOutputColumn } from "./SelectOutputCollector";

export type ParameterConditionOptimizationInput = string | SelectQuery | SimpleSelectQuery;

/**
 * First-phase safe-only placement for ordinary parameter predicates.
 *
 * The optimizer intentionally handles only root top-level AND predicates and one
 * CTE/derived-table hop where the destination output is a direct column reference.
 * Unsupported boundaries such as OR, UNION, DISTINCT, GROUP BY, WINDOW, OUTER
 * JOIN, expression outputs, and function predicates are reported as skipped.
 */
export interface ParameterConditionOptimizationOptions extends SqlComponentFormatOptions {
    dryRun?: boolean;
    /**
     * Whether AST/model inputs should be cloned before optimization.
     * Defaults to true for public-call safety. Internal pipelines can pass false
     * when they own the model and want to avoid AST -> SQL -> AST round trips.
     */
    cloneInput?: boolean;
}

export interface ParameterConditionOptimizationWarning {
    code: string;
    message: string;
    detail?: unknown;
}

export interface ParameterConditionOptimizationError {
    code: string;
    message: string;
    detail?: unknown;
}

export interface ParameterConditionMove {
    kind: "move_condition";
    conditionSql: string;
    fromScopeId: string;
    toScopeId: string;
    reason: string;
    parameterNames: readonly string[];
    columnReferences: readonly string[];
}

export interface ParameterConditionSkipped {
    conditionSql: string;
    scopeId: string;
    reason: string;
    code: string;
}

export interface ParameterConditionOptimizationSafety {
    mode: "safe_only";
    unsafeRewriteApplied: false;
    dryRun: boolean;
    formatterGeneratedSource: boolean;
}

export interface ParameterConditionOptimizationResult {
    ok: boolean;
    sql: string;
    query: SelectQuery | null;
    applied: readonly ParameterConditionMove[];
    skipped: readonly ParameterConditionSkipped[];
    warnings: readonly ParameterConditionOptimizationWarning[];
    errors: readonly ParameterConditionOptimizationError[];
    safety: ParameterConditionOptimizationSafety;
    conditionMoves: readonly ParameterConditionMove[];
}

interface ParsedOptimizationInput {
    query: SelectQuery | null;
    sql: string;
    formatterGeneratedSource: boolean;
    warnings: ParameterConditionOptimizationWarning[];
    errors: ParameterConditionOptimizationError[];
}

interface CandidateCondition {
    expression: ValueComponent;
    conditionSql: string;
    parameterNames: string[];
    references: ColumnReference[];
}

interface SourceBinding {
    source: SourceExpression;
    alias: string;
    join: JoinClause | null;
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

type UpstreamTarget = SimpleUpstreamTarget | UnionUpstreamTarget;

interface TargetColumnResolution {
    sourceColumn: ColumnReference;
    targetColumn: ColumnReference;
}

interface TargetPlacement {
    reason: string;
}

type SkipDraft = Omit<ParameterConditionSkipped, "conditionSql" | "scopeId">;

const SUPPORTED_OPERATORS = new Set(["=", "<>", "!=", "<", "<=", ">", ">=", "like", "ilike", "in"]);
const VOLATILE_OR_UNSUPPORTED_FUNCTION_REASON = "Condition contains a function call; volatile and expression predicates are not moved in the safe-only implementation.";

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
    return normalizeIdentifier(left.column.name) === normalizeIdentifier(right.column.name)
        && normalizeIdentifier(left.getNamespace()) === normalizeIdentifier(right.getNamespace());
};

const appendUnique = <T>(items: T[], value: T): void => {
    if (!items.includes(value)) {
        items.push(value);
    }
};

export class ParameterConditionPlacementOptimizer {
    public plan(
        input: ParameterConditionOptimizationInput,
        options: ParameterConditionOptimizationOptions = {}
    ): ParameterConditionOptimizationResult {
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
                message: "Parameter condition placement currently supports only SimpleSelectQuery roots."
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
        const applied: ParameterConditionMove[] = [];
        const skipped: ParameterConditionSkipped[] = [];
        const movedTerms: ValueComponent[] = [];

        for (const term of query.whereClause ? collectTopLevelAndTerms(query.whereClause.condition) : []) {
            const candidate = this.analyzeCandidate(term, options);
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
            if (target.kind === "simple") {
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

                const movedCondition = this.rebaseCondition(candidate.expression, targetColumns, options);
                target.query.appendWhere(movedCondition);
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
                    const movedCondition = this.rebaseCondition(candidate.expression, branch.targetColumns, options);
                    branch.query.appendWhere(movedCondition);
                }
                appliedReason = placements.some(item => /group by/i.test(item.reason))
                    ? "Condition is distributed to every UNION branch by output column position; grouped branches only receive GROUP BY-key predicates."
                    : "Condition is distributed to every UNION branch by output column position before unsafe query boundaries.";
            }
            movedTerms.push(term);

            applied.push({
                kind: "move_condition",
                conditionSql: candidate.conditionSql,
                fromScopeId: "scope:root",
                toScopeId: target.scopeId,
                reason: appliedReason,
                parameterNames: candidate.parameterNames,
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
        input: ParameterConditionOptimizationInput,
        options: ParameterConditionOptimizationOptions = {}
    ): ParameterConditionOptimizationResult {
        return this.plan(input, { ...options, dryRun: options.dryRun ?? false });
    }

    private parseInput(
        input: ParameterConditionOptimizationInput,
        options: ParameterConditionOptimizationOptions
    ): ParsedOptimizationInput {
        const warnings: ParameterConditionOptimizationWarning[] = [];
        const errors: ParameterConditionOptimizationError[] = [];

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
                message: "Parameter condition optimization could not parse the input SQL.",
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
        expression: ValueComponent,
        options: SqlComponentFormatOptions
    ): CandidateCondition | SkipDraft | null {
        const parameterNames = this.collectParameterNames(expression);
        if (parameterNames.length === 0) {
            return null;
        }

        const unsupported = this.findUnsupportedExpression(expression);
        if (unsupported) {
            return unsupported;
        }

        const columnReferences = this.collectColumnReferences(expression);
        if (columnReferences.length === 0) {
            return {
                code: "AMBIGUOUS_COLUMN_REFERENCE",
                reason: "Parameter condition has no column reference to anchor the move."
            };
        }

        const unsupportedShape = this.findUnsupportedParameterPredicateShape(expression);
        if (unsupportedShape) {
            return unsupportedShape;
        }

        return {
            expression,
            conditionSql: formatSqlComponent(expression, options),
            parameterNames,
            references: columnReferences
        };
    }

    private findUnsupportedExpression(expression: ValueComponent): SkipDraft | null {
        let found: SkipDraft | null = null;

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

            if (candidate instanceof InlineQuery || candidate instanceof ArrayQueryExpression) {
                found = {
                    code: "SUBQUERY_PREDICATE_UNSUPPORTED",
                    reason: "Subquery predicates are not moved in the first safe-only implementation."
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

    private findUnsupportedParameterPredicateShape(expression: ValueComponent): SkipDraft | null {
        const visit = (value: ValueComponent): SkipDraft | null => {
            const candidate = unwrapParens(value);
            if (candidate instanceof BetweenExpression) {
                return null;
            }
            if (candidate instanceof BinaryExpression) {
                const operator = candidate.operator.value.trim().toLowerCase();
                if (operator === "and" || operator === "or") {
                    return visit(candidate.left) ?? visit(candidate.right);
                }
                if (!SUPPORTED_OPERATORS.has(operator)) {
                    return {
                        code: "UNSUPPORTED_OPERATOR",
                        reason: `Operator '${candidate.operator.value}' is not supported for safe-only parameter condition placement.`
                    };
                }
                if (operator === "in" && !this.isSupportedInPredicate(candidate)) {
                    return {
                        code: "UNSUPPORTED_IN_PREDICATE",
                        reason: "Only simple column IN (:parameter) predicates are moved in the safe-only implementation."
                    };
                }
                return null;
            }

            return {
                code: "UNSUPPORTED_PARAMETER_CONDITION",
                reason: "Only simple binary, BETWEEN, and whole OR/AND parameter predicates are moved in the safe-only implementation."
            };
        };

        return visit(expression);
    }

    private isSupportedInPredicate(expression: BinaryExpression): boolean {
        const left = unwrapParens(expression.left);
        const right = unwrapParens(expression.right);
        if (!(left instanceof ColumnReference)) {
            return false;
        }
        if (right instanceof ParameterExpression) {
            return true;
        }
        if (!(right instanceof ValueList)) {
            return false;
        }
        return right.values.length > 0
            && right.values.every(value => unwrapParens(value) instanceof ParameterExpression);
    }

    private resolveTarget(root: SimpleSelectQuery, candidate: CandidateCondition): UpstreamTarget | SkipDraft {
        const boundary = this.findRootQueryBoundary(root);
        if (boundary) {
            return boundary;
        }

        if (!root.fromClause) {
            return {
                code: "NO_FROM_CLAUSE",
                reason: "Condition has no FROM source that can receive the predicate safely."
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
                reason: "Parameter condition references multiple source query blocks; moving it may change semantics."
            };
        }

        const binding = bindings[0]!;
        const nullableSide = this.findNullableSideBoundary(root.fromClause, binding);
        if (nullableSide) {
            return nullableSide;
        }

        const upstream = this.resolveUpstreamQuery(root, binding, candidate.references);
        if ("code" in upstream) {
            return upstream;
        }

        return upstream;
    }

    private findRootQueryBoundary(query: SimpleSelectQuery): SkipDraft | null {
        if (query.selectClause.distinct) {
            return {
                code: "DISTINCT_BOUNDARY",
                reason: "Condition crosses DISTINCT boundary; moving it may change semantics."
            };
        }
        if (this.hasWindowUsage(query)) {
            return {
                code: "WINDOW_BOUNDARY",
                reason: "Condition crosses WINDOW boundary; moving it may change semantics."
            };
        }
        return null;
    }

    private resolveTargetPlacement(
        query: SimpleSelectQuery,
        targetColumns: readonly TargetColumnResolution[]
    ): TargetPlacement | SkipDraft {
        if (query.selectClause.distinct) {
            return {
                code: "DISTINCT_BOUNDARY",
                reason: "Condition crosses DISTINCT boundary; moving it may change semantics."
            };
        }
        if (this.hasWindowUsage(query)) {
            return {
                code: "WINDOW_BOUNDARY",
                reason: "Condition crosses WINDOW boundary; moving it may change semantics."
            };
        }
        if (query.limitClause || query.offsetClause || query.fetchClause) {
            return {
                code: "ROW_LIMIT_BOUNDARY",
                reason: "Condition crosses LIMIT/OFFSET/FETCH boundary; moving it may change row selection semantics."
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
                    reason: "Condition references a target column that is not proven to be a GROUP BY key."
                };
            }
            return {
                reason: "Condition references only GROUP BY keys; it is moved into pre-aggregation WHERE."
            };
        }
        if (query.havingClause) {
            return {
                code: "GROUP_BY_BOUNDARY",
                reason: "Condition crosses HAVING aggregation boundary; moving it may change semantics."
            };
        }
        return {
            reason: "All referenced columns resolve to a single direct upstream output before unsafe query boundaries."
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
                reason: "Condition has no FROM source that can receive the predicate safely."
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

            const matchCount = this.getOutputColumnMatchCount(contextRoot, matches[0]!, columnName);
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
                reason: "Condition would need distribution into a UNION or non-simple subquery, which is unsupported."
            };
        }

        if (!(source instanceof TableSource)) {
            return {
                code: "UNSUPPORTED_SOURCE",
                reason: "Only CTE and simple derived-table sources can receive moved parameter conditions."
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
                reason: "Writable or non-select CTE bodies are not moved into by parameter condition placement."
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
            const matches = this.collectSelectOutputs(root, query).filter(item =>
                normalizeIdentifier(item.name) === normalizeIdentifier(reference.column.name)
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
        if ("code" in upstream || upstream.kind === "union") {
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
        if (normalizeIdentifier(left.column.name) !== normalizeIdentifier(right.column.name)) {
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
        const namespace = normalizeIdentifier(column.getNamespace());
        if (namespace) {
            const matches = bindings.filter(binding => normalizeIdentifier(binding.alias) === namespace);
            return matches.length === 1 ? normalizeIdentifier(matches[0]!.alias) : null;
        }
        return bindings.length === 1 ? normalizeIdentifier(bindings[0]!.alias) : null;
    }

    private rebaseCondition(
        expression: ValueComponent,
        targetColumns: readonly TargetColumnResolution[],
        options: SqlComponentFormatOptions
    ): ValueComponent {
        const cloned = cloneValueComponent(expression, options);
        for (const reference of this.collectColumnReferences(cloned)) {
            const target = targetColumns.find(item => sameColumnReference(reference, item.sourceColumn));
            if (target) {
                reference.qualifiedName = cloneColumnReference(target.targetColumn).qualifiedName;
            }
        }
        return cloned;
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

    private findNullableSideBoundary(fromClause: FromClause, binding: SourceBinding): SkipDraft | null {
        if (!binding.join) {
            const rightOrFull = (fromClause.joins ?? []).some(join => {
                const joinType = join.joinType.value.toLowerCase();
                return joinType.includes("right") || joinType.includes("full");
            });
            return rightOrFull
                ? {
                    code: "OUTER_JOIN_NULLABLE_SIDE",
                    reason: "Condition crosses OUTER JOIN nullable side; moving it may change semantics."
                }
                : null;
        }

        const joinType = binding.join.joinType.value.toLowerCase();
        if (joinType.includes("left")) {
            return {
                code: "OUTER_JOIN_NULLABLE_SIDE",
                reason: "Condition crosses LEFT JOIN nullable side; moving it may change semantics."
            };
        }
        if (joinType.includes("full")) {
            return {
                code: "OUTER_JOIN_NULLABLE_SIDE",
                reason: "Condition crosses FULL JOIN nullable side; moving it may change semantics."
            };
        }

        return null;
    }

    private hasOuterJoin(fromClause: FromClause): boolean {
        return (fromClause.joins ?? []).some(join => {
            const joinType = join.joinType.value.toLowerCase();
            return joinType.includes("left") || joinType.includes("right") || joinType.includes("full") || joinType.includes("outer");
        });
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
            return this.collectSelectOutputs(root, branches[0]!).filter(item =>
                normalizeIdentifier(item.name) === normalizeIdentifier(columnName)
            ).length;
        }
        if (!(target instanceof SimpleSelectQuery)) {
            return 0;
        }
        return this.collectSelectOutputs(root, target).filter(item =>
            normalizeIdentifier(item.name) === normalizeIdentifier(columnName)
        ).length;
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
                    reason: "Condition would need distribution into a non-simple UNION branch, which is unsupported."
                };
            }

            const operator = select.operator.value.trim().toLowerCase();
            if (operator !== "union" && operator !== "union all") {
                return {
                    code: "UNION_BOUNDARY",
                    reason: `Condition would need distribution through '${select.operator.value}', which is unsupported.`
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
            if (normalizeIdentifier(item.name) === normalizeIdentifier(outputColumnName)) {
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

    private collectSelectOutputs(root: SimpleSelectQuery, query: SimpleSelectQuery): SelectOutputColumn[] {
        const commonTables = [
            ...(query.withClause?.tables ?? []),
            ...(root.withClause?.tables ?? [])
        ];
        const collector = new SelectOutputCollector(null, commonTables.length > 0 ? commonTables : null);
        return collector.collect(query);
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

    private collectColumnReferences(expression: ValueComponent): ColumnReference[] {
        const references: ColumnReference[] = [];
        const visit = (value: ValueComponent): void => {
            const candidate = unwrapParens(value);
            if (candidate instanceof ColumnReference) {
                if (!references.some(existing => sameColumnReference(existing, candidate))) {
                    references.push(candidate);
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
        return references;
    }

    private collectParameterNames(expression: ValueComponent): string[] {
        const names: string[] = [];
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
            if (candidate instanceof ArrayQueryExpression || candidate instanceof InlineQuery) {
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
    ): ParameterConditionSkipped {
        return {
            conditionSql: formatSqlComponent(expression, options),
            scopeId: "scope:root",
            ...draft
        };
    }

    private buildResult(params: {
        query: SelectQuery | null;
        sql: string;
        applied: ParameterConditionMove[];
        skipped: ParameterConditionSkipped[];
        warnings: ParameterConditionOptimizationWarning[];
        errors: ParameterConditionOptimizationError[];
        dryRun: boolean;
        formatterGeneratedSource: boolean;
    }): ParameterConditionOptimizationResult {
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
            conditionMoves: params.applied
        };
    }
}

export const planParameterConditionOptimization = (
    input: ParameterConditionOptimizationInput,
    options: ParameterConditionOptimizationOptions = {}
): ParameterConditionOptimizationResult => {
    return new ParameterConditionPlacementOptimizer().plan(input, options);
};

export const optimizeParameterConditionPlacement = (
    input: ParameterConditionOptimizationInput,
    options: ParameterConditionOptimizationOptions = {}
): ParameterConditionOptimizationResult => {
    return new ParameterConditionPlacementOptimizer().optimize(input, options);
};
