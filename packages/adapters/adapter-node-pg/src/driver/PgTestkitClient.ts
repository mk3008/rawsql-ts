import type {
  FieldDef,
  QueryConfig,
  QueryResult,
  QueryResultRow,
} from 'pg';
import {
  createPostgresTestkitClient,
  type PostgresTestkitClient,
  type Row,
} from '@rawsql-ts/testkit-postgres';
import type { CountableResult } from '@rawsql-ts/testkit-core';
import type {
  CreatePgTestkitClientOptions,
  PgQueryInput,
  PgQueryable,
  TableRowsFixture,
} from '../types';
import { compileNamedParameters, type NamedParams } from './compileNamedParameters';

const RESULT_METADATA_KEY = Symbol('PgTestkitClientResultMetadata');

type RowsWithResultMetadata = Row[] & {
  [RESULT_METADATA_KEY]?: QueryResult<Row>;
};

/** A pg-compatible client that routes SQL through @rawsql-ts/testkit-postgres fixtures. */
export class PgTestkitClient {
  private readonly testkit: PostgresTestkitClient;
  private connection?: PgQueryable;
  private connectionPromise?: Promise<PgQueryable>;
  private released = false;

  /**
   * @param options - Fixture/DDL configuration plus the connection factory to wrap.
   * @param testkit - Optional testkit client instance used for scoped fixtures.
   * @param connection - Optional PgQueryable to share across helpers.
   */
  constructor(
    private readonly options: CreatePgTestkitClientOptions,
    testkit?: PostgresTestkitClient,
    connection?: PgQueryable
  ) {
    this.connection = connection;
    this.testkit = testkit ?? this.buildTestkit();
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    textOrConfig: PgQueryInput,
    values?: unknown[] | NamedParams
  ): Promise<QueryResult<T>>;
  public query<R extends any[] = any[], I = any[]>(
    queryConfig: QueryConfig<I>,
    values?: QueryConfig['values']
  ): Promise<any>;
  public query(...args: unknown[]): unknown {
    const [queryTextOrConfig, valuesOrCallback, callbackOrUndefined] = args as [
      PgQueryInput,
      unknown[] | ((err: Error, result: QueryResult<QueryResultRow>) => void) | undefined,
      ((err: Error, result: QueryResult<QueryResultRow>) => void) | undefined
    ];
    const callback = typeof valuesOrCallback === 'function' ? valuesOrCallback : callbackOrUndefined;
    const values = typeof valuesOrCallback === 'function' ? undefined : (valuesOrCallback as unknown[] | undefined);

    const payload =
      typeof queryTextOrConfig === 'string'
        ? queryTextOrConfig
        : {
            text: queryTextOrConfig.text,
            values: queryTextOrConfig.values ?? queryTextOrConfig.params ?? values,
          };

    const normalized = this.normalizeQuery(
      typeof payload === 'string' ? payload : payload.text,
      typeof payload === 'string' ? values : payload.values
    );

    const execution = this.testkit.query(
      normalized.sql,
      normalized.values
    );
    const finalize = (result: CountableResult<Row>) =>
      this.toQueryResult(result, this.extractMetadata(result.rows));

    if (typeof callback === 'function') {
      execution
        .then((result) => callback(null as unknown as Error, finalize(result)))
        .catch((error) => {
          callback(error as Error, undefined as unknown as QueryResult<QueryResultRow>);
        });
      return undefined;
    }

    return execution.then(finalize, (error) => {
      throw error;
    });
  }

  public withFixtures(fixtures: TableRowsFixture[]): PgTestkitClient {
    const scopedTestkit = this.testkit.withFixtures(fixtures);
    return new PgTestkitClient(this.options, scopedTestkit, this.connection);
  }

  public async close(): Promise<void> {
    await this.testkit.close();
  }

  private buildTestkit(): PostgresTestkitClient {
    return createPostgresTestkitClient({
      queryExecutor: async (sql, params) => {
        const pgResult = await this.executeQuery(sql, params);
        const rowsWithMetadata = pgResult.rows as RowsWithResultMetadata;
        Object.defineProperty(rowsWithMetadata, RESULT_METADATA_KEY, {
          value: pgResult,
          configurable: true,
        });
        return pgResult.rows;
      },
      tableDefinitions: this.options.tableDefinitions,
      tableRows: this.options.tableRows,
      formatterOptions: this.options.formatterOptions,
      missingFixtureStrategy: this.options.missingFixtureStrategy,
      ddl: this.options.ddl,
      defaultSchema: this.options.defaultSchema,
      searchPath: this.options.searchPath,
      onExecute: this.options.onExecute,
      disposeExecutor: () => this.releaseConnection(),
    });
  }

  private async executeQuery(
    sql: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    const connection = await this.getConnection();
    return connection.query<Row>(sql, params as unknown[]);
  }

  private normalizeQuery(
    sql: string,
    params?: unknown[] | NamedParams
  ): { sql: string; values?: unknown[] } {
    if (!params) {
      return { sql, values: undefined };
    }

    if (Array.isArray(params)) {
      return { sql, values: params };
    }

    const compiled = compileNamedParameters(sql, params, 'pg-indexed');
    return { sql: compiled.sql, values: compiled.values };
  }

  private extractMetadata(rows: Row[]): QueryResult<Row> | undefined {
    const rowsWithMetadata = rows as RowsWithResultMetadata;
    const metadata = rowsWithMetadata[RESULT_METADATA_KEY];
    if (metadata) {
      delete rowsWithMetadata[RESULT_METADATA_KEY];
    }
    return metadata;
  }

  private toQueryResult(result: CountableResult<Row>, metadata?: QueryResult<Row>): QueryResult<Row> {
    const command = result.command ?? metadata?.command ?? 'select';
    const rowCount = result.rowCount ?? metadata?.rowCount ?? 0;
    const fields = (metadata?.fields ?? (result.fields ?? [])) as FieldDef[];
    const columnNames = fields.map((field) => field.name);
    const rows = result.rows.map((row) => {
      const record = row as Record<string, unknown>;
      Object.defineProperty(record, 'reduce', {
        value: (callback: (accumulator: unknown, value: unknown, index: number) => unknown, initialValue: unknown) => {
          let accumulator = initialValue;
          for (let index = 0; index < columnNames.length; index++) {
            accumulator = callback(accumulator, record[columnNames[index]], index);
          }
          return accumulator;
        },
        enumerable: false,
      });
      return record;
    });
    return {
      command,
      fields,
      oid: 0,
      rowCount,
      rows,
    };
  }

  private async getConnection(): Promise<PgQueryable> {
    if (this.connection) {
      return this.connection;
    }
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      try {
        const connection = await this.options.connectionFactory();
        this.connection = connection;
        this.released = false;
        return connection;
      } finally {
        this.connectionPromise = undefined;
      }
    })();

    return this.connectionPromise;
  }

  private async releaseConnection(): Promise<void> {
    if (this.released) {
      return;
    }
    this.released = true;
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
}

/**
 * Build a `PgTestkitClient` that replays rewritten SQL through the configured fixtures.
 * @param options - Fixture definitions, DDL, and connection factory used by the adapter.
 * @returns A `PgTestkitClient` bound to the provided configuration.
 */
export const createPgTestkitClient = (options: CreatePgTestkitClientOptions): PgTestkitClient => {
  return new PgTestkitClient(options);
};
