import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SchemaRegistry, TableSchemaDefinition } from '@rawsql-ts/testkit-core';

const schemaPath = resolve(__dirname, 'schema.json');
const TABLE_SCHEMAS = loadSchemaDefinitions();

function loadSchemaDefinitions(): Record<string, TableSchemaDefinition> {
  // Prefer per-table JSON fragments when they are present for easier maintenance.
  const directoryEntries = readdirSync(__dirname);
  const tableFiles = directoryEntries
    .filter((name) => name !== 'schema.json' && name.endsWith('.json'))
    .sort();

  if (tableFiles.length > 0) {
    const aggregated: Record<string, TableSchemaDefinition> = {};
    for (const file of tableFiles) {
      const filePath = resolve(__dirname, file);
      const partial = JSON.parse(readFileSync(filePath, 'utf8')) as Record<
        string,
        TableSchemaDefinition
      >;
      Object.assign(aggregated, partial);
    }

    if (Object.keys(aggregated).length > 0) {
      return aggregated;
    }
  }

  if (!existsSync(schemaPath)) {
    throw new Error('No schema definitions were found for the demo registry.');
  }

  return JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, TableSchemaDefinition>;
}

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
