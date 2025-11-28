import type { TableDefinitionModel } from 'rawsql-ts';
import type { TableRowsFixture } from '@rawsql-ts/testkit-core';
import type { CreatePgTestkitPoolOptions } from '../../src';
import { createPgTestkitPool } from '../../src';

interface FixtureRunnerConfig {
  ddlRoot?: string;
  tableDefinitions?: TableDefinitionModel[];
}

/**
 * Creates a runner that wires the pg-testkit pool around each invocation and
 * enforces cleanup after every test block.
 */
export const createPgTestkitFixtureRunner = ({
  ddlRoot,
  tableDefinitions,
}: FixtureRunnerConfig) => {
  return async <T>(
    connectionString: string,
    fixtures: TableRowsFixture[],
    testFn: (pool: ReturnType<typeof createPgTestkitPool>) => Promise<T>
  ): Promise<T> => {
    // Pass fixture metadata through so multi-table scenarios can be described by consumers.
    const poolOptions: CreatePgTestkitPoolOptions = {};

    if (tableDefinitions) {
      // Supply explicit table metadata when tests rely on column-level accuracy.
      poolOptions.tableDefinitions = tableDefinitions;
    }

    if (ddlRoot) {
      // Point the loader at the directory tree that hosts the DDL fixtures.
      poolOptions.ddl = { directories: [ddlRoot] };
    }

    // Create the pool with the accumulated fixtures and any optional metadata.
    const pool = Object.keys(poolOptions).length > 0
      ? createPgTestkitPool(connectionString, ...fixtures, poolOptions)
      : createPgTestkitPool(connectionString, ...fixtures);

    try {
      return await testFn(pool);
    } finally {
      // Always release the pool so tests cannot leak Postgres connections.
      await pool.end();
    }
  };
};
