import { normalizeTableName } from 'rawsql-ts';
import type {
  FixtureColumnDefinition,
  FixtureTableDefinition,
  TableDefinitionModel,
  TableDefinitionRegistry,
} from 'rawsql-ts';
import type { TableRowsFixture } from '../types';
import type { FixtureResolver, FixtureSnapshot } from '../types';
import { TableNameResolver } from './TableNameResolver';

/** Resolves fixtures while unifying table metadata coming from DDL or explicit configuration. */
export class DefaultFixtureProvider implements FixtureResolver {
  private readonly definitionMap = new Map<string, TableDefinitionModel>();

  constructor(
    tableDefinitions: TableDefinitionModel[] = [],
    private readonly baseRows: TableRowsFixture[] = [],
    private readonly tableNameResolver?: TableNameResolver
  ) {
    this.registerDefinitions(tableDefinitions);
  }

  public resolve(overrides?: TableRowsFixture[]): FixtureSnapshot {
    const mergedRows = this.mergeRows(overrides);
    const snapshot: FixtureSnapshot = {
      fixtureTables: this.buildFixtureTables(mergedRows),
      tableDefinitions: this.buildDefinitionRegistry(),
      fixturesApplied: mergedRows.map((fixture) => fixture.tableName),
    };
    return snapshot;
  }

  private registerDefinitions(definitions: TableDefinitionModel[]): void {
    for (const definition of definitions) {
      const key = this.resolveDefinitionKey(definition.name);
      this.definitionMap.set(key, definition);
    }
  }

  private mergeRows(overrides?: TableRowsFixture[]): TableRowsFixture[] {
    const merged = new Map<string, TableRowsFixture>();

    // Start with the baseline rows so overrides only need to supply deltas.
    for (const fixture of this.baseRows) {
      const lookupKey = this.resolveDefinitionKey(fixture.tableName, (candidate) =>
        this.definitionMap.has(candidate)
      );
      merged.set(lookupKey, fixture);
    }

    // Apply overrides so callers can shadow specific tables per scope.
    for (const fixture of overrides ?? []) {
      const lookupKey = this.resolveDefinitionKey(fixture.tableName, (candidate) =>
        this.definitionMap.has(candidate)
      );
      merged.set(lookupKey, fixture);
    }

    return [...merged.values()];
  }

  private buildFixtureTables(fixtures: TableRowsFixture[]): FixtureTableDefinition[] {
    const result: FixtureTableDefinition[] = [];

    for (const fixture of fixtures) {
      const definition = this.findDefinition(fixture.tableName);
      if (!definition) {
        throw new Error(`Missing table definition for fixture "${fixture.tableName}".`);
      }

      const columns: FixtureColumnDefinition[] = definition.columns.map((column) => ({
        name: column.name,
        typeName: column.typeName,
        defaultValue: typeof column.defaultValue === 'string' ? column.defaultValue : undefined,
      }));

      const rows = fixture.rows.map((row: Record<string, unknown>, rowIndex: number) =>
        this.buildRow(row, columns, fixture.tableName, rowIndex, definition)
      );

      result.push({ tableName: fixture.tableName, columns, rows });
    }

    return result;
  }

  private buildDefinitionRegistry(): TableDefinitionRegistry {
    const registry: TableDefinitionRegistry = {};
    const seen = new Set<string>();

    for (const definition of this.definitionMap.values()) {
      const key = this.resolveDefinitionKey(definition.name);
      if (seen.has(key)) {
        continue;
      }
      registry[key] = definition;
      seen.add(key);
    }

    return registry;
  }

  private findDefinition(tableName: string): TableDefinitionModel | undefined {
    const key = this.resolveDefinitionKey(tableName, (candidate) => this.definitionMap.has(candidate));
    return this.definitionMap.get(key);
  }

  // Resolve the canonical key for a table name, optionally preferring any registered schema entry.
  private resolveDefinitionKey(tableName: string, lookup?: (candidate: string) => boolean): string {
    if (!this.tableNameResolver) {
      return normalizeTableName(tableName);
    }
    return this.tableNameResolver.resolve(tableName, lookup);
  }

  private buildRow(
    row: Record<string, unknown>,
    columns: FixtureTableDefinition['columns'],
    tableName: string,
    rowIndex: number,
    definition: TableDefinitionModel
  ): (string | number | bigint | Buffer | null)[] {
    const normalizedKeys = new Set(Object.keys(row));
    const columnLookup = new Map(definition.columns.map((column) => [column.name, column]));

    // Ensure required columns without defaults are explicitly provided.
    for (const column of columns) {
      const definitionColumn = columnLookup.get(column.name);
      const hasValue = normalizedKeys.has(column.name);
      if (
        !hasValue &&
        definitionColumn?.required &&
        !definitionColumn.defaultValue
      ) {
        throw new Error(
          `Row ${rowIndex} for table "${tableName}" misses required column "${column.name}".`
        );
      }
    }

    return columns.map((column) => {
      const value = row[column.name];
      if (value === undefined || value === null) {
        return null;
      }
      return this.coerceValue(value);
    });
  }

  private coerceValue(value: unknown): string | number | bigint | Buffer | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      return value;
    }
    if (typeof Buffer !== 'undefined' && value instanceof Buffer) {
      return value;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return JSON.stringify(value);
  }
}
