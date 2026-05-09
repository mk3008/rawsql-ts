import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { TableDocsColumnMetadata, TableDocsMetadata, TableDocsTableMetadata } from './types';

export interface ResolvedTableDocsMetadata {
  getColumnSample(schema: string, table: string, column: string): string;
}

const EMPTY_TABLE_DOCS_METADATA: ResolvedTableDocsMetadata = {
  getColumnSample: () => '',
};

export function loadTableDocsMetadata(metadataPath: string | undefined): ResolvedTableDocsMetadata {
  if (!metadataPath) {
    return EMPTY_TABLE_DOCS_METADATA;
  }

  const resolvedPath = path.resolve(process.cwd(), metadataPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Table docs metadata file does not exist: ${resolvedPath}`);
  }

  const raw = parseTableDocsMetadataFile(resolvedPath);
  assertTableDocsMetadata(raw, resolvedPath);

  return {
    getColumnSample: (schema, table, column) => {
      const tableMetadata = raw.tables?.[`${schema}.${table}`] ?? raw.tables?.[table];
      const columnMetadata = tableMetadata?.columns?.[column];
      return formatSample(columnMetadata?.sample);
    },
  };
}

function parseTableDocsMetadataFile(resolvedPath: string): unknown {
  try {
    return JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse table docs metadata file: ${resolvedPath}: ${message}`);
  }
}

function assertTableDocsMetadata(value: unknown, sourcePath: string): asserts value is TableDocsMetadata {
  if (!isRecord(value)) {
    throw new Error(`Table docs metadata must be a JSON object: ${sourcePath}`);
  }
  if (value.schemaVersion !== 1) {
    throw new Error(`Table docs metadata schemaVersion must be 1: ${sourcePath}`);
  }
  if (value.tables !== undefined && !isRecord(value.tables)) {
    throw new Error(`Table docs metadata tables must be an object: ${sourcePath}`);
  }
  for (const [tableKey, tableMetadata] of Object.entries(value.tables ?? {})) {
    assertTableMetadata(tableKey, tableMetadata, sourcePath);
  }
}

function assertTableMetadata(tableKey: string, value: unknown, sourcePath: string): asserts value is TableDocsTableMetadata {
  if (!isRecord(value)) {
    throw new Error(`Table docs metadata entry must be an object for ${tableKey}: ${sourcePath}`);
  }
  if (value.columns !== undefined && !isRecord(value.columns)) {
    throw new Error(`Table docs metadata columns must be an object for ${tableKey}: ${sourcePath}`);
  }
  for (const [columnName, columnMetadata] of Object.entries(value.columns ?? {})) {
    assertColumnMetadata(tableKey, columnName, columnMetadata, sourcePath);
  }
}

function assertColumnMetadata(
  tableKey: string,
  columnName: string,
  value: unknown,
  sourcePath: string
): asserts value is TableDocsColumnMetadata {
  if (!isRecord(value)) {
    throw new Error(`Table docs metadata column entry must be an object for ${tableKey}.${columnName}: ${sourcePath}`);
  }
}

function formatSample(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
