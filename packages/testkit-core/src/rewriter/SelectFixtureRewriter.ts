import { SelectQueryParser, SqlFormatter, splitQueries } from 'rawsql-ts';
import type { SimpleSelectQuery, SqlFormatterOptions } from 'rawsql-ts';
import {
  MissingFixtureError,
  QueryRewriteError,
  SchemaValidationError,
} from '../errors';
import type { MissingFixtureColumnDetail } from '../errors';
import { FixtureStore } from '../fixtures/FixtureStore';
import { normalizeIdentifier } from '../fixtures/naming';
import { createLogger } from '../logger/NoopLogger';
import type {
  AnalyzerFailureBehavior,
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
  private readonly analyzerFailureBehavior: AnalyzerFailureBehavior;

  constructor(options: SelectRewriterOptions = {}) {
    this.fixtureStore = new FixtureStore(options.fixtures ?? [], options.schema, options.tableNameResolver);
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
    this.analyzerFailureBehavior = options.analyzerFailureBehavior ?? 'error';
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
    const analyzerFailureBehavior = this.resolveAnalyzerFailureBehavior(context);

    let analysis: SelectAnalysisResult | null = null;
    let analyzerError: unknown = null;
    try {
      analysis = this.analyzer.analyze(sql);
    } catch (error) {
      analyzerError = error;
      // Preserve the root cause for diagnostics while deferring the final decision to the configured fallback strategy.
      this.logger.debug?.('Falling back to raw WITH merge due to analyzer failure.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!analysis) {
      if (this.isDclStatement(sql)) {
        // DCL statements remain untouched because fixture injection would corrupt their syntax.
        return { sql, fixturesApplied: [] };
      }

      if (analyzerFailureBehavior === 'skip') {
        // Allow callers to opt out of rewrites when analyzer support is missing.
        return { sql, fixturesApplied: [] };
      }

      if (analyzerFailureBehavior === 'error') {
        const cause = analyzerError instanceof Error ? analyzerError : undefined;
        throw new QueryRewriteError(
          'Analyzer failed to process SQL statement; provide a SELECT query or set analyzerFailureBehavior to "inject".',
          cause
        );
      }
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
        // Surface actionable diagnostics when a referenced table does not have a fixture.
        const columnDescriptor = this.fixtureStore.describeColumns(table);
        const schemaColumns = columnDescriptor?.columns.map((column) => ({
          name: column.name,
          affinity: column.affinity,
        }));
        this.handleMissingFixture(table, sql, schemaColumns, columnDescriptor?.source);
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

  private resolveAnalyzerFailureBehavior(context?: SelectRewriteContext): AnalyzerFailureBehavior {
    return context?.analyzerFailureBehavior ?? this.analyzerFailureBehavior;
  }

  /**
   * Skips statements that are clearly DCL (Data Control Language).
   * In theory, this should be detected via AST analysis,
   * but since DCL is outside the supported syntax scope of this library,
   * we use a lightweight prefix check as a simple safeguard.
   *
   * @param {string} sql - The SQL text to inspect.
   * @returns {boolean} True if the statement appears to be a DCL statement; otherwise, false.
   */
  private isDclStatement(sql: string): boolean {
    const normalized = sql.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return /^(set|reset|grant|revoke)\b/.test(normalized);
  }

  private isPassthrough(tableName: string): boolean {
    if (this.wildcardPassthrough) {
      return true;
    }
    return this.passthrough.has(tableName);
  }

  private handleMissingFixture(
    table: string,
    sql: string,
    schemaColumns?: MissingFixtureColumnDetail[],
    schemaSource?: 'fixture' | 'schema'
  ): void {
    if (this.missingFixtureStrategy === 'error') {
      throw new MissingFixtureError({
        tableName: table,
        sql,
        strategy: this.missingFixtureStrategy,
        schemaColumns,
        schemaSource,
      });
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
