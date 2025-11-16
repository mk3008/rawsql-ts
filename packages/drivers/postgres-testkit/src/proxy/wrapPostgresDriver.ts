import { SelectFixtureRewriter, TestkitDbAdapter } from '@rawsql-ts/testkit-core';
import { InsertQuery, SimpleSelectQuery, SqlFormatter, SqlParser } from 'rawsql-ts';
import type { TableFixture, TableDef, TestkitCudOptions } from '@rawsql-ts/testkit-core';
import type { QueryConfig } from 'pg';
import type {
  PostgresConnectionLike,
  PostgresQueryCallback,
  WrapPostgresDriverOptions,
  WrappedPostgresDriver,
  WrappedPostgresQueryLogEntry,
} from '../types';
import { withPostgresFormatterDefaults } from '../utils/postgresFormatterOptions';
import { isSelectableQuery } from '@rawsql-ts/testkit-core';

const normalizePostgresQueryArgs = (
  args: unknown[]
): {
  text: string;
  values?: unknown[];
  callback?: PostgresQueryCallback;
  isConfig: boolean;
  config?: QueryConfig;
  buildArgs(rewrittenText?: string): unknown[];
} => {
  const [textOrConfig, valuesOrCallback, maybeCallback] = args;
  let text = '';
  let values: unknown[] | undefined;
  let callback: PostgresQueryCallback | undefined;
  let config: QueryConfig | undefined;
  let isConfig = false;

  if (typeof textOrConfig === 'object' && textOrConfig !== null && 'text' in textOrConfig) {
    // Handle the QueryConfig overload by keeping a reference to the original config.
    config = textOrConfig as QueryConfig;
    text = config.text;
    isConfig = true;
    values = config.values;
    if (typeof valuesOrCallback === 'function') {
      callback = valuesOrCallback as PostgresQueryCallback;
    }
  } else {
    // Treat the string overload and distinguish between params arrays and callbacks.
    text = typeof textOrConfig === 'string' ? textOrConfig : '';
    if (Array.isArray(valuesOrCallback)) {
      values = valuesOrCallback;
      if (typeof maybeCallback === 'function') {
        callback = maybeCallback as PostgresQueryCallback;
      }
    } else if (typeof valuesOrCallback === 'function') {
      callback = valuesOrCallback as PostgresQueryCallback;
    }
  }

  return {
    text,
    values,
    callback,
    isConfig,
    config,
    buildArgs(rewrittenText = text) {
      if (isConfig && config) {
        // Clone the config so we only modify the rewritten text.
        const rewrittenConfig: QueryConfig = { ...config, text: rewrittenText };
        return callback ? [rewrittenConfig, callback] : [rewrittenConfig];
      }

      const reconstructed: unknown[] = [rewrittenText];
      if (values !== undefined) {
        reconstructed.push(values);
      }
      if (callback) {
        reconstructed.push(callback);
      }
      return reconstructed;
    },
  };
};

export const wrapPostgresDriver = <T extends PostgresConnectionLike>(
  driver: T,
  options: WrapPostgresDriverOptions
): WrappedPostgresDriver<T> => {
  const rewriterOptions = withPostgresFormatterDefaults(options);
  const rewriter = new SelectFixtureRewriter(rewriterOptions);
  const tableDefs: TableDef[] | undefined =
    Array.isArray(options.tableDefs) && options.tableDefs.length > 0 ? options.tableDefs : undefined;
  const cudAdapter = tableDefs ? new TestkitDbAdapter(tableDefs) : undefined;
  const cudOptions: TestkitCudOptions = options.cudOptions ?? {};
  const insertFormatter = cudAdapter ? new SqlFormatter(rewriterOptions.formatterOptions ?? {}) : undefined;
  const simulateReturning = Boolean(options.simulateCudReturning);

  const isInsertStatement = (sql: string): boolean => {
    try {
      const parsed = SqlParser.parse(sql);
      return parsed instanceof InsertQuery;
    } catch {
      return false;
    }
  };

  // Route INSERT statements through the TestkitDbAdapter when table metadata is available.
  const rewriteInsertSql = (
    sql: string,
  ): { insert: InsertQuery; selectSql: string } | undefined => {
    if (!cudAdapter || !insertFormatter) {
      return undefined;
    }

    if (!isInsertStatement(sql)) {
      return undefined;
    }

    const rewritten = cudAdapter.rewriteInsert(sql, cudOptions);
    if (!rewritten) {
      return undefined;
    }

    // Focus on the normalized SELECT payload so that the connection only observes the DTO evaluation.
    const selectQuery =
      rewritten.selectQuery instanceof SimpleSelectQuery
        ? rewritten.selectQuery
        : rewritten.selectQuery?.toSimpleQuery();
    if (!selectQuery) {
      return undefined;
    }

    const { formattedSql: selectSql } = insertFormatter.format(selectQuery);
    return { insert: rewritten, selectSql };
  };

  const buildProxy = (scopedFixtures?: TableFixture[]): WrappedPostgresDriver<T> => {
    const queryLog: WrappedPostgresQueryLogEntry[] | undefined = options.recordQueries ? [] : undefined;
    const shouldObserve = Boolean(options.onExecute || queryLog);

    const handleExecution = (sql: string, params?: unknown[]): void => {
      // Skip instrumentation when no observers were configured.
      if (!shouldObserve) {
        return;
      }
      options.onExecute?.(sql, params);
      queryLog?.push({ method: 'query', sql, params });
    };

    // Proxy the driver so we can hook `query` while leaving other members untouched.
    return new Proxy(driver, {
      get(target, prop, receiver) {
        if (prop === 'withFixtures') {
          return (fixtures: TableFixture[]) => buildProxy(fixtures);
        }

        if (prop === 'queries') {
          return queryLog;
        }

        const value = Reflect.get(target, prop, receiver);
        if (prop !== 'query' || typeof value !== 'function') {
          return typeof value === 'function' ? value.bind(target) : value;
        }

        return (...args: unknown[]) => {
          const normalized = normalizePostgresQueryArgs(args);

          if (isSelectableQuery(normalized.text)) {
            const context = scopedFixtures ? { fixtures: scopedFixtures } : undefined;
            // Rewrite SELECT queries before they reach the real driver.
            const rewritten = rewriter.rewrite(normalized.text, context);
            handleExecution(rewritten.sql, normalized.values);
            return value.apply(target, normalized.buildArgs(rewritten.sql));
          }

            const rewrittenInsert = rewriteInsertSql(normalized.text);
            if (rewrittenInsert) {
              // Record the DTO SELECT even though the RETURNING rows are simulated separately.
              handleExecution(rewrittenInsert.selectSql, normalized.values);
              const promise = value.apply(
                target,
                normalized.buildArgs(rewrittenInsert.selectSql),
              );
              if (!simulateReturning || !cudAdapter) {
                return promise;
              }

            // When DAL simulation is active, swap in the DTO-derived RETURNING rows.
            return promise.then((result) => {
              const simulatedRows = cudAdapter.simulateReturningRows(
                rewrittenInsert.insert,
                normalized.values,
              );
              if (!simulatedRows) {
                return result;
              }

              return {
                ...result,
                rows: simulatedRows,
                rowCount: simulatedRows.length,
              };
            });
          }

          // Pass through non-rewritten statements untouched.
          return value.apply(target, normalized.buildArgs());
        };
      },
    }) as WrappedPostgresDriver<T>;
  };

  return buildProxy();
};
