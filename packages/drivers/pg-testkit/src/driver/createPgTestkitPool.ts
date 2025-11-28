import type {
  QueryArrayConfig,
  QueryArrayResult,
  QueryConfig,
  QueryConfigValues,
  QueryResult,
  QueryResultRow,
  Submittable,
} from 'pg';
import { Client, Pool, PoolConfig } from 'pg';
import { createPgTestkitClient } from './PgTestkitClient';
import type {
  CreatePgTestkitPoolOptions,
  PgQueryInput,
  PgQueryable,
  TableRowsFixture,
} from '../types';

const TRANSACTION_COMMAND_RE = /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/i;

const isPoolOptions = (value: TableRowsFixture | CreatePgTestkitPoolOptions): value is CreatePgTestkitPoolOptions => {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('ddl' in value || 'tableRows' in value || 'tableDefinitions' in value)
  );
};

/** Builds a pool whose clients rewrite CRUD traffic through pg-testkit while leaving transactions alone. */
export const createPgTestkitPool = (
  connectionString: string,
  ...fixturesOrOptions: Array<TableRowsFixture | CreatePgTestkitPoolOptions>
): Pool => {
  const hasOptions = fixturesOrOptions.length > 0 && isPoolOptions(fixturesOrOptions[fixturesOrOptions.length - 1]);
  const poolOptions = hasOptions
    ? (fixturesOrOptions[fixturesOrOptions.length - 1] as CreatePgTestkitPoolOptions)
    : undefined;
  const baseFixtures = hasOptions
    ? (fixturesOrOptions.slice(0, -1) as TableRowsFixture[])
    : (fixturesOrOptions as TableRowsFixture[]);
  // Combine ad-hoc rows with option-provided ones so callers can mix styles.
  const combinedFixtures = [...baseFixtures, ...(poolOptions?.tableRows ?? [])];
  class TestkitClient extends Client {
    private readonly testkit = createPgTestkitClient({
      connectionFactory: async () => this.buildRawConnection(),
      tableRows: combinedFixtures,
      ddl: poolOptions?.ddl,
      tableDefinitions: poolOptions?.tableDefinitions,
    });

    private buildRawConnection(): PgQueryable {
      const baseQuery = Client.prototype.query as (
        queryTextOrConfig: PgQueryInput,
        values?: unknown[]
      ) => Promise<QueryResult<QueryResultRow>>;

      // Forward rewritten SQL to the original pg client so transactional commands stay bound to the pool.
      const rawConnection: PgQueryable = {
        query: <T extends QueryResultRow = QueryResultRow>(queryTextOrConfig: PgQueryInput, values?: unknown[]) =>
          baseQuery.call(this, queryTextOrConfig as never, values) as Promise<QueryResult<T>>,
      };

      return rawConnection;
    }

    public override query<T extends Submittable>(queryStream: T): T;
    public override query<R extends any[] = any[], I = any[]>(
      queryConfig: QueryArrayConfig<I>,
      values?: QueryConfigValues<I>
    ): Promise<QueryArrayResult<R>>;
    public override query<R extends QueryResultRow = any, I = any>(queryConfig: QueryConfig<I>): Promise<QueryResult<R>>;
    public override query<R extends QueryResultRow = any, I = any[]>(
      queryTextOrConfig: string | QueryConfig<I>,
      values?: QueryConfigValues<I>
    ): Promise<QueryResult<R>>;
    public override query<R extends QueryResultRow = any, I = any[]>(
      queryTextOrConfig: string,
      values: QueryConfigValues<I>,
      callback: (err: Error, result: QueryResult<R>) => void
    ): void;
    public override query<R extends QueryResultRow = any, I = any[]>(
      queryTextOrConfig: string | QueryConfig<I>,
      callback: (err: Error, result: QueryResult<R>) => void
    ): void;
    public override query(...args: unknown[]): unknown {
      const [queryTextOrConfig, valuesOrCallback, callbackOrUndefined] = args as [
        string | { text: string; values?: unknown[]; params?: unknown[] },
        unknown[] | ((err: Error, result: QueryResult<QueryResultRow>) => void) | undefined,
        ((err: Error, result: QueryResult<QueryResultRow>) => void) | undefined
      ];
      const callback =
        typeof valuesOrCallback === 'function' ? valuesOrCallback : callbackOrUndefined;
      const values = typeof valuesOrCallback === 'function' ? undefined : valuesOrCallback;
      const sqlText = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      const configPayload =
        typeof queryTextOrConfig === 'string' ? undefined : queryTextOrConfig;
      const normalizedValues = values ?? configPayload?.values ?? configPayload?.params;

      // Allow explicit transaction control to reach Pg without interference.
      if (sqlText && TRANSACTION_COMMAND_RE.test(sqlText)) {
        return Client.prototype.query.apply(this, args as any);
      }

      const execution = this.testkit.query(
        queryTextOrConfig as PgQueryInput,
        normalizedValues
      );

      // Surface callback behavior when the caller provided the older pg query signature.
      if (typeof callback === 'function') {
        execution
          .then((result) => callback(null as unknown as Error, result))
          .catch((error) => callback(error as Error, undefined as unknown as QueryResult<QueryResultRow>));
        return undefined;
      }

      return execution;
    }
  }

  const poolConfig: PoolConfig = { connectionString, Client: TestkitClient };
  return new Pool(poolConfig);
};
