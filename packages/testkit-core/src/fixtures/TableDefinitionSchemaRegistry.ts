import type { TableDefinitionModel } from 'rawsql-ts';
import { normalizeIdentifier } from './naming';
import type { SchemaRegistry } from '../types';

export class TableDefinitionSchemaRegistry implements SchemaRegistry {
  private readonly tableMap: Map<string, TableDefinitionModel>;

  constructor(definitions: TableDefinitionModel[]) {
    this.tableMap = new Map();
    for (const definition of definitions) {
      // Use normalized names so lookups stay case-insensitive and schema-aware.
      this.tableMap.set(normalizeIdentifier(definition.name), definition);
    }
  }

  public getTable(name: string): TableDefinitionModel | undefined {
    const normalized = normalizeIdentifier(name);
    return this.tableMap.get(normalized);
  }
}
