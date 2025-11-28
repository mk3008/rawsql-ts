import type { QueryConfig, QueryResult, QueryResultRow } from 'pg';
import { PgFixtureStore } from '../fixtures/PgFixtureStore';
import { PgResultSelectRewriter } from '../rewriter/PgResultSelectRewriter';
import type {
  PgQueryInput,
  PgQueryable,
  WrapPgClientOptions,
  WrappedPgClient,
} from '../types';
import { DdlFixtureLoader } from '@rawsql-ts/testkit-core';
import type { DdlProcessedFixture } from '@rawsql-ts/testkit-core';
import type { TableDefinitionModel, TableRowsFixture } from '../types';

const buildEmptyResult = <T extends QueryResultRow = QueryResultRow>(command = 'NOOP'): QueryResult<T> => ({
  command,
  rowCount: 0,
  oid: 0,
  rows: [],
  fields: [],
});

const extractParams = (query: PgQueryInput, values?: unknown[]): unknown[] | QueryConfig['values'] | undefined => {
  if (typeof query === 'string') {
    return values;
  }
  return query.values;
};

const resolveOptionsState = (options: WrapPgClientOptions) => {
  const ddlFixtures: DdlProcessedFixture[] = options.ddl?.directories?.length
    ? new DdlFixtureLoader(options.ddl).getFixtures()
    : [];
  const tableDefinitions: TableDefinitionModel[] = [
    ...ddlFixtures.map((fixture) => fixture.tableDefinition),
    ...(options.tableDefinitions ?? []),
  ];
  const tableRows: TableRowsFixture[] = [
    ...ddlFixtures.flatMap((fixture) =>
      fixture.rows && fixture.rows.length
        ? [{ tableName: fixture.tableDefinition.name, rows: fixture.rows }]
        : []
    ),
    ...(options.tableRows ?? []),
  ];
  return { tableDefinitions, tableRows };
};

/** Wraps an existing Postgres client with fixture-aware query rewriting. */
export const wrapPgClient = <T extends PgQueryable>(client: T, options: WrapPgClientOptions): WrappedPgClient<T> => {
  const overridden = resolveOptionsState(options);
  const fixtureStore = new PgFixtureStore(overridden.tableDefinitions, overridden.tableRows);
  const rewriter = new PgResultSelectRewriter(
    fixtureStore,
    options.missingFixtureStrategy ?? 'error',
    options.formatterOptions
  );

  const buildProxy = (scopedFixtures?: TableRowsFixture[]): WrappedPgClient<T> => {
    return new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === 'withFixtures') {
          return (fixtures: TableRowsFixture[]) => buildProxy(fixtures);
        }

        const value = Reflect.get(target, prop, receiver);
        if (prop === 'query' && typeof value === 'function') {
          return async <TRow extends QueryResultRow = QueryResultRow>(
            textOrConfig: PgQueryInput,
            values?: unknown[]
          ) => {
            const sql = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
            if (!sql) {
              return value.apply(target, [textOrConfig, values]);
            }

            // Inject fixture-backed CTEs into CRUD/SELECT statements and skip unsupported DDL.
          const rewritten = rewriter.rewrite(sql, scopedFixtures);
            if (!rewritten.sql) {
              return buildEmptyResult();
            }

            const payload =
              typeof textOrConfig === 'string' ? rewritten.sql : { ...textOrConfig, text: rewritten.sql };

            const result: QueryResult<TRow> =
              typeof payload === 'string'
                ? await value.call(target, payload, values)
                : await value.call(target, payload);

            options.onExecute?.(rewritten.sql, extractParams(textOrConfig, values), rewritten.fixturesApplied);
            return result;
          };
        }

        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as WrappedPgClient<T>;
  };

  return buildProxy();
};
