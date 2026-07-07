import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
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
    InlineQuery,
    JsonPredicateExpression,
    ParenExpression,
    TupleExpression,
    TypeValue,
    UnaryExpression,
    ValueComponent,
    ValueList
} from "../models/ValueComponent";
import {
    JoinClause,
    SourceExpression,
    SubQuerySource,
    TableSource
} from "../models/Clause";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { rewriteValueComponentWithColumnResolver } from "../utils/ValueComponentRewriter";
import {
    ParameterConditionPlacementOptimizer,
    ParameterConditionMove,
    ParameterConditionOptimizationError,
    ParameterConditionOptimizationOptions,
    ParameterConditionOptimizationWarning,
    ParameterConditionSkipped
} from "./ParameterConditionPlacementOptimizer";
import {
    StaticPredicatePlacementOptimizer,
    StaticPredicateMove,
    StaticPredicatePlacementError,
    StaticPredicatePlacementWarning,
    StaticPredicateSkipped
} from "./StaticPredicatePlacementOptimizer";
import {
    ConditionDeduplicationApplied,
    ConditionDeduplicationOptimizer
} from "./ConditionDeduplicationOptimizer";
import {
    collectSupportedOptionalConditionBranches,
    OptionalConditionPruningParameters,
    pruneOptionalConditionBranches,
    SupportedOptionalConditionBranch
} from "./PruneOptionalConditionBranches";
import { SSSQLFilterBuilder } from "./SSSQLFilterBuilder";
import {
    formatSqlComponent,
    hasSqlComponentFormatOverride,
    SqlComponentFormatOptions
} from "./SqlComponentFormatter";
import { SqlFormatter } from "./SqlFormatter";

export type ConditionOptimizationInput = string | SelectQuery | SimpleSelectQuery;
export type ConditionOptimizationPhaseKind =
    | "sssql_optional_condition"
    | "parameter_condition_placement"
    | "static_predicate_placement"
    | "condition_deduplication";

export interface ConditionOptimizationOptions extends ParameterConditionOptimizationOptions {
    /**
     * Explicit opt-in values for SSSQL optional branch pruning.
     * Only listed parameter names are considered, and only null/undefined values
     * are pruned by the safe-only SSSQL phase.
     */
    optionalConditionParameters?: OptionalConditionPruningParameters;
}

export interface ConditionOptimizationPhaseSummary {
    kind: ConditionOptimizationPhaseKind;
    appliedCount: number;
    skippedCount: number;
    warningCount: number;
    errorCount: number;
}

export type ConditionOptimizationSkipDisposition =
    | "blocked"
    | "unchanged"
    | "ignored";

export interface SssqlOptionalConditionApplied {
    phaseKind: "sssql_optional_condition";
    kind: "prune_optional_branch" | "refresh_optional_branch";
    conditionSql: string;
    parameterName: string;
    reason: string;
    previousConditionSql?: string;
}

export interface SssqlOptionalConditionSkipped {
    phaseKind: "sssql_optional_condition";
    kind: "optional_branch_skipped";
    conditionSql: string;
    parameterName: string;
    code: string;
    reason: string;
    skipDisposition: ConditionOptimizationSkipDisposition;
}

export type ConditionOptimizationApplied =
    | SssqlOptionalConditionApplied
    | (ParameterConditionMove & { phaseKind: "parameter_condition_placement" })
    | (StaticPredicateMove & { phaseKind: "static_predicate_placement" })
    | (ConditionDeduplicationApplied & { phaseKind: "condition_deduplication" });

export type ConditionOptimizationSkipped =
    | SssqlOptionalConditionSkipped
    | (ParameterConditionSkipped & {
        phaseKind: "parameter_condition_placement";
        skipDisposition: ConditionOptimizationSkipDisposition;
    })
    | (StaticPredicateSkipped & {
        phaseKind: "static_predicate_placement";
        skipDisposition: ConditionOptimizationSkipDisposition;
    });

export type ConditionOptimizationWarning =
    | (ParameterConditionOptimizationWarning & { phaseKind: ConditionOptimizationPhaseKind })
    | (StaticPredicatePlacementWarning & { phaseKind: ConditionOptimizationPhaseKind });

export type ConditionOptimizationError =
    | (ParameterConditionOptimizationError & { phaseKind: ConditionOptimizationPhaseKind })
    | (StaticPredicatePlacementError & { phaseKind: ConditionOptimizationPhaseKind });

export interface ConditionOptimizationSafety {
    mode: "safe_only";
    unsafeRewriteApplied: false;
    dryRun: boolean;
    formatterGeneratedSource: boolean;
}

export interface ConditionOptimizationSourceFilterProbe {
    kind: "source_filter_probe";
    source: string;
    sourceAlias: string;
    predicate: string;
    suggestedSql: string;
    reason: string;
}

export interface ConditionOptimizationSkippedProbe {
    kind: "source_filter_probe_skipped";
    source?: string;
    sourceAlias?: string;
    predicate: string;
    code: string;
    reason: string;
}

export interface ConditionOptimizationDiagnostics {
    /**
     * Probe diagnostics are collected after SSSQL optional pruning/refresh and
     * before parameter/static placement phases, so they describe the pre-placement
     * source-filter debugging snapshot rather than the final rewritten query.
     */
    probes: readonly ConditionOptimizationSourceFilterProbe[];
    skippedProbes: readonly ConditionOptimizationSkippedProbe[];
}

export interface ConditionOptimizationResult {
    ok: boolean;
    sql: string;
    query: SelectQuery | null;
    phases: readonly ConditionOptimizationPhaseSummary[];
    applied: readonly ConditionOptimizationApplied[];
    skipped: readonly ConditionOptimizationSkipped[];
    warnings: readonly ConditionOptimizationWarning[];
    errors: readonly ConditionOptimizationError[];
    safety: ConditionOptimizationSafety;
    /** API output shape review: diagnostics is additive; sql/query keep their existing output shape for callers. */
    diagnostics?: ConditionOptimizationDiagnostics;
}

interface ParsedConditionOptimizationInput {
    query: SelectQuery | null;
    sql: string;
    formatterGeneratedSource: boolean;
    warnings: ConditionOptimizationWarning[];
    errors: ConditionOptimizationError[];
}

interface SssqlPhaseResult {
    query: SelectQuery | null;
    sql: string;
    applied: SssqlOptionalConditionApplied[];
    skipped: SssqlOptionalConditionSkipped[];
    warnings: ConditionOptimizationWarning[];
    errors: ConditionOptimizationError[];
    formatterGeneratedSource: boolean;
}

interface JoinSourceBinding {
    source: SourceExpression;
    alias: string;
    matchNames: readonly string[];
    join: JoinClause | null;
    isPrimary: boolean;
}

interface PredicateReferenceAnalysis {
    references: ColumnReference[];
    hasNestedQuery: boolean;
}

const hasOwnParameter = (
    parameters: OptionalConditionPruningParameters,
    parameterName: string
): boolean => Object.prototype.hasOwnProperty.call(parameters, parameterName);

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

const uniqueMatchNames = (names: readonly string[]): string[] => {
    const unique: string[] = [];
    for (const name of names) {
        if (name && !unique.includes(name)) {
            unique.push(name);
        }
    }
    return unique;
};

const getTableSourceTableName = (source: TableSource): string => source.table.name;

const getProbeSourceAlias = (source: SourceExpression): string => {
    if (source.aliasExpression) {
        return source.aliasExpression.table.name;
    }
    if (source.datasource instanceof TableSource) {
        return getTableSourceTableName(source.datasource);
    }
    return source.getAliasName() ?? "";
};

const getProbeSourceMatchNames = (source: SourceExpression): string[] => {
    if (source.aliasExpression) {
        return uniqueMatchNames([source.aliasExpression.table.name]);
    }
    if (source.datasource instanceof TableSource) {
        return uniqueMatchNames([
            getTableSourceTableName(source.datasource),
            source.datasource.getSourceName()
        ]);
    }
    return uniqueMatchNames([source.getAliasName() ?? ""]);
};

const collectJoinSourceBindings = (query: SimpleSelectQuery): JoinSourceBinding[] => {
    if (!query.fromClause) {
        return [];
    }

    const bindings: JoinSourceBinding[] = [{
        source: query.fromClause.source,
        alias: getProbeSourceAlias(query.fromClause.source),
        matchNames: getProbeSourceMatchNames(query.fromClause.source),
        join: null,
        isPrimary: true
    }];

    for (const join of query.fromClause.joins ?? []) {
        bindings.push({
            source: join.source,
            alias: getProbeSourceAlias(join.source),
            matchNames: getProbeSourceMatchNames(join.source),
            join,
            isPrimary: false
        });
    }

    return bindings;
};

const isProbeSafeJoin = (join: JoinClause): boolean => {
    const joinType = join.joinType.value.trim().toLowerCase();
    return joinType === "join" || joinType === "inner join" || joinType === "cross join";
};

const collectPredicateReferences = (expression: ValueComponent): PredicateReferenceAnalysis => {
    const references: ColumnReference[] = [];
    let hasNestedQuery = false;

    const visitSelect = (): void => {
        hasNestedQuery = true;
    };

    const visit = (value: ValueComponent): void => {
        const candidate = unwrapParens(value);
        if (candidate instanceof ColumnReference) {
            references.push(candidate);
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
            visitSelect();
            return;
        }
        if (candidate instanceof ArrayQueryExpression) {
            visitSelect();
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
        if (candidate instanceof ArrayIndexExpression) {
            visit(candidate.array);
            visit(candidate.index);
            return;
        }
        if (candidate instanceof ArraySliceExpression) {
            visit(candidate.array);
            if (candidate.startIndex) {
                visit(candidate.startIndex);
            }
            if (candidate.endIndex) {
                visit(candidate.endIndex);
            }
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
    return { references, hasNestedQuery };
};

const stripAliasFromPredicate = (
    expression: ValueComponent,
    sourceMatchNames: readonly string[],
    options: SqlComponentFormatOptions
): ValueComponent => {
    const sourceNames = uniqueMatchNames(sourceMatchNames);
    return rewriteValueComponentWithColumnResolver(expression, reference =>
        sourceNames.includes(reference.getNamespace())
            ? new ColumnReference(null, reference.column.name)
            : reference
    );
};

const addLowercaseBindingFallback = (
    lowerBindings: Map<string, JoinSourceBinding | null>,
    name: string,
    binding: JoinSourceBinding
): void => {
    const normalized = normalizeIdentifier(name);
    const existing = lowerBindings.get(normalized);
    if (existing === undefined) {
        lowerBindings.set(normalized, binding);
        return;
    }
    if (existing !== binding) {
        lowerBindings.set(normalized, null);
    }
};

const resolveProbeBinding = (
    exactBindings: ReadonlyMap<string, JoinSourceBinding>,
    lowerBindings: ReadonlyMap<string, JoinSourceBinding | null>,
    namespace: string
): JoinSourceBinding | null => {
    const exact = exactBindings.get(namespace);
    if (exact) {
        return exact;
    }
    return lowerBindings.get(normalizeIdentifier(namespace)) ?? null;
};

const formatTableSourceForProbe = (
    source: TableSource,
    options: SqlComponentFormatOptions
): string => {
    return new SqlFormatter({ exportComment: true, ...options.formatOptions }).format(source).formattedSql;
};

const makeSkippedProbe = (
    expression: ValueComponent,
    code: string,
    reason: string,
    options: SqlComponentFormatOptions,
    binding?: JoinSourceBinding
): ConditionOptimizationSkippedProbe => {
    const source = binding?.source.datasource instanceof TableSource
        ? binding.source.datasource.getSourceName()
        : undefined;
    return {
        kind: "source_filter_probe_skipped",
        source,
        sourceAlias: binding?.alias || undefined,
        predicate: formatSqlComponent(expression, options),
        code,
        reason
    };
};

const collectConditionOptimizationDiagnostics = (
    query: SelectQuery | null,
    options: SqlComponentFormatOptions
): ConditionOptimizationDiagnostics => {
    const probes: ConditionOptimizationSourceFilterProbe[] = [];
    const skippedProbes: ConditionOptimizationSkippedProbe[] = [];

    if (!(query instanceof SimpleSelectQuery) || !query.fromClause?.joins || !query.whereClause) {
        return { probes, skippedProbes };
    }

    const bindings = collectJoinSourceBindings(query);
    const bindingsByExactName = new Map<string, JoinSourceBinding>();
    const bindingsByLowerName = new Map<string, JoinSourceBinding | null>();
    for (const binding of bindings) {
        for (const matchName of binding.matchNames) {
            bindingsByExactName.set(matchName, binding);
            addLowercaseBindingFallback(bindingsByLowerName, matchName, binding);
        }
    }

    for (const term of collectTopLevelAndTerms(query.whereClause.condition)) {
        const analysis = collectPredicateReferences(term);
        if (analysis.hasNestedQuery) {
            skippedProbes.push(makeSkippedProbe(
                term,
                "NESTED_QUERY_UNSUPPORTED",
                "Probe metadata skips predicates containing nested queries because source-local execution cannot be represented safely.",
                options
            ));
            continue;
        }
        if (analysis.references.length === 0) {
            continue;
        }

        const namespaces = Array.from(new Set(analysis.references.map(reference => reference.getNamespace())));
        if (namespaces.some(namespace => namespace === "")) {
            skippedProbes.push(makeSkippedProbe(
                term,
                "UNQUALIFIED_COLUMN_REFERENCE",
                "Probe metadata requires qualified column references so the source table is unambiguous.",
                options
            ));
            continue;
        }
        if (namespaces.length !== 1) {
            skippedProbes.push(makeSkippedProbe(
                term,
                "MULTI_SOURCE_PREDICATE",
                "Probe metadata only suggests source filters when the predicate references one joined table.",
                options
            ));
            continue;
        }

        const binding = resolveProbeBinding(bindingsByExactName, bindingsByLowerName, namespaces[0]!);
        if (!binding) {
            skippedProbes.push(makeSkippedProbe(
                term,
                "UNKNOWN_SOURCE_ALIAS",
                `Probe metadata could not match '${namespaces[0]}' to a source in the root FROM clause.`,
                options
            ));
            continue;
        }
        if (binding.isPrimary || !binding.join) {
            continue;
        }
        if (binding.join.lateral) {
            skippedProbes.push(makeSkippedProbe(
                term,
                "LATERAL_SOURCE_UNSUPPORTED",
                "Probe metadata skips lateral join sources because their input can depend on earlier sources.",
                options,
                binding
            ));
            continue;
        }
        if (!isProbeSafeJoin(binding.join)) {
            skippedProbes.push(makeSkippedProbe(
                term,
                "JOIN_TYPE_UNSUPPORTED",
                `Probe metadata skips '${binding.join.joinType.value}' sources because probing the nullable side can mislead debugging.`,
                options,
                binding
            ));
            continue;
        }
        if (binding.source.datasource instanceof SubQuerySource) {
            skippedProbes.push(makeSkippedProbe(
                term,
                "DERIVED_SOURCE_UNSUPPORTED",
                "Probe metadata skips derived table sources until their input query can be represented without implying a rewrite.",
                options,
                binding
            ));
            continue;
        }
        if (!(binding.source.datasource instanceof TableSource)) {
            skippedProbes.push(makeSkippedProbe(
                term,
                "SOURCE_KIND_UNSUPPORTED",
                "Probe metadata currently supports only base table join sources.",
                options,
                binding
            ));
            continue;
        }

        const source = binding.source.datasource.getSourceName();
        const predicate = formatSqlComponent(term, options);
        const sourcePredicate = stripAliasFromPredicate(term, binding.matchNames, options);
        probes.push({
            kind: "source_filter_probe",
            source,
            sourceAlias: binding.alias,
            predicate,
            suggestedSql: `select * from ${formatTableSourceForProbe(binding.source.datasource, options)} where ${formatSqlComponent(sourcePredicate, options)}`,
            reason: "predicate references only this joined table"
        });
    }

    return { probes, skippedProbes };
};

const isAbsentOptionalValue = (
    parameters: OptionalConditionPruningParameters,
    parameterName: string
): boolean => parameters[parameterName] === null || parameters[parameterName] === undefined;

const parseConditionOptimizationInput = (
    input: ConditionOptimizationInput,
    options: ConditionOptimizationOptions
): ParsedConditionOptimizationInput => {
    const warnings: ConditionOptimizationWarning[] = [];
    const errors: ConditionOptimizationError[] = [];
    const sourceSql = typeof input === "string" ? input : formatSqlComponent(input, options);
    const formatterGeneratedSource = typeof input !== "string";

    if (typeof input !== "string" && options.cloneInput === false) {
        return {
            query: input,
            sql: sourceSql,
            formatterGeneratedSource: false,
            warnings,
            errors
        };
    }

    if (formatterGeneratedSource) {
        warnings.push({
            phaseKind: "sssql_optional_condition",
            code: "AST_INPUT_FORMATTED",
            message: "AST input is cloned through formatter output so the caller-owned query is not mutated."
        });
    }

    try {
        return {
            query: SelectQueryParser.parse(sourceSql),
            sql: sourceSql,
            formatterGeneratedSource,
            warnings,
            errors
        };
    } catch (error) {
        errors.push({
            phaseKind: "sssql_optional_condition",
            code: "PARSE_FAILED",
            message: "SSSQL optional condition optimization could not parse the input SQL.",
            detail: error instanceof Error ? error.message : String(error)
        });

        return {
            query: null,
            sql: sourceSql,
            formatterGeneratedSource,
            warnings,
            errors
        };
    }
};

const buildSssqlApplied = (
    branch: SupportedOptionalConditionBranch,
    options: SqlComponentFormatOptions
): SssqlOptionalConditionApplied => {
    return {
        phaseKind: "sssql_optional_condition",
        kind: "prune_optional_branch",
        conditionSql: formatSqlComponent(branch.expression, options),
        parameterName: branch.parameterName,
        reason: "The optional branch parameter is explicitly absent, so the safe-only SSSQL phase pruned the branch."
    };
};

const buildSssqlRefreshApplied = (
    branch: SupportedOptionalConditionBranch,
    previousConditionSql: string,
    options: SqlComponentFormatOptions
): SssqlOptionalConditionApplied => {
    return {
        phaseKind: "sssql_optional_condition",
        kind: "refresh_optional_branch",
        conditionSql: formatSqlComponent(branch.expression, options),
        previousConditionSql,
        parameterName: branch.parameterName,
        reason: "The safe-only SSSQL phase refreshed the optional branch placement before ordinary parameter placement."
    };
};

const buildSssqlSkipped = (
    branch: SupportedOptionalConditionBranch,
    parameters: OptionalConditionPruningParameters,
    options: SqlComponentFormatOptions
): SssqlOptionalConditionSkipped => {
    const parameterProvided = hasOwnParameter(parameters, branch.parameterName);
    return {
        phaseKind: "sssql_optional_condition",
        kind: "optional_branch_skipped",
        conditionSql: formatSqlComponent(branch.expression, options),
        parameterName: branch.parameterName,
        code: parameterProvided
            ? "SSSQL_OPTIONAL_PARAMETER_PRESENT"
            : "SSSQL_OPTIONAL_PARAMETER_NOT_PROVIDED",
        reason: parameterProvided
            ? "The optional branch parameter is present, so the branch remains active."
            : "No optional branch parameter value was provided, so the branch remains unchanged.",
        skipDisposition: parameterProvided ? "unchanged" : "ignored"
    };
};

const buildSssqlRefreshSkipped = (
    branch: SupportedOptionalConditionBranch,
    code: string,
    reason: string,
    skipDisposition: ConditionOptimizationSkipDisposition,
    options: SqlComponentFormatOptions
): SssqlOptionalConditionSkipped => {
    return {
        phaseKind: "sssql_optional_condition",
        kind: "optional_branch_skipped",
        conditionSql: formatSqlComponent(branch.expression, options),
        parameterName: branch.parameterName,
        code,
        reason,
        skipDisposition
    };
};

const buildSssqlRefreshFilters = (
    branches: readonly SupportedOptionalConditionBranch[],
    parameters: OptionalConditionPruningParameters
): OptionalConditionPruningParameters => {
    const filters: OptionalConditionPruningParameters = {};
    for (const branch of branches) {
        filters[branch.parameterName] = hasOwnParameter(parameters, branch.parameterName)
            ? parameters[branch.parameterName]
            : null;
    }
    return filters;
};

const refreshRemainingSssqlBranches = (
    query: SelectQuery,
    fallbackSql: string,
    parameters: OptionalConditionPruningParameters,
    options: SqlComponentFormatOptions
): SssqlPhaseResult => {
    const applied: SssqlOptionalConditionApplied[] = [];
    const skipped: SssqlOptionalConditionSkipped[] = [];

    const beforeBranches = collectSupportedOptionalConditionBranches(query);
    if (beforeBranches.length === 0) {
        return {
            query,
            sql: fallbackSql,
            applied,
            skipped,
            warnings: [],
            errors: [],
            formatterGeneratedSource: false
        };
    }

    const beforeBranchSql = new WeakMap<ValueComponent, string>();
    const beforeBranchQuery = new WeakMap<ValueComponent, SimpleSelectQuery>();
    const parameterCounts = new Map<string, number>();
    for (const branch of beforeBranches) {
        beforeBranchSql.set(branch.expression, formatSqlComponent(branch.expression, options));
        beforeBranchQuery.set(branch.expression, branch.query);
        parameterCounts.set(branch.parameterName, (parameterCounts.get(branch.parameterName) ?? 0) + 1);
    }

    const alreadyReportedExpressions = new WeakSet<ValueComponent>();
    const refreshableBranches: SupportedOptionalConditionBranch[] = [];
    for (const branch of beforeBranches) {
        if ((parameterCounts.get(branch.parameterName) ?? 0) > 1) {
            skipped.push(buildSssqlRefreshSkipped(
                branch,
                "SSSQL_OPTIONAL_REFRESH_DUPLICATE_PARAMETER_UNCHANGED",
                "SSSQL optional branch refresh left this duplicate parameter branch unchanged so each query scope can keep its existing local predicate.",
                "unchanged",
                options
            ));
            alreadyReportedExpressions.add(branch.expression);
            continue;
        }
        refreshableBranches.push(branch);
    }

    for (const branch of refreshableBranches) {
        try {
            new SSSQLFilterBuilder().refresh(query, buildSssqlRefreshFilters([branch], parameters));
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            skipped.push(buildSssqlRefreshSkipped(
                branch,
                "SSSQL_OPTIONAL_REFRESH_UNSUPPORTED",
                `SSSQL optional branch refresh was skipped because safe refresh could not be proven: ${detail}`,
                "blocked",
                options
            ));
            alreadyReportedExpressions.add(branch.expression);
        }
    }

    const afterBranches = collectSupportedOptionalConditionBranches(query);
    for (const branch of afterBranches) {
        if (alreadyReportedExpressions.has(branch.expression)) {
            continue;
        }

        const previousSql = beforeBranchSql.get(branch.expression);
        const previousQuery = beforeBranchQuery.get(branch.expression);
        if (!previousSql || !previousQuery) {
            skipped.push(buildSssqlRefreshSkipped(
                branch,
                "SSSQL_OPTIONAL_REFRESH_UNSUPPORTED",
                "SSSQL optional branch refresh left an untracked branch unchanged.",
                "blocked",
                options
            ));
            continue;
        }

        const refreshedSql = formatSqlComponent(branch.expression, options);
        if (previousQuery !== branch.query || previousSql !== refreshedSql) {
            applied.push(buildSssqlRefreshApplied(branch, previousSql, options));
            continue;
        }

        const parameterProvided = hasOwnParameter(parameters, branch.parameterName);
        skipped.push(buildSssqlRefreshSkipped(
            branch,
            parameterProvided
                ? "SSSQL_OPTIONAL_REFRESH_NOOP"
                : "SSSQL_OPTIONAL_PARAMETER_NOT_PROVIDED",
            parameterProvided
                ? "SSSQL optional branch refresh found no safe placement change to apply."
                : "No optional branch parameter value was provided, so the branch was not a refresh target.",
            parameterProvided ? "unchanged" : "ignored",
            options
        ));
    }

    return {
        query,
        sql: applied.length > 0 || hasSqlComponentFormatOverride(options)
            ? formatSqlComponent(query, options)
            : fallbackSql,
        applied,
        skipped,
        warnings: [],
        errors: [],
        formatterGeneratedSource: false
    };
};

const refreshRemainingSssqlBranchesFromSql = (
    sql: string,
    parameters: OptionalConditionPruningParameters,
    options: ConditionOptimizationOptions
): SssqlPhaseResult => {
    const parsed = parseConditionOptimizationInput(sql, options);
    if (!parsed.query) {
        return {
            query: null,
            sql: parsed.sql,
            applied: [],
            skipped: [],
            warnings: parsed.warnings,
            errors: parsed.errors,
            formatterGeneratedSource: parsed.formatterGeneratedSource
        };
    }

    const refreshed = refreshRemainingSssqlBranches(parsed.query, sql, parameters, options);
    return {
        ...refreshed,
        warnings: [...parsed.warnings, ...refreshed.warnings],
        errors: [...parsed.errors, ...refreshed.errors],
        formatterGeneratedSource: parsed.formatterGeneratedSource || refreshed.formatterGeneratedSource
    };
};

const runSssqlOptionalConditionPhase = (
    input: ConditionOptimizationInput,
    options: ConditionOptimizationOptions
): SssqlPhaseResult => {
    const reuseOwnedModel = options.cloneInput === false && typeof input !== "string";
    const parsed = parseConditionOptimizationInput(input, options);
    const warnings = [...parsed.warnings];
    let errors = [...parsed.errors];
    const applied: SssqlOptionalConditionApplied[] = [];
    const skipped: SssqlOptionalConditionSkipped[] = [];
    const optionalConditionParameters = options.optionalConditionParameters ?? {};

    if (!parsed.query) {
        return {
            query: null,
            sql: parsed.sql,
            applied,
            skipped,
            warnings,
            errors,
            formatterGeneratedSource: parsed.formatterGeneratedSource
        };
    }

    let currentSql = parsed.sql;
    let currentQuery: SelectQuery | null = parsed.query;
    let formatterGeneratedSource = parsed.formatterGeneratedSource;
    const branches = collectSupportedOptionalConditionBranches(parsed.query);
    const pruneBranches = branches.filter(branch =>
        hasOwnParameter(optionalConditionParameters, branch.parameterName)
        && isAbsentOptionalValue(optionalConditionParameters, branch.parameterName)
    );

    if (pruneBranches.length > 0) {
        try {
            pruneOptionalConditionBranches(parsed.query, optionalConditionParameters);
            currentSql = formatSqlComponent(parsed.query, options);
            applied.push(...pruneBranches.map(branch => buildSssqlApplied(branch, options)));
        } catch (error) {
            errors = [...errors, {
                phaseKind: "sssql_optional_condition",
                code: "SSSQL_PRUNE_FAILED",
                message: "SSSQL optional condition optimization could not prune optional branches.",
                detail: error instanceof Error ? error.message : String(error)
            }];
        }
    }

    if (errors.length === 0) {
        const refreshPhase = reuseOwnedModel
            ? refreshRemainingSssqlBranches(parsed.query, currentSql, optionalConditionParameters, options)
            : refreshRemainingSssqlBranchesFromSql(currentSql, optionalConditionParameters, options);
        applied.push(...refreshPhase.applied);
        skipped.push(...refreshPhase.skipped);
        warnings.push(...refreshPhase.warnings);
        errors.push(...refreshPhase.errors);
        currentSql = refreshPhase.sql;
        currentQuery = refreshPhase.query;
        formatterGeneratedSource = formatterGeneratedSource || refreshPhase.formatterGeneratedSource;
    } else {
        for (const branch of branches) {
            if (pruneBranches.includes(branch)) {
                continue;
            }
            skipped.push(buildSssqlSkipped(branch, optionalConditionParameters, options));
        }
    }

    return {
        query: errors.length === 0 ? currentQuery : null,
        sql: errors.length === 0 ? currentSql : parsed.sql,
        applied,
        skipped,
        warnings,
        errors,
        formatterGeneratedSource
    };
};

const mapParameterWarnings = (
    warnings: readonly ParameterConditionOptimizationWarning[]
): ConditionOptimizationWarning[] => warnings.map(warning => ({
    phaseKind: "parameter_condition_placement",
    ...warning
}));

const mapParameterErrors = (
    errors: readonly ParameterConditionOptimizationError[]
): ConditionOptimizationError[] => errors.map(error => ({
    phaseKind: "parameter_condition_placement",
    ...error
}));

const mapParameterApplied = (
    applied: readonly ParameterConditionMove[]
): ConditionOptimizationApplied[] => applied.map(item => ({
    phaseKind: "parameter_condition_placement",
    ...item
}));

const mapParameterSkipped = (
    skipped: readonly ParameterConditionSkipped[]
): ConditionOptimizationSkipped[] => skipped.map(item => ({
    phaseKind: "parameter_condition_placement",
    skipDisposition: "blocked",
    ...item
}));

const mapStaticWarnings = (
    warnings: readonly StaticPredicatePlacementWarning[]
): ConditionOptimizationWarning[] => warnings.map(warning => ({
    phaseKind: "static_predicate_placement",
    ...warning
}));

const mapStaticErrors = (
    errors: readonly StaticPredicatePlacementError[]
): ConditionOptimizationError[] => errors.map(error => ({
    phaseKind: "static_predicate_placement",
    ...error
}));

const mapStaticApplied = (
    applied: readonly StaticPredicateMove[]
): ConditionOptimizationApplied[] => applied.map(item => ({
    phaseKind: "static_predicate_placement",
    ...item
}));

const mapStaticSkipped = (
    skipped: readonly StaticPredicateSkipped[]
): ConditionOptimizationSkipped[] => skipped.map(item => ({
    phaseKind: "static_predicate_placement",
    skipDisposition: "blocked",
    ...item
}));

const mapConditionDeduplicationApplied = (
    applied: readonly ConditionDeduplicationApplied[]
): ConditionOptimizationApplied[] => applied.map(item => ({
    phaseKind: "condition_deduplication",
    ...item
}));

const makePhaseSummary = (
    kind: ConditionOptimizationPhaseKind,
    counts: {
        appliedCount: number;
        skippedCount: number;
        warningCount: number;
        errorCount: number;
    }
): ConditionOptimizationPhaseSummary => ({
    kind,
    appliedCount: counts.appliedCount,
    skippedCount: counts.skippedCount,
    warningCount: counts.warningCount,
    errorCount: counts.errorCount
});

const runConditionOptimization = (
    input: ConditionOptimizationInput,
    options: ConditionOptimizationOptions,
    defaultDryRun: boolean
): ConditionOptimizationResult => {
    const dryRun = options.dryRun ?? defaultDryRun;
    const reuseOwnedModel = options.cloneInput === false && typeof input !== "string";

    // Run semantic SSSQL handling before generic placement phases so optional
    // branches remain owned by SSSQL even if later phases grow broader support.
    const sssqlPhase = runSssqlOptionalConditionPhase(input, { ...options, dryRun });
    const diagnostics = collectConditionOptimizationDiagnostics(sssqlPhase.query, options);
    const parameterOptimizer = new ParameterConditionPlacementOptimizer();
    const parameterInput = reuseOwnedModel
        ? sssqlPhase.query ?? sssqlPhase.sql
        : sssqlPhase.sql;
    const parameterOptions = {
        ...options,
        dryRun,
        cloneInput: reuseOwnedModel && sssqlPhase.query ? false : options.cloneInput
    };
    const parameterPhase = dryRun
        ? parameterOptimizer.plan(parameterInput, parameterOptions)
        : parameterOptimizer.optimize(parameterInput, parameterOptions);
    const parameterWarnings = mapParameterWarnings(parameterPhase.warnings);
    const parameterErrors = mapParameterErrors(parameterPhase.errors);
    const parameterApplied = mapParameterApplied(parameterPhase.applied);
    const parameterSkipped = mapParameterSkipped(parameterPhase.skipped);
    const staticOptimizer = new StaticPredicatePlacementOptimizer();
    const staticInput = reuseOwnedModel
        ? parameterPhase.query ?? parameterPhase.sql
        : parameterPhase.sql;
    const staticOptions = {
        ...options,
        dryRun,
        cloneInput: reuseOwnedModel && parameterPhase.query ? false : options.cloneInput
    };
    const staticPhase = dryRun
        ? staticOptimizer.plan(staticInput, staticOptions)
        : staticOptimizer.optimize(staticInput, staticOptions);
    const staticWarnings = mapStaticWarnings(staticPhase.warnings);
    const staticErrors = mapStaticErrors(staticPhase.errors);
    const staticApplied = mapStaticApplied(staticPhase.applied);
    const staticSkipped = mapStaticSkipped(staticPhase.skipped);
    const warnings = [...sssqlPhase.warnings, ...parameterWarnings, ...staticWarnings];
    const errors = [...sssqlPhase.errors, ...parameterErrors, ...staticErrors];
    const dedupePhase = errors.length === 0
        ? new ConditionDeduplicationOptimizer().optimize(staticPhase.query, options)
        : { query: staticPhase.query, applied: [] };
    const dedupeApplied = mapConditionDeduplicationApplied(dedupePhase.applied);
    const finalSql = dedupePhase.applied.length > 0 && dedupePhase.query
        ? formatSqlComponent(dedupePhase.query, options)
        : staticPhase.sql;

    return {
        ok: errors.length === 0,
        sql: finalSql,
        query: dedupePhase.query,
        phases: [
            makePhaseSummary("sssql_optional_condition", {
                appliedCount: sssqlPhase.applied.length,
                skippedCount: sssqlPhase.skipped.length,
                warningCount: sssqlPhase.warnings.length,
                errorCount: sssqlPhase.errors.length
            }),
            makePhaseSummary("parameter_condition_placement", {
                appliedCount: parameterApplied.length,
                skippedCount: parameterSkipped.length,
                warningCount: parameterWarnings.length,
                errorCount: parameterErrors.length
            }),
            makePhaseSummary("static_predicate_placement", {
                appliedCount: staticApplied.length,
                skippedCount: staticSkipped.length,
                warningCount: staticWarnings.length,
                errorCount: staticErrors.length
            }),
            makePhaseSummary("condition_deduplication", {
                appliedCount: dedupeApplied.length,
                skippedCount: 0,
                warningCount: 0,
                errorCount: 0
            })
        ],
        applied: [...sssqlPhase.applied, ...parameterApplied, ...staticApplied, ...dedupeApplied],
        skipped: [...sssqlPhase.skipped, ...parameterSkipped, ...staticSkipped],
        warnings,
        errors,
        safety: {
            mode: "safe_only",
            unsafeRewriteApplied: false,
            dryRun,
            formatterGeneratedSource: sssqlPhase.formatterGeneratedSource
                || parameterPhase.safety.formatterGeneratedSource
                || staticPhase.safety.formatterGeneratedSource
        },
        diagnostics
    };
};

export const planConditionOptimization = (
    input: ConditionOptimizationInput,
    options: ConditionOptimizationOptions = {}
): ConditionOptimizationResult => {
    return runConditionOptimization(input, options, true);
};

export const optimizeConditions = (
    input: ConditionOptimizationInput,
    options: ConditionOptimizationOptions = {}
): ConditionOptimizationResult => {
    return runConditionOptimization(input, options, false);
};
