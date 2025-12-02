import type { QueryConfig, QueryResult, QueryResultRow } from 'pg';
import { DefaultFixtureProvider, ResultSelectRewriter, alignRewrittenParameters, applyCountWrapper } from '@rawsql-ts/testkit-core';
import type {
  PgQueryInput,
  PgQueryable,
  WrapPgClientOptions,
  WrappedPgClient,
} from '../types';
import { validateFixtureRowsAgainstTableDefinitions } from '../utils/fixtureValidation';
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

const resolveOptionsState = (options: WrapPgClientOptions) => {
  const ddlFixtures: DdlProcessedFixture[] = options.ddl?.directories?.length
    ? new DdlFixtureLoader(options.ddl).getFixtures()
    : [];
  const tableDefinitions: TableDefinitionModel[] = [
    ...ddlFixtures.map((fixture) => fixture.tableDefinition),
    ...(options.tableDefinitions ?? []),
  ];
  // Validate caller-provided fixtures before instantiating the fixture provider.
  validateFixtureRowsAgainstTableDefinitions(options.tableRows, tableDefinitions, 'wrap tableRows');
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
  const fixtureStore = new DefaultFixtureProvider(overridden.tableDefinitions, overridden.tableRows);
  const rewriter = new ResultSelectRewriter(
    fixtureStore,
    options.missingFixtureStrategy ?? 'error',
    options.formatterOptions
  );

  const buildProxy = (scopedFixtures?: TableRowsFixture[]): WrappedPgClient<T> => {
    return new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === 'withFixtures') {
          return (fixtures: TableRowsFixture[]) => {
            validateFixtureRowsAgainstTableDefinitions(fixtures, overridden.tableDefinitions, 'scoped fixtures');
            return buildProxy(fixtures);
          };
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

            // Align caller parameters with the rewritten SQL so placeholders stay contiguous.
            const incomingParams =
              typeof textOrConfig === 'string'
                ? values
                : values ??
                  (textOrConfig as { values?: unknown[]; params?: unknown[] }).values ??
                  (textOrConfig as { values?: unknown[]; params?: unknown[] }).params;

            const normalized = alignRewrittenParameters(rewritten.sql, incomingParams);

            const payload =
              typeof textOrConfig === 'string'
                ? normalized.sql
                : { ...textOrConfig, text: normalized.sql, values: normalized.params };

            let result: QueryResult<TRow> =
              typeof payload === 'string'
                ? await value.call(target, payload, normalized.params)
                : await value.call(target, payload);

            options.onExecute?.(normalized.sql, normalized.params, rewritten.fixturesApplied);

            // Normalize rowCount/command only when the rewriter produced a count-wrapper SELECT.
            result = applyCountWrapper(result, rewritten.sourceCommand, rewritten.isCountWrapper);

            return result;
          };
        }

        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as WrappedPgClient<T>;
  };

  return buildProxy();
};
