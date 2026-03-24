import { SelectQueryParser, SqlFormatter, splitQueries, normalizeTableName } from 'rawsql-ts';
import type { SimpleSelectQuery, SqlFormatterOptions } from 'rawsql-ts';
import {
  MissingFixtureError,
  QueryRewriteError,
  SchemaValidationError,
} from '../errors';
import type { MissingFixtureColumnDetail } from '../errors';
import { FixtureStore } from '../fixtures/FixtureStore';
import type { NormalizedFixture } from '../fixtures/FixtureStore';
import { TableNameResolver } from '../fixtures/TableNameResolver';
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
import {
  collectSelectReservationNames,
  createCollisionAwareFixtureAliasMap,
  rewriteSelectFixtureReferences,
} from './fixtureAliasing';
import type { SelectAnalysisResult } from './SelectAnalyzer';

const DEFAULT_FORMATTER_OPTIONS: SqlFormatterOptions = {
  preset: 'sqlite',
  newline: ' ',
  withClauseStyle: 'full-oneline',
  exportComment: 'top-header-only',
};

/**
 * Rewrites SELECT statements by injecting fixture CTEs so tests can run without physical tables.
 */
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
  private readonly tableNameResolver?: TableNameResolver;

  constructor(options: SelectRewriterOptions = {}) {
    this.tableNameResolver = options.tableNameResolver;
    this.fixtureStore = new FixtureStore(options.fixtures ?? [], options.schema, this.tableNameResolver);
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

  /**
   * Rewrites the provided SQL text, applying fixtures and formatting the final query.
   * @param sql - Original SQL that may include multiple statements.
   * @param context - Optional rewrite customization hooks.
   */
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

      const cteDefinitions = [...fixtureMap.values()].map((fixture) =>
        SqliteValuesBuilder.buildCTE(fixture)
      );
      if (cteDefinitions.length === 0) {
        return { sql, fixturesApplied: [] };
      }

      const rewritten = this.mergeWithClause(sql, cteDefinitions, context, false);
      return {
        sql: rewritten,
        fixturesApplied: [...new Set(cteDefinitions.map((cte) => cte.name))],
      };
    }

    const existingCteNames = new Set(analysis.cteNames);
    const targetTables = [...new Set(analysis.tableNames)];
    const parsedQuery = SelectQueryParser.parse(sql).toSimpleQuery();
    const fixtureTargets: Array<{
      table: string;
      fixture: NormalizedFixture;
      exactConflict: boolean;
    }> = [];
    const exactConflictCtes: FixtureCteDefinition[] = [];
    const fixturesApplied: string[] = [];

    for (const table of targetTables) {
      if (this.isPassthrough(table)) {
        continue;
      }

      const fixture = fixtureMap.get(table);
      const isQueryDefinedCte = existingCteNames.has(table);

      if (!fixture) {
        if (isQueryDefinedCte) {
          // Reference points to a CTE defined inside the query, so no fixture is required.
          continue;
        }
        // Surface actionable diagnostics when a referenced table does not have a fixture.
        const columnDescriptor = this.fixtureStore.describeColumns(table);
        const schemaColumns = columnDescriptor?.columns.map((column) => ({
          name: column.name,
          typeName: column.typeName,
        }));
        this.handleMissingFixture(table, sql, schemaColumns, columnDescriptor?.source);
        continue;
      }

      if (isQueryDefinedCte) {
        if (this.cteConflictBehavior === 'error') {
          throw new QueryRewriteError(`Fixture CTE "${table}" conflicts with query-defined CTE.`);
        }
        exactConflictCtes.push(
          SqliteValuesBuilder.buildCTE({
            ...fixture,
            name: table,
          })
        );
        fixtureTargets.push({ table, fixture, exactConflict: true });
        if (!fixturesApplied.includes(fixture.name)) {
          fixturesApplied.push(fixture.name);
        }
        continue;
      }

      fixtureTargets.push({ table, fixture, exactConflict: false });
      if (!fixturesApplied.includes(fixture.name)) {
        fixturesApplied.push(fixture.name);
      }
    }

    if (fixtureTargets.length === 0) {
      return { sql, fixturesApplied };
    }

    const aliasedTargets = fixtureTargets.filter((target) => !target.exactConflict);
    const aliasMap = createCollisionAwareFixtureAliasMap(
      aliasedTargets.map((target) => target.table),
      collectSelectReservationNames(parsedQuery),
      this.tableNameResolver
    );
    const cteDefinitions: FixtureCteDefinition[] = aliasedTargets.map((target) => {
      const alias = aliasMap.get(this.tableNameResolver?.resolve(target.table) ?? normalizeTableName(target.table))
        ?? target.fixture.name;
      return SqliteValuesBuilder.buildCTE({
        ...target.fixture,
        name: alias,
      });
    });

    rewriteSelectFixtureReferences(parsedQuery, aliasMap, this.tableNameResolver);
    for (const target of fixtureTargets) {
      if (!target.exactConflict) {
        continue;
      }
      const cte = exactConflictCtes.find((definition) => definition.name === target.table);
      if (cte) {
        parsedQuery.replaceCTE(target.table, cte.query);
      }
    }
    for (const cte of cteDefinitions) {
      parsedQuery.addCTE(cte.name, cte.query);
    }
    this.promoteFixtureCtes(parsedQuery, cteDefinitions.map((cte) => cte.name));

    const formatter = this.createFormatter(context);
    const { formattedSql } = formatter.format(parsedQuery);
    return {
      sql: formattedSql,
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
