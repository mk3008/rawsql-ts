import { normalizeTableName } from 'rawsql-ts';
import type { TableDefinitionModel, TableRowsFixture } from '../types';

const normalizeColumnName = (value: string): string => value.toLowerCase();

/** 
 * Validates fixture rows against table definitions, ensuring every referenced
 * table and column exists in the configured DDL or explicit definitions.
 *
 * @param tableRows - Fixtures to validate; undefined or empty arrays are no-ops.
 * @param tableDefinitions - Table metadata to validate against.
 * @param contextLabel - Optional label prefixed to thrown error messages for clarity.
 * @throws Error when a fixture references a missing table or column.
 */
export const validateFixtureRowsAgainstTableDefinitions = (
  tableRows: TableRowsFixture[] | undefined,
  tableDefinitions: TableDefinitionModel[],
  contextLabel?: string
): void => {
  if (!tableRows?.length) {
    return;
  }

  const prefix = contextLabel ? `${contextLabel}: ` : '';

  // Build a lookup keyed by normalized table names so definitions can be resolved quickly.
  const definitionLookup = new Map<string, TableDefinitionModel>();
  for (const definition of tableDefinitions) {
    definitionLookup.set(normalizeTableName(definition.name), definition);
  }

  const columnCache = new Map<string, Set<string>>();

  for (const fixture of tableRows) {
    const normalizedTableName = normalizeTableName(fixture.tableName);
    const tableDefinition = definitionLookup.get(normalizedTableName);
    if (!tableDefinition) {
      throw new Error(
        `${prefix}Table '${fixture.tableName}' is not defined by the configured DDL or explicit table definitions.`
      );
    }

    // Cache column names per table to avoid recomputing the same metadata for every row.
    let columnNames = columnCache.get(normalizedTableName);
    if (!columnNames) {
      columnNames = new Set(tableDefinition.columns.map((column) => normalizeColumnName(column.name)));
      columnCache.set(normalizedTableName, columnNames);
    }

    // Validate each row so mistyped columns surface immediately during setup.
    for (const row of fixture.rows) {
      for (const column of Object.keys(row)) {
        if (!columnNames.has(normalizeColumnName(column))) {
          throw new Error(
            `${prefix}Column '${column}' not found in table '${fixture.tableName}'. Please fix the fixture to match the DDL.`
          );
        }
      }
    }
  }
};
