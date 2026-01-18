import type { PgQueryable } from '../types';
import { createPgTestkitClient } from '../driver/PgTestkitClient';
import type { WrapPgClientOptions, WrappedPgClient, TableRowsFixture } from '../types';

/**
 * Wraps a `PgQueryable` client so queries flow through adapter-node-pg fixtures and rewriting.
 * @template T - The type of the underlying Pg client or pool being proxied.
 * @param client - The driver instance whose methods should be forwarded.
 * @param options - Fixture/DDL configuration forwarded to `createPgTestkitClient`.
 * @returns A `WrappedPgClient` that proxies queries through the testkit client.
 */
export const wrapPgClient = <T extends PgQueryable>(
  client: T,
  options: WrapPgClientOptions
): WrappedPgClient<T> => {
  const testkit = createPgTestkitClient({
    connectionFactory: () => client,
    tableDefinitions: options.tableDefinitions,
    tableRows: options.tableRows,
    ddl: options.ddl,
    defaultSchema: options.defaultSchema,
    searchPath: options.searchPath,
    formatterOptions: options.formatterOptions,
    missingFixtureStrategy: options.missingFixtureStrategy,
    onExecute: options.onExecute,
  });

  const buildProxy = (clientInstance: T, pgTestkit: ReturnType<typeof createPgTestkitClient>): WrappedPgClient<T> => {
    return new Proxy(clientInstance, {
      get(target, prop, receiver) {
        if (prop === 'withFixtures') {
          return (fixtures: TableRowsFixture[]) => buildProxy(target, pgTestkit.withFixtures(fixtures));
        }

        if (prop === 'query') {
          const queryFn =
            typeof pgTestkit.query === 'function' ? pgTestkit.query.bind(pgTestkit) : undefined;
          if (queryFn) {
            return queryFn;
          }
        }

        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as WrappedPgClient<T>;
  };

  return buildProxy(client, testkit);
};
