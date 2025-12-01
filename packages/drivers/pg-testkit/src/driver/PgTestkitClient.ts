import type { QueryResult, QueryResultRow } from 'pg';
import { DefaultFixtureProvider, ResultSelectRewriter } from '@rawsql-ts/testkit-core';
import type {
  CreatePgTestkitClientOptions,
  PgQueryInput,
  PgQueryable,
} from '../types';
import { DdlFixtureLoader, alignRewrittenParameters, applyCountWrapper } from '@rawsql-ts/testkit-core';
import type { DdlProcessedFixture } from '@rawsql-ts/testkit-core';
import type { TableDefinitionModel, TableRowsFixture } from '../types';
import { validateFixtureRowsAgainstTableDefinitions } from '../utils/fixtureValidation';

/**
 * Lightweight client that rewrites CRUD/SELECT statements into fixture-backed SELECTs
 * and delegates execution to a real `pg` connection.
 *
 * Consumers can use this in place of `pg.Client` during tests; production code can stay
 * unaware of pg-testkit as long as it relies on the standard `query` API.
 */
export class PgTestkitClient {
  private connection?: PgQueryable;
  private readonly rewriter: ResultSelectRewriter;
  private readonly ddlFixtures: DdlProcessedFixture[];

  constructor(
    private readonly options: CreatePgTestkitClientOptions,
    private readonly scopedRows?: TableRowsFixture[],
    seedConnection?: PgQueryable
  ) {
    this.ddlFixtures = this.loadDdlFixtures();
    const tableDefinitions = this.collectDefinitions();
    // Validate fixtures declared by callers so typographical errors fail during client setup.
    validateFixtureRowsAgainstTableDefinitions(this.options.tableRows, tableDefinitions, 'base tableRows');
    validateFixtureRowsAgainstTableDefinitions(scopedRows, tableDefinitions, 'scoped fixtures');

    const fixtureStore = new DefaultFixtureProvider(
      tableDefinitions,
      this.collectBaseRows()
    );
    this.rewriter = new ResultSelectRewriter(
      fixtureStore,
      options.missingFixtureStrategy ?? 'error',
      options.formatterOptions
    );
    this.connection = seedConnection;
  }

  private collectDefinitions(): TableDefinitionModel[] {
    // Combine DDL-derived definitions with any explicit configuration the user provided.
    return [
      ...this.ddlFixtures.map((fixture) => fixture.tableDefinition),
      ...(this.options.tableDefinitions ?? []),
    ];
  }

  private collectBaseRows(): TableRowsFixture[] {
    const ddlRows: TableRowsFixture[] = [];
    for (const fixture of this.ddlFixtures) {
      if (!fixture.rows || fixture.rows.length === 0) {
        continue;
      }
      ddlRows.push({ tableName: fixture.tableDefinition.name, rows: fixture.rows });
    }
    // DDL rows are merged before caller-supplied ones so test authors can override them.
    return [...ddlRows, ...(this.options.tableRows ?? [])];
  }

  /**
   * Executes SQL after rewriting it to use fixture-backed CTEs. CRUD statements are converted
   * to result-producing SELECTs; unsupported DDL is ignored.
   *
   * @param textOrConfig SQL text or pg QueryConfig
   * @param values Optional positional parameters
   * @returns pg-style QueryResult with rows simulated from fixtures
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    textOrConfig: PgQueryInput,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    const sql = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
    if (!sql) {
      throw new Error('Query text is required for pg-testkit execution.');
    }

    // Rewrite CRUD and SELECT statements into fixture-backed SELECT queries.
    const rewritten = this.rewriter.rewrite(sql, this.scopedRows);
    if (!rewritten.sql) {
      return this.buildEmptyResult<T>('NOOP');
    }

    // Align caller-supplied parameters with the rewritten placeholders to keep numbering contiguous.
    const incomingParams =
      typeof textOrConfig === 'string'
        ? values
        : values ??
          (textOrConfig as { values?: unknown[]; params?: unknown[] }).values ??
          (textOrConfig as { values?: unknown[]; params?: unknown[] }).params;

    const normalizeResult = alignRewrittenParameters(rewritten.sql, incomingParams);
    const payload =
      typeof textOrConfig === 'string'
        ? normalizeResult.sql
        : { ...textOrConfig, text: normalizeResult.sql, values: normalizeResult.params };
    const connection = await this.getConnection();

    this.options.onExecute?.(normalizeResult.sql, normalizeResult.params, rewritten.fixturesApplied);

    const rawResult = typeof payload === 'string'
      ? await connection.query<T>(payload, normalizeResult.params)
      : await connection.query<T>(payload);

    return applyCountWrapper(rawResult, rewritten.sourceCommand, rewritten.isCountWrapper);
  }

  /**
   * Derives a scoped client that overlays additional fixtures while reusing the same connection.
   */
  public withFixtures(fixtures: TableRowsFixture[]): PgTestkitClient {
    return new PgTestkitClient(this.options, fixtures, this.connection);
  }

  /**
   * Disposes the underlying connection or returns it to the pool if `release` is available.
   */
  public async close(): Promise<void> {
    if (!this.connection) {
      return;
    }

    const closable = this.connection;
    this.connection = undefined;

    if (typeof closable.release === 'function') {
      closable.release();
      return;
    }

    if (typeof closable.end === 'function') {
      await closable.end();
    }
  }

  private async getConnection(): Promise<PgQueryable> {
    if (this.connection) {
      return this.connection;
    }

    this.connection = await this.options.connectionFactory();
    return this.connection;
  }

  private buildEmptyResult<T extends QueryResultRow>(command: string): QueryResult<T> {
    return {
      command,
      rowCount: 0,
      oid: 0,
      rows: [],
      fields: [],
    };
  }

  private loadDdlFixtures(): DdlProcessedFixture[] {
    if (!this.options.ddl?.directories?.length) {
      return [];
    }

    const loader = new DdlFixtureLoader(this.options.ddl);
    return loader.getFixtures();
  }
}

/** Factory that instantiates a `PgTestkitClient` with the provided fixture-driven options. */
export const createPgTestkitClient = (options: CreatePgTestkitClientOptions): PgTestkitClient => {
  return new PgTestkitClient(options);
};
