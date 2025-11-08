import { SelectQueryParser, SqlFormatter } from 'rawsql-ts';
import type { SimpleSelectQuery } from 'rawsql-ts';
import { MissingFixtureError, QueryRewriteError, SchemaValidationError } from '../errors';
import { FixtureStore } from '../fixtures/FixtureStore';
import { normalizeIdentifier } from '../fixtures/naming';
import { createLogger } from '../logger/NoopLogger';
import type {
  MissingFixtureStrategy,
  SelectRewriteContext,
  SelectRewriteResult,
  SelectRewriterOptions,
  TestkitLogger,
} from '../types';
import { SqliteValuesBuilder } from '../sql/SqliteValuesBuilder';
import type { FixtureCteDefinition } from '../sql/SqliteValuesBuilder';
import { SelectAnalyzer } from './SelectAnalyzer';

export class SelectFixtureRewriter {
  private readonly fixtureStore: FixtureStore;
  private readonly analyzer = new SelectAnalyzer();
  private readonly logger: TestkitLogger;
  private readonly missingFixtureStrategy: MissingFixtureStrategy;
  private readonly passthrough: Set<string>;
  private readonly wildcardPassthrough: boolean;
  private readonly formatter = new SqlFormatter({
    preset: 'sqlite',
    newline: ' ',
    withClauseStyle: 'full-oneline',
    exportComment: 'top-header-only',
  });

  constructor(options: SelectRewriterOptions = {}) {
    this.fixtureStore = new FixtureStore(options.fixtures ?? [], options.schema);
    this.logger = createLogger(options.logger);
    this.missingFixtureStrategy = options.missingFixtureStrategy ?? 'error';
    const passthrough = options.passthroughTables ?? [];
    this.wildcardPassthrough = passthrough.includes('*');
    this.passthrough = new Set(passthrough.filter((value) => value !== '*').map((value) => normalizeIdentifier(value)));
  }

  public rewrite(sql: string, context?: SelectRewriteContext): SelectRewriteResult {
    try {
      const analysis = this.analyzer.analyze(sql);
      const fixtureMap = this.fixtureStore.withOverrides(context?.fixtures);
      const fixturesApplied: string[] = [];
      const cteDefinitions: FixtureCteDefinition[] = [];

      for (const table of analysis.tableNames) {
        if (this.isPassthrough(table)) {
          continue;
        }

        if (analysis.cteNames.includes(table)) {
          this.logger.debug?.('Skipping fixture because query already defines CTE', { table });
          continue;
        }

        const fixture = fixtureMap.get(table);
        if (!fixture) {
          this.handleMissingFixture(table);
          continue;
        }

        cteDefinitions.push(SqliteValuesBuilder.buildCTE(fixture));
        fixturesApplied.push(fixture.name);
      }

      const rewritten = this.mergeWithClause(sql, cteDefinitions);
      return {
        sql: rewritten,
        fixturesApplied,
      };
    } catch (error) {
      if (error instanceof MissingFixtureError || error instanceof SchemaValidationError) {
        throw error;
      }
      throw new QueryRewriteError('Failed to rewrite SELECT statement.', error);
    }
  }

  private isPassthrough(tableName: string): boolean {
    if (this.wildcardPassthrough) {
      return true;
    }
    return this.passthrough.has(tableName);
  }

  private handleMissingFixture(table: string): void {
    if (this.missingFixtureStrategy === 'error') {
      throw new MissingFixtureError(table);
    }

    if (this.missingFixtureStrategy === 'warn') {
      this.logger.warn?.('Missing fixture falls back to passthrough table access.', { table });
    }
  }

  private mergeWithClause(sql: string, cteDefinitions: FixtureCteDefinition[]): string {
    if (cteDefinitions.length === 0) {
      return sql;
    }

    // Parse the SQL into an AST so we can attach fixtures even when comments or existing WITH clauses exist.
    const parsedQuery = SelectQueryParser.parse(sql);
    const simpleQuery = parsedQuery.toSimpleQuery();
    const fixtureNames: string[] = [];

    for (const cte of cteDefinitions) {
      fixtureNames.push(cte.name);
      simpleQuery.addCTE(cte.name, cte.query);
    }

    this.promoteFixtureCtes(simpleQuery, fixtureNames);

    // Emit the final SQL with one-line formatting and top-level header comments only.
    const { formattedSql } = this.formatter.format(simpleQuery);
    return formattedSql;
  }

  private promoteFixtureCtes(query: SimpleSelectQuery, fixtureNames: string[]): void {
    if (!query.withClause || fixtureNames.length === 0) {
      return;
    }

    // Preserve insertion order so query-defined CTEs remain after injected fixtures.
    const fixtureOrder = new Map<string, number>();
    fixtureNames.forEach((name, index) => fixtureOrder.set(name, index));

    const fixtureTables: (typeof query.withClause.tables[number] | undefined)[] = new Array(fixtureNames.length);
    const userTables: typeof query.withClause.tables = [];

    for (const table of query.withClause.tables) {
      const alias = table.aliasExpression.table.name;
      const order = fixtureOrder.get(alias);
      if (order === undefined) {
        userTables.push(table);
        continue;
      }
      fixtureTables[order] = table;
    }

    query.withClause.tables = fixtureTables
      .filter((table): table is typeof query.withClause.tables[number] => Boolean(table))
      .concat(userTables);
  }
}
