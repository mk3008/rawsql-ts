import type { DdlFixtureLoaderOptions, DdlProcessedFixture, TableRowsFixture } from '@rawsql-ts/testkit-core';
import { DdlFixtureLoader } from '@rawsql-ts/testkit-core';
import type { TableDefinitionModel } from 'rawsql-ts';
import type { TableNameResolver } from '@rawsql-ts/testkit-core';
import type { GeneratedFixtureManifest } from '../types';

export interface FixtureResolutionOptions {
  generated?: GeneratedFixtureManifest;
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
export function resolveFixtureState(
  options: FixtureResolutionOptions,
  tableNameResolver: TableNameResolver
): ResolvedFixtureState {
  // Prefer generated metadata so runtime does not need to rescan raw DDL on the normal path.
  const hasGeneratedManifest = options.generated != null;

  // Load DDL-derived fixtures only when no generated manifest was provided.
  const loader = !hasGeneratedManifest && options.ddl?.directories?.length
    ? new DdlFixtureLoader({
        ...options.ddl,
        tableNameResolver,
      })
    : undefined;
  const ddlFixtures = loader?.getFixtures() ?? [];

  // Combine generated definitions with any explicit metadata the caller provided.
  const tableDefinitions = [
    ...(options.generated?.tableDefinitions ?? []),
    ...ddlFixtures.map((fixture: DdlProcessedFixture) => fixture.tableDefinition),
    ...(options.tableDefinitions ?? []),
  ];

  // Merge generated rows and caller-supplied fixtures ahead of legacy DDL-derived rows.
  const tableRows: TableRowsFixture[] = [
    ...(options.generated?.tableRows ?? []),
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
}
