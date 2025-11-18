import {
    CommonTable,
    FromClause,
    JoinClause,
    ReturningClause,
    SelectClause,
    SelectItem,
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
import type { MissingFixtureStrategy } from './InsertResultSelectConverter';

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
        const selectClause = deleteQuery.returningClause
            ? this.buildReturningSelectClause(deleteQuery.returningClause, targetAlias, tableDefinition)
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
        targetAlias: string | null,
        tableDefinition?: TableDefinitionModel
    ): SelectClause {
        const requestedColumns = this.resolveReturningColumns(returning, tableDefinition);
        const selectItems = requestedColumns.map((columnName) => {
            const expression = this.buildReturningExpression(columnName, targetAlias, tableDefinition);
            return new SelectItem(expression, columnName);
        });
        return new SelectClause(selectItems);
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

    private static resolveReturningColumns(
        returning: ReturningClause,
        tableDefinition?: TableDefinitionModel
    ): string[] {
        const requested = returning.columns.map((column) => column.name);
        if (requested.some((name) => name === '*')) {
            if (!tableDefinition) {
                throw new Error('Cannot expand RETURNING * without table definition.');
            }
            return tableDefinition.columns.map((column) => column.name);
        }
        return requested;
    }

    private static buildReturningExpression(
        columnName: string,
        targetAlias: string | null,
        tableDefinition?: TableDefinitionModel
    ): ColumnReference {
        this.ensureColumnExists(columnName, tableDefinition);
        return new ColumnReference(targetAlias, columnName);
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
