import type { FixtureTableDefinition, TableDefinitionModel, TableDefinitionRegistry } from 'rawsql-ts';
import type { PgFixture, PgFixtureProvider, PgFixtureSnapshot } from '../types';

export class PgFixtureStore implements PgFixtureProvider {
  constructor(private readonly baseFixtures: PgFixture[] = []) {}

  public resolve(overrides?: PgFixture[]): PgFixtureSnapshot {
    const merged = this.mergeFixtures(overrides);
    const tableDefinitions: TableDefinitionRegistry = {};
    const fixtureTables: FixtureTableDefinition[] = [];

    for (const fixture of merged) {
      const definition = this.buildTableDefinition(fixture);
      tableDefinitions[definition.name] = definition;
      fixtureTables.push(this.buildFixtureTable(fixture));
    }

    return {
      fixtureTables,
      tableDefinitions,
      fixturesApplied: merged.map((fixture) => fixture.tableName),
    };
  }

  private mergeFixtures(overrides?: PgFixture[]): PgFixture[] {
    const merged = new Map<string, PgFixture>();
    for (const fixture of this.baseFixtures) {
      merged.set(fixture.tableName.toLowerCase(), fixture);
    }
    for (const fixture of overrides ?? []) {
      merged.set(fixture.tableName.toLowerCase(), fixture);
    }
    return [...merged.values()];
  }

  private buildTableDefinition(fixture: PgFixture): TableDefinitionModel {
    return {
      name: fixture.tableName,
      columns: fixture.columns.map((column) => ({
        name: column.name,
        typeName: column.typeName,
        required: column.required ?? false,
        defaultValue: column.defaultValue ?? null,
      })),
    };
  }

  private buildFixtureTable(fixture: PgFixture): FixtureTableDefinition {
    const columns = fixture.columns.map((column) => ({
      name: column.name,
      typeName: column.typeName,
      defaultValue: column.defaultValue,
    }));

    const rows =
      fixture.rows?.map((row) =>
        columns.map((column) => this.coerceValue(row[column.name]))
      ) ?? [];

    return {
      tableName: fixture.tableName,
      columns,
      rows,
    };
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
