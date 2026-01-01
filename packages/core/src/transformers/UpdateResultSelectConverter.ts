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
import { SqlComponent } from '../models/SqlComponent';
import {
    ColumnReference,
    FunctionCall,
    IdentifierString,
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
import { rewriteValueComponentWithColumnResolver } from '../utils/ValueComponentRewriter';
import { tableNameVariants } from '../utils/TableNameUtils';
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
        const referencedTables = this.collectPhysicalTableReferences(selectQuery, originalWithClause);
        const cteNames = this.collectCteNamesFromWithClause(originalWithClause);
        const targetVariants = tableNameVariants(targetTableName);
        for (const variant of targetVariants) {
            if (!cteNames.has(variant)) {
                referencedTables.add(variant);
            }
        }
        // Ensure each referenced table is covered by a fixture (or allowed to skip it).
        this.ensureFixtureCoverage(referencedTables, fixtureMap, missingStrategy);

        const filteredFixtures = this.filterFixtureTablesForReferences(fixtureTables, referencedTables);
        // Turn the fixture definitions into CommonTable entries before reinjecting the WITH clause.
        const fixtureCtes = this.buildFixtureCtes(filteredFixtures);
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
        const setExpressionMap = this.mapSetExpressions(setClause);
        const selectItems = this.buildReturningSelectItems(
            returning,
            setExpressionMap,
            targetAlias,
            tableDefinition
        );

        return new SelectClause(selectItems);
    }

    private static buildReturningSelectItems(
        returning: ReturningClause,
        setExpressions: Map<string, ValueComponent>,
        targetAlias: string | null,
        tableDefinition?: TableDefinitionModel
    ): SelectItem[] {
        // Convert each RETURNING item into a select entry, expanding wildcards up front.
        const selectItems: SelectItem[] = [];
        for (const item of returning.items) {
            if (this.isWildcardReturningItem(item)) {
                selectItems.push(
                    ...this.expandReturningWildcard(tableDefinition, setExpressions, targetAlias)
                );
                continue;
            }
            selectItems.push(
                this.buildUpdateReturningSelectItem(item, setExpressions, targetAlias, tableDefinition)
            );
        }
        return selectItems;
    }

    private static isWildcardReturningItem(item: SelectItem): boolean {
        return (
            item.value instanceof ColumnReference &&
            item.value.column.name === '*'
        );
    }

    private static expandReturningWildcard(
        tableDefinition: TableDefinitionModel | undefined,
        setExpressions: Map<string, ValueComponent>,
        targetAlias: string | null
    ): SelectItem[] {
        // Use metadata to expand RETURNING * so each column can honor SET overrides.
        if (!tableDefinition) {
            throw new Error('Cannot expand RETURNING * without table definition.');
        }
        return tableDefinition.columns.map((column) => {
            const expression = this.buildUpdateColumnExpression(
                column.name,
                setExpressions,
                targetAlias,
                tableDefinition
            );
            return new SelectItem(expression, column.name);
        });
    }

    private static buildUpdateReturningSelectItem(
        item: SelectItem,
        setExpressions: Map<string, ValueComponent>,
        targetAlias: string | null,
        tableDefinition?: TableDefinitionModel
    ): SelectItem {
        // Rewrite the item expression so column references honor SET overrides.
        const expression = rewriteValueComponentWithColumnResolver(item.value, (column) =>
            this.buildUpdateColumnExpression(column, setExpressions, targetAlias, tableDefinition)
        );
        const alias = this.getReturningAlias(item);
        return new SelectItem(expression, alias);
    }

    private static buildUpdateColumnExpression(
        columnOrName: ColumnReference | string,
        setExpressions: Map<string, ValueComponent>,
        targetAlias: string | null,
        tableDefinition?: TableDefinitionModel
    ): ValueComponent {
        const columnName =
            typeof columnOrName === 'string'
                ? columnOrName
                : this.getColumnReferenceName(columnOrName);
        const normalized = this.normalizeIdentifier(columnName);
        const overrideExpression = setExpressions.get(normalized);
        // Prefer the SET expression when the column is updated, otherwise preserve the target reference.
        if (overrideExpression) {
            return overrideExpression;
        }

        this.ensureColumnExists(columnName, tableDefinition);
        return new ColumnReference(targetAlias, columnName);
    }

    private static getColumnReferenceName(column: ColumnReference): string {
        const nameComponent = column.qualifiedName.name;
        if (nameComponent instanceof IdentifierString) {
            return nameComponent.name;
        }
        return nameComponent.value;
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

        const normalizedVariants = new Set(tableNameVariants(tableName));

        if (options?.tableDefinitions) {
            const map = this.buildTableDefinitionMap(options.tableDefinitions);
            for (const variant of normalizedVariants) {
                const definition = map.get(variant);
                if (definition) {
                    return definition;
                }
            }
        }

        if (options?.fixtureTables) {
            const fixture = options.fixtureTables.find((f) =>
                tableNameVariants(f.tableName).some((variant) => normalizedVariants.has(variant))
            );
            if (fixture) {
                return this.convertFixtureToTableDefinition(fixture);
            }
        }

        return undefined;
    }

    private static convertFixtureToTableDefinition(fixture: FixtureTableDefinition): TableDefinitionModel {
        return {
            name: fixture.tableName,
            columns: fixture.columns.map(col => ({
                name: col.name,
                typeName: col.typeName,
                required: false,
                defaultValue: col.defaultValue ?? null
            }))
        };
    }

    private static buildTableDefinitionMap(
        registry: TableDefinitionRegistry
    ): Map<string, TableDefinitionModel> {
        // Normalize registry keys so lookups ignore casing.
        const map = new Map<string, TableDefinitionModel>();
        for (const definition of Object.values(registry)) {
            for (const variant of tableNameVariants(definition.name)) {
                map.set(variant, definition);
            }
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

    private static collectPhysicalTableReferences(
        selectQuery: SelectQuery,
        withClause: WithClause | null
    ): Set<string> {
        const referencedTables = this.collectReferencedTables(selectQuery);
        const ignoredTables = this.collectCteNamesFromWithClause(withClause);

        const tablesToShadow = new Set<string>();
        // Record only concrete tables that are not already defined via CTE aliases.
        for (const table of referencedTables) {
            if (ignoredTables.has(table)) {
                continue;
            }
            tablesToShadow.add(table);
        }

        const cteReferencedTables = this.collectReferencedTablesFromWithClause(withClause);
        for (const table of cteReferencedTables) {
            if (ignoredTables.has(table)) {
                continue;
            }
            tablesToShadow.add(table);
        }

        return tablesToShadow;
    }

    private static filterFixtureTablesForReferences(
        fixtures: FixtureTableDefinition[],
        referencedTables: Set<string>
    ): FixtureTableDefinition[] {
        if (!fixtures.length || referencedTables.size === 0) {
            return [];
        }

        const filtered: FixtureTableDefinition[] = [];
        for (const fixture of fixtures) {
            const fixtureVariants = tableNameVariants(fixture.tableName);
            if (fixtureVariants.some((variant) => referencedTables.has(variant))) {
                filtered.push(fixture);
            }
        }

        return filtered;
    }

    private static collectReferencedTablesFromWithClause(withClause: WithClause | null): Set<string> {
        const tables = new Set<string>();
        if (!withClause?.tables) {
            return tables;
        }

        for (const cte of withClause.tables) {
            for (const table of this.collectReferencedTables(cte.query)) {
                tables.add(table);
            }
        }

        return tables;
    }

    private static buildFixtureTableMap(fixtures: FixtureTableDefinition[]): Map<string, FixtureTableDefinition> {
        // Normalize fixture table names to keep comparisons consistent.
        const map = new Map<string, FixtureTableDefinition>();
        for (const fixture of fixtures) {
            for (const variant of tableNameVariants(fixture.tableName)) {
                map.set(variant, fixture);
            }
        }
        return map;
    }

    private static ensureFixtureCoverage(
        referencedTables: Set<string>,
        fixtureMap: Map<string, FixtureTableDefinition>,
        strategy: MissingFixtureStrategy
    ): void {
        if (referencedTables.size === 0) {
            return;
        }

        const missingTables = this.getMissingFixtureTables(referencedTables, fixtureMap);
        if (missingTables.length === 0) {
            return;
        }

        if (strategy === 'error') {
            throw new Error(
                `Update SELECT refers to tables without fixture coverage: ${missingTables.join(', ')}.`
            );
        }
    }

    private static collectReferencedTables(query: SqlComponent): Set<string> {   
        // Use the collector to track every TableSource referenced by the SELECT.
        const collector = new TableSourceCollector(false);
        const sources = collector.collect(query);
        const normalized = new Set<string>();
        for (const source of sources) {
            for (const variant of tableNameVariants(source.getSourceName())) {
                normalized.add(variant);
            }
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
            for (const variant of tableNameVariants(table.getSourceAliasName())) {
                names.add(variant);
            }
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
            const covered = tableNameVariants(table).some((variant) => fixtureMap.has(variant));
            if (!covered) {
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
