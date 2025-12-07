import type { DdlFixtureLoaderOptions, DdlProcessedFixture, TableRowsFixture } from '@rawsql-ts/testkit-core';
import { DdlFixtureLoader } from '@rawsql-ts/testkit-core';
import type { TableDefinitionModel } from 'rawsql-ts';
import type { TableNameResolver } from '@rawsql-ts/testkit-core';

export interface FixtureResolutionOptions {
  tableDefinitions?: TableDefinitionModel[];
  tableRows?: TableRowsFixture[];
  ddl?: DdlFixtureLoaderOptions;
}

export interface ResolvedFixtureState {
  ddlFixtures: DdlProcessedFixture[];
  tableDefinitions: TableDefinitionModel[];
  tableRows: TableRowsFixture[];
}

/** Produces the merged fixture metadata for any pg-testkit entry point. */
export const resolveOptionsState = (
  options: FixtureResolutionOptions,
  tableNameResolver: TableNameResolver
): ResolvedFixtureState => {
  // Load DDL-derived fixtures when directories were supplied so every consumer shares the same resolver rules.
  const loader = options.ddl?.directories?.length
    ? new DdlFixtureLoader({
        ...options.ddl,
        tableNameResolver,
      })
    : undefined;
  const ddlFixtures = loader?.getFixtures() ?? [];

  // Combine generated definitions with any explicit metadata the caller provided.
  const tableDefinitions = [
    ...ddlFixtures.map((fixture: DdlProcessedFixture) => fixture.tableDefinition),
    ...(options.tableDefinitions ?? []),
  ];

  // Merge DDL-sourced rows ahead of caller-supplied fixtures so overrides take precedence.
  const tableRows: TableRowsFixture[] = [
    ...ddlFixtures.flatMap((fixture: DdlProcessedFixture) =>
      fixture.rows && fixture.rows.length
        ? [{ tableName: fixture.tableDefinition.name, rows: fixture.rows }]
        : []
    ),
    ...(options.tableRows ?? []),
  ];

  return {
    ddlFixtures,
    tableDefinitions,
    tableRows,
  };
};

export const resolveFixtureState = resolveOptionsState;
