import type { PostgresTestkitClient, StarterPostgresTestkitOptions } from '../support/postgres-testkit.js';

export type ZtdTestKind = 'ztd';

export type ZtdResultCardinality = 'one' | 'many';

export interface ZtdCase<RowShape extends Record<string, unknown> = Record<string, unknown>, Input = unknown, Result = unknown> {
  name: string;
  input: Input;
  clientOptions?: StarterPostgresTestkitOptions<RowShape>;
  expectedResult?: Result;
  assertResult?: (result: Result) => void | Promise<void>;
  assertAfter?: (client: PostgresTestkitClient<RowShape>) => void | Promise<void>;
}
