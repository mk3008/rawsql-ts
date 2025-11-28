import type { TableDefinitionModel } from 'rawsql-ts';
import type { TableRowsFixture } from '@rawsql-ts/testkit-core';
import type { CreatePgTestkitPoolOptions } from '../../src';
import { createPgTestkitPool } from '../../src';

export type TableRowsBuilder<Row> = (rows: Row[]) => TableRowsFixture[];

interface FixtureRunnerConfig<Row> {
  ddlRoot?: string;
  tableDefinitions?: TableDefinitionModel[];
  buildTableRows: TableRowsBuilder<Row>;
}

/**
 * Creates a runner that wires the pg-testkit pool around each invocation and
 * enforces cleanup after every test block.
 */
export const createPgTestkitFixtureRunner = <Row>({
  ddlRoot,
  tableDefinitions,
  buildTableRows,
}: FixtureRunnerConfig<Row>) => {
  return async <T>(
    connectionString: string,
    rows: Row[],
    testFn: (pool: ReturnType<typeof createPgTestkitPool>) => Promise<T>
  ): Promise<T> => {
    // Translate the provided row data into pg-testkit table fixtures.
    const fixturePayload = buildTableRows(rows);

    // Collect optional pool configuration such as schema definitions or DDL roots.
    const poolOptions: CreatePgTestkitPoolOptions = {};

    if (tableDefinitions) {
      // Supply explicit table metadata when the test depends on column-level accuracy.
      poolOptions.tableDefinitions = tableDefinitions;
    }

    if (ddlRoot) {
      // Point the loader at the directory tree that hosts the DDL fixtures.
      poolOptions.ddl = { directories: [ddlRoot] };
    }

    // Choose whether to pass explicit options so the helper stays flexible for plain setups.
    const pool = Object.keys(poolOptions).length > 0
      ? createPgTestkitPool(connectionString, ...fixturePayload, poolOptions)
      : createPgTestkitPool(connectionString, ...fixturePayload);

    try {
      return await testFn(pool);
    } finally {
      // Always release the pool so tests cannot leak Postgres connections.
      await pool.end();
    }
  };
};
