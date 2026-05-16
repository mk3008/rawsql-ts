import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  TableDocsColumnMetadata,
  TableDocsConstraintMetadata,
  TableDocsMetadata,
  TableDocsSchemaMetadata,
  TableDocsTableMetadata,
} from './types';

export interface ResolvedTableDocsMetadata {
  getSchemaSummary(schema: string): string;
  getColumnSample(schema: string, table: string, column: string): string;
  getTableDesignNotes(schema: string, table: string): string[];
  getColumnDesignNotes(schema: string, table: string, column: string): string[];
  getConstraintDesignNotes(schema: string, table: string, constraint: string): string[];
  getTableDesignIntent(schema: string, table: string): string[];
  getColumnDesignIntent(schema: string, table: string, column: string): string[];
  getConstraintDesignIntent(schema: string, table: string, constraint: string): string[];
}

const EMPTY_TABLE_DOCS_METADATA: ResolvedTableDocsMetadata = {
  getSchemaSummary: () => '',
  getColumnSample: () => '',
  getTableDesignNotes: () => [],
  getColumnDesignNotes: () => [],
  getConstraintDesignNotes: () => [],
  getTableDesignIntent: () => [],
  getColumnDesignIntent: () => [],
  getConstraintDesignIntent: () => [],
};

export function loadTableDocsMetadata(metadataPath: string | undefined): ResolvedTableDocsMetadata {
  if (!metadataPath) {
    return EMPTY_TABLE_DOCS_METADATA;
  }

  const resolvedPath = path.resolve(process.cwd(), metadataPath);
  const raw = loadRawTableDocsMetadata(resolvedPath);

  return {
    getSchemaSummary: (schema) => raw.schemas?.[schema]?.summary?.trim() ?? '',
    getColumnSample: (schema, table, column) => {
      const tableMetadata = raw.tables?.[`${schema}.${table}`] ?? raw.tables?.[table];
      const columnMetadata = tableMetadata?.columns?.[column];
      return formatSample(columnMetadata?.sample);
    },
    getTableDesignNotes: (schema, table) => {
      const tableMetadata = raw.tables?.[`${schema}.${table}`] ?? raw.tables?.[table];
      return tableMetadata?.designNotes ?? [];
    },
    getColumnDesignNotes: (schema, table, column) => {
      const tableMetadata = raw.tables?.[`${schema}.${table}`] ?? raw.tables?.[table];
      const columnMetadata = tableMetadata?.columns?.[column];
      return columnMetadata?.designNotes ?? [];
    },
    getConstraintDesignNotes: (schema, table, constraint) => {
      const tableMetadata = raw.tables?.[`${schema}.${table}`] ?? raw.tables?.[table];
      const constraintMetadata = tableMetadata?.constraints?.[constraint];
      return constraintMetadata?.designNotes ?? [];
    },
    getTableDesignIntent: (schema, table) => {
      const tableMetadata = raw.tables?.[`${schema}.${table}`] ?? raw.tables?.[table];
      return formatDesignIntent(tableMetadata);
    },
    getColumnDesignIntent: (schema, table, column) => {
      const tableMetadata = raw.tables?.[`${schema}.${table}`] ?? raw.tables?.[table];
      return formatDesignIntent(tableMetadata?.columns?.[column]);
    },
    getConstraintDesignIntent: (schema, table, constraint) => {
      const tableMetadata = raw.tables?.[`${schema}.${table}`] ?? raw.tables?.[table];
      return formatDesignIntent(tableMetadata?.constraints?.[constraint]);
    },
  };
}

export function loadRawTableDocsMetadata(metadataPath: string): TableDocsMetadata {
  const resolvedPath = path.resolve(process.cwd(), metadataPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Table docs metadata file does not exist: ${resolvedPath}`);
  }

  const raw = parseTableDocsMetadataFile(resolvedPath);
  assertTableDocsMetadata(raw, resolvedPath);
  return raw;
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
  if (value.metadataLanguagePolicy !== undefined && typeof value.metadataLanguagePolicy !== 'string') {
    throw new Error(`Table docs metadata metadataLanguagePolicy must be a string: ${sourcePath}`);
  }
  if (value.schemas !== undefined && !isRecord(value.schemas)) {
    throw new Error(`Table docs metadata schemas must be an object: ${sourcePath}`);
  }
  if (value.tables !== undefined && !isRecord(value.tables)) {
    throw new Error(`Table docs metadata tables must be an object: ${sourcePath}`);
  }
  for (const [schemaName, schemaMetadata] of Object.entries(value.schemas ?? {})) {
    assertSchemaMetadata(schemaName, schemaMetadata, sourcePath);
  }
  for (const [tableKey, tableMetadata] of Object.entries(value.tables ?? {})) {
    assertTableMetadata(tableKey, tableMetadata, sourcePath);
  }
}

function assertSchemaMetadata(schemaName: string, value: unknown, sourcePath: string): asserts value is TableDocsSchemaMetadata {
  if (!isRecord(value)) {
    throw new Error(`Table docs metadata schema entry must be an object for ${schemaName}: ${sourcePath}`);
  }
  if (value.summary !== undefined && typeof value.summary !== 'string') {
    throw new Error(`Table docs metadata schema summary must be a string for ${schemaName}: ${sourcePath}`);
  }
  if (value.language !== undefined && typeof value.language !== 'string') {
    throw new Error(`Table docs metadata schema language must be a string for ${schemaName}: ${sourcePath}`);
  }
}

function assertTableMetadata(tableKey: string, value: unknown, sourcePath: string): asserts value is TableDocsTableMetadata {
  if (!isRecord(value)) {
    throw new Error(`Table docs metadata entry must be an object for ${tableKey}: ${sourcePath}`);
  }
  if (value.columns !== undefined && !isRecord(value.columns)) {
    throw new Error(`Table docs metadata columns must be an object for ${tableKey}: ${sourcePath}`);
  }
  if (value.constraints !== undefined && !isRecord(value.constraints)) {
    throw new Error(`Table docs metadata constraints must be an object for ${tableKey}: ${sourcePath}`);
  }
  if (value.designNotes !== undefined && !isStringArray(value.designNotes)) {
    throw new Error(`Table docs metadata designNotes must be a string array for ${tableKey}: ${sourcePath}`);
  }
  assertDesignIntentMetadata(tableKey, value, sourcePath);
  for (const [columnName, columnMetadata] of Object.entries(value.columns ?? {})) {
    assertColumnMetadata(tableKey, columnName, columnMetadata, sourcePath);
  }
  for (const [constraintName, constraintMetadata] of Object.entries(value.constraints ?? {})) {
    assertConstraintMetadata(tableKey, constraintName, constraintMetadata, sourcePath);
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
  if (value.designNotes !== undefined && !isStringArray(value.designNotes)) {
    throw new Error(`Table docs metadata column designNotes must be a string array for ${tableKey}.${columnName}: ${sourcePath}`);
  }
  assertDesignIntentMetadata(`${tableKey}.${columnName}`, value, sourcePath);
}

function assertConstraintMetadata(
  tableKey: string,
  constraintName: string,
  value: unknown,
  sourcePath: string
): asserts value is TableDocsConstraintMetadata {
  if (!isRecord(value)) {
    throw new Error(`Table docs metadata constraint entry must be an object for ${tableKey}.${constraintName}: ${sourcePath}`);
  }
  if (value.designNotes !== undefined && !isStringArray(value.designNotes)) {
    throw new Error(
      `Table docs metadata constraint designNotes must be a string array for ${tableKey}.${constraintName}: ${sourcePath}`
    );
  }
  assertDesignIntentMetadata(`${tableKey}.${constraintName}`, value, sourcePath);
}

function assertDesignIntentMetadata(scope: string, value: Record<string, unknown>, sourcePath: string): void {
  for (const key of ['decision', 'reviewRisk']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      throw new Error(`Table docs metadata ${key} must be a string for ${scope}: ${sourcePath}`);
    }
  }
  for (const key of ['conceptRefs', 'processRefs', 'ddlRefs', 'tradeoff', 'alternativesRejected']) {
    if (value[key] !== undefined && !isStringArray(value[key])) {
      throw new Error(`Table docs metadata ${key} must be a string array for ${scope}: ${sourcePath}`);
    }
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

function formatDesignIntent(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }
  const lines: string[] = [];
  if (typeof value.decision === 'string' && value.decision.trim()) {
    lines.push(`decision: ${value.decision.trim()}`);
  }
  if (typeof value.reviewRisk === 'string' && value.reviewRisk.trim()) {
    lines.push(`reviewRisk: ${value.reviewRisk.trim()}`);
  }
  for (const key of ['conceptRefs', 'processRefs', 'ddlRefs', 'tradeoff', 'alternativesRejected']) {
    const entries = value[key];
    if (isStringArray(entries) && entries.length > 0) {
      lines.push(`${key}: ${entries.join(', ')}`);
    }
  }
  return lines;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
