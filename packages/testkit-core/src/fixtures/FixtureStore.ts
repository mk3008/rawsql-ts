import { SchemaValidationError } from '../errors';
import { normalizeIdentifier } from './naming';
import type { TableFixture, SchemaRegistry, TableSchemaDefinition, SqliteAffinity } from '../types';

export interface ColumnDefinition {
  name: string;
  affinity: SqliteAffinity;
}

export interface NormalizedFixture {
  name: string;
  columns: ColumnDefinition[];
  rows: (string | number | bigint | Buffer | null)[][];
}

export class FixtureStore {
  private readonly schemaRegistry?: SchemaRegistry;
  private readonly baseMap: Map<string, NormalizedFixture>;

  constructor(fixtures: TableFixture[] = [], schema?: SchemaRegistry) {
    this.schemaRegistry = schema;
    this.baseMap = this.buildMap(fixtures);
  }

  public withOverrides(overrides?: TableFixture[]): Map<string, NormalizedFixture> {
    if (!overrides || overrides.length === 0) {
      return new Map(this.baseMap);
    }

    const next = new Map(this.baseMap);
    const overrideMap = this.buildMap(overrides);
    for (const [name, fixture] of overrideMap.entries()) {
      next.set(name, fixture);
    }
    return next;
  }

  private buildMap(fixtures: TableFixture[]): Map<string, NormalizedFixture> {
    const map = new Map<string, NormalizedFixture>();
    for (const fixture of fixtures) {
      const normalizedName = normalizeIdentifier(fixture.tableName);
      map.set(normalizedName, this.normalizeFixture(fixture));
    }
    return map;
  }

  private normalizeFixture(fixture: TableFixture): NormalizedFixture {
    const schema = fixture.schema ?? this.schemaRegistry?.getTable(fixture.tableName);
    if (!schema) {
      throw new SchemaValidationError(
        `Table "${fixture.tableName}" is missing a schema definition. Provide fixture.schema or register the table.`
      );
    }

    const columns = this.buildColumns(schema, fixture.tableName);
    const rows = fixture.rows.map((row, rowIndex) => this.normalizeRow(row, columns, fixture.tableName, rowIndex));

    return {
      name: fixture.tableName,
      columns,
      rows,
    };
  }

  private buildColumns(schema: TableSchemaDefinition, fixtureName: string): ColumnDefinition[] {
    const entries = Object.entries(schema.columns);
    if (entries.length === 0) {
      throw new SchemaValidationError(`Schema for "${fixtureName}" must declare at least one column.`);
    }

    return entries.map(([name, affinity]) => ({ name, affinity }));
  }

  private normalizeRow(
    row: Record<string, unknown>,
    columns: ColumnDefinition[],
    fixtureName: string,
    rowIndex: number
  ): (string | number | bigint | Buffer | null)[] {
    const normalizedRow: (string | number | bigint | Buffer | null)[] = [];

    // Guard against extraneous columns so fixture drift fails fast.
    for (const key of Object.keys(row)) {
      if (!columns.some((column) => column.name === key)) {
        throw new SchemaValidationError(
          `Row ${rowIndex} in fixture "${fixtureName}" contains unknown column "${key}".`
        );
      }
    }

    for (const column of columns) {
      const value = row[column.name];
      if (value === undefined || value === null) {
        normalizedRow.push(null);
        continue;
      }

      normalizedRow.push(
        this.normalizeValue(value, column.affinity, fixtureName, column.name, rowIndex)
      );
    }

    return normalizedRow;
  }

  private normalizeValue(
    value: unknown,
    affinity: SqliteAffinity,
    fixtureName: string,
    columnName: string,
    rowIndex: number
  ): string | number | bigint | Buffer {
    const location = `fixture "${fixtureName}" column "${columnName}" (row ${rowIndex})`;

    if (affinity === 'TEXT') {
      if (typeof value === 'string') {
        return value;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      return JSON.stringify(value);
    }

    if (affinity === 'INTEGER') {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
      }
      if (typeof value === 'bigint') {
        return value;
      }
      if (typeof value === 'boolean') {
        return value ? 1 : 0;
      }
      throw new SchemaValidationError(`Expected integer-compatible value for ${location}.`);
    }

    if (affinity === 'REAL' || affinity === 'NUMERIC') {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'bigint') {
        return Number(value);
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
      throw new SchemaValidationError(`Expected numeric value for ${location}.`);
    }

    if (affinity === 'BLOB') {
      if (value instanceof Buffer) {
        return value;
      }
      if (value instanceof Uint8Array) {
        return Buffer.from(value);
      }
      throw new SchemaValidationError(`Expected Buffer or Uint8Array for ${location}.`);
    }

    throw new SchemaValidationError(`Unsupported affinity "${affinity}" configured for ${location}.`);
  }
}
