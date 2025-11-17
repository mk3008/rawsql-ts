import {
    CommonTable,
    FromClause,
    JoinClause,
    ReturningClause,
    SelectClause,
    SelectItem,
    SetClause,
    SetClauseItem,
    SourceExpression,
    TableSource,
    WithClause
} from '../models/Clause';
import { UpdateQuery } from '../models/UpdateQuery';
import { SimpleSelectQuery, SelectQuery } from '../models/SelectQuery';
import {
    ColumnReference,
    FunctionCall,
    RawString,
    ValueComponent
} from '../models/ValueComponent';
import {
    TableDefinitionModel,
    TableDefinitionRegistry,
    TableColumnDefinitionModel as TableColumnDefinition
} from '../models/TableDefinitionModel';
import { TableSourceCollector } from './TableSourceCollector';
import { FixtureCteBuilder, FixtureTableDefinition } from './FixtureCteBuilder';
import { SelectQueryWithClauseHelper } from '../utils/SelectQueryWithClauseHelper';
import type { MissingFixtureStrategy } from './InsertResultSelectConverter';

/** Options that control how UPDATE-to-SELECT conversion resolves metadata and fixtures. */
export interface UpdateResultSelectOptions {
    /** Optional registry keyed by table name (matching the target table name case). */
    tableDefinitions?: TableDefinitionRegistry;
    /** Optional callback that resolves metadata by table name (useful for schemified targets). */
    tableDefinitionResolver?: (tableName: string) => TableDefinitionModel | undefined;
    /** Optional fixtures that should shadow real tables inside the generated SELECT. */
    fixtureTables?: FixtureTableDefinition[];
    /** Strategy for how missing fixtures should be tolerated. */
    missingFixtureStrategy?: MissingFixtureStrategy;
}

export class UpdateResultSelectConverter {
    private static readonly DEFAULT_MISSING_FIXTURE_STRATEGY: MissingFixtureStrategy = 'error';

    /**
     * Converts an UPDATE with RETURNING (or a bare UPDATE) into a SELECT that mirrors its output rows.
     */
    public static toSelectQuery(updateQuery: UpdateQuery, options?: UpdateResultSelectOptions): SimpleSelectQuery {
        const targetTableName = this.extractTargetTableName(updateQuery.updateClause);
        const tableDefinition = this.resolveTableDefinition(targetTableName, options);
        const targetAlias = updateQuery.updateClause.getSourceAliasName();

        const fromClause = this.buildFromClause(updateQuery.updateClause.source, updateQuery.fromClause);
        const whereClause = updateQuery.whereClause ?? null;

        // Decide whether RETURNING or a row count should drive the SELECT clause.
        const selectClause = updateQuery.returningClause
            ? this.buildReturningSelectClause(
                  updateQuery.returningClause,
                  updateQuery.setClause,
                  targetAlias,
                  tableDefinition
              )
            : this.buildCountSelectClause();

        // Assemble the skeleton SELECT that mirrors the UPDATE's source and predicates.
        const selectQuery = new SimpleSelectQuery({
            withClause: updateQuery.withClause ?? undefined,
            selectClause,
            fromClause,
            whereClause
        });

        // Prepare fixture descriptors for the tables that will be touched by the SELECT.
        const fixtureTables = options?.fixtureTables ?? [];
        const fixtureMap = this.buildFixtureTableMap(fixtureTables);
        const missingStrategy = options?.missingFixtureStrategy ?? this.DEFAULT_MISSING_FIXTURE_STRATEGY;

        const originalWithClause = SelectQueryWithClauseHelper.detachWithClause(selectQuery);
        // Ensure each referenced table is covered by a fixture (or allowed to skip it).
        this.ensureFixtureCoverage(selectQuery, fixtureMap, missingStrategy, originalWithClause);

        // Turn the fixture definitions into CommonTable entries before reinjecting the WITH clause.
        const fixtureCtes = this.buildFixtureCtes(fixtureTables);
        const recombinedWithClause = this.mergeWithClause(originalWithClause, fixtureCtes);
        // Reattach the combined WITH clause so fixture CTEs precede any existing definitions.
        SelectQueryWithClauseHelper.setWithClause(selectQuery, recombinedWithClause);

        return selectQuery;
    }

    private static buildReturningSelectClause(
        returning: ReturningClause,
        setClause: SetClause,
        targetAlias: string | null,
        tableDefinition?: TableDefinitionModel
    ): SelectClause {
        const requestedColumns = this.resolveReturningColumns(returning, tableDefinition);
        // Index SET expressions so we can substitute updated columns later.
        const setExpressionMap = this.mapSetExpressions(setClause);

        // Create select items that either use the SET expressions or the target column references.
        const selectItems = requestedColumns.map((columnName) => {
            const expression = this.buildReturningExpression(
                columnName,
                setExpressionMap,
                targetAlias,
                tableDefinition
            );
            return new SelectItem(expression, columnName);
        });

        return new SelectClause(selectItems);
    }

    private static buildCountSelectClause(): SelectClause {
        // Count rows when the UPDATE does not expose RETURNING output.
        const countFunction = new FunctionCall(null, 'count', new RawString('*'), null);
        const selectItem = new SelectItem(countFunction, 'count');
        return new SelectClause([selectItem]);
    }

    private static buildFromClause(targetSource: SourceExpression, fromClause: FromClause | null): FromClause {
        if (!fromClause) {
            return new FromClause(targetSource, null);
        }

        const joins: JoinClause[] = [];
        // Cross join any explicit FROM sources so their columns remain accessible.
        joins.push(new JoinClause('cross join', fromClause.source, null, false));
        if (fromClause.joins) {
            joins.push(...fromClause.joins);
        }

        return new FromClause(targetSource, joins);
    }

    private static mapSetExpressions(setClause: SetClause): Map<string, ValueComponent> {
        // Normalize each column name so lookups are case-insensitive.
        const expressionMap = new Map<string, ValueComponent>();
        for (const item of setClause.items) {
            const columnName = this.extractColumnName(item);
            expressionMap.set(this.normalizeIdentifier(columnName), item.value);
        }
        return expressionMap;
    }

    private static buildReturningExpression(
        columnName: string,
        setExpressions: Map<string, ValueComponent>,
        targetAlias: string | null,
        tableDefinition?: TableDefinitionModel
    ): ValueComponent {
        const normalized = this.normalizeIdentifier(columnName);
        const overrideExpression = setExpressions.get(normalized);
        // Prefer the updated expression when the column is part of the SET clause.
        if (overrideExpression) {
            return overrideExpression;
        }

        this.ensureColumnExists(columnName, tableDefinition);
        // Fall back to the original target column when no SET override exists.
        return new ColumnReference(targetAlias, columnName);
    }

    private static resolveReturningColumns(
        returning: ReturningClause,
        tableDefinition?: TableDefinitionModel
    ): string[] {
        const requested = returning.columns.map((column) => column.name);
        // Expand RETURNING * with metadata if the caller supplied a table definition.
        if (requested.some((name) => name === '*')) {
            if (!tableDefinition) {
                throw new Error('Cannot expand RETURNING * without table definition.');
            }
            return tableDefinition.columns.map((column) => column.name);
        }
        return requested;
    }

    private static ensureColumnExists(columnName: string, tableDefinition?: TableDefinitionModel): void {
        // Guard against referencing columns that do not exist when metadata is available.
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
        options?: UpdateResultSelectOptions
    ): TableDefinitionModel | undefined {
        // Prefer resolver callback results before falling back to the static registry.
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
        // Normalize registry keys so lookups ignore casing.
        const map = new Map<string, TableDefinitionModel>();
        for (const definition of Object.values(registry)) {
            map.set(this.normalizeIdentifier(definition.name), definition);
        }
        return map;
    }

    private static extractTargetTableName(updateClause: UpdateQuery['updateClause']): string {
        const datasource = updateClause.source.datasource;
        if (datasource instanceof TableSource) {
            return datasource.getSourceName();
        }
        throw new Error('Update target must be a table source for conversion.');
    }

    private static extractColumnName(item: SetClauseItem): string {
        const columnComponent = item.qualifiedName.name;
        if (columnComponent instanceof RawString) {
            return columnComponent.value;
        }
        return columnComponent.name;
    }

    private static buildFixtureCtes(fixtures: FixtureTableDefinition[]): CommonTable[] {
        if (!fixtures || fixtures.length === 0) {
            return [];
        }
        return FixtureCteBuilder.buildFixtures(fixtures);
    }

    private static buildFixtureTableMap(fixtures: FixtureTableDefinition[]): Map<string, FixtureTableDefinition> {
        // Normalize fixture table names to keep comparisons consistent.
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
        // Enumerate the physical tables that the SELECT actually touches.
        const referencedTables = this.collectReferencedTables(selectQuery);
        // Skip any tables that are defined via CTE aliases in the WITH clause.
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
                `Update SELECT refers to tables without fixture coverage: ${missingTables.join(', ')}.`
            );
        }
    }

    private static collectReferencedTables(query: SelectQuery): Set<string> {
        // Use the collector to track every TableSource referenced by the SELECT.
        const collector = new TableSourceCollector(false);
        const sources = collector.collect(query);
        const normalized = new Set<string>();
        for (const source of sources) {
            normalized.add(this.normalizeIdentifier(source.getSourceName()));
        }
        return normalized;
    }

    private static collectCteNamesFromWithClause(withClause?: WithClause | null): Set<string> {
        // Determine which table names come from CTE aliases so they can be ignored.
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
        // Return every referenced table that lacks an overriding fixture definition.
        const missing: string[] = [];
        for (const table of referencedTables) {
            if (!fixtureMap.has(table)) {
                missing.push(table);
            }
        }
        return missing;
    }

    private static mergeWithClause(original: WithClause | null, fixtureCtes: CommonTable[]): WithClause | null {
        // Combine fixture CTEs ahead of any original definitions so they shadow physical tables.
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
