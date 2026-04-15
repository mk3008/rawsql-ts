import type { SqlClient } from '../../src/libraries/sql/sql-client.js';

export type TestkitClient = SqlClient & {
  close(): Promise<void>;
};

export interface TableFixture<RowShape extends Record<string, unknown> = Record<string, unknown>> {
  tableName: string;
  rows: RowShape[];
  schema?: { columns: Record<string, string> };
}

type FixtureRow = Record<string, unknown>;

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/^"+|"+$/g, '').toLowerCase();
}

function resolveTableRows(fixtures: TableFixture[], tableName: string): FixtureRow[] {
  const requested = normalizeIdentifier(tableName);
  const fixture = fixtures.find((entry) => {
    const candidate = normalizeIdentifier(entry.tableName);
    return candidate === requested || candidate.endsWith(`.${requested}`);
  });

  return (fixture?.rows ?? []) as FixtureRow[];
}

function parseSelectQuery(sql: string): { columns: string[]; tableName: string; whereColumn?: string; whereValue?: string } {
  const normalized = sql.trim().replace(/;$/, '');
  const match = normalized.match(
    /^select\s+(?<columns>[\s\S]+?)\s+from\s+(?<table>"[^"]+"|[a-zA-Z0-9_.]+)(?:\s+where\s+(?<whereColumn>"[^"]+"|[a-zA-Z0-9_]+)\s*=\s*(?<whereValue>\$\d+|'.*?'|".*?"|[a-zA-Z0-9_.-]+))?$/i
  );

  if (!match?.groups) {
    throw new Error(`Unsupported testkit query: ${sql}`);
  }

  const columns = match.groups.columns.split(',').map((column) => normalizeIdentifier(column));
  const tableName = normalizeIdentifier(match.groups.table);
  const whereColumn = match.groups.whereColumn ? normalizeIdentifier(match.groups.whereColumn) : undefined;
  const whereValue = match.groups.whereValue?.trim();

  return { columns, tableName, whereColumn, whereValue };
}

function resolveWhereValue(whereValue: string | undefined, values?: readonly unknown[] | Record<string, unknown>): unknown {
  if (!whereValue) {
    return undefined;
  }

  if (whereValue.startsWith('$')) {
    const index = Number(whereValue.slice(1));
    if (!Number.isFinite(index) || index < 1) {
      throw new Error(`Unsupported parameter reference: ${whereValue}`);
    }

    if (!Array.isArray(values)) {
      throw new Error('Positional parameters are required for fixture-backed queries.');
    }

    return values[index - 1];
  }

  if (whereValue.startsWith("'") && whereValue.endsWith("'")) {
    return whereValue.slice(1, -1).replace(/''/g, "'");
  }

  if (whereValue.startsWith('"') && whereValue.endsWith('"')) {
    return whereValue.slice(1, -1);
  }

  return whereValue;
}

function projectRows(rows: FixtureRow[], columns: string[]): FixtureRow[] {
  return rows.map((row) => {
    const projected: FixtureRow = {};
    for (const column of columns) {
      projected[column] = row[column];
    }
    return projected;
  });
}

function filterRows(rows: FixtureRow[], whereColumn: string | undefined, whereValue: unknown): FixtureRow[] {
  if (!whereColumn) {
    return rows;
  }

  return rows.filter((row) => row[whereColumn] === whereValue);
}

export function tableFixture<RowShape extends Record<string, unknown>>(
  tableName: string,
  rows: RowShape[],
  schema?: { columns: Record<string, string> }
): TableFixture<RowShape> {
  return { tableName, rows, schema };
}

/**
 * Create a reusable fixture-backed SqlClient for ZTD tests.
 *
 * The scaffold keeps the first test path self-contained so the sample stays runnable
 * even when external fixture packages are unavailable.
 */
export async function createTestkitClient(fixtures: TableFixture[] = []): Promise<TestkitClient> {
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[] | Record<string, unknown>
    ): Promise<T[]> {
      if (fixtures.length === 0) {
        throw new Error('Provide tableFixture() rows before executing fixture-backed tests.');
      }

      const parsed = parseSelectQuery(text);
      const rows = resolveTableRows(fixtures, parsed.tableName);
      const whereValue = resolveWhereValue(parsed.whereValue, values);
      const matchingRows = filterRows(rows, parsed.whereColumn, whereValue);
      return projectRows(matchingRows, parsed.columns) as T[];
    },
    async close() {
      return;
    }
  };
}
