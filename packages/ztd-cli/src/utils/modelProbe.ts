import type { PgClientLike } from './optionalDependencies';

export interface ProbedColumn {
  columnName: string;
  typeName: string;
  tsType: string;
}

interface ProbeField {
  name: string;
  dataTypeID: number;
}

interface PgTypeRow {
  oid: number;
  typname: string;
  typtype: string;
  typelem: number;
  typbasetype: number;
}

const directTypeMap = new Map<string, string>([
  ['int2', 'number'],
  ['int4', 'number'],
  ['int8', 'string'],
  ['float4', 'number'],
  ['float8', 'number'],
  ['numeric', 'string'],
  ['decimal', 'string'],
  ['bool', 'boolean'],
  ['text', 'string'],
  ['varchar', 'string'],
  ['bpchar', 'string'],
  ['char', 'string'],
  ['uuid', 'string'],
  ['citext', 'string'],
  ['name', 'string'],
  ['date', 'string'],
  ['timestamp', 'string'],
  ['timestamptz', 'string'],
  ['time', 'string'],
  ['timetz', 'string'],
  ['json', 'any'],
  ['jsonb', 'any'],
  ['bytea', 'Uint8Array']
]);

export async function probeQueryColumns(
  client: PgClientLike,
  boundSql: string,
  params: unknown[]
): Promise<ProbedColumn[]> {
  const probeSql = buildProbeSql(boundSql);
  const result = await client.query(probeSql, params);
  const fields = normalizeFields(result.fields);
  if (fields.length === 0) {
    throw new Error('The probe query returned no column metadata.');
  }

  const typeRows = await loadPgTypes(client, fields.map((field) => field.dataTypeID));
  return fields.map((field) => {
    const typeName = resolvePgTypeName(field.dataTypeID, typeRows);
    return {
      columnName: field.name,
      typeName,
      tsType: mapPgTypeToTs(field.dataTypeID, typeRows)
    };
  });
}

export function buildProbeSql(boundSql: string): string {
  const normalizedSql = boundSql.trim().replace(/(?:;\s*)+$/u, '');
  if (!normalizedSql) {
    throw new Error('The SQL probe source is empty.');
  }
  return `SELECT * FROM (${normalizedSql}) AS _ztd_type_probe LIMIT 0`;
}

function normalizeFields(fields: unknown): ProbeField[] {
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields
    .filter((field): field is ProbeField =>
      typeof field === 'object' &&
      field !== null &&
      typeof (field as { name?: unknown }).name === 'string' &&
      typeof (field as { dataTypeID?: unknown }).dataTypeID === 'number'
    );
}

async function loadPgTypes(client: PgClientLike, initialOids: number[]): Promise<Map<number, PgTypeRow>> {
  const rows = new Map<number, PgTypeRow>();
  const pending = new Set<number>(initialOids.filter((oid) => oid > 0));

  while (pending.size > 0) {
    const batch = Array.from(pending);
    pending.clear();
    const result = await client.query<PgTypeRow>(
      `
        SELECT oid, typname, typtype, typelem, typbasetype
        FROM pg_type
        WHERE oid = ANY($1::oid[])
      `,
      [batch]
    );
    for (const row of result.rows ?? []) {
      rows.set(row.oid, row);
      if (row.typelem && row.typelem > 0 && !rows.has(row.typelem)) {
        pending.add(row.typelem);
      }
      if (row.typbasetype && row.typbasetype > 0 && !rows.has(row.typbasetype)) {
        pending.add(row.typbasetype);
      }
    }
  }

  return rows;
}

function resolvePgTypeName(oid: number, rows: Map<number, PgTypeRow>): string {
  const row = rows.get(oid);
  if (!row) {
    return 'unknown';
  }
  if (row.typtype === 'd' && row.typbasetype > 0) {
    return resolvePgTypeName(row.typbasetype, rows);
  }
  if (row.typelem > 0 && row.typname.startsWith('_')) {
    return `${resolvePgTypeName(row.typelem, rows)}[]`;
  }
  if (row.typtype === 'e') {
    return row.typname;
  }
  return row.typname;
}

function mapPgTypeToTs(oid: number, rows: Map<number, PgTypeRow>): string {
  const row = rows.get(oid);
  if (!row) {
    return 'unknown';
  }
  if (row.typtype === 'd' && row.typbasetype > 0) {
    return mapPgTypeToTs(row.typbasetype, rows);
  }
  if (row.typelem > 0 && row.typname.startsWith('_')) {
    return `${mapPgTypeToTs(row.typelem, rows)}[]`;
  }
  if (row.typtype === 'e') {
    return 'string';
  }
  return directTypeMap.get(row.typname) ?? 'unknown';
}
