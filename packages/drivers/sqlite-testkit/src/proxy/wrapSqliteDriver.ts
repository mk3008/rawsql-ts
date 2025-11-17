import { SelectFixtureRewriter } from '@rawsql-ts/testkit-core';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import type {
  SqliteConnectionLike,
  SqliteStatementLike,
  WrapSqliteDriverOptions,
  WrappedSqliteDriver,
  WrappedSqlQueryLogEntry,
} from '../types';

const normalizeParams = (args: unknown[]): unknown => {
  if (args.length === 0) {
    return undefined;
  }
  if (args.length === 1) {
    return args[0];
  }
  return args;
};

const isSelectableQuery = (sql: string): boolean => {
  const trimmed = sql.trimStart();
  if (trimmed.length === 0) {
    return false;
  }

  const upper = trimmed.toUpperCase();
  if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
    return true;
  }

  if (upper.startsWith('EXPLAIN')) {
    return /\bSELECT\b/i.test(upper);
  }

  return false;
};

/**
 * Wraps a SQLite connection so every SELECT/CTE statement is rewritten with fixture-backed CTEs before execution.
 * @param driver Native connection (e.g. better-sqlite3, sqlite3) whose SELECT queries should honor rewrites.
 * @param options Configuration that controls fixtures, rewrite strategy, execution hooks, and optional query logging.
 * @returns A proxied driver that transparently rewrites queries, surfaces an optional `queries` log, and supports `withFixtures`.
 * @example
 * ```ts
 * import Database from 'better-sqlite3';
 * import { wrapSqliteDriver } from '@rawsql-ts/sqlite-testkit';
 *
 * const db = wrapSqliteDriver(new Database(':memory:'), {
 *   fixtures: [
 *     { tableName: 'accounts', rows: [{ id: 42, tier: 'pro' }] },
 *   ],
 *   recordQueries: true,
 * });
 *
 * const rows = db.all('SELECT id, tier FROM accounts');
 * console.log(rows, db.queries);
 * ```
 */
export const wrapSqliteDriver = <T extends SqliteConnectionLike>(
  driver: T,
  options: WrapSqliteDriverOptions
): WrappedSqliteDriver<T> => {
  const rewriter = new SelectFixtureRewriter(options);

  const buildProxy = (scopedFixtures?: TableFixture[]): WrappedSqliteDriver<T> => {
    const queryLog: WrappedSqlQueryLogEntry[] | undefined = options.recordQueries ? [] : undefined;
    const shouldObserve = Boolean(options.onExecute || queryLog);

    // Fan out execution details to the configured hook and optional in-memory log.
    const handleExecution = (
      method: string | symbol,
      sql: string,
      args: unknown[],
      fixtures?: string[]
    ): void => {
      if (!shouldObserve) {
        return;
      }
      const params = normalizeParams(args);
      options.onExecute?.(sql, params);
      queryLog?.push({
        method: typeof method === 'string' ? method : String(method),
        sql,
        params,
        fixtures,
      });
    };

    const wrapStatement = (
      statement: SqliteStatementLike,
      sql: string,
      fixtures?: string[]
    ): SqliteStatementLike => {
      if (!shouldObserve || !statement) {
        return statement;
      }
      return new Proxy(statement, {
        get(stmtTarget, stmtProp, stmtReceiver) {
          const stmtValue = Reflect.get(stmtTarget, stmtProp, stmtReceiver);
          if (typeof stmtValue !== 'function') {
            return stmtValue;
          }

          if (stmtProp === 'all' || stmtProp === 'get' || stmtProp === 'run') {
            return (...stmtArgs: unknown[]) => {
              handleExecution(stmtProp, sql, stmtArgs, fixtures);
              return stmtValue.apply(stmtTarget, stmtArgs);
            };
          }

          return stmtValue.bind(stmtTarget);
        },
      });
    };

    return new Proxy(driver, {
      get(target, prop, receiver) {
        if (prop === 'withFixtures') {
          return (fixtures: TableFixture[]) => buildProxy(fixtures);
        }

        if (prop === 'queries') {
          return queryLog;
        }

        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') {
          return value;
        }

        if (prop === 'prepare') {
          return (sql: string, ...rest: unknown[]) => {
            if (typeof sql !== 'string' || !isSelectableQuery(sql)) {
              return value.apply(target, [sql, ...rest]);
            }

            const context = scopedFixtures ? { fixtures: scopedFixtures } : undefined;
            const rewritten = rewriter.rewrite(sql, context);
            const statement = value.apply(target, [rewritten.sql, ...rest]) as SqliteStatementLike;
            return wrapStatement(statement, rewritten.sql, rewritten.fixturesApplied);
          };
        }

        if (prop === 'exec') {
          return (sql: string, ...rest: unknown[]) => {
            if (typeof sql !== 'string' || !isSelectableQuery(sql)) {
              return value.apply(target, [sql, ...rest]);
            }
            const context = scopedFixtures ? { fixtures: scopedFixtures } : undefined;
            const rewritten = rewriter.rewrite(sql, context);
            handleExecution(prop, rewritten.sql, rest, rewritten.fixturesApplied);
            return value.apply(target, [rewritten.sql, ...rest]);
          };
        }

        if (prop === 'all' || prop === 'get' || prop === 'run') {
          return (sql: string, ...rest: unknown[]) => {
            if (typeof sql !== 'string' || !isSelectableQuery(sql)) {
              return value.apply(target, [sql, ...rest]);
            }
            const context = scopedFixtures ? { fixtures: scopedFixtures } : undefined;
            const rewritten = rewriter.rewrite(sql, context);
            handleExecution(prop, rewritten.sql, rest, rewritten.fixturesApplied);
            return value.apply(target, [rewritten.sql, ...rest]);
          };
        }

        return value.bind(target);
      },
    }) as WrappedSqliteDriver<T>;
  };

  return buildProxy();
};
