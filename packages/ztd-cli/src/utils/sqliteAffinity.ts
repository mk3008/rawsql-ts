import type { SqliteAffinity } from '@rawsql-ts/testkit-core';

const shouldLogUnknownSqlTypes = process.env.RAWSQL_DDL_SILENT !== '1';

function warnUnknownSqlType(typeName: string | undefined, context?: string): void {
  if (!shouldLogUnknownSqlTypes) {
    return;
  }

  const subject = context ?? 'column';
  console.warn(`[ztd ddl] Unknown SQL type for ${subject}: ${typeName ?? 'undefined'}. Defaulting to NUMERIC.`);
}

/**
 * Maps PostgreSQL column types to SQLite affinities to keep fixtures compatible with sqlite-testkit.
 */
export function mapSqlTypeToAffinity(typeName?: string, context?: string): SqliteAffinity {
  if (!typeName) {
    warnUnknownSqlType(typeName, context);
    return 'NUMERIC';
  }

  const normalized = typeName.split('(')[0].trim().toUpperCase();

  if (normalized === '' || normalized.includes('BLOB')) {
    return 'BLOB';
  }

  if (normalized.includes('INT')) {
    return 'INTEGER';
  }

  // Treat temporal types as TEXT so fixtures align with how pg-testkit exposes timestamps/dates.
  if (normalized.includes('TIME') || normalized.includes('DATE')) {
    return 'TEXT';
  }

  if (normalized.includes('CHAR') || normalized.includes('CLOB') || normalized.includes('TEXT')) {
    return 'TEXT';
  }

  if (normalized.includes('REAL') || normalized.includes('DOUB') || normalized.includes('FLOA')) {
    return 'REAL';
  }

  return 'NUMERIC';
}
