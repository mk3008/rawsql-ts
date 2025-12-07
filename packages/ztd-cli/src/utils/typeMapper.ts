const numericTypes = new Set([
  'int',
  'integer',
  'smallint',
  'bigint',
  'real',
  'double precision',
  'float',
  'serial',
  'bigserial',
  'smallserial'
]);

const arbitraryPrecisionTypes = new Set(['decimal', 'numeric']);

const stringTypes = new Set(['text', 'varchar', 'char', 'character varying', 'character', 'uuid', 'citext']);

const dateTypes = new Set(['date', 'timestamp', 'timestamp without time zone', 'timestamp with time zone', 'time', 'time without time zone', 'time with time zone', 'timestamptz']);

const shouldLogUnknownSqlTypes = process.env.RAWSQL_DDL_SILENT !== '1';

function warnUnknownSqlType(typeName: string | undefined, context?: string): void {
  // Do nothing when logging is explicitly silenced in CI or tooling.
  if (!shouldLogUnknownSqlTypes) {
    return;
  }

  // Keep developers aware when the generator sees an unmapped SQL type.
  const subject = context ?? 'column';
  console.warn(
    `[ztd ddl] Unknown SQL type for ${subject}: ${typeName ?? 'undefined'}. Defaulting to unknown.`
  );
}

/**
 * Maps PostgreSQL data types (basic numeric, string, temporal, JSON/binary types) to serializable TypeScript types, falling back to `unknown` when unmatched.
 */
export function mapSqlTypeToTs(typeName?: string, context?: string): string {
  // Log when the AST omitted a type so callers can track down why type inference failed.
  if (!typeName) {
    warnUnknownSqlType(typeName, context);
    return 'unknown';
  }

  // Drop trailing precision/length metadata (varchar(255), numeric(10,2), etc.) because TS cannot capture it.
  const normalized = typeName.split('(')[0].trim().toLowerCase();

  if (numericTypes.has(normalized)) {
    return 'number';
  }

  if (arbitraryPrecisionTypes.has(normalized)) {
    // Postgres decimal/numeric are arbitrary precision, so string preserves exactness when floating-point would lose it.
    return 'string';
  }

  // Treat all date/time families as strings to keep the generated rows serializable.
  if (normalized.includes('time') || dateTypes.has(normalized)) {
    return 'string';
  }

  if (stringTypes.has(normalized) || normalized.includes('text')) {
    return 'string';
  }

  if (normalized === 'boolean' || normalized === 'bool') {
    return 'boolean';
  }

  if (normalized === 'json' || normalized === 'jsonb') {
    // Use any so generated APIs stay friendly for JSON-heavy applications; narrowing can still be applied later.
    return 'any';
  }

  if (normalized === 'bytea') {
    // Prefer Uint8Array to avoid Node.js-only Buffer while still representing binary payloads.
    return 'Uint8Array';
  }

  if (normalized === 'inet' || normalized === 'cidr' || normalized === 'macaddr') {
    return 'string';
  }

  if (normalized.startsWith('interval')) {
    // Interval strings cover day/hour/second variants, so keep them as text.
    return 'string';
  }

  // Alert when an unfamiliar SQL type flows through so we can extend the mapper later.
  warnUnknownSqlType(typeName, context);
  return 'unknown';
}
