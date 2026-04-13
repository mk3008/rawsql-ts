import { WhereClause, type SourceExpression, TableSource } from "../models/Clause";
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
import { SelectableColumnCollector, DuplicateDetectionMode } from "./SelectableColumnCollector";
import { ColumnReferenceCollector } from "./ColumnReferenceCollector";
import { ParameterCollector } from "./ParameterCollector";
import { SqlFormatter } from "./SqlFormatter";
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

    const operator = normalizeScalarOperator(predicate.operator.value as SssqlScalarOperatorInput);
    const left = unwrapParens(predicate.left);
    const right = unwrapParens(predicate.right);

    if (left instanceof ColumnReference && right instanceof ParameterExpression && right.name.value === parameterName) {
        return {
            operator,
            target: normalizeColumnReferenceText(left)
        };
    }

    if (right instanceof ColumnReference && left instanceof ParameterExpression && left.name.value === parameterName) {
        return {
            operator,
            target: normalizeColumnReferenceText(right)
        };
    }

    return null;
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
    if (predicate instanceof UnaryExpression && predicate.operator.value.trim().toLowerCase() === "exists") {
        return predicate.expression instanceof InlineQuery ? "exists" : null;
    }

    if (
        predicate instanceof UnaryExpression &&
        predicate.operator.value.trim().toLowerCase() === "not" &&
        unwrapParens(predicate.expression) instanceof UnaryExpression
    ) {
        const nested = unwrapParens(predicate.expression) as UnaryExpression;
        if (nested.operator.value.trim().toLowerCase() === "exists" && nested.expression instanceof InlineQuery) {
            return "not-exists";
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
            const target = this.resolveTarget(parsed, filterName);
            const matches = collectSupportedOptionalConditionBranches(parsed)
                .filter(branch => branch.parameterName === target.parameterName);

            if (matches.length === 0) {
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
                throw new Error(`Multiple SSSQL branches matched parameter ':${target.parameterName}'. Refresh is ambiguous.`);
            }

            const [match] = matches;
            if (!match) {
                continue;
            }

            if (match.query === target.query) {
                continue;
            }

            this.rebaseMovedBranch(match.expression, match.query, target.column);
            rebuildWhereWithoutTerm(match.query, match.expression);
            target.query.appendWhere(match.expression);
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
            new ColumnReferenceCollector()
                .collect(expression)
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

        for (const reference of new ColumnReferenceCollector().collect(expression)) {
            if (normalizeIdentifier(reference.getNamespace()) !== sourceAlias) {
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
