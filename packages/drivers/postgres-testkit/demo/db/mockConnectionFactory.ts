import type { PostgresConnectionLike } from '../../src/types';
import type { QueryConfig } from 'pg';

export type DemoRow = Record<string, unknown>;
export interface DemoTableRows {
  [tableAlias: string]: DemoRow[];
}

const DEFAULT_TABLE_ROWS: DemoTableRows = {
  'public.customers': [],
  'public.customer_tiers': [],
  public__customers: [],
  public__customer_tiers: [],
};

// Normalize table identifiers so we can map both dotted and sanitized versions to the same fixture set.
const normalizeKey = (value: string): string => value.trim().toLowerCase();

const hydrateLookup = (rows: DemoTableRows): Record<string, DemoRow[]> => {
  const lookup: Record<string, DemoRow[]> = {};
  for (const [key, value] of Object.entries(rows)) {
    const normalized = normalizeKey(key);
    // mirror both dotted and sanitized identifiers so alias variants share the same fixtures
    lookup[normalized] = value;
    lookup[normalized.replace(/\./g, '__')] = value;
  }
  return lookup;
};

// Try to infer the table alias referenced in the SQL so we can return the matching fixture rows.
const detectTableAlias = (sql: string): string | undefined => {
  // capture schema and table identifiers from a simple FROM clause
  const match = /from\s+(?:(?:"([\w_]+)")|([\w_]+))(?:\.(?:(?:"([\w_]+)")|([\w_]+)))?/i.exec(sql);
  if (!match) {
    return undefined;
  }

  const schema = match[1] ?? match[2];
  const table = match[3] ?? match[4];
  if (schema && table) {
    return `${schema}.${table}`;
  }
  return schema;
};

// Bundle the stub rows into the same shape pg.Client.query returns.
const buildQueryResult = (rows: DemoRow[]) => ({
  command: 'SELECT' as const,
  rowCount: rows.length,
  oid: 0,
  rows,
  fields: [],
});

export const createDemoPostgresConnection = (tableRows: DemoTableRows = {}): PostgresConnectionLike => {
  const lookup = hydrateLookup({ ...DEFAULT_TABLE_ROWS, ...tableRows });

  return {
    query: async (textOrConfig: string | QueryConfig) => {
      // normalize the input so we always work with the SQL text
      const sql = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
      const table = detectTableAlias(sql);
      const normalized = table ? normalizeKey(table) : undefined;
      const rows = normalized ? lookup[normalized] ?? [] : [];
      return buildQueryResult(rows);
    },
    end: async () => undefined,
  };
};

