import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { ValueComponent } from "../models/ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
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

export type ConditionOptimizationInput = string | SelectQuery | SimpleSelectQuery;
export type ConditionOptimizationPhaseKind =
    | "sssql_optional_condition"
    | "parameter_condition_placement"
    | "static_predicate_placement";

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
    | (StaticPredicateMove & { phaseKind: "static_predicate_placement" });

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

const hasOwnParameter = (
    parameters: OptionalConditionPruningParameters,
    parameterName: string
): boolean => Object.prototype.hasOwnProperty.call(parameters, parameterName);

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
        skipDisposition: "ignored"
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

    return {
        ok: errors.length === 0,
        sql: staticPhase.sql,
        query: staticPhase.query,
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
            })
        ],
        applied: [...sssqlPhase.applied, ...parameterApplied, ...staticApplied],
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
        }
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
