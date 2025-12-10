import { existsSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { runPgDump } from '../utils/pgDump';
import { ensureDirectory } from '../utils/fs';
import { normalizePulledSchema, NormalizedStatement } from '../utils/normalizePulledSchema';
import type { DbConnectionContext } from '../utils/dbConnection';

export interface PullSchemaOptions {
  url: string;
  out: string;
  pgDumpPath?: string;
  schemas?: string[];
  tables?: string[];
  connectionContext?: DbConnectionContext;
}

interface TableSpecifier {
  schema: string;
  original: string;
}

export function runPullSchema(options: PullSchemaOptions): void {
  // Canonicalize CLI filters before invoking pg_dump so later steps can rely on consistent casing.
  const schemaFilters = (options.schemas ?? []).map((value) => normalizeSchemaName(value));
  const tableFilters = (options.tables ?? []).map((value) => parseTableSpecifier(value));
  // Build the schema set that should survive the normalization pass.
  const allowedSchemas = buildAllowedSchemas(schemaFilters, tableFilters);

  // Invoke pg_dump once with the normalized filters so only the desired objects are exported.
  const ddlSql = runPgDump({
    url: options.url,
    pgDumpPath: options.pgDumpPath,
    extraArgs: buildPgDumpArguments(schemaFilters, tableFilters),
    connectionContext: options.connectionContext
  });

  // Normalize and bucket the pg_dump output while respecting the requested schema set.
  const normalizedMap = normalizePulledSchema(ddlSql, {
    allowedSchemas: allowedSchemas.size ? allowedSchemas : undefined
  });
  if (normalizedMap.size === 0) {
    // Help callers realize their filters may have excluded everything from the dump.
    const filterHints: string[] = [];
    if (schemaFilters.length) {
      filterHints.push(`--schema ${schemaFilters.join(', ')}`);
    }
    if (tableFilters.length) {
      filterHints.push(`--table ${tableFilters.map((table) => table.original).join(', ')}`);
    }
    const hint = filterHints.length ? ` Filters applied: ${filterHints.join('; ')}.` : '';
    throw new Error(`The dump did not contain any supported DDL statements.${hint} Verify the schema/table filters match your database.`);
  }

  const outDir = path.resolve(options.out);
  ensureDirectory(outDir);
  // Remove the legacy schema.sql snapshot only when it is still present.
  const legacySchemaFile = path.join(outDir, 'schema.sql');
  if (existsSync(legacySchemaFile)) {
    rmSync(legacySchemaFile, { force: true });
  }
  const schemasDir = path.join(outDir, 'schemas');
  if (existsSync(schemasDir)) {
    rmSync(schemasDir, { recursive: true, force: true });
  }

  // Persist each schema snapshot directly under the DDL directory for easier discovery.
  for (const [schema, statements] of normalizedMap) {
    const filePath = path.join(outDir, `${sanitizeSchemaFileName(schema)}.sql`);
    writeFileSync(filePath, buildSchemaFile(statements), 'utf8');
    console.log(`Wrote normalized schema for ${schema} at ${filePath}`);
  }
}

function buildPgDumpArguments(schemaFilters: string[], tableFilters: TableSpecifier[]): string[] {
  // Allow callers to target specific schemas or tables when invoking pg_dump.
  const args: string[] = [];
  for (const schema of schemaFilters) {
    args.push('--schema', schema);
  }
  for (const table of tableFilters) {
    args.push('--table', table.original);
  }
  return args;
}

function buildAllowedSchemas(schemaFilters: string[], tableFilters: TableSpecifier[]): Set<string> {
  // Combine the schemas referenced via filters so the normalizer can limit output.
  const combined = new Set<string>(schemaFilters);
  for (const table of tableFilters) {
    combined.add(table.schema);
  }
  return combined;
}

function buildSchemaFile(statements: NormalizedStatement[]): string {
  // Join the sorted statements with blank lines so the file stays readable.
  const body = statements.map((statement) => statement.sql).join('\n\n');
  return `${body}\n`;
}

function sanitizeSchemaFileName(schema: string): string {
  const sanitized = schema.replace(/[^a-z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  // Fall back to a safe default when all characters were stripped away.
  return sanitized || 'schema';
}

function normalizeSchemaName(value: string): string {
  // Trim, unquote, and lowercase schema names to keep filter comparison predictable.
  return value.trim().replace(/^"|"$/g, '').toLowerCase();
}

function parseTableSpecifier(value: string): TableSpecifier {
  const trimmed = value.trim();
  const qualifiedPattern = /^\s*(?:"([^"]+)"|([^".\s]+))\.(?:"([^"]+)"|([^".\s]+))\s*$/;
  const match = trimmed.match(qualifiedPattern);
  // Resolve the schema portion, falling back to public when the specifier is unqualified.
  const schema = match ? match[1] ?? match[2] ?? 'public' : 'public';
  return {
    schema: normalizeSchemaName(schema),
    original: trimmed
  };
}
