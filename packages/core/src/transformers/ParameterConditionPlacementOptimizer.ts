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
import { SqlFormatter } from "./SqlFormatter";

export type ParameterConditionOptimizationInput = string | SelectQuery | SimpleSelectQuery;

/**
 * First-phase safe-only placement for ordinary parameter predicates.
 *
 * The optimizer intentionally handles only root top-level AND predicates and one
 * CTE/derived-table hop where the destination output is a direct column reference.
 * Unsupported boundaries such as OR, UNION, DISTINCT, GROUP BY, WINDOW, OUTER
 * JOIN, expression outputs, and function predicates are reported as skipped.
 */
export interface ParameterConditionOptimizationOptions {
    dryRun?: boolean;
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
    column: ColumnReference;
}

interface SourceBinding {
    source: SourceExpression;
    alias: string;
    join: JoinClause | null;
    isPrimary: boolean;
}

interface UpstreamTarget {
    query: SimpleSelectQuery;
    scopeId: string;
    outputColumnName: string;
    sourceBinding: SourceBinding;
    cteName?: string;
}

interface TargetColumnResolution {
    column: ColumnReference;
}

type SkipDraft = Omit<ParameterConditionSkipped, "conditionSql" | "scopeId">;

const SUPPORTED_OPERATORS = new Set(["=", "<>", "!=", "<", "<=", ">", ">=", "like", "ilike", "in"]);
const VOLATILE_OR_UNSUPPORTED_FUNCTION_REASON = "Condition contains a function call; volatile and expression predicates are not moved in the safe-only implementation.";

const normalizeIdentifier = (value: string): string => value.trim().toLowerCase();

const formatSqlComponent = (component: SelectQuery | ValueComponent): string => {
    return new SqlFormatter().format(component).formattedSql;
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

export class ParameterConditionPlacementOptimizer {
    public plan(
        input: ParameterConditionOptimizationInput,
        options: ParameterConditionOptimizationOptions = {}
    ): ParameterConditionOptimizationResult {
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
                message: "Parameter condition placement currently supports only SimpleSelectQuery roots."
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
        const applied: ParameterConditionMove[] = [];
        const skipped: ParameterConditionSkipped[] = [];
        const movedTerms: ValueComponent[] = [];

        for (const term of query.whereClause ? collectTopLevelAndTerms(query.whereClause.condition) : []) {
            const candidate = this.analyzeCandidate(term);
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

            const targetColumn = this.resolveTargetColumn(target.query, target.outputColumnName);
            if ("code" in targetColumn) {
                skipped.push(this.makeSkipped(term, targetColumn));
                continue;
            }

            const movedCondition = this.rebaseCondition(candidate.expression, candidate.column, targetColumn.column);
            target.query.appendWhere(movedCondition);
            movedTerms.push(term);

            applied.push({
                kind: "move_condition",
                conditionSql: candidate.conditionSql,
                fromScopeId: "scope:root",
                toScopeId: target.scopeId,
                reason: "All referenced columns resolve to a single direct upstream output before unsafe query boundaries.",
                parameterNames: candidate.parameterNames,
                columnReferences: [columnReferenceText(candidate.column)]
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
        input: ParameterConditionOptimizationInput,
        options: ParameterConditionOptimizationOptions = {}
    ): ParameterConditionOptimizationResult {
        return this.plan(input, { ...options, dryRun: options.dryRun ?? false });
    }

    private parseInput(input: ParameterConditionOptimizationInput): ParsedOptimizationInput {
        const warnings: ParameterConditionOptimizationWarning[] = [];
        const errors: ParameterConditionOptimizationError[] = [];

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

    private analyzeCandidate(expression: ValueComponent): CandidateCondition | SkipDraft | null {
        const parameterNames = this.collectParameterNames(expression);
        if (parameterNames.length === 0) {
            return null;
        }

        const unsupported = this.findUnsupportedExpression(expression);
        if (unsupported) {
            return unsupported;
        }

        const candidate = unwrapParens(expression);
        if (!(candidate instanceof BinaryExpression)) {
            return {
                code: "UNSUPPORTED_PARAMETER_CONDITION",
                reason: "Only simple binary parameter predicates are moved in the safe-only implementation."
            };
        }

        const operator = candidate.operator.value.trim().toLowerCase();
        if (!SUPPORTED_OPERATORS.has(operator)) {
            return {
                code: "UNSUPPORTED_OPERATOR",
                reason: `Operator '${candidate.operator.value}' is not supported for safe-only parameter condition placement.`
            };
        }

        const columnReferences = this.collectColumnReferences(expression);
        if (columnReferences.length !== 1) {
            return {
                code: "AMBIGUOUS_COLUMN_REFERENCE",
                reason: columnReferences.length === 0
                    ? "Parameter condition has no column reference to anchor the move."
                    : "Parameter condition references multiple columns; moving it may change semantics."
            };
        }

        if (operator === "in" && !this.isSupportedInPredicate(candidate)) {
            return {
                code: "UNSUPPORTED_IN_PREDICATE",
                reason: "Only simple column IN (:parameter) predicates are moved in the safe-only implementation."
            };
        }

        return {
            expression,
            conditionSql: formatSqlComponent(expression),
            parameterNames,
            column: columnReferences[0]!
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
                if (candidate.operator.value.trim().toLowerCase() === "or") {
                    found = {
                        code: "OR_PREDICATE_UNSUPPORTED",
                        reason: "Condition contains OR predicates, which are not moved in the first safe-only implementation."
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

            if (candidate instanceof InlineQuery || candidate instanceof ArrayQueryExpression) {
                found = {
                    code: "SUBQUERY_PREDICATE_UNSUPPORTED",
                    reason: "Subquery predicates are not moved in the first safe-only implementation."
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
        const boundary = this.findCurrentQueryBoundary(root);
        if (boundary) {
            return boundary;
        }

        if (!root.fromClause) {
            return {
                code: "NO_FROM_CLAUSE",
                reason: "Condition has no FROM source that can receive the predicate safely."
            };
        }

        const bindingResult = this.resolveSourceBinding(root, candidate.column);
        if ("code" in bindingResult) {
            return bindingResult;
        }

        const nullableSide = this.findNullableSideBoundary(root.fromClause, bindingResult);
        if (nullableSide) {
            return nullableSide;
        }

        const upstream = this.resolveUpstreamQuery(root, bindingResult, candidate.column.column.name);
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
                reason: "Condition crosses DISTINCT boundary; moving it may change semantics."
            };
        }
        if (query.groupByClause || query.havingClause) {
            return {
                code: "GROUP_BY_BOUNDARY",
                reason: "Condition crosses GROUP BY boundary; moving it may change semantics."
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

    private findTargetQueryBoundary(query: SimpleSelectQuery): SkipDraft | null {
        const commonBoundary = this.findCurrentQueryBoundary(query);
        if (commonBoundary) {
            return commonBoundary;
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
        return null;
    }

    private resolveSourceBinding(root: SimpleSelectQuery, column: ColumnReference): SourceBinding | SkipDraft {
        const fromClause = root.fromClause;
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
                reason: "Condition would need distribution into a UNION branch, which is unsupported."
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

    private resolveUpstreamQuery(
        root: SimpleSelectQuery,
        binding: SourceBinding,
        outputColumnName: string
    ): UpstreamTarget | SkipDraft {
        const source = binding.source.datasource;
        if (source instanceof SubQuerySource) {
            if (source.query instanceof SimpleSelectQuery) {
                return {
                    query: source.query,
                    scopeId: `subquery:${binding.alias}`,
                    outputColumnName,
                    sourceBinding: binding
                };
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
            return {
                code: "UNION_BOUNDARY",
                reason: "Condition would need distribution into a UNION branch, which is unsupported."
            };
        }

        if (!(commonTable.query instanceof SimpleSelectQuery)) {
            return {
                code: "UNSUPPORTED_CTE_QUERY",
                reason: "Writable or non-select CTE bodies are not moved into by parameter condition placement."
            };
        }

        return {
            query: commonTable.query,
            scopeId: `cte:${commonTable.getSourceAliasName()}`,
            outputColumnName,
            sourceBinding: binding,
            cteName: commonTable.getSourceAliasName()
        };
    }

    private resolveTargetColumn(query: SimpleSelectQuery, outputColumnName: string): TargetColumnResolution | SkipDraft {
        const matches = query.selectClause.items.filter(item =>
            normalizeIdentifier(this.getSelectItemOutputName(item) ?? "") === normalizeIdentifier(outputColumnName)
        );

        if (matches.length !== 1) {
            return {
                code: "AMBIGUOUS_TARGET_COLUMN",
                reason: matches.length === 0
                    ? `Target query does not expose '${outputColumnName}' as a direct output column.`
                    : `Target query exposes multiple '${outputColumnName}' columns.`
            };
        }

        const value = matches[0]!.value;
        if (!(value instanceof ColumnReference)) {
            return {
                code: "EXPRESSION_OUTPUT_UNSUPPORTED",
                reason: `Target output '${outputColumnName}' is an expression, not a direct column reference.`
            };
        }

        const sourceResolution = this.verifyColumnResolvableInQuery(query, value);
        if (sourceResolution) {
            return sourceResolution;
        }

        return { column: value };
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

    private rebaseCondition(
        expression: ValueComponent,
        sourceColumn: ColumnReference,
        targetColumn: ColumnReference
    ): ValueComponent {
        const cloned = cloneValueComponent(expression);
        for (const reference of this.collectColumnReferences(cloned)) {
            if (!sameColumnReference(reference, sourceColumn)) {
                continue;
            }
            reference.qualifiedName = cloneColumnReference(targetColumn).qualifiedName;
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

    private makeSkipped(expression: ValueComponent, draft: SkipDraft): ParameterConditionSkipped {
        return {
            conditionSql: formatSqlComponent(expression),
            scopeId: "scope:root",
            ...draft
        };
    }

    private buildResult(params: {
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
