import { SelectFixtureRewriter, type TableFixture } from '@rawsql-ts/testkit-core';
import type { SqliteConnectionLike, WrapSqliteDriverOptions, WrappedSqliteDriver } from '../types';

export const wrapSqliteDriver = <T extends SqliteConnectionLike>(
  driver: T,
  options: WrapSqliteDriverOptions
): WrappedSqliteDriver<T> => {
  const rewriter = new SelectFixtureRewriter(options);

  const buildProxy = (scopedFixtures?: TableFixture[]): WrappedSqliteDriver<T> => {
    return new Proxy(driver, {
      get(target, prop, receiver) {
        if (prop === 'withFixtures') {
          return (fixtures: TableFixture[]) => buildProxy(fixtures);
        }

        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') {
          return value;
        }

        if (prop === 'prepare') {
          return (sql: string, ...rest: unknown[]) => {
            // Only rewrite when the caller passes a SQL string.
            if (typeof sql !== 'string') {
              return value.apply(target, [sql, ...rest]);
            }

            const context = scopedFixtures ? { fixtures: scopedFixtures } : undefined;
            const rewritten = rewriter.rewrite(sql, context);
            return value.apply(target, [rewritten.sql, ...rest]);
          };
        }

        if (prop === 'exec') {
          return (sql: string, ...rest: unknown[]) => {
            if (typeof sql !== 'string') {
              return value.apply(target, [sql, ...rest]);
            }
            const context = scopedFixtures ? { fixtures: scopedFixtures } : undefined;
            const rewritten = rewriter.rewrite(sql, context);
            return value.apply(target, [rewritten.sql, ...rest]);
          };
        }

        if (prop === 'all' || prop === 'get' || prop === 'run') {
          return (sql: string, ...rest: unknown[]) => {
            if (typeof sql !== 'string') {
              return value.apply(target, [sql, ...rest]);
            }
            const context = scopedFixtures ? { fixtures: scopedFixtures } : undefined;
            const rewritten = rewriter.rewrite(sql, context);
            return value.apply(target, [rewritten.sql, ...rest]);
          };
        }

        return value.bind(target);
      },
    }) as WrappedSqliteDriver<T>;
  };

  return buildProxy();
};
