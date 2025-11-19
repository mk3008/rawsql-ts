import { CommonTable, FromClause, JoinClause, JoinOnClause, SelectClause, SelectItem, SourceAliasExpression, SourceExpression, SubQuerySource, TableSource, WithClause, WhereClause } from '../models/Clause';
import { MergeQuery, MergeWhenClause, MergeUpdateAction, MergeDeleteAction, MergeInsertAction, MergeDoNothingAction } from '../models/MergeQuery';
import { BinaryExpression, FunctionCall, InlineQuery, LiteralValue, RawString, UnaryExpression, ValueComponent } from '../models/ValueComponent';
import { BinarySelectQuery, SimpleSelectQuery, SelectQuery } from '../models/SelectQuery';
import { FixtureCteBuilder, FixtureTableDefinition } from './FixtureCteBuilder';
import { TableSourceCollector } from './TableSourceCollector';
import { SelectQueryWithClauseHelper } from '../utils/SelectQueryWithClauseHelper';
import type { MissingFixtureStrategy } from './InsertResultSelectConverter';

export interface MergeResultSelectOptions {
    fixtureTables?: FixtureTableDefinition[];
    missingFixtureStrategy?: MissingFixtureStrategy;
}

export class MergeResultSelectConverter {
    private static readonly DEFAULT_MISSING_FIXTURE_STRATEGY: MissingFixtureStrategy = 'error';

    /**
     * Converts a MERGE query into a SELECT that counts or models the rows affected by each action.
     */
    public static toSelectQuery(mergeQuery: MergeQuery, options?: MergeResultSelectOptions): SimpleSelectQuery {
        // Build individual SELECTs for each WHEN clause so the row count can include every affected path.
        const actionSelects = this.buildActionSelects(mergeQuery);
        if (actionSelects.length === 0) {
            throw new Error('MERGE query must include at least one action that affects rows.');
        }

        // Combine the individual action selects into one union so the COUNT(*) can inspect all of them.
        const unionSource = this.combineSelects(actionSelects);
        const derivedSource = new SourceExpression(
            new SubQuerySource(unionSource),
            new SourceAliasExpression('__merge_action_rows', null)
        );

        // Wrap the union in a derived table so the outer query can aggregate a single row count.
        const finalSelect = new SimpleSelectQuery({
            selectClause: this.buildCountSelectClause(),
            fromClause: new FromClause(derivedSource, null)
        });

        // Prepare fixture metadata before verifying coverage.
        const fixtureTables = options?.fixtureTables ?? [];
        const fixtureMap = this.buildFixtureTableMap(fixtureTables);
        const missingStrategy = options?.missingFixtureStrategy ?? this.DEFAULT_MISSING_FIXTURE_STRATEGY;
        const nativeWithClause = mergeQuery.withClause ?? null;

        const referencedTables = this.collectPhysicalTableReferences(unionSource, nativeWithClause);
        const cteNames = this.collectCteNamesFromWithClause(nativeWithClause);
        const targetName = this.normalizeIdentifier(this.extractTargetTableName(mergeQuery.target));
        if (!cteNames.has(targetName)) {
            referencedTables.add(targetName);
        }
        // Ensure every referenced physical table is backed by a fixture when required.
        this.ensureFixtureCoverage(referencedTables, fixtureMap, missingStrategy);

        // Merge fixture CTEs ahead of any original MERGE WITH clause definitions.
        const filteredFixtures = this.filterFixtureTablesForReferences(fixtureTables, referencedTables);
        const fixtureCtes = this.buildFixtureCtes(filteredFixtures);
        const combinedWithClause = this.mergeWithClause(nativeWithClause, fixtureCtes);
        SelectQueryWithClauseHelper.setWithClause(finalSelect, combinedWithClause);

        return finalSelect;
    }

    private static buildActionSelects(mergeQuery: MergeQuery): SimpleSelectQuery[] {
        const selects: SimpleSelectQuery[] = [];
        // Translate each WHEN clause into a row-producing SELECT when it represents an actual change.
        for (const clause of mergeQuery.whenClauses) {
            const selectQuery = this.buildSelectForClause(mergeQuery, clause);
            if (selectQuery) {
                selects.push(selectQuery);
            }
        }
        return selects;
    }

    private static buildSelectForClause(mergeQuery: MergeQuery, clause: MergeWhenClause): SimpleSelectQuery | null {
        switch (clause.matchType) {
            case 'matched':
                return this.buildMatchedSelect(mergeQuery, clause);
            case 'not_matched':
            case 'not_matched_by_target':
                return this.buildNotMatchedSelect(mergeQuery, clause);
            case 'not_matched_by_source':
                return this.buildNotMatchedBySourceSelect(mergeQuery, clause);
            default:
                return null;
        }
    }

    private static buildMatchedSelect(mergeQuery: MergeQuery, clause: MergeWhenClause): SimpleSelectQuery | null {
        const action = clause.action;
        if (action instanceof MergeDoNothingAction) {
            return null;
        }
        if (!(action instanceof MergeUpdateAction) && !(action instanceof MergeDeleteAction)) {
            return null;
        }

        // Match target rows with their source counterparts via the MERGE ON predicate.
        const joinClause = new JoinClause('inner join', mergeQuery.source, new JoinOnClause(mergeQuery.onCondition), false);
        // Apply any additional WHEN/WHERE filters tied to this action.
        const combinedPredicate = this.combineConditions([
            clause.condition,
            this.buildActionWhereClause(action)
        ]);
        const whereClause = combinedPredicate ? new WhereClause(combinedPredicate) : null;

        return new SimpleSelectQuery({
            selectClause: this.buildLiteralSelectClause(),
            fromClause: new FromClause(mergeQuery.target, [joinClause]),
            whereClause
        });
    }

    private static buildNotMatchedSelect(mergeQuery: MergeQuery, clause: MergeWhenClause): SimpleSelectQuery | null {
        if (!(clause.action instanceof MergeInsertAction)) {
            return null;
        }

        // Select source rows that lack any matching target record using NOT EXISTS semantics.
        const notExistsExpression = this.buildNotExistsExpression(mergeQuery.target, mergeQuery.onCondition);
        const combinedPredicate = this.combineConditions([notExistsExpression, clause.condition]);
        const whereClause = combinedPredicate ? new WhereClause(combinedPredicate) : null;

        return new SimpleSelectQuery({
            selectClause: this.buildLiteralSelectClause(),
            fromClause: new FromClause(mergeQuery.source, null),
            whereClause
        });
    }

    private static buildNotMatchedBySourceSelect(mergeQuery: MergeQuery, clause: MergeWhenClause): SimpleSelectQuery | null {
        const action = clause.action;
        if (!(action instanceof MergeDeleteAction)) {
            return null;
        }

        // Select target rows that are orphaned by the source to emulate delete actions.
        const notExistsExpression = this.buildNotExistsExpression(mergeQuery.source, mergeQuery.onCondition);
        const combinedPredicate = this.combineConditions([
            notExistsExpression,
            clause.condition,
            this.buildActionWhereClause(action)
        ]);
        const whereClause = combinedPredicate ? new WhereClause(combinedPredicate) : null;

        return new SimpleSelectQuery({
            selectClause: this.buildLiteralSelectClause(),
            fromClause: new FromClause(mergeQuery.target, null),
            whereClause
        });
    }

    private static buildNotExistsExpression(sourceReference: SourceExpression, predicate: ValueComponent): ValueComponent {
        // Build an EXISTS subquery that can be negated to detect missing matches.
        const existsSelect = new SimpleSelectQuery({
            selectClause: this.buildLiteralSelectClause(),
            fromClause: new FromClause(sourceReference, null),
            whereClause: new WhereClause(predicate)
        });
        const existsExpression = new UnaryExpression('exists', new InlineQuery(existsSelect));
        return new UnaryExpression('not', existsExpression);
    }

    private static buildActionWhereClause(action: MergeUpdateAction | MergeDeleteAction): ValueComponent | null {
        return action.whereClause?.condition ?? null;
    }

    // Combine additional predicates into a single AND expression for filtering.
    private static combineConditions(predicates: (ValueComponent | null | undefined)[]): ValueComponent | null {
        const values = predicates.filter((predicate): predicate is ValueComponent => Boolean(predicate));
        if (values.length === 0) {
            return null;
        }
        return values.reduce<ValueComponent | null>((acc, value) => {
            if (!acc) {
                return value;
            }
            return new BinaryExpression(acc, 'and', value);
        }, null);
    }

    // Combine all action queries via UNION ALL so the count can see every simulated row.
    private static combineSelects(selects: SimpleSelectQuery[]): SelectQuery {
        if (selects.length === 1) {
            return selects[0];
        }
        let combined = new BinarySelectQuery(selects[0], 'union all', selects[1]);
        for (let i = 2; i < selects.length; i++) {
            combined = combined.unionAll(selects[i]);
        }
        return combined;
    }

    // Build the simple SELECT clause that yields one row per matched action.
    private static buildLiteralSelectClause(): SelectClause {
        return new SelectClause([new SelectItem(new LiteralValue(1))]);
    }

    // Summarize the merged action stream by counting every row that survived the union.
    private static buildCountSelectClause(): SelectClause {
        const countFunction = new FunctionCall(null, 'count', new RawString('*'), null);
        const selectItem = new SelectItem(countFunction, 'count');
        return new SelectClause([selectItem]);
    }

    private static buildFixtureCtes(fixtures: FixtureTableDefinition[]): CommonTable[] {
        if (!fixtures || fixtures.length === 0) {
            return [];
        }
        return FixtureCteBuilder.buildFixtures(fixtures);
    }

    private static collectPhysicalTableReferences(query: SelectQuery, withClause: WithClause | null): Set<string> {
        const referencedTables = this.collectReferencedTables(query);
        const ignoredTables = this.collectCteNamesFromWithClause(withClause);

        const tablesToShadow = new Set<string>();
        // Retain only tables that are not defined via WITH clauses so fixtures shadow physical sources.
        for (const table of referencedTables) {
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
        // Keep fixtures only for tables that actually appear in the converted SELECT.
        for (const fixture of fixtures) {
            if (referencedTables.has(this.normalizeIdentifier(fixture.tableName))) {
                filtered.push(fixture);
            }
        }

        return filtered;
    }

    private static extractTargetTableName(target: SourceExpression): string {
        const datasource = target.datasource;
        if (datasource instanceof TableSource) {
            return datasource.getSourceName();
        }
        throw new Error('Merge target must be a table source for conversion.');
    }

    private static buildFixtureTableMap(fixtures: FixtureTableDefinition[]): Map<string, FixtureTableDefinition> {
        const map = new Map<string, FixtureTableDefinition>();
        for (const fixture of fixtures) {
            map.set(this.normalizeIdentifier(fixture.tableName), fixture);
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

        // Compare the referenced tables against the fixtures that were supplied.
        const missingTables = this.getMissingFixtureTables(referencedTables, fixtureMap);
        if (missingTables.length === 0) {
            return;
        }

        if (strategy === 'error') {
            throw new Error(`Merge SELECT refers to tables without fixture coverage: ${missingTables.join(', ')}.`);
        }
    }

    // Use the collector to track every concrete table source referenced by the SELECT.
    private static collectReferencedTables(query: SelectQuery): Set<string> {
        const collector = new TableSourceCollector(false);
        const sources = collector.collect(query);
        const normalized = new Set<string>();
        for (const source of sources) {
            normalized.add(this.normalizeIdentifier(source.getSourceName()));
        }
        return normalized;
    }

    // Track CTE aliases so those names are ignored when validating fixtures.
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

    // Return every referenced table that lacks an overriding fixture definition.
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

    // Prepend fixture CTEs ahead of the existing WITH clause so they shadow real tables.
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
