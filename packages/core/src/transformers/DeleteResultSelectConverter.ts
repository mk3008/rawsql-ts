import {
    CommonTable,
    FromClause,
    JoinClause,
    ReturningClause,
    SelectClause,
    SelectItem,
    SourceExpression,
    TableSource,
    UsingClause,
    WithClause
} from '../models/Clause';
import { DeleteQuery } from '../models/DeleteQuery';
import { SimpleSelectQuery, SelectQuery } from '../models/SelectQuery';
import { ColumnReference, FunctionCall, RawString } from '../models/ValueComponent';
import {
    TableDefinitionModel,
    TableDefinitionRegistry
} from '../models/TableDefinitionModel';
import { TableSourceCollector } from './TableSourceCollector';
import { FixtureCteBuilder, FixtureTableDefinition } from './FixtureCteBuilder';
import { SelectQueryWithClauseHelper } from '../utils/SelectQueryWithClauseHelper';
import { rewriteValueComponentWithColumnResolver } from '../utils/ValueComponentRewriter';
import type { MissingFixtureStrategy } from './InsertResultSelectConverter';
import { FullNameParser } from '../parsers/FullNameParser';

/** Options that control how DELETE-to-SELECT conversion resolves metadata and fixtures. */
export interface DeleteResultSelectOptions {
    /** Optional registry keyed by table name (matching the target table name case). */
    tableDefinitions?: TableDefinitionRegistry;
    /** Optional callback that resolves metadata by table name (useful for schemified targets). */
    tableDefinitionResolver?: (tableName: string) => TableDefinitionModel | undefined;
    /** Optional fixtures that should shadow real tables inside the generated SELECT. */
    fixtureTables?: FixtureTableDefinition[];
    /** Strategy for how missing fixtures should be tolerated. */
    missingFixtureStrategy?: MissingFixtureStrategy;
}

interface TableAliasContext {
    alias: string;
    tableName: string;
    tableDefinition?: TableDefinitionModel;
}

interface ReturningContext {
    targetAlias: string | null;
    targetDefinition?: TableDefinitionModel;
    aliasMap: Map<string, TableAliasContext>;
    tableNameMap: Map<string, TableAliasContext>;
}

interface ParsedReturningColumn {
    namespaces: string[] | null;
    column: string;
}

export class DeleteResultSelectConverter {
    private static readonly DEFAULT_MISSING_FIXTURE_STRATEGY: MissingFixtureStrategy = 'error';

    /**
     * Converts a DELETE (with optional RETURNING) into a SELECT that mirrors its output rows.
     */
    public static toSelectQuery(deleteQuery: DeleteQuery, options?: DeleteResultSelectOptions): SimpleSelectQuery {
        const targetTableName = this.extractTargetTableName(deleteQuery.deleteClause);
        const tableDefinition = this.resolveTableDefinition(targetTableName, options);
        const targetAlias = deleteQuery.deleteClause.getSourceAliasName();

        // Build the SELECT structure that mirrors the DELETE source/join semantics.
        const returningContext = deleteQuery.returningClause
            ? this.buildReturningContext(deleteQuery.deleteClause, deleteQuery.usingClause, targetAlias, tableDefinition, options)
            : null;
        const selectClause = deleteQuery.returningClause
            ? this.buildReturningSelectClause(deleteQuery.returningClause, returningContext!)
            : this.buildCountSelectClause();
        const fromClause = this.buildFromClause(deleteQuery.deleteClause, deleteQuery.usingClause);
        const whereClause = deleteQuery.whereClause ?? null;

        const selectQuery = new SimpleSelectQuery({
            withClause: deleteQuery.withClause ?? undefined,
            selectClause,
            fromClause,
            whereClause
        });

        // Ensure fixture coverage before weaving CTEs back into the SELECT.
        const fixtureTables = options?.fixtureTables ?? [];
        const fixtureMap = this.buildFixtureTableMap(fixtureTables);
        const missingStrategy = options?.missingFixtureStrategy ?? this.DEFAULT_MISSING_FIXTURE_STRATEGY;

        const originalWithClause = SelectQueryWithClauseHelper.detachWithClause(selectQuery);
        this.ensureFixtureCoverage(selectQuery, fixtureMap, missingStrategy, originalWithClause);

        const fixtureCtes = this.buildFixtureCtes(fixtureTables);
        const mergedWithClause = this.mergeWithClause(originalWithClause, fixtureCtes);
        SelectQueryWithClauseHelper.setWithClause(selectQuery, mergedWithClause);

        return selectQuery;
    }

    private static buildReturningSelectClause(
        returning: ReturningClause,
        context: ReturningContext
    ): SelectClause {
        const selectItems = this.buildReturningSelectItems(returning, context);
        return new SelectClause(selectItems);
    }

    private static buildReturningSelectItems(
        returning: ReturningClause,
        context: ReturningContext
    ): SelectItem[] {
        // Build SELECT entries from RETURNING items, expanding wildcards before expression rewriting.
        const selectItems: SelectItem[] = [];
        for (const item of returning.items) {
            if (this.isWildcardReturningItem(item)) {
                selectItems.push(...this.expandReturningWildcard(context));
                continue;
            }
            selectItems.push(this.buildDeleteReturningSelectItem(item, context));
        }
        return selectItems;
    }

    private static isWildcardReturningItem(item: SelectItem): boolean {
        return (
            item.value instanceof ColumnReference &&
            item.value.column.name === '*'
        );
    }

    private static expandReturningWildcard(context: ReturningContext): SelectItem[] {
        if (!context.targetDefinition) {
            throw new Error('Cannot expand RETURNING * without table definition.');
        }
        return context.targetDefinition.columns.map((column) => {
            const expression = this.composeDeleteColumnReference(
                { namespaces: null, column: column.name },
                context
            );
            return new SelectItem(expression, column.name);
        });
    }

    private static buildDeleteReturningSelectItem(item: SelectItem, context: ReturningContext): SelectItem {
        const expression = rewriteValueComponentWithColumnResolver(item.value, (column) =>
            this.buildDeleteColumnReference(column, context)
        );
        const alias = this.getReturningAlias(item);
        return new SelectItem(expression, alias);
    }

    private static buildDeleteColumnReference(column: ColumnReference, context: ReturningContext): ColumnReference {
        const parsed = this.parseReturningColumnName(column.toString());
        return this.composeDeleteColumnReference(parsed, context);
    }

    private static composeDeleteColumnReference(
        parsedColumn: ParsedReturningColumn,
        context: ReturningContext
    ): ColumnReference {
        const tableContext = this.findTableContextForNamespaces(parsedColumn.namespaces, context);
        const definitionToValidate =
            tableContext?.tableDefinition ??
            (parsedColumn.namespaces ? undefined : context.targetDefinition);
        if (definitionToValidate) {
            this.ensureColumnExists(parsedColumn.column, definitionToValidate);
        }
        const columnNamespace =
            parsedColumn.namespaces && parsedColumn.namespaces.length > 0
                ? [...parsedColumn.namespaces]
                : context.targetAlias
                    ? [context.targetAlias]
                    : null;
        return new ColumnReference(columnNamespace, parsedColumn.column);
    }

    private static getReturningAlias(item: SelectItem): string | null {
        if (item.identifier?.name) {
            return item.identifier.name;
        }
        if (item.value instanceof ColumnReference) {
            return item.value.toString();
        }
        return null;
    }

    private static buildCountSelectClause(): SelectClause {
        // Count rows when no RETURNING clause is present.
        const countFunction = new FunctionCall(null, 'count', new RawString('*'), null);
        const selectItem = new SelectItem(countFunction, 'count');
        return new SelectClause([selectItem]);
    }

    private static buildFromClause(deleteClause: DeleteQuery['deleteClause'], usingClause: UsingClause | null): FromClause {
        if (!usingClause?.sources?.length) {
            return new FromClause(deleteClause.source, null);
        }

        // Cross join each USING source so their columns remain available for predicates.
        const joins: JoinClause[] = usingClause.sources.map((source) =>
            new JoinClause('cross join', source, null, false)
        );
        return new FromClause(deleteClause.source, joins);
    }

    private static buildReturningContext(
        deleteClause: DeleteQuery['deleteClause'],
        usingClause: UsingClause | null,
        targetAlias: string | null,
        targetDefinition: TableDefinitionModel | undefined,
        options?: DeleteResultSelectOptions
    ): ReturningContext {
        const { aliasMap, tableNameMap } = this.buildTableContexts(deleteClause, usingClause, options);
        return {
            aliasMap,
            tableNameMap,
            targetAlias,
            targetDefinition
        };
    }

    private static buildTableContexts(
        deleteClause: DeleteQuery['deleteClause'],
        usingClause: UsingClause | null,
        options?: DeleteResultSelectOptions
    ): { aliasMap: Map<string, TableAliasContext>; tableNameMap: Map<string, TableAliasContext> } {
        const aliasMap = new Map<string, TableAliasContext>();
        const tableNameMap = new Map<string, TableAliasContext>();

        // Capture alias and table name contexts to resolve metadata for both identifiers.
        const collectSource = (source: SourceExpression): void => {
            const alias = source.getAliasName();
            if (!alias || !(source.datasource instanceof TableSource)) {
                return;
            }
            const normalizedAlias = this.normalizeIdentifier(alias);
            if (aliasMap.has(normalizedAlias)) {
                return;
            }
            const tableName = source.datasource.getSourceName();
            const tableDefinition = this.resolveTableDefinition(tableName, options);
            const context: TableAliasContext = {
                alias,
                tableName,
                tableDefinition
            };
            aliasMap.set(normalizedAlias, context);
            const normalizedTableName = this.normalizeIdentifier(tableName);
            if (!tableNameMap.has(normalizedTableName)) {
                tableNameMap.set(normalizedTableName, context);
            }
        };

        collectSource(deleteClause.source);
        if (usingClause) {
            for (const source of usingClause.sources) {
                collectSource(source);
            }
        }

        return { aliasMap, tableNameMap };
    }

    private static parseReturningColumnName(columnName: string): ParsedReturningColumn {
        const trimmed = columnName.trim();
        if (!trimmed) {
            throw new Error('Returning column name cannot be empty.');
        }
        try {
            const parsed = FullNameParser.parse(trimmed);
            return {
                namespaces: parsed.namespaces,
                column: parsed.name.name
            };
        } catch {
            const parts = trimmed.split('.').map((segment) => segment.trim()).filter((segment) => segment.length > 0);
            if (parts.length === 0) {
                return { namespaces: null, column: trimmed };
            }
            const column = parts.pop()!;
            return {
                namespaces: parts.length > 0 ? parts : null,
                column
            };
        }
    }

    private static findTableContextForNamespaces(
        namespaces: string[] | null,
        context: ReturningContext
    ): TableAliasContext | undefined {
        if (!namespaces?.length) {
            return undefined;
        }
        for (let depth = namespaces.length; depth > 0; depth--) {
            const candidateParts = namespaces.slice(namespaces.length - depth);
            const identifier = candidateParts.join('.');
            const normalized = this.normalizeIdentifier(identifier);
            const aliasContext = context.aliasMap.get(normalized);
            if (aliasContext) {
                return aliasContext;
            }
            const tableContext = context.tableNameMap.get(normalized);
            if (tableContext) {
                return tableContext;
            }
        }
        return undefined;
    }

    private static ensureColumnExists(columnName: string, tableDefinition?: TableDefinitionModel): void {
        if (!tableDefinition) {
            return;
        }
        const normalized = this.normalizeIdentifier(columnName);
        const exists = tableDefinition.columns.some(
            (column) => this.normalizeIdentifier(column.name) === normalized
        );
        if (!exists) {
            throw new Error(`Column '${columnName}' cannot be resolved for RETURNING output.`);
        }
    }

    private static resolveTableDefinition(
        tableName: string,
        options?: DeleteResultSelectOptions
    ): TableDefinitionModel | undefined {
        if (options?.tableDefinitionResolver) {
            const resolved = options.tableDefinitionResolver(tableName);
            if (resolved !== undefined) {
                return resolved;
            }
        }
        if (!options?.tableDefinitions) {
            return undefined;
        }
        const normalized = this.normalizeIdentifier(tableName);
        const map = this.buildTableDefinitionMap(options.tableDefinitions);
        return map.get(normalized);
    }

    private static buildTableDefinitionMap(
        registry: TableDefinitionRegistry
    ): Map<string, TableDefinitionModel> {
        const map = new Map<string, TableDefinitionModel>();
        for (const definition of Object.values(registry)) {
            map.set(this.normalizeIdentifier(definition.name), definition);
        }
        return map;
    }

    private static extractTargetTableName(deleteClause: DeleteQuery['deleteClause']): string {
        const datasource = deleteClause.source.datasource;
        if (datasource instanceof TableSource) {
            return datasource.getSourceName();
        }
        throw new Error('Delete target must be a table source for conversion.');
    }

    private static buildFixtureCtes(fixtures: FixtureTableDefinition[]): CommonTable[] {
        if (!fixtures || fixtures.length === 0) {
            return [];
        }
        return FixtureCteBuilder.buildFixtures(fixtures);
    }

    private static buildFixtureTableMap(fixtures: FixtureTableDefinition[]): Map<string, FixtureTableDefinition> {
        const map = new Map<string, FixtureTableDefinition>();
        for (const fixture of fixtures) {
            map.set(this.normalizeIdentifier(fixture.tableName), fixture);
        }
        return map;
    }

    private static ensureFixtureCoverage(
        selectQuery: SelectQuery,
        fixtureMap: Map<string, FixtureTableDefinition>,
        strategy: MissingFixtureStrategy,
        withClause: WithClause | null
    ): void {
        // Identify every table referenced directly by the SELECT query.
        const referencedTables = this.collectReferencedTables(selectQuery);
        const ignoredTables = this.collectCteNamesFromWithClause(withClause);

        const tablesToCheck = new Set<string>();
        for (const table of referencedTables) {
            if (ignoredTables.has(table)) {
                continue;
            }
            tablesToCheck.add(table);
        }

        const missingTables = this.getMissingFixtureTables(tablesToCheck, fixtureMap);
        if (missingTables.length === 0) {
            return;
        }

        if (strategy === 'error') {
            throw new Error(
                `Delete SELECT refers to tables without fixture coverage: ${missingTables.join(', ')}.`
            );
        }
    }

    private static collectReferencedTables(query: SelectQuery): Set<string> {
        const collector = new TableSourceCollector(false);
        const sources = collector.collect(query);
        const normalized = new Set<string>();
        for (const source of sources) {
            normalized.add(this.normalizeIdentifier(source.getSourceName()));
        }
        return normalized;
    }

    private static collectCteNamesFromWithClause(withClause: WithClause | null): Set<string> {
        const names = new Set<string>();
        if (!withClause?.tables) {
            return names;
        }
        for (const table of withClause.tables) {
            names.add(this.normalizeIdentifier(table.getSourceAliasName()));
        }
        return names;
    }

    private static getMissingFixtureTables(
        referencedTables: Set<string>,
        fixtureMap: Map<string, FixtureTableDefinition>
    ): string[] {
        const missing: string[] = [];
        for (const table of referencedTables) {
            if (!fixtureMap.has(table)) {
                missing.push(table);
            }
        }
        return missing;
    }

    private static mergeWithClause(original: WithClause | null, fixtureCtes: CommonTable[]): WithClause | null {
        if (!fixtureCtes.length && !original) {
            return null;
        }
        const combinedTables = [...fixtureCtes];
        if (original?.tables) {
            combinedTables.push(...original.tables);
        }
        if (!combinedTables.length) {
            return null;
        }
        const merged = new WithClause(original?.recursive ?? false, combinedTables);
        merged.globalComments = original?.globalComments ? [...original.globalComments] : null;
        merged.trailingComments = original?.trailingComments ? [...original.trailingComments] : null;
        return merged;
    }

    private static normalizeIdentifier(value: string): string {
        return value.trim().toLowerCase();
    }
}
