import { MissingFixtureError, QueryRewriteError, SchemaValidationError } from '../errors';
import { FixtureStore } from '../fixtures/FixtureStore';
import { normalizeIdentifier } from '../fixtures/naming';
import { createLogger } from '../logger/NoopLogger';
import type {
  MissingFixtureStrategy,
  SelectRewriteContext,
  SelectRewriteResult,
  SelectRewriterOptions,
  TableFixture,
  TestkitLogger,
} from '../types';
import { SqliteValuesBuilder } from '../sql/SqliteValuesBuilder';
import { SelectAnalyzer } from './SelectAnalyzer';

export class SelectFixtureRewriter {
  private readonly fixtureStore: FixtureStore;
  private readonly analyzer = new SelectAnalyzer();
  private readonly logger: TestkitLogger;
  private readonly missingFixtureStrategy: MissingFixtureStrategy;
  private readonly passthrough: Set<string>;
  private readonly wildcardPassthrough: boolean;

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
      const cteDefinitions: string[] = [];

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

  private mergeWithClause(sql: string, cteDefinitions: string[]): string {
    if (cteDefinitions.length === 0) {
      return sql;
    }

    const fixtureSql = cteDefinitions.join(',\n');
    const withPattern = /^(\s*WITH\s+(?:RECURSIVE\s+)?)/i;
    const match = sql.match(withPattern);

    if (match) {
      const prefix = match[0];
      const remainder = sql.slice(prefix.length);
      const separator = remainder.trimStart().length > 0 ? ',\n' : '\n';
      return `${prefix}${fixtureSql}${separator}${remainder}`;
    }

    return `WITH ${fixtureSql}\n${sql}`;
  }
}
