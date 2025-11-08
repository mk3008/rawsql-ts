import { SelectQueryParser, SqlFormatter, splitQueries } from 'rawsql-ts';
import type { SimpleSelectQuery, SqlFormatterOptions } from 'rawsql-ts';
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
import type { SelectAnalysisResult } from './SelectAnalyzer';

const DEFAULT_FORMATTER_OPTIONS: SqlFormatterOptions = {
  preset: 'sqlite',
  newline: ' ',
  withClauseStyle: 'full-oneline',
  exportComment: 'top-header-only',
};

export class SelectFixtureRewriter {
  private readonly fixtureStore: FixtureStore;
  private readonly analyzer = new SelectAnalyzer();
  private readonly logger: TestkitLogger;
  private readonly missingFixtureStrategy: MissingFixtureStrategy;
  private readonly passthrough: Set<string>;
  private readonly wildcardPassthrough: boolean;
  private readonly formatterOptions: SqlFormatterOptions;
  private readonly cteConflictBehavior: 'error' | 'override';

  constructor(options: SelectRewriterOptions = {}) {
    this.fixtureStore = new FixtureStore(options.fixtures ?? [], options.schema);
    this.logger = createLogger(options.logger);
    this.missingFixtureStrategy = options.missingFixtureStrategy ?? 'error';
    const passthrough = options.passthroughTables ?? [];
    this.wildcardPassthrough = passthrough.includes('*');
    this.passthrough = new Set(passthrough.filter((value) => value !== '*').map((value) => normalizeIdentifier(value)));
    this.formatterOptions = {
      ...DEFAULT_FORMATTER_OPTIONS,
      ...(options.formatterOptions ?? {}),
    };
    this.cteConflictBehavior = options.cteConflictBehavior ?? 'error';
  }

  public rewrite(sql: string, context?: SelectRewriteContext): SelectRewriteResult {
    try {
      // Split multi-statement SQL and handle each query independently so fixtures are injected per statement.
      const queries = splitQueries(sql);
      const meaningfulQueries = queries.getNonEmpty();

      if (meaningfulQueries.length <= 1) {
        return this.rewriteSingleQuery(sql, context);
      }

      const fixturesApplied = new Set<string>();
      const rewrittenSegments: string[] = [];

      for (const query of meaningfulQueries) {
        const result = this.rewriteSingleQuery(query.sql, context);
        result.fixturesApplied.forEach((fixture) => {
          if (!fixturesApplied.has(fixture)) {
            fixturesApplied.add(fixture);
          }
        });
        rewrittenSegments.push(this.ensureTerminated(result.sql));
      }

      return {
        sql: rewrittenSegments.join(' ').trim(),
        fixturesApplied: [...fixturesApplied],
      };
    } catch (error) {
      if (
        error instanceof MissingFixtureError ||
        error instanceof SchemaValidationError ||
        error instanceof QueryRewriteError
      ) {
        throw error;
      }
      throw new QueryRewriteError('Failed to rewrite SELECT statement.', error);
    }
  }

  private rewriteSingleQuery(sql: string, context?: SelectRewriteContext): SelectRewriteResult {
    const fixtureMap = this.fixtureStore.withOverrides(context?.fixtures);

    let analysis: SelectAnalysisResult | null = null;
    try {
      analysis = this.analyzer.analyze(sql);
    } catch (error) {
      // Fall back to regex insertion later; over-inject fixtures because dependencies are unknown.
      this.logger.debug?.('Falling back to raw WITH merge due to analyzer failure.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const existingCteNames = analysis ? new Set(analysis.cteNames) : undefined;
    const targetTables = analysis ? [...new Set(analysis.tableNames)] : [...fixtureMap.keys()];
    const cteDefinitions: FixtureCteDefinition[] = [];
    const scheduledFixtures = new Set<string>();
    const fixturesApplied: string[] = [];

    for (const table of targetTables) {
      if (this.isPassthrough(table)) {
        continue;
      }

      const fixture = fixtureMap.get(table);
      const isQueryDefinedCte = existingCteNames?.has(table) ?? false;

      if (!fixture) {
        if (isQueryDefinedCte) {
          // Reference points to a CTE defined inside the query, so no fixture is required.
          continue;
        }
        this.handleMissingFixture(table);
        continue;
      }

      cteDefinitions.push(SqliteValuesBuilder.buildCTE(fixture));
      scheduledFixtures.add(table);
      if (!fixturesApplied.includes(fixture.name)) {
        fixturesApplied.push(fixture.name);
      }
    }

    if (existingCteNames) {
      for (const cteName of existingCteNames) {
        if (scheduledFixtures.has(cteName)) {
          continue;
        }
        const fixture = fixtureMap.get(cteName);
        if (!fixture) {
          continue;
        }
        cteDefinitions.push(SqliteValuesBuilder.buildCTE(fixture));
        scheduledFixtures.add(cteName);
        if (!fixturesApplied.includes(fixture.name)) {
          fixturesApplied.push(fixture.name);
        }
      }
    }

    if (cteDefinitions.length === 0) {
      return { sql, fixturesApplied };
    }

    const rewritten = this.mergeWithClause(sql, cteDefinitions, context, Boolean(analysis), existingCteNames);
    return {
      sql: rewritten,
      fixturesApplied,
    };
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

  private mergeWithClause(
    sql: string,
    cteDefinitions: FixtureCteDefinition[],
    context: SelectRewriteContext | undefined,
    preferAst: boolean,
    conflictingCteNames?: Set<string>
  ): string {
    if (cteDefinitions.length === 0) {
      return sql;
    }

    if (preferAst) {
      try {
        return this.mergeWithClauseAst(sql, cteDefinitions, context, conflictingCteNames);
      } catch (error) {
        if (error instanceof QueryRewriteError) {
          throw error;
        }
        // Analyzer succeeded but the final formatting failed; fall back to regex merge.
        this.logger.debug?.('AST-based WITH merge failed, using regex fallback.', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return this.mergeWithClauseFallback(sql, cteDefinitions);
  }

  private mergeWithClauseAst(
    sql: string,
    cteDefinitions: FixtureCteDefinition[],
    context?: SelectRewriteContext,
    conflictingCteNames?: Set<string>
  ): string {
    const parsedQuery = SelectQueryParser.parse(sql);
    const simpleQuery = parsedQuery.toSimpleQuery();
    const fixtureNames: string[] = [];

    for (const cte of cteDefinitions) {
      fixtureNames.push(cte.name);
      const normalizedName = cte.name.toLowerCase();
      const conflicts = conflictingCteNames?.has(normalizedName) ?? false;
      if (conflicts) {
        if (this.cteConflictBehavior === 'override') {
          // Replace user-defined definition so fixtures always win when requested.
          simpleQuery.replaceCTE(cte.name, cte.query);
        } else {
          throw new QueryRewriteError(`Fixture CTE "${cte.name}" conflicts with query-defined CTE.`);
        }
      } else {
        simpleQuery.addCTE(cte.name, cte.query);
      }
    }

    this.promoteFixtureCtes(simpleQuery, fixtureNames);
    const formatter = this.createFormatter(context);
    const { formattedSql } = formatter.format(simpleQuery);
    return formattedSql;
  }

  private mergeWithClauseFallback(sql: string, cteDefinitions: FixtureCteDefinition[]): string {
    const fixtureSql = cteDefinitions.map((cte) => cte.inlineSql).join(', ');
    const withPattern = /^(\s*WITH\s+(?:RECURSIVE\s+)?)/i;
    const match = sql.match(withPattern);

    if (match) {
      const prefix = match[0];
      const remainder = sql.slice(prefix.length);
      const separator = remainder.trimStart().length > 0 ? ', ' : ' ';
      return `${prefix}${fixtureSql}${separator}${remainder}`;
    }

    return `WITH ${fixtureSql} ${sql}`.trim();
  }

  private promoteFixtureCtes(query: SimpleSelectQuery, fixtureNames: string[]): void {
    if (!query.withClause || fixtureNames.length === 0) {
      return;
    }

    // Preserve requested CTE ordering so fixture definitions always appear before user CTEs.
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

  private ensureTerminated(sql: string): string {
    const trimmed = sql.trim();
    if (trimmed.endsWith(';')) {
      return trimmed;
    }
    return `${trimmed};`;
  }

  private createFormatter(context?: SelectRewriteContext): SqlFormatter {
    const override = context?.formatterOptions;
    const options = override ? { ...this.formatterOptions, ...override } : this.formatterOptions;
    return new SqlFormatter(options);
  }
}
