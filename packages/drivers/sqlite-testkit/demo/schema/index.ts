import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SchemaRegistry, TableSchemaDefinition } from '@rawsql-ts/testkit-core';

const schemaPath = resolve(__dirname, 'schema.json');
const TABLE_SCHEMAS = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<
  string,
  TableSchemaDefinition
>;

class DemoSchemaRegistry implements SchemaRegistry {
  private readonly tables: Record<string, TableSchemaDefinition>;

  constructor(tables: Record<string, TableSchemaDefinition>) {
    this.tables = Object.fromEntries(
      Object.entries(tables).map(([name, definition]) => [name.toLowerCase(), definition])
    );
  }

  public getTable(name: string): TableSchemaDefinition | undefined {
    return this.tables[name.toLowerCase()];
  }
}

export const demoSchemaRegistry: SchemaRegistry = new DemoSchemaRegistry(TABLE_SCHEMAS);
