export interface NormalizedType {
  canonicalType: string;
  typeKey: string;
  unknown: boolean;
  baseForDivergence: string;
}

export function normalizePostgresType(rawTypeName: string): NormalizedType {
  const raw = rawTypeName.trim();
  const lower = raw.toLowerCase().replace(/\s+/g, ' ');

  if (!lower) {
    return asRaw('unknown');
  }

  if (lower === 'integer' || lower === 'int' || lower === 'int4') {
    return known('int4', 'int4');
  }
  if (lower === 'bigint' || lower === 'int8') {
    return known('int8', 'int8');
  }
  if (lower === 'serial' || lower === 'serial4') {
    return known('int4', 'int4{serial}', 'int4');
  }
  if (lower === 'bigserial' || lower === 'serial8') {
    return known('int8', 'int8{serial}', 'int8');
  }
  if (lower === 'boolean' || lower === 'bool') {
    return known('bool', 'bool');
  }
  if (lower === 'uuid') {
    return known('uuid', 'uuid');
  }
  if (lower === 'timestamp without time zone' || lower === 'timestamp') {
    return known('timestamp', 'timestamp');
  }
  if (lower === 'timestamp with time zone' || lower === 'timestamptz') {
    return known('timestamptz', 'timestamptz');
  }

  const numeric = lower.match(/^(numeric|decimal)\s*\((\d+)\s*,\s*(\d+)\)$/);
  if (numeric) {
    const p = numeric[2];
    const s = numeric[3];
    return known(`numeric(${p},${s})`, `numeric(${p},${s})`, 'numeric');
  }
  if (lower === 'numeric' || lower === 'decimal') {
    return known('numeric', 'numeric', 'numeric');
  }

  const varchar = lower.match(/^(character varying|varchar)\s*\((\d+)\)$/);
  if (varchar) {
    const n = varchar[2];
    return known(`varchar(${n})`, `varchar(${n})`, 'varchar');
  }
  if (lower === 'character varying' || lower === 'varchar') {
    return known('varchar', 'varchar', 'varchar');
  }

  return asRaw(raw);
}

function known(canonicalType: string, typeKey: string, baseForDivergence?: string): NormalizedType {
  return {
    canonicalType,
    typeKey,
    unknown: false,
    baseForDivergence: baseForDivergence ?? canonicalType.replace(/\(.*\)/, ''),
  };
}

function asRaw(raw: string): NormalizedType {
  const normalizedRaw = raw.replace(/\s+/g, ' ').trim();
  return {
    canonicalType: normalizedRaw,
    typeKey: `raw:${normalizedRaw}`,
    unknown: true,
    baseForDivergence: `raw:${normalizedRaw.toLowerCase()}`,
  };
}
