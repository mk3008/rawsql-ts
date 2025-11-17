import { CommonTable, FromClause, ReturningClause, SelectClause, SelectItem, SourceAliasExpression, SourceExpression, TableSource, WithClause } from '../models/Clause';
import { InsertQuery } from '../models/InsertQuery';
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from '../models/SelectQuery';
import { InsertQuerySelectValuesConverter } from './InsertQuerySelectValuesConverter';
import { CastExpression, ColumnReference, FunctionCall, LiteralValue, RawString, TypeValue, ValueComponent } from '../models/ValueComponent';
import { ValueParser } from '../parsers/ValueParser';
import {
    TableDefinitionModel,
    TableDefinitionRegistry,
    TableColumnDefinitionModel as TableColumnDefinition
} from '../models/TableDefinitionModel';
import { TableSourceCollector } from './TableSourceCollector';
import { FixtureCteBuilder, FixtureTableDefinition } from './FixtureCteBuilder';
import { SelectQueryWithClauseHelper } from "../utils/SelectQueryWithClauseHelper";

/** Options that drive how the insert-to-select transformation resolves table metadata. */
export interface InsertResultSelectOptions {
    /** Optional registry keyed by table name (matching the target table name case). */
    tableDefinitions?: TableDefinitionRegistry;
    /** Optional callback to resolve metadata by full table name (useful for schemified names). */
    tableDefinitionResolver?: (tableName: string) => TableDefinitionModel | undefined;
    /** Optional fixtures that should shadow real tables inside the generated SELECT. */
    fixtureTables?: FixtureTableDefinition[];
    /** Strategy to control behavior when fixtures are missing for real tables. */
    missingFixtureStrategy?: MissingFixtureStrategy;
}

/** Strategy choices for how missing fixtures are handled during transformation. */
export type MissingFixtureStrategy = 'error' | 'warn' | 'passthrough';

interface ColumnMetadata {
    name: string;
    normalized: string;
    provided: boolean;
    typeName?: string;
    required?: boolean;
    defaultValue?: ValueComponent | null;
}

export class InsertResultSelectConverter {
    private static readonly BASE_CTE_NAME = '__inserted_rows';

    private static readonly DEFAULT_MISSING_FIXTURE_STRATEGY: MissingFixtureStrategy = 'error';

    /**
     * Converts an INSERT ... SELECT/VALUES query into a SELECT that mirrors its RETURNING output
     * (or a count(*) when RETURNING is absent).
     */
    public static toSelectQuery(insertQuery: InsertQuery, options?: InsertResultSelectOptions): SimpleSelectQuery {
        const preparedInsert = this.prepareInsertQuery(insertQuery);
        const sourceQuery = preparedInsert.selectQuery;

        if (!sourceQuery) {
            throw new Error('Cannot convert INSERT query without a data source.');
        }

        const sourceWithClause = SelectQueryWithClauseHelper.detachWithClause(sourceQuery);

        const targetTableName = this.extractTargetTableName(preparedInsert.insertClause);
        const tableDefinition = this.resolveTableDefinition(targetTableName, options);

        const fixtureTables = options?.fixtureTables ?? [];
        const fixtureMap = this.buildFixtureTableMap(fixtureTables);
        const missingStrategy = options?.missingFixtureStrategy ?? this.DEFAULT_MISSING_FIXTURE_STRATEGY;
        this.ensureFixtureCoverage(sourceQuery, fixtureMap, missingStrategy, sourceWithClause);

        const insertColumnNames = this.resolveInsertColumns(preparedInsert.insertClause, sourceQuery, tableDefinition);
        const selectColumnCount = this.getSelectColumnCount(sourceQuery);

        if (insertColumnNames.length !== selectColumnCount) {
            throw new Error('Insert column count does not match SELECT output columns.');
        }

        const columnMetadataMap = this.buildColumnMetadata(insertColumnNames, tableDefinition);
        this.assertRequiredColumns(columnMetadataMap, tableDefinition);
        this.applyColumnCasts(sourceQuery, insertColumnNames, columnMetadataMap);

        const fixtureCtes = this.buildFixtureCtes(fixtureTables);
        const cteName = this.generateUniqueCteName(sourceWithClause, fixtureCtes);
        const cteAlias = new SourceAliasExpression(cteName, insertColumnNames);
        const insertedRowsCte = new CommonTable(sourceQuery, cteAlias, null);
        const withClause = this.buildWithClause(sourceWithClause, fixtureCtes, insertedRowsCte);

        if (!preparedInsert.returningClause) {
            return this.buildCountSelect(withClause, cteName);
        }

        const returningColumns = this.resolveReturningColumns(
            preparedInsert.returningClause,
            tableDefinition,
            insertColumnNames
        );

        const selectItems = returningColumns.map((columnName) => {
            const metadata = this.getColumnMetadata(columnMetadataMap, columnName);
            const expression = this.buildColumnExpression(metadata, cteName);
            return new SelectItem(expression, columnName);
        });

        const fromExpr = new SourceExpression(new TableSource(null, cteName), null);
        const fromClause = new FromClause(fromExpr, null);

        return new SimpleSelectQuery({
            withClause,
            selectClause: new SelectClause(selectItems),
            fromClause
        });
    }
    private static prepareInsertQuery(insertQuery: InsertQuery): InsertQuery {
        // Values-based inserts need to be rewritten into INSERT ... SELECT before further processing.
        if (insertQuery.selectQuery instanceof ValuesQuery) {
            return InsertQuerySelectValuesConverter.toSelectUnion(insertQuery);
        }
        return insertQuery;
    }

    private static extractTargetTableName(insertClause: InsertQuery['insertClause']): string {
        const datasource = insertClause.source.datasource;
        if (datasource instanceof TableSource) {
            return datasource.getSourceName();
        }
        throw new Error('Insert target must be a table source for conversion.');
    }

    private static resolveTableDefinition(
        tableName: string,
        options?: InsertResultSelectOptions
    ): TableDefinitionModel | undefined {
        // Prefer resolver results but fall back to the registry when the resolver cannot handle the table name.
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
        const normalizedMap = this.buildTableDefinitionMap(options.tableDefinitions);
        return normalizedMap.get(normalized);
    }

    private static buildTableDefinitionMap(
        registry?: TableDefinitionRegistry
    ): Map<string, TableDefinitionModel> {
        const map = new Map<string, TableDefinitionModel>();
        if (!registry) {
            return map;
        }

        for (const definition of Object.values(registry)) {
            map.set(this.normalizeIdentifier(definition.name), definition);
        }

        return map;
    }

    private static resolveInsertColumns(
        insertClause: InsertQuery['insertClause'],
        selectQuery: SelectQuery,
        tableDefinition?: TableDefinitionModel
    ): string[] {
        if (insertClause.columns && insertClause.columns.length > 0) {
            return insertClause.columns.map((col) => col.name);
        }

        // When the column list is omitted we rely on the table definition to infer both names and order.
        if (!tableDefinition) {
            throw new Error('Cannot infer INSERT columns without a table definition.');
        }

        const columnNames = tableDefinition.columns.map((col) => col.name);
        const expectedCount = this.getSelectColumnCount(selectQuery);

        if (columnNames.length !== expectedCount) {
            throw new Error(
                'Table definition column count does not match the SELECT output when column list is omitted.'
            );
        }

        return columnNames;
    }

    private static getSelectColumnCount(selectQuery: SelectQuery): number {
        const firstSimple = this.getFirstSimpleSelectQuery(selectQuery);
        return firstSimple.selectClause.items.length;
    }

    private static getFirstSimpleSelectQuery(selectQuery: SelectQuery): SimpleSelectQuery {
        if (selectQuery instanceof SimpleSelectQuery) {
            return selectQuery;
        }
        if (selectQuery instanceof BinarySelectQuery) {
            return this.getFirstSimpleSelectQuery(selectQuery.left);
        }
        throw new Error('Unsupported select query structure in insert conversion.');
    }

    private static buildColumnMetadata(
        insertColumns: string[],
        tableDefinition?: TableDefinitionModel
    ): Map<string, ColumnMetadata> {
        // Capture both the provided columns and the broader table definition so we can resolve defaults later.
        const metadataMap = new Map<string, ColumnMetadata>();
        const columnDefinitionMap = tableDefinition
            ? new Map<string, TableColumnDefinition>(
                  tableDefinition.columns.map((col) => [this.normalizeIdentifier(col.name), col])
              )
            : null;

        for (const columnName of insertColumns) {
            const normalized = this.normalizeIdentifier(columnName);
            const definition = columnDefinitionMap?.get(normalized);
            metadataMap.set(normalized, {
                name: columnName,
                normalized,
                provided: true,
                typeName: definition?.typeName,
                required: definition?.required,
                defaultValue: this.resolveDefaultValueExpression(definition)
            });
        }

        if (columnDefinitionMap) {
            for (const [normalized, definition] of columnDefinitionMap.entries()) {
                if (!metadataMap.has(normalized)) {
                    metadataMap.set(normalized, {
                        name: definition.name,
                        normalized,
                        provided: false,
                        typeName: definition.typeName,
                        required: definition.required,
                        defaultValue: this.resolveDefaultValueExpression(definition)
                    });
                }
            }
        }

        return metadataMap;
    }

    private static assertRequiredColumns(
        metadataMap: Map<string, ColumnMetadata>,
        tableDefinition?: TableDefinitionModel
    ): void {
        if (!tableDefinition) {
            return;
        }

        // Ensure every NOT NULL column (without a default) was part of the insert so the transformation stays accurate.
        const requiredColumns = new Set(
            tableDefinition.columns
                .filter((col) => col.required)
                .map((col) => this.normalizeIdentifier(col.name))
        );

        for (const normalized of requiredColumns) {
            const metadata = metadataMap.get(normalized);
            if (metadata && metadata.provided) {
                continue;
            }
            if (metadata?.defaultValue) {
                continue;
            }
            const columnName = tableDefinition.columns.find(
                (col) => this.normalizeIdentifier(col.name) === normalized
            )?.name;
            if (columnName) {
                throw new Error(
                    `Required column '${columnName}' is missing from INSERT, so conversion cannot proceed.`
                );
            }
        }
    }

    private static resolveReturningColumns(
        returning: ReturningClause,
        tableDefinition: TableDefinitionModel | undefined,
        insertColumns: string[]
    ): string[] {
        const requested = returning.columns.map((col) => col.name);
        const hasStar = requested.some((name) => name === '*');
        if (hasStar) {
            // RETURNING * expands to the full table definition (fallback to explicit columns if available).
            if (tableDefinition) {
                return tableDefinition.columns.map((col) => col.name);
            }
            if (insertColumns.length > 0) {
                return insertColumns;
            }
            throw new Error('Cannot expand RETURNING * without table definition or column list.');
        }
        return requested;
    }

    private static getColumnMetadata(
        metadataMap: Map<string, ColumnMetadata>,
        columnName: string
    ): ColumnMetadata {
        const normalized = this.normalizeIdentifier(columnName);
        const metadata = metadataMap.get(normalized);
        if (!metadata) {
            throw new Error(`Column '${columnName}' cannot be resolved for RETURNING output.`);
        }
        return metadata;
    }

    private static buildColumnExpression(metadata: ColumnMetadata, cteName: string): ValueComponent {
        // Choose either the inserted column reference or the configured default/null expression.
        let expression: ValueComponent;
        if (metadata.provided) {
            expression = new ColumnReference(cteName, metadata.name);
        } else if (metadata.defaultValue) {
            expression = metadata.defaultValue;
        } else {
            expression = new LiteralValue(null);
        }

        return expression;
    }

    private static buildTypeValue(typeName: string): TypeValue {
        // Split schema-qualified type names so namespaces become TypeValue namespaces.
        const parts = typeName.split('.');
        const namePart = parts.pop()?.trim() ?? typeName.trim();
        const namespaces = parts.length > 0 ? parts.map((part) => part.trim()) : null;
        return new TypeValue(namespaces, new RawString(namePart));
    }

    private static buildFixtureCtes(fixtures?: FixtureTableDefinition[]): CommonTable[] {
        if (!fixtures || fixtures.length === 0) {
            return [];
        }

        return FixtureCteBuilder.buildFixtures(fixtures);
    }

    private static buildWithClause(original: WithClause | null, fixtureCtes: CommonTable[], insertedCte: CommonTable): WithClause {
        // Preserve any existing CTEs while prefixing fixture-based definitions before the simulated inserted rows CTE.
        const originalTables = original?.tables ?? [];
        const combinedTables = [...fixtureCtes, ...originalTables, insertedCte];
        const withClause = new WithClause(original?.recursive ?? false, combinedTables);
        withClause.globalComments = original?.globalComments ? [...original.globalComments] : null;
        withClause.trailingComments = original?.trailingComments ? [...original.trailingComments] : null;
        return withClause;
    }

    private static buildCountSelect(withClause: WithClause, cteName: string): SimpleSelectQuery {
        // Build a simple tally query that counts the rows produced by the inserted rows CTE.
        const countItem = new SelectItem(
            new FunctionCall(null, 'count', new RawString('*'), null),
            'count'
        );
        const selectClause = new SelectClause([countItem]);
        const fromExpr = new SourceExpression(new TableSource(null, cteName), null);
        const fromClause = new FromClause(fromExpr, null);
        return new SimpleSelectQuery({ withClause, selectClause, fromClause });
    }

    private static buildFixtureTableMap(fixtures?: FixtureTableDefinition[]): Map<string, FixtureTableDefinition> {
        const map = new Map<string, FixtureTableDefinition>();
        if (!fixtures) {
            return map;
        }

        // Normalize table names so lookups are case-insensitive.
        for (const fixture of fixtures) {
            map.set(this.normalizeIdentifier(fixture.tableName), fixture);
        }
        return map;
    }

    private static ensureFixtureCoverage(
        selectQuery: SelectQuery,
        fixtureMap: Map<string, FixtureTableDefinition>,
        strategy: MissingFixtureStrategy,
        withClause?: WithClause | null
    ): void {
        // Evaluate the SELECT expression before proceeding.
        const referencedTables = this.collectReferencedTables(selectQuery);
        const ignoredTables = this.collectCteNamesFromWithClause(withClause);

        // Filter out CTE aliases so fixture coverage only targets real tables.
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
                `Insert SELECT refers to tables without fixture coverage: ${missingTables.join(', ')}.`
            );
        }
        // 'warn' and 'passthrough' intentionally allow the conversion to continue.
    }

    private static collectReferencedTables(query: SelectQuery): Set<string> {
        // Scan every part of the query (including subqueries) so fixture coverage validates all referenced tables.
        const collector = new TableSourceCollector(false);
        const sources = collector.collect(query);
        const referenced = new Set<string>();
        for (const source of sources) {
            referenced.add(this.normalizeIdentifier(source.getSourceName()));
        }
        return referenced;
    }

    private static collectCteNamesFromWithClause(withClause?: WithClause | null): Set<string> {
        const names = new Set<string>();
        if (!withClause?.tables) {
            return names;
        }

        // Normalize alias names before storing so they line up with referenced table normalization.
        for (const table of withClause.tables) {
            names.add(this.normalizeIdentifier(table.getSourceAliasName()));
        }

        return names;
    }

    private static addCteNames(usedNames: Set<string>, tables?: CommonTable[]): void {
        if (!tables) {
            return;
        }
        for (const table of tables) {
            usedNames.add(this.normalizeIdentifier(table.getSourceAliasName()));
        }
    }

    private static getMissingFixtureTables(
        referencedTables: Set<string>,
        fixtureMap: Map<string, FixtureTableDefinition>
    ): string[] {
        // Compare normalized table names against the fixtures that were supplied.
        const missing: string[] = [];
        for (const table of referencedTables) {
            if (!fixtureMap.has(table)) {
                missing.push(table);
            }
        }
        return missing;
    }

    private static generateUniqueCteName(withClause: WithClause | null, fixtureCtes: CommonTable[]): string {
        const usedNames = new Set<string>();
        this.addCteNames(usedNames, fixtureCtes);
        for (const name of this.collectCteNamesFromWithClause(withClause)) {
            usedNames.add(name);
        }
        let candidate = this.BASE_CTE_NAME;
        let suffix = 0;
        while (usedNames.has(this.normalizeIdentifier(candidate))) {
            suffix += 1;
            candidate = `${this.BASE_CTE_NAME}_${suffix}`;
        }
        return candidate;
    }

    private static normalizeIdentifier(value: string): string {
        return value.trim().toLowerCase();
    }

    private static parseDefaultValue(def: string): ValueComponent {
        try {
            return ValueParser.parse(def);
        } catch (error) {
            throw new Error(
                `Failed to parse default expression '${def}': ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private static resolveDefaultValueExpression(
        definition?: TableColumnDefinition
    ): ValueComponent | null {
        if (!definition?.defaultValue) {
            return null;
        }

        if (typeof definition.defaultValue === 'string') {
            // Re-parse text defaults so callers always work with ValueComponent data.
            return this.parseDefaultValue(definition.defaultValue);
        }

        return definition.defaultValue;
    }

    private static applyColumnCasts(
        selectQuery: SelectQuery,
        insertColumns: string[],
        metadataMap: Map<string, ColumnMetadata>
    ): void {
        if (selectQuery instanceof SimpleSelectQuery) {
            this.applyColumnCastsToSimple(selectQuery, insertColumns, metadataMap);
            return;
        }

        if (selectQuery instanceof BinarySelectQuery) {
            this.applyColumnCasts(selectQuery.left, insertColumns, metadataMap);
            this.applyColumnCasts(selectQuery.right, insertColumns, metadataMap);
            return;
        }

        // ValuesQuery should have been converted to SELECT earlier.
        throw new Error('Unsupported select query structure for applying column casts.');
    }

    private static applyColumnCastsToSimple(
        simple: SimpleSelectQuery,
        insertColumns: string[],
        metadataMap: Map<string, ColumnMetadata>
    ): void {
        const items = simple.selectClause.items;
        for (let i = 0; i < items.length; i++) {
            const metadata = metadataMap.get(this.normalizeIdentifier(insertColumns[i]));
            if (!metadata || !metadata.typeName) {
                continue;
            }
            const identifier = items[i].identifier?.name ?? null;
            const casted = new CastExpression(items[i].value, this.buildTypeValue(metadata.typeName));
            const newItem = new SelectItem(casted, identifier);
            newItem.comments = items[i].comments;
            newItem.positionedComments = items[i].positionedComments;
            simple.selectClause.items[i] = newItem;
        }
    }
}
