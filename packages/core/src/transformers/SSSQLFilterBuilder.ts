import { WhereClause, type SourceExpression, SubQuerySource, TableSource } from "../models/Clause";
import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import {
    BinaryExpression,
    ColumnReference,
    IdentifierString,
    InlineQuery,
    LiteralValue,
    ParameterExpression,
    ParenExpression,
    RawString,
    UnaryExpression,
    type ValueComponent
} from "../models/ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { UpstreamSelectQueryFinder } from "./UpstreamSelectQueryFinder";
import { ColumnReferenceCollector } from "./ColumnReferenceCollector";
import { SelectableColumnCollector, DuplicateDetectionMode } from "./SelectableColumnCollector";
import { ParameterCollector } from "./ParameterCollector";
import { SqlFormatter } from "./SqlFormatter";
import { CTECollector } from "./CTECollector";
import {
    collectSupportedOptionalConditionBranches,
    type SupportedOptionalConditionBranch
} from "./PruneOptionalConditionBranches";

export type SSSQLFilterValue = unknown;
export type SSSQLFilterInput = Record<string, SSSQLFilterValue>;
export type SssqlScaffoldFilters = SSSQLFilterInput;
export type SssqlScalarOperator = "=" | "<>" | "<" | "<=" | ">" | ">=" | "like" | "ilike";
export type SssqlScalarOperatorInput = SssqlScalarOperator | "!=";
export type SssqlBranchKind = "scalar" | "exists" | "not-exists" | "expression";

export interface SssqlTransformResult {
    query: SelectQuery;
}

export interface SssqlBranchInfo {
    parameterName: string;
    kind: SssqlBranchKind;
    operator?: SssqlScalarOperator;
    target?: string;
    query: SimpleSelectQuery;
    expression: ValueComponent;
    sql: string;
}

export interface SssqlScalarScaffoldSpec {
    kind?: "scalar";
    target: string;
    parameterName?: string;
    operator?: SssqlScalarOperatorInput;
}

export interface SssqlExistsScaffoldSpec {
    kind: "exists" | "not-exists";
    parameterName: string;
    query: string;
    anchorColumns: string[];
}

export type SssqlScaffoldSpec = SssqlScalarScaffoldSpec | SssqlExistsScaffoldSpec;

export interface SssqlRemoveSpec {
    parameterName: string;
    kind?: SssqlBranchKind;
    operator?: SssqlScalarOperatorInput;
    target?: string;
}

interface ResolvedFilterTarget {
    query: SimpleSelectQuery;
    column: ColumnReference;
    parameterName: string;
}

interface ParsedFilterName {
    table: string;
    column: string;
}

interface ExistsPredicateDetails {
    kind: "exists" | "not-exists";
    subquery: SelectQuery;
}

interface CorrelatedAnchorReference {
    namespace: string;
    column: string;
}

interface CorrelatedRefreshPlan {
    target: ResolvedFilterTarget;
    sourceAlias: string;
}

const formatter = new SqlFormatter();
const SUPPORTED_SCALAR_OPERATORS = new Set<SssqlScalarOperator>(["=", "<>", "<", "<=", ">", ">=", "like", "ilike"]);

const normalizeIdentifier = (value: string): string => value.trim().toLowerCase();

const normalizeSql = (value: string): string => value.replace(/\s+/g, " ").trim().toLowerCase();

const normalizeColumnReferenceKey = (reference: ColumnReference): string => {
    return `${normalizeIdentifier(reference.getNamespace())}.${normalizeIdentifier(reference.column.name)}`;
};

const normalizeColumnReferenceText = (reference: ColumnReference): string => {
    const namespace = reference.getNamespace();
    return namespace ? `${namespace}.${reference.column.name}` : reference.column.name;
};

const normalizeScalarOperator = (value: SssqlScalarOperatorInput | undefined): SssqlScalarOperator => {
    if (!value) {
        return "=";
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "!=") {
        return "<>";
    }
    if (SUPPORTED_SCALAR_OPERATORS.has(normalized as SssqlScalarOperator)) {
        return normalized as SssqlScalarOperator;
    }

    throw new Error(`Unsupported SSSQL operator '${value}'.`);
};

const isExplicitEqualityScaffoldValue = (value: unknown): boolean => {
    if (value === null || value === undefined) {
        return true;
    }

    if (Array.isArray(value)) {
        return false;
    }

    if (typeof value !== "object") {
        return true;
    }

    const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined);
    return entries.length === 1 && entries[0]?.[0] === "=";
};

const parseQualifiedFilterName = (filterName: string): ParsedFilterName | null => {
    const segments = filterName.split(".");
    if (segments.length !== 2) {
        return null;
    }

    const [table, column] = segments.map(segment => segment.trim());
    if (!table || !column) {
        return null;
    }

    return { table, column };
};

const makeParameterName = (filterName: string): string => {
    return filterName
        .trim()
        .replace(/\./g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "_");
};

const unwrapParens = (expression: ValueComponent): ValueComponent => {
    let candidate = expression;
    while (candidate instanceof ParenExpression) {
        candidate = candidate.expression;
    }
    return candidate;
};

const isBinaryOperator = (expression: ValueComponent, operator: string): expression is BinaryExpression => {
    return expression instanceof BinaryExpression && expression.operator.value.trim().toLowerCase() === operator;
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

const collectTopLevelOrTerms = (expression: ValueComponent): ValueComponent[] => {
    const candidate = unwrapParens(expression);
    if (!isBinaryOperator(candidate, "or")) {
        return [expression];
    }

    return [
        ...collectTopLevelOrTerms(candidate.left),
        ...collectTopLevelOrTerms(candidate.right)
    ];
};

const getGuardedParameterName = (expression: ValueComponent): string | null => {
    const candidate = unwrapParens(expression);
    if (!isBinaryOperator(candidate, "is")) {
        return null;
    }

    if (!(candidate.left instanceof ParameterExpression)) {
        return null;
    }

    const right = unwrapParens(candidate.right);
    const isNull = (right instanceof LiteralValue && right.value === null)
        || (right instanceof RawString && right.value.trim().toLowerCase() === "null");
    if (!isNull) {
        return null;
    }

    return candidate.left.name.value;
};

const buildOptionalScalarBranch = (
    column: ColumnReference,
    parameterName: string,
    operator: SssqlScalarOperator
): ValueComponent => {
    const guard = new BinaryExpression(new ParameterExpression(parameterName), "is", new LiteralValue(null));
    const predicate = new BinaryExpression(
        new ColumnReference(column.getNamespace() || null, column.column.name),
        operator,
        new ParameterExpression(parameterName)
    );
    return new ParenExpression(new BinaryExpression(guard, "or", predicate));
};

const buildOptionalExistsBranch = (
    parameterName: string,
    subquery: SelectQuery,
    kind: "exists" | "not-exists"
): ValueComponent => {
    const guard = new BinaryExpression(new ParameterExpression(parameterName), "is", new LiteralValue(null));
    const existsExpression = new UnaryExpression("exists", new InlineQuery(subquery));
    const predicate = kind === "exists"
        ? existsExpression
        : new UnaryExpression("not", existsExpression);

    return new ParenExpression(new BinaryExpression(guard, "or", predicate));
};

const rebuildWhereWithoutTerm = (query: SimpleSelectQuery, termToRemove: ValueComponent): void => {
    if (!query.whereClause) {
        return;
    }

    const terms = collectTopLevelAndTerms(query.whereClause.condition).filter(term => term !== termToRemove);
    if (terms.length === 0) {
        query.whereClause = null;
        return;
    }

    let rebuilt = terms[0]!;
    for (let index = 1; index < terms.length; index += 1) {
        rebuilt = new BinaryExpression(rebuilt, "and", terms[index]!);
    }

    query.whereClause = new WhereClause(rebuilt);
};

const formatSqlComponent = (component: ValueComponent | SelectQuery): string => {
    return formatter.format(component).formattedSql;
};

const enforceSubqueryConstraints = (sql: string): void => {
    if (!sql.trim()) {
        throw new Error("SSSQL EXISTS/NOT EXISTS scaffold query must not be empty.");
    }
    if (sql.includes(";")) {
        throw new Error("SSSQL EXISTS/NOT EXISTS scaffold query must not contain semicolons or multiple statements.");
    }
    if (/\blateral\b/i.test(sql)) {
        throw new Error("LATERAL is not supported in SSSQL EXISTS/NOT EXISTS scaffold.");
    }
};

const substituteAnchorPlaceholders = (sql: string, formattedColumns: string[]): string => {
    const usedIndexes = new Set<number>();
    const replaced = sql.replace(/\$c(\d+)/g, (_, indexDigits) => {
        const index = Number(indexDigits);
        if (!Number.isInteger(index)) {
            throw new Error(`Invalid placeholder '$c${indexDigits}' in SSSQL scaffold query.`);
        }
        if (index < 0 || index >= formattedColumns.length) {
            throw new Error(`Placeholder '$c${index}' references a missing SSSQL scaffold anchor column.`);
        }
        usedIndexes.add(index);
        return formattedColumns[index]!;
    });

    if (formattedColumns.length === 0) {
        return replaced;
    }

    for (let index = 0; index < formattedColumns.length; index += 1) {
        if (!usedIndexes.has(index)) {
            throw new Error(`Missing placeholder '$c${index}' for SSSQL scaffold anchor column.`);
        }
    }

    return replaced;
};

const getScalarBranchDetails = (
    expression: ValueComponent,
    parameterName: string
): { operator: SssqlScalarOperator; target: string } | null => {
    const meaningfulTerms = collectTopLevelOrTerms(expression)
        .filter(term => getGuardedParameterName(term) !== parameterName);

    if (meaningfulTerms.length !== 1) {
        return null;
    }

    const predicate = unwrapParens(meaningfulTerms[0]!);
    if (!(predicate instanceof BinaryExpression)) {
        return null;
    }

    const left = unwrapParens(predicate.left);
    const right = unwrapParens(predicate.right);

    if (left instanceof ColumnReference && right instanceof ParameterExpression && right.name.value === parameterName) {
        try {
            return {
                operator: normalizeScalarOperator(predicate.operator.value as SssqlScalarOperatorInput),
                target: normalizeColumnReferenceText(left)
            };
        } catch {
            return null;
        }
    }

    if (right instanceof ColumnReference && left instanceof ParameterExpression && left.name.value === parameterName) {
        try {
            return {
                operator: normalizeScalarOperator(predicate.operator.value as SssqlScalarOperatorInput),
                target: normalizeColumnReferenceText(right)
            };
        } catch {
            return null;
        }
    }

    return null;
};

const hasSelectQuery = (value: unknown): value is { selectQuery: SelectQuery } => {
    return typeof value === "object" && value !== null && "selectQuery" in value;
};

const collectColumnReferencesDeep = (value: unknown): ColumnReference[] => {
    const references: ColumnReference[] = [];
    const visited = new WeakSet<object>();

    const walk = (candidate: unknown): void => {
        if (!candidate || typeof candidate !== "object") {
            return;
        }

        if (candidate instanceof ColumnReference) {
            references.push(candidate);
            return;
        }

        if (visited.has(candidate)) {
            return;
        }
        visited.add(candidate);

        if (Array.isArray(candidate)) {
            for (const item of candidate) {
                walk(item);
            }
            return;
        }

        for (const child of Object.values(candidate as Record<string, unknown>)) {
            walk(child);
        }
    };

    walk(value);
    return references;
};

const getExistsBranchKind = (
    expression: ValueComponent,
    parameterName: string
): "exists" | "not-exists" | null => {
    const meaningfulTerms = collectTopLevelOrTerms(expression)
        .filter(term => getGuardedParameterName(term) !== parameterName);

    if (meaningfulTerms.length !== 1) {
        return null;
    }

    const predicate = unwrapParens(meaningfulTerms[0]!);
    const isInlineQueryValue = (value: ValueComponent): value is InlineQuery => {
        return value instanceof InlineQuery || hasSelectQuery(value);
    };

    if (predicate instanceof UnaryExpression && predicate.operator.value.trim().toLowerCase() === "exists") {
        return isInlineQueryValue(unwrapParens(predicate.expression)) ? "exists" : null;
    }

    if (predicate instanceof UnaryExpression && predicate.operator.value.trim().toLowerCase() === "not exists") {
        return isInlineQueryValue(unwrapParens(predicate.expression)) ? "not-exists" : null;
    }

    if (
        predicate instanceof UnaryExpression &&
        predicate.operator.value.trim().toLowerCase() === "not" &&
        unwrapParens(predicate.expression) instanceof UnaryExpression
    ) {
        const nested = unwrapParens(predicate.expression) as UnaryExpression;
        if (
            nested.operator.value.trim().toLowerCase() === "exists"
            && isInlineQueryValue(unwrapParens(nested.expression))
        ) {
            return "not-exists";
        }
    }

    return null;
};

const getExistsPredicateDetails = (
    expression: ValueComponent,
    parameterName: string
): ExistsPredicateDetails | null => {
    const meaningfulTerms = collectTopLevelOrTerms(expression)
        .filter(term => getGuardedParameterName(term) !== parameterName);

    if (meaningfulTerms.length !== 1) {
        return null;
    }

    const predicate = unwrapParens(meaningfulTerms[0]!);
    const isInlineQueryValue = (value: ValueComponent): value is InlineQuery => {
        return value instanceof InlineQuery || hasSelectQuery(value);
    };

    if (predicate instanceof UnaryExpression && predicate.operator.value.trim().toLowerCase() === "exists") {
        const candidate = unwrapParens(predicate.expression);
        if (isInlineQueryValue(candidate)) {
            return {
                kind: "exists",
                subquery: candidate.selectQuery
            };
        }
        return null;
    }

    if (predicate instanceof UnaryExpression && predicate.operator.value.trim().toLowerCase() === "not exists") {
        const candidate = unwrapParens(predicate.expression);
        if (isInlineQueryValue(candidate)) {
            return {
                kind: "not-exists",
                subquery: candidate.selectQuery
            };
        }
        return null;
    }

    if (
        predicate instanceof UnaryExpression &&
        predicate.operator.value.trim().toLowerCase() === "not" &&
        unwrapParens(predicate.expression) instanceof UnaryExpression
    ) {
        const nested = unwrapParens(predicate.expression) as UnaryExpression;
        const candidate = unwrapParens(nested.expression);
        if (nested.operator.value.trim().toLowerCase() === "exists" && isInlineQueryValue(candidate)) {
            return {
                kind: "not-exists",
                subquery: candidate.selectQuery
            };
        }
    }

    return null;
};

const getBranchInfo = (branch: SupportedOptionalConditionBranch): SssqlBranchInfo => {
    const scalar = getScalarBranchDetails(branch.expression, branch.parameterName);
    if (scalar) {
        return {
            parameterName: branch.parameterName,
            kind: "scalar",
            operator: scalar.operator,
            target: scalar.target,
            query: branch.query,
            expression: branch.expression,
            sql: formatSqlComponent(branch.expression)
        };
    }

    const existsKind = getExistsBranchKind(branch.expression, branch.parameterName);
    if (existsKind) {
        return {
            parameterName: branch.parameterName,
            kind: existsKind,
            query: branch.query,
            expression: branch.expression,
            sql: formatSqlComponent(branch.expression)
        };
    }

    return {
        parameterName: branch.parameterName,
        kind: "expression",
        query: branch.query,
        expression: branch.expression,
        sql: formatSqlComponent(branch.expression)
    };
};

/**
 * Builds and refreshes truthful SSSQL optional filter branches.
 * Runtime callers should use pruning, not dynamic predicate injection.
 */
export class SSSQLFilterBuilder {
    private readonly finder: UpstreamSelectQueryFinder;

    constructor(private readonly tableColumnResolver?: (tableName: string) => string[]) {
        this.finder = new UpstreamSelectQueryFinder(this.tableColumnResolver);
    }

    list(query: SelectQuery | string): SssqlBranchInfo[] {
        const parsed = this.parseQuery(query);
        return collectSupportedOptionalConditionBranches(parsed).map(getBranchInfo);
    }

    scaffold(query: SelectQuery | string, filters: SSSQLFilterInput): SelectQuery {
        const parsed = this.parseQuery(query);

        for (const [filterName, filterValue] of Object.entries(filters)) {
            if (!isExplicitEqualityScaffoldValue(filterValue)) {
                throw new Error(
                    `SSSQL scaffold only supports equality filters in v1. Use structured scaffold or refresh for pre-authored branches: '${filterName}'.`
                );
            }

            this.scaffoldBranch(parsed, {
                target: filterName,
                parameterName: makeParameterName(filterName),
                operator: "="
            });
        }

        return parsed;
    }

    scaffoldBranch(query: SelectQuery | string, spec: SssqlScaffoldSpec): SelectQuery {
        const parsed = this.parseQuery(query);

        if (spec.kind === "exists" || spec.kind === "not-exists") {
            this.scaffoldExistsBranch(parsed, spec as SssqlExistsScaffoldSpec);
            return parsed;
        }

        this.scaffoldScalarBranch(parsed, spec as SssqlScalarScaffoldSpec);
        return parsed;
    }

    refresh(query: SelectQuery | string, filters: SSSQLFilterInput): SelectQuery {
        const parsed = this.parseQuery(query);

        for (const [filterName, filterValue] of Object.entries(filters)) {
            let parameterName = filterName;
            let target: ResolvedFilterTarget | null = null;
            let matches = collectSupportedOptionalConditionBranches(parsed)
                .filter(branch => branch.parameterName === parameterName);

            if (matches.length === 0) {
                target = this.resolveTarget(parsed, filterName);
                parameterName = target.parameterName;
                matches = collectSupportedOptionalConditionBranches(parsed)
                    .filter(branch => branch.parameterName === parameterName);
            }

            if (matches.length === 0) {
                if (!target) {
                    target = this.resolveTarget(parsed, filterName);
                    parameterName = target.parameterName;
                }
                if (!isExplicitEqualityScaffoldValue(filterValue)) {
                    throw new Error(
                        `No existing SSSQL branch was found for '${filterName}', and v1 scaffold only supports equality filters.`
                    );
                }

                this.scaffoldScalarBranch(parsed, {
                    target: filterName,
                    parameterName: target.parameterName,
                    operator: "="
                });
                continue;
            }

            if (matches.length > 1) {
                throw new Error(`Multiple SSSQL branches matched parameter ':${parameterName}'. Refresh is ambiguous.`);
            }

            const [match] = matches;
            if (!match) {
                continue;
            }

            const correlatedPlan = this.buildCorrelatedRefreshPlan(parsed, match);
            if (correlatedPlan) {
                if (correlatedPlan.target.query === match.query) {
                    continue;
                }

                this.rebaseMovedBranchByAlias(match.expression, correlatedPlan.sourceAlias, correlatedPlan.target.column);
                rebuildWhereWithoutTerm(match.query, match.expression);
                correlatedPlan.target.query.appendWhere(match.expression);
                continue;
            }

            if (!target) {
                target = this.resolveTarget(parsed, filterName);
            }
            if (match.query !== target.query) {
                this.rebaseMovedBranch(match.expression, match.query, target.column);
                rebuildWhereWithoutTerm(match.query, match.expression);
                target.query.appendWhere(match.expression);
            }
        }

        return parsed;
    }

    remove(query: SelectQuery | string, spec: SssqlRemoveSpec): SelectQuery {
        const parsed = this.parseQuery(query);
        const matches = this.findMatchingBranchInfos(parsed, spec);

        if (matches.length === 0) {
            return parsed;
        }

        if (matches.length > 1) {
            throw new Error(`Multiple SSSQL branches matched parameter ':${spec.parameterName}'. Remove is ambiguous.`);
        }

        const [match] = matches;
        if (!match) {
            return parsed;
        }

        rebuildWhereWithoutTerm(match.query, match.expression);
        return parsed;
    }

    removeAll(query: SelectQuery | string): SelectQuery {
        const parsed = this.parseQuery(query);
        const matches = this.list(parsed);

        for (const match of matches) {
            rebuildWhereWithoutTerm(match.query, match.expression);
        }

        return parsed;
    }

    private parseQuery(query: SelectQuery | string): SelectQuery {
        return typeof query === "string" ? SelectQueryParser.parse(query) : query;
    }

    private findMatchingBranchInfos(root: SelectQuery, spec: SssqlRemoveSpec): SssqlBranchInfo[] {
        const normalizedOperator = spec.operator ? normalizeScalarOperator(spec.operator) : undefined;
        const normalizedTarget = spec.target ? normalizeIdentifier(spec.target) : undefined;

        return this.list(root).filter(branch => {
            if (branch.parameterName !== spec.parameterName) {
                return false;
            }
            if (spec.kind && branch.kind !== spec.kind) {
                return false;
            }
            if (normalizedOperator && branch.operator !== normalizedOperator) {
                return false;
            }
            if (normalizedTarget && (!branch.target || normalizeIdentifier(branch.target) !== normalizedTarget)) {
                return false;
            }
            return true;
        });
    }

    private scaffoldScalarBranch(root: SelectQuery, spec: SssqlScalarScaffoldSpec): void {
        const target = this.resolveTarget(root, spec.target);
        const parameterName = spec.parameterName?.trim() || target.parameterName;
        const operator = normalizeScalarOperator(spec.operator);
        const branch = buildOptionalScalarBranch(target.column, parameterName, operator);
        const branchSql = normalizeSql(formatSqlComponent(branch));

        const duplicate = this.list(root).find(existing =>
            existing.query === target.query &&
            normalizeSql(existing.sql) === branchSql
        );
        if (duplicate) {
            return;
        }

        target.query.appendWhere(branch);
    }

    private scaffoldExistsBranch(root: SelectQuery, spec: SssqlExistsScaffoldSpec): void {
        const parameterName = spec.parameterName.trim();
        if (!parameterName) {
            throw new Error("SSSQL EXISTS/NOT EXISTS scaffold requires parameterName.");
        }
        if (spec.anchorColumns.length === 0) {
            throw new Error("SSSQL EXISTS/NOT EXISTS scaffold requires at least one anchorColumn.");
        }

        const anchorTargets = spec.anchorColumns.map(anchorColumn => this.resolveTarget(root, anchorColumn));
        const targetQueries = [...new Set(anchorTargets.map(target => target.query))];
        if (targetQueries.length !== 1) {
            throw new Error("SSSQL EXISTS/NOT EXISTS scaffold anchor columns must resolve within one query scope.");
        }

        const targetQuery = targetQueries[0]!;
        const formattedColumns = anchorTargets.map(target => formatSqlComponent(target.column));
        const substitutedSql = substituteAnchorPlaceholders(spec.query, formattedColumns).trim();
        enforceSubqueryConstraints(substitutedSql);

        const subquery = SelectQueryParser.parse(substitutedSql);
        const parameterNames = new Set(ParameterCollector.collect(subquery).map(parameter => parameter.name.value));
        if (parameterNames.size !== 1 || !parameterNames.has(parameterName)) {
            throw new Error(
                `SSSQL ${spec.kind.toUpperCase()} scaffold query must reference only parameter ':${parameterName}'.`
            );
        }

        const branch = buildOptionalExistsBranch(parameterName, subquery, spec.kind);
        const branchSql = normalizeSql(formatSqlComponent(branch));
        const duplicate = this.list(root).find(existing =>
            existing.query === targetQuery &&
            normalizeSql(existing.sql) === branchSql
        );
        if (duplicate) {
            return;
        }

        targetQuery.appendWhere(branch);
    }

    private resolveTarget(root: SelectQuery, filterName: string): ResolvedFilterTarget {
        const qualified = parseQualifiedFilterName(filterName);
        const lookupColumn = qualified?.column ?? filterName.trim();
        const candidateQueries = [...new Set(this.finder.find(root, lookupColumn))];

        const matches = candidateQueries
            .map(query => this.resolveTargetInQuery(query, filterName, qualified))
            .filter((target): target is ResolvedFilterTarget => target !== null);

        if (matches.length === 0) {
            throw new Error(`Could not resolve SSSQL filter target '${filterName}' in the current query graph.`);
        }

        if (matches.length > 1) {
            throw new Error(`SSSQL filter target '${filterName}' is ambiguous across multiple query scopes.`);
        }

        return matches[0]!;
    }

    private resolveTargetInQuery(
        query: SimpleSelectQuery,
        filterName: string,
        qualified: ParsedFilterName | null
    ): ResolvedFilterTarget | null {
        if (qualified) {
            return this.resolveQualifiedTarget(query, qualified);
        }

        return this.resolveUnqualifiedTarget(query, filterName);
    }

    private resolveQualifiedTarget(query: SimpleSelectQuery, filterName: ParsedFilterName): ResolvedFilterTarget | null {
        const alias = this.findAliasForTable(query, filterName.table);
        if (!alias) {
            return null;
        }

        const collector = new SelectableColumnCollector(
            this.tableColumnResolver,
            false,
            DuplicateDetectionMode.FullName,
            { upstream: true }
        );

        const matches = collector.collect(query)
            .filter((entry): entry is { name: string; value: ColumnReference } => entry.value instanceof ColumnReference)
            .filter(entry => normalizeColumnReferenceKey(entry.value) === `${normalizeIdentifier(alias)}.${normalizeIdentifier(filterName.column)}`);

        if (matches.length === 0) {
            return null;
        }

        if (matches.length > 1) {
            throw new Error(`SSSQL scaffold target '${filterName.table}.${filterName.column}' resolved to multiple columns.`);
        }

        return {
            query,
            column: matches[0]!.value,
            parameterName: makeParameterName(`${filterName.table}.${filterName.column}`)
        };
    }

    private resolveUnqualifiedTarget(query: SimpleSelectQuery, filterName: string): ResolvedFilterTarget | null {
        const collector = new SelectableColumnCollector(
            this.tableColumnResolver,
            false,
            DuplicateDetectionMode.FullName,
            { upstream: true }
        );

        const matches = collector.collect(query)
            .filter((entry): entry is { name: string; value: ColumnReference } => entry.value instanceof ColumnReference)
            .filter(entry => normalizeIdentifier(entry.name) === normalizeIdentifier(filterName));

        if (matches.length === 0) {
            return null;
        }

        if (matches.length > 1) {
            throw new Error(`SSSQL scaffold target '${filterName}' is ambiguous. Use a qualified table.column reference.`);
        }

        return {
            query,
            column: matches[0]!.value,
            parameterName: makeParameterName(filterName)
        };
    }

    private findAliasForTable(query: SimpleSelectQuery, tableName: string): string | null {
        const normalizedTable = normalizeIdentifier(tableName);
        const sources = query.fromClause?.getSources() ?? [];
        const matchingAliases = sources
            .map(source => this.resolveAliasForSource(source, normalizedTable))
            .filter((alias): alias is string => alias !== null);

        if (matchingAliases.length === 0) {
            return null;
        }

        if (matchingAliases.length > 1) {
            throw new Error(`SSSQL scaffold target table '${tableName}' is ambiguous in the selected query scope.`);
        }

        return matchingAliases[0]!;
    }

    private resolveAliasForSource(source: SourceExpression, normalizedTable: string): string | null {
        if (!(source.datasource instanceof TableSource)) {
            return null;
        }

        const sourceName = normalizeIdentifier(source.datasource.getSourceName());
        const shortName = normalizeIdentifier(source.datasource.table.name);
        if (sourceName !== normalizedTable && shortName !== normalizedTable) {
            return null;
        }

        return source.getAliasName() ?? source.datasource.table.name;
    }

    private buildCorrelatedRefreshPlan(
        root: SelectQuery,
        branch: SupportedOptionalConditionBranch
    ): CorrelatedRefreshPlan | null {
        const details = getExistsPredicateDetails(branch.expression, branch.parameterName);
        if (!details) {
            return null;
        }

        const sourceAliases = this.collectSourceAliases(branch.query);
        const candidatesByKey = new Map<string, CorrelatedAnchorReference>();

        for (const reference of new ColumnReferenceCollector().collect(details.subquery)) {
            const namespace = normalizeIdentifier(reference.getNamespace());
            if (!namespace || !sourceAliases.has(namespace)) {
                continue;
            }

            const column = normalizeIdentifier(reference.column.name);
            const key = `${namespace}.${column}`;
            if (!candidatesByKey.has(key)) {
                candidatesByKey.set(key, { namespace, column });
            }
        }

        const candidates = [...candidatesByKey.values()];
        if (candidates.length === 0) {
            throw new Error(
                `SSSQL refresh could not infer a correlated anchor for ':${branch.parameterName}'.`
            );
        }
        if (candidates.length > 1) {
            const listed = candidates.map(candidate => `${candidate.namespace}.${candidate.column}`).join(", ");
            throw new Error(
                `SSSQL refresh found multiple correlated anchor candidates for ':${branch.parameterName}' (${listed}).`
            );
        }

        const [anchor] = candidates;
        if (!anchor) {
            throw new Error(
                `SSSQL refresh could not infer a correlated anchor for ':${branch.parameterName}'.`
            );
        }

        return {
            target: this.resolveCorrelatedAnchorTarget(root, branch.query, anchor, branch.parameterName),
            sourceAlias: anchor.namespace
        };
    }

    private collectSourceAliases(query: SimpleSelectQuery): Set<string> {
        const aliases = new Set<string>();
        for (const source of query.fromClause?.getSources() ?? []) {
            const sourceAlias = this.getSourceAlias(source);
            if (sourceAlias) {
                aliases.add(sourceAlias);
            }
        }
        return aliases;
    }

    private resolveCorrelatedAnchorTarget(
        root: SelectQuery,
        sourceQuery: SimpleSelectQuery,
        anchor: CorrelatedAnchorReference,
        parameterName: string
    ): ResolvedFilterTarget {
        const sourceExpression = this.findSourceExpressionByAlias(sourceQuery, anchor.namespace, parameterName);
        const upstreamQuery = this.resolveSourceExpressionToUpstreamQuery(root, sourceExpression, parameterName);
        if (!upstreamQuery) {
            return {
                query: sourceQuery,
                column: new ColumnReference(anchor.namespace, anchor.column),
                parameterName
            };
        }

        return this.resolveAnchorTargetInQuery(upstreamQuery, anchor, parameterName);
    }

    private findSourceExpressionByAlias(
        query: SimpleSelectQuery,
        alias: string,
        parameterName: string
    ): SourceExpression {
        const matches = (query.fromClause?.getSources() ?? [])
            .filter(source => this.getSourceAlias(source) === alias);

        if (matches.length === 0) {
            throw new Error(
                `SSSQL refresh could not resolve correlated alias '${alias}' for ':${parameterName}'.`
            );
        }
        if (matches.length > 1) {
            throw new Error(
                `SSSQL refresh found multiple correlated sources for alias '${alias}' and ':${parameterName}'.`
            );
        }

        return matches[0]!;
    }

    private resolveSourceExpressionToUpstreamQuery(
        root: SelectQuery,
        source: SourceExpression,
        parameterName: string
    ): SimpleSelectQuery | null {
        if (source.datasource instanceof SubQuerySource) {
            if (source.datasource.query instanceof SimpleSelectQuery) {
                return source.datasource.query;
            }
            throw new Error(
                `SSSQL refresh requires a simple query anchor for ':${parameterName}'.`
            );
        }

        if (!(source.datasource instanceof TableSource)) {
            return null;
        }

        const cteName = normalizeIdentifier(source.datasource.table.name);
        const cteMatches = new CTECollector()
            .collect(root)
            .filter(cte => normalizeIdentifier(cte.getSourceAliasName()) === cteName);

        if (cteMatches.length === 0) {
            return null;
        }
        if (cteMatches.length > 1) {
            throw new Error(
                `SSSQL refresh found multiple CTE anchors for ':${parameterName}' (${source.datasource.table.name}).`
            );
        }

        const [cte] = cteMatches;
        if (!cte) {
            return null;
        }

        const cteQuery = cte.query as unknown;
        if (!(cteQuery instanceof SimpleSelectQuery)) {
            throw new Error(
                `SSSQL refresh requires a simple CTE anchor for ':${parameterName}'.`
            );
        }

        return cteQuery;
    }

    private resolveAnchorTargetInQuery(
        query: SimpleSelectQuery,
        anchor: CorrelatedAnchorReference,
        parameterName: string
    ): ResolvedFilterTarget {
        const collector = new SelectableColumnCollector(
            this.tableColumnResolver,
            false,
            DuplicateDetectionMode.FullName,
            { upstream: true }
        );

        const matches = collector.collect(query)
            .filter((entry): entry is { name: string; value: ColumnReference } => entry.value instanceof ColumnReference)
            .filter(entry => normalizeIdentifier(entry.name) === anchor.column);

        if (matches.length === 0) {
            throw new Error(
                `SSSQL refresh could not resolve correlated anchor column '${anchor.column}' for ':${parameterName}'.`
            );
        }
        if (matches.length > 1) {
            throw new Error(
                `SSSQL refresh found multiple correlated anchor columns '${anchor.column}' for ':${parameterName}'.`
            );
        }

        return {
            query,
            column: matches[0]!.value,
            parameterName
        };
    }

    private getSourceAlias(source: SourceExpression): string | null {
        const explicitAlias = source.getAliasName();
        if (explicitAlias) {
            return normalizeIdentifier(explicitAlias);
        }

        if (source.datasource instanceof TableSource) {
            return normalizeIdentifier(source.datasource.table.name);
        }

        return null;
    }

    private rebaseMovedBranch(
        expression: ValueComponent,
        sourceQuery: SimpleSelectQuery,
        targetColumn: ColumnReference
    ): void {
        const targetNamespace = targetColumn.qualifiedName.namespaces
            ? targetColumn.qualifiedName.namespaces.map(namespace => namespace.name)
            : null;
        const targetColumnName = normalizeIdentifier(targetColumn.column.name);
        const sourceAliases = new Set(
            collectColumnReferencesDeep(expression)
                .filter(reference => normalizeIdentifier(reference.column.name) === targetColumnName)
                .map(reference => normalizeIdentifier(reference.getNamespace()))
                .filter(namespace => namespace.length > 0)
        );

        if (sourceAliases.size === 0) {
            return;
        }

        if (sourceAliases.size > 1) {
            const aliases = [...sourceAliases].join(", ");
            throw new Error(
                `SSSQL refresh cannot safely rebase '${targetColumn.column.name}' across multiple aliases (${aliases}).`
            );
        }

        const [sourceAlias] = [...sourceAliases];
        const availableAliases = new Set(
            (sourceQuery.fromClause?.getSources() ?? [])
                .map(source => source.getAliasName())
                .filter((alias): alias is string => typeof alias === "string")
                .map(alias => normalizeIdentifier(alias))
        );

        if (!availableAliases.has(sourceAlias)) {
            return;
        }

        for (const reference of collectColumnReferencesDeep(expression)) {
            if (normalizeIdentifier(reference.getNamespace()) !== sourceAlias) {
                continue;
            }

            reference.qualifiedName.namespaces = targetNamespace?.map(namespace => new IdentifierString(namespace)) ?? null;
        }
    }

    private rebaseMovedBranchByAlias(
        expression: ValueComponent,
        sourceAlias: string,
        targetColumn: ColumnReference
    ): void {
        const normalizedSourceAlias = normalizeIdentifier(sourceAlias);
        if (!normalizedSourceAlias) {
            return;
        }

        const targetNamespace = targetColumn.qualifiedName.namespaces
            ? targetColumn.qualifiedName.namespaces.map(namespace => namespace.name)
            : null;

        for (const reference of collectColumnReferencesDeep(expression)) {
            if (normalizeIdentifier(reference.getNamespace()) !== normalizedSourceAlias) {
                continue;
            }

            reference.qualifiedName.namespaces = targetNamespace?.map(namespace => new IdentifierString(namespace)) ?? null;
        }
    }
}

export type { SupportedOptionalConditionBranch };

export const scaffoldSssqlQuery = (
    sqlContent: string,
    filters: SssqlScaffoldFilters
): SssqlTransformResult => ({
    query: new SSSQLFilterBuilder().scaffold(sqlContent, filters)
});

export const refreshSssqlQuery = (
    sqlContent: string,
    filters: SssqlScaffoldFilters
): SssqlTransformResult => ({
    query: new SSSQLFilterBuilder().refresh(sqlContent, filters)
});
