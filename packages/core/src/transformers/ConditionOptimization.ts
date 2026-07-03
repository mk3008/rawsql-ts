import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { ValueComponent } from "../models/ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import {
    optimizeParameterConditionPlacement,
    ParameterConditionMove,
    ParameterConditionOptimizationError,
    ParameterConditionOptimizationOptions,
    ParameterConditionOptimizationWarning,
    ParameterConditionSkipped,
    planParameterConditionOptimization
} from "./ParameterConditionPlacementOptimizer";
import {
    optimizeStaticPredicatePlacement,
    planStaticPredicatePlacement,
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
import { formatSqlComponent } from "./SqlComponentFormatter";

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
}

export type ConditionOptimizationApplied =
    | SssqlOptionalConditionApplied
    | (ParameterConditionMove & { phaseKind: "parameter_condition_placement" })
    | (StaticPredicateMove & { phaseKind: "static_predicate_placement" });

export type ConditionOptimizationSkipped =
    | SssqlOptionalConditionSkipped
    | (ParameterConditionSkipped & { phaseKind: "parameter_condition_placement" })
    | (StaticPredicateSkipped & { phaseKind: "static_predicate_placement" });

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
    input: ConditionOptimizationInput
): ParsedConditionOptimizationInput => {
    const warnings: ConditionOptimizationWarning[] = [];
    const errors: ConditionOptimizationError[] = [];
    const sourceSql = typeof input === "string" ? input : formatSqlComponent(input);
    const formatterGeneratedSource = typeof input !== "string";

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
    branch: SupportedOptionalConditionBranch
): SssqlOptionalConditionApplied => {
    return {
        phaseKind: "sssql_optional_condition",
        kind: "prune_optional_branch",
        conditionSql: formatSqlComponent(branch.expression),
        parameterName: branch.parameterName,
        reason: "The optional branch parameter is explicitly absent, so the safe-only SSSQL phase pruned the branch."
    };
};

const buildSssqlRefreshApplied = (
    branch: SupportedOptionalConditionBranch,
    previousConditionSql: string
): SssqlOptionalConditionApplied => {
    return {
        phaseKind: "sssql_optional_condition",
        kind: "refresh_optional_branch",
        conditionSql: formatSqlComponent(branch.expression),
        previousConditionSql,
        parameterName: branch.parameterName,
        reason: "The safe-only SSSQL phase refreshed the optional branch placement before ordinary parameter placement."
    };
};

const buildSssqlSkipped = (
    branch: SupportedOptionalConditionBranch,
    parameters: OptionalConditionPruningParameters
): SssqlOptionalConditionSkipped => {
    const parameterProvided = hasOwnParameter(parameters, branch.parameterName);
    return {
        phaseKind: "sssql_optional_condition",
        kind: "optional_branch_skipped",
        conditionSql: formatSqlComponent(branch.expression),
        parameterName: branch.parameterName,
        code: parameterProvided
            ? "SSSQL_OPTIONAL_PARAMETER_PRESENT"
            : "SSSQL_OPTIONAL_PARAMETER_NOT_PROVIDED",
        reason: parameterProvided
            ? "The optional branch parameter is present, so the branch remains active."
            : "No optional branch parameter value was provided, so the branch remains unchanged."
    };
};

const buildSssqlRefreshSkipped = (
    branch: SupportedOptionalConditionBranch,
    code: string,
    reason: string
): SssqlOptionalConditionSkipped => {
    return {
        phaseKind: "sssql_optional_condition",
        kind: "optional_branch_skipped",
        conditionSql: formatSqlComponent(branch.expression),
        parameterName: branch.parameterName,
        code,
        reason
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
    sql: string,
    parameters: OptionalConditionPruningParameters
): SssqlPhaseResult => {
    const parsed = parseConditionOptimizationInput(sql);
    const applied: SssqlOptionalConditionApplied[] = [];
    const skipped: SssqlOptionalConditionSkipped[] = [];

    if (!parsed.query) {
        return {
            sql: parsed.sql,
            applied,
            skipped,
            warnings: parsed.warnings,
            errors: parsed.errors,
            formatterGeneratedSource: parsed.formatterGeneratedSource
        };
    }

    const beforeBranches = collectSupportedOptionalConditionBranches(parsed.query);
    if (beforeBranches.length === 0) {
        return {
            sql: parsed.sql,
            applied,
            skipped,
            warnings: parsed.warnings,
            errors: parsed.errors,
            formatterGeneratedSource: parsed.formatterGeneratedSource
        };
    }

    const beforeBranchSql = new WeakMap<ValueComponent, string>();
    const beforeBranchQuery = new WeakMap<ValueComponent, SimpleSelectQuery>();
    for (const branch of beforeBranches) {
        beforeBranchSql.set(branch.expression, formatSqlComponent(branch.expression));
        beforeBranchQuery.set(branch.expression, branch.query);
    }

    try {
        new SSSQLFilterBuilder().refresh(parsed.query, buildSssqlRefreshFilters(beforeBranches, parameters));
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return {
            sql,
            applied,
            skipped: beforeBranches.map(branch => buildSssqlRefreshSkipped(
                branch,
                "SSSQL_OPTIONAL_REFRESH_UNSUPPORTED",
                `SSSQL optional branch refresh was skipped because safe refresh could not be proven: ${detail}`
            )),
            warnings: parsed.warnings,
            errors: parsed.errors,
            formatterGeneratedSource: parsed.formatterGeneratedSource
        };
    }

    const afterBranches = collectSupportedOptionalConditionBranches(parsed.query);
    for (const branch of afterBranches) {
        const previousSql = beforeBranchSql.get(branch.expression);
        const previousQuery = beforeBranchQuery.get(branch.expression);
        if (!previousSql || !previousQuery) {
            skipped.push(buildSssqlRefreshSkipped(
                branch,
                "SSSQL_OPTIONAL_REFRESH_UNSUPPORTED",
                "SSSQL optional branch refresh left an untracked branch unchanged."
            ));
            continue;
        }

        const refreshedSql = formatSqlComponent(branch.expression);
        if (previousQuery !== branch.query || previousSql !== refreshedSql) {
            applied.push(buildSssqlRefreshApplied(branch, previousSql));
            continue;
        }

        skipped.push(buildSssqlRefreshSkipped(
            branch,
            "SSSQL_OPTIONAL_REFRESH_NOOP",
            "SSSQL optional branch refresh found no safe placement change to apply."
        ));
    }

    return {
        sql: applied.length > 0 ? formatSqlComponent(parsed.query) : sql,
        applied,
        skipped,
        warnings: parsed.warnings,
        errors: parsed.errors,
        formatterGeneratedSource: parsed.formatterGeneratedSource
    };
};

const runSssqlOptionalConditionPhase = (
    input: ConditionOptimizationInput,
    options: ConditionOptimizationOptions
): SssqlPhaseResult => {
    const parsed = parseConditionOptimizationInput(input);
    const warnings = [...parsed.warnings];
    let errors = [...parsed.errors];
    const applied: SssqlOptionalConditionApplied[] = [];
    const skipped: SssqlOptionalConditionSkipped[] = [];
    const optionalConditionParameters = options.optionalConditionParameters ?? {};

    if (!parsed.query) {
        return {
            sql: parsed.sql,
            applied,
            skipped,
            warnings,
            errors,
            formatterGeneratedSource: parsed.formatterGeneratedSource
        };
    }

    let currentSql = parsed.sql;
    const branches = collectSupportedOptionalConditionBranches(parsed.query);
    const pruneBranches = branches.filter(branch =>
        hasOwnParameter(optionalConditionParameters, branch.parameterName)
        && isAbsentOptionalValue(optionalConditionParameters, branch.parameterName)
    );

    if (pruneBranches.length > 0) {
        try {
            pruneOptionalConditionBranches(parsed.query, optionalConditionParameters);
            currentSql = formatSqlComponent(parsed.query);
            applied.push(...pruneBranches.map(buildSssqlApplied));
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
        const refreshPhase = refreshRemainingSssqlBranches(currentSql, optionalConditionParameters);
        applied.push(...refreshPhase.applied);
        skipped.push(...refreshPhase.skipped);
        warnings.push(...refreshPhase.warnings);
        errors.push(...refreshPhase.errors);
        currentSql = refreshPhase.sql;
    } else {
        for (const branch of branches) {
            if (pruneBranches.includes(branch)) {
                continue;
            }
            skipped.push(buildSssqlSkipped(branch, optionalConditionParameters));
        }
    }

    return {
        sql: errors.length === 0 ? currentSql : parsed.sql,
        applied,
        skipped,
        warnings,
        errors,
        formatterGeneratedSource: parsed.formatterGeneratedSource
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

    // Run semantic SSSQL handling before generic placement phases so optional
    // branches remain owned by SSSQL even if later phases grow broader support.
    const sssqlPhase = runSssqlOptionalConditionPhase(input, { ...options, dryRun });
    const parameterPhase = dryRun
        ? planParameterConditionOptimization(sssqlPhase.sql, { dryRun })
        : optimizeParameterConditionPlacement(sssqlPhase.sql, { dryRun });
    const parameterWarnings = mapParameterWarnings(parameterPhase.warnings);
    const parameterErrors = mapParameterErrors(parameterPhase.errors);
    const parameterApplied = mapParameterApplied(parameterPhase.applied);
    const parameterSkipped = mapParameterSkipped(parameterPhase.skipped);
    const staticPhase = dryRun
        ? planStaticPredicatePlacement(parameterPhase.sql, { dryRun })
        : optimizeStaticPredicatePlacement(parameterPhase.sql, { dryRun });
    const staticWarnings = mapStaticWarnings(staticPhase.warnings);
    const staticErrors = mapStaticErrors(staticPhase.errors);
    const staticApplied = mapStaticApplied(staticPhase.applied);
    const staticSkipped = mapStaticSkipped(staticPhase.skipped);
    const warnings = [...sssqlPhase.warnings, ...parameterWarnings, ...staticWarnings];
    const errors = [...sssqlPhase.errors, ...parameterErrors, ...staticErrors];

    return {
        ok: errors.length === 0,
        sql: staticPhase.sql,
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
