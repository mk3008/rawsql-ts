import type { TableDefinitionModel } from 'rawsql-ts';
import { normalizeIdentifier } from './naming';
import type { SchemaRegistry } from '../types';
import { TableNameResolver } from './TableNameResolver';

export class TableDefinitionSchemaRegistry implements SchemaRegistry {
  private readonly tableMap: Map<string, TableDefinitionModel>;

  constructor(definitions: TableDefinitionModel[], private readonly tableNameResolver?: TableNameResolver) {
    this.tableMap = new Map();
    for (const definition of definitions) {
      const key = this.normalizeTableKey(definition.name);
      // Use normalized names so lookups stay case-insensitive and schema-aware.
      this.tableMap.set(key, definition);
    }
  }

  public getTable(name: string): TableDefinitionModel | undefined {
    const key = this.normalizeTableKey(name);
    return this.tableMap.get(key);
  }

  // Normalize table keys so registry lookups stay aligned with the resolver.
  private normalizeTableKey(name: string): string {
    if (!this.tableNameResolver) {
      return normalizeIdentifier(name);
    }
    return this.tableNameResolver.resolve(name);
  }
}
