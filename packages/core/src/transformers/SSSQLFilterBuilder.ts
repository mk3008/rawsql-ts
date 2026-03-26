import { WhereClause, type SourceExpression, TableSource } from "../models/Clause";
import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import {
    BinaryExpression,
    ColumnReference,
    IdentifierString,
    LiteralValue,
    ParameterExpression,
    ParenExpression,
    type ValueComponent
} from "../models/ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { UpstreamSelectQueryFinder } from "./UpstreamSelectQueryFinder";
import { SelectableColumnCollector, DuplicateDetectionMode } from "./SelectableColumnCollector";
import { ColumnReferenceCollector } from "./ColumnReferenceCollector";
import {
    collectSupportedOptionalConditionBranches,
    type SupportedOptionalConditionBranch
} from "./PruneOptionalConditionBranches";

export type SSSQLFilterValue = unknown;
export type SSSQLFilterInput = Record<string, SSSQLFilterValue>;
export type SssqlScaffoldFilters = SSSQLFilterInput;

export interface SssqlTransformResult {
    query: SelectQuery;
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

const normalizeIdentifier = (value: string): string => value.trim().toLowerCase();

const normalizeColumnReferenceKey = (reference: ColumnReference): string => {
    return `${normalizeIdentifier(reference.getNamespace())}.${normalizeIdentifier(reference.column.name)}`;
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

const buildOptionalEqualityBranch = (column: ColumnReference, parameterName: string): ValueComponent => {
    const parameter = new ParameterExpression(parameterName);
    const guard = new BinaryExpression(new ParameterExpression(parameterName), "is", new LiteralValue(null));
    const equality = new BinaryExpression(
        new ColumnReference(column.getNamespace() || null, column.column.name),
        "=",
        parameter
    );
    return new ParenExpression(new BinaryExpression(guard, "or", equality));
};

const rebuildWhereWithoutTerm = (query: SimpleSelectQuery, termToRemove: ValueComponent): void => {
    if (!query.whereClause) {
        return;
    }

    const collectTopLevelAndTerms = (expression: ValueComponent): ValueComponent[] => {
        if (
            expression instanceof BinaryExpression &&
            expression.operator.value.trim().toLowerCase() === "and"
        ) {
            return [
                ...collectTopLevelAndTerms(expression.left),
                ...collectTopLevelAndTerms(expression.right)
            ];
        }

        return [expression];
    };

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

/**
 * Builds and refreshes truthful SSSQL optional filter branches.
 * Runtime callers should use pruning, not dynamic predicate injection.
 */
export class SSSQLFilterBuilder {
    private readonly finder: UpstreamSelectQueryFinder;

    constructor(private readonly tableColumnResolver?: (tableName: string) => string[]) {
        this.finder = new UpstreamSelectQueryFinder(this.tableColumnResolver);
    }

    scaffold(query: SelectQuery | string, filters: SSSQLFilterInput): SelectQuery {
        const parsed = this.parseQuery(query);

        for (const [filterName, filterValue] of Object.entries(filters)) {
            if (!isExplicitEqualityScaffoldValue(filterValue)) {
                throw new Error(
                    `SSSQL scaffold only supports equality filters in v1. Use refresh for pre-authored branches: '${filterName}'.`
                );
            }

            const target = this.resolveTarget(parsed, filterName);
            target.query.appendWhere(buildOptionalEqualityBranch(target.column, target.parameterName));
        }

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

                target.query.appendWhere(buildOptionalEqualityBranch(target.column, target.parameterName));
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

    private parseQuery(query: SelectQuery | string): SelectQuery {
        return typeof query === "string" ? SelectQueryParser.parse(query) : query;
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
