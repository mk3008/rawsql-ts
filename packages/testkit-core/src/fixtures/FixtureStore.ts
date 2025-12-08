import { SchemaValidationError } from '../errors';
import { normalizeIdentifier } from './naming';
import type {
  TableDefinitionModel,
  TableFixture,
  SchemaRegistry,
  TableSchemaDefinition,
} from '../types';
import { guessAffinity } from './ColumnAffinity';
import type { ColumnAffinity } from './ColumnAffinity';
import { TableNameResolver } from './TableNameResolver';

export interface ColumnDefinition {
  name: string;
  typeName: string;
  affinity: ColumnAffinity;
}

export interface NormalizedFixture {
  name: string;
  columns: ColumnDefinition[];
  rows: (string | number | bigint | Buffer | null)[][];
}

export type FixtureColumnSource = 'fixture' | 'schema';

export interface FixtureColumnDescription {
  columns: ColumnDefinition[];
  source: FixtureColumnSource;
}

/**
 * Normalizes and indexes fixture metadata so rewrites can resolve tables and columns deterministically.
 */
export class FixtureStore {
  private readonly schemaRegistry?: SchemaRegistry;
  private readonly tableNameResolver?: TableNameResolver;
  private readonly baseMap: Map<string, NormalizedFixture>;

  constructor(fixtures: TableFixture[] = [], schema?: SchemaRegistry, tableNameResolver?: TableNameResolver) {
    this.schemaRegistry = schema;
    this.tableNameResolver = tableNameResolver;
    this.baseMap = this.buildMap(fixtures);
  }

  /**
   * Builds a fixture lookup map that layers per-call overrides on top of the base fixtures.
   * @param overrides - Additional fixtures to merge with the base set.
   * @returns A map keyed by normalized table names.
   */
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

  /**
   * Retrieves column metadata for the requested table from fixtures or registered schema information.
   * @param tableName - The table identifier potentially qualified by schema.
   * @returns Column details assembled from fixtures or schema registry entries.
   */
  public describeColumns(tableName: string): FixtureColumnDescription | undefined {
    const target = this.resolveTableKey(tableName, (candidate) => this.baseMap.has(candidate));
    const fixture = this.baseMap.get(target);
    if (fixture) {
      return { columns: fixture.columns, source: 'fixture' };
    }

    const schema = this.getRegisteredSchema(tableName);
    if (!schema) {
      return undefined;
    }

    return { columns: this.buildColumns(schema, tableName), source: 'schema' };
  }

  private buildMap(fixtures: TableFixture[]): Map<string, NormalizedFixture> {
    const map = new Map<string, NormalizedFixture>();
    for (const fixture of fixtures) {
      const lookupKey = this.resolveTableKey(fixture.tableName);
      map.set(lookupKey, this.normalizeFixture(fixture));
    }
    return map;
  }

  private getRegisteredSchema(tableName: string): TableSchemaDefinition | TableDefinitionModel | undefined {
    if (!this.schemaRegistry) {
      return undefined;
    }

    for (const candidate of this.resolveLookupCandidates(tableName)) {
      const schema = this.schemaRegistry.getTable(candidate);
      if (schema) {
        return schema;
      }
    }

    return undefined;
  }

  private normalizeFixture(fixture: TableFixture): NormalizedFixture {
    const schema = fixture.schema ?? this.getRegisteredSchema(fixture.tableName);
    if (!schema) {
      throw new SchemaValidationError(
        `Table "${fixture.tableName}" is missing a schema definition. Provide fixture.schema or register the table.`
      );
    }

    const columns = this.buildColumns(schema, fixture.tableName);
    const rows = fixture.rows.map((row, rowIndex) =>
      this.normalizeRow(row, columns, fixture.tableName, rowIndex)
    );

    return {
      name: fixture.tableName,
      columns,
      rows,
    };
  }

  // Prefer configured resolver results so the canonical key matches schema-aware expectations.
  private resolveTableKey(tableName: string, lookup?: (candidate: string) => boolean): string {
    if (!this.tableNameResolver) {
      return normalizeIdentifier(tableName);
    }
    return this.tableNameResolver.resolve(tableName, lookup);
  }

  // Provide multiple lookup candidates so schema registries can be probed by both qualified and unqualified names.
  private resolveLookupCandidates(tableName: string): string[] {
    if (!this.tableNameResolver) {
      return [normalizeIdentifier(tableName)];
    }
    return this.tableNameResolver.buildLookupCandidates(tableName);
  }

  private buildColumns(
    schema: TableSchemaDefinition | TableDefinitionModel,
    fixtureName: string
  ): ColumnDefinition[] {
    if (this.isTableDefinitionModel(schema)) {
      // Table definitions carry richer metadata that we can reuse for affinity guesses.
      return this.buildColumnsFromDefinition(schema, fixtureName);
    }

    return this.buildColumnsFromSchema(schema, fixtureName);
  }

  private buildColumnsFromSchema(schema: TableSchemaDefinition, fixtureName: string): ColumnDefinition[] {
    const entries = Object.entries(schema.columns);
    if (entries.length === 0) {
      throw new SchemaValidationError(`Schema for "${fixtureName}" must declare at least one column.`);
    }

    return entries.map(([name, typeName]) => this.buildColumnDefinition(name, typeName ?? ''));
  }

  private buildColumnsFromDefinition(
    definition: TableDefinitionModel,
    fixtureName: string
  ): ColumnDefinition[] {
    if (definition.columns.length === 0) {
      throw new SchemaValidationError(`Schema for "${fixtureName}" must declare at least one column.`);
    }

    return definition.columns.map((column) =>
      this.buildColumnDefinition(column.name, column.typeName ?? '')
    );
  }

  private buildColumnDefinition(name: string, typeName: string): ColumnDefinition {
    return {
      name,
      typeName,
      affinity: guessAffinity(typeName),
    };
  }

  private isTableDefinitionModel(
    schema: TableSchemaDefinition | TableDefinitionModel
  ): schema is TableDefinitionModel {
    return Array.isArray(schema.columns);
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

      normalizedRow.push(this.normalizeValue(value, column.affinity, fixtureName, column.name, rowIndex));
    }

    return normalizedRow;
  }

  private normalizeValue(
    value: unknown,
    affinity: ColumnAffinity,
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
