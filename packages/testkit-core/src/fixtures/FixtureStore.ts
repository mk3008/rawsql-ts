import { SchemaValidationError } from '../errors';
import { normalizeIdentifier, sanitizeFixtureIdentifier } from './naming';
import type {
  ColumnTypeName,
  TableFixture,
  SchemaRegistry,
  TableSchemaDefinition,
} from '../types';

export interface ColumnDefinition {
  name: string;
  typeName: ColumnTypeName;
}

export interface NormalizedFixture {
  tableName: string;
  cteNameBase: string;
  columns: ColumnDefinition[];
  rows: (string | number | bigint | Buffer | null)[][];
}

export type FixtureColumnSource = 'fixture' | 'schema';

export interface FixtureColumnDescription {
  columns: ColumnDefinition[];
  source: FixtureColumnSource;
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

  public describeColumns(tableName: string): FixtureColumnDescription | undefined {
    const normalized = normalizeIdentifier(tableName);
    const fixture = this.baseMap.get(normalized);
    if (fixture) {
      return { columns: fixture.columns, source: 'fixture' };
    }

    const schema = this.getRegisteredSchema(tableName, normalized);
    if (!schema) {
      return undefined;
    }

    return { columns: this.buildColumns(schema, tableName), source: 'schema' };
  }

  private buildMap(fixtures: TableFixture[]): Map<string, NormalizedFixture> {
    const map = new Map<string, NormalizedFixture>();
    for (const fixture of fixtures) {
      const normalizedName = normalizeIdentifier(fixture.tableName);
      map.set(normalizedName, this.normalizeFixture(fixture));
    }
    return map;
  }

  private getRegisteredSchema(tableName: string, normalized: string): TableSchemaDefinition | undefined {
    if (!this.schemaRegistry) {
      return undefined;
    }
    return (
      this.schemaRegistry.getTable(tableName) ??
      this.schemaRegistry.getTable(normalized) ??
      this.schemaRegistry.getTable(tableName.toLowerCase())
    );
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
      tableName: fixture.tableName,
      cteNameBase: sanitizeFixtureIdentifier(fixture.tableName),
      columns,
      rows,
    };
  }

  private buildColumns(schema: TableSchemaDefinition, fixtureName: string): ColumnDefinition[] {
    const entries = Object.entries(schema.columns);
    if (entries.length === 0) {
      throw new SchemaValidationError(`Schema for "${fixtureName}" must declare at least one column.`);
    }

    return entries.map(([name, typeName]) => ({ name, typeName }));
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
        this.normalizeValue(value, column.typeName, fixtureName, column.name, rowIndex)
      );
    }

    return normalizedRow;
  }

  private normalizeValue(
    value: unknown,
    typeName: ColumnTypeName,
    fixtureName: string,
    columnName: string,
    rowIndex: number
  ): string | number | bigint | Buffer {
    const location = `fixture "${fixtureName}" column "${columnName}" (row ${rowIndex})`;

    // Convert flexible JS primitives into the literal shapes SqliteValuesBuilder accepts.
    if (value instanceof Buffer) {
      return value;
    }
    if (value instanceof Uint8Array) {
      return Buffer.from(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    throw new SchemaValidationError(
      `Expected fixture value compatible with declared type "${typeName}" for ${location}.`
    );
  }
}

