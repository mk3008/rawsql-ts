import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveSchemaSettings } from '../config';
import { snapshotTableDocs } from '../parser/snapshotTableDocs';
import { loadRawTableDocsMetadata } from '../tableDocsMetadata';
import type { CheckDocsOptions, DdlInput, SqlSource, TableDocModel, TableDocsMetadata } from '../types';
import { dedupeDdlInputsByInstanceAndPath } from '../utils/ddlInputDedupe';
import { collectSqlFiles, expandGlobPatterns } from '../utils/fs';
import { filterPgDump } from '../utils/pgDumpFilter';

export interface CheckIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface CheckDocsResult {
  errors: CheckIssue[];
  warnings: CheckIssue[];
}

interface RelationshipMetadata {
  schemaVersion: 1;
  relationships: RelationshipEntry[];
}

interface RelationshipEntry {
  path: string;
  kind: string;
  reason?: string;
  concepts?: RelationshipTarget[];
  processes?: RelationshipTarget[];
}

interface RelationshipTarget {
  path: string;
  reason?: string;
}

interface OrderMetadata {
  schemaVersion: 1;
  order: string[];
}

interface ConceptRelationshipMetadata {
  schemaVersion: 1;
  concepts?: ConceptEntry[];
  relationships?: ConceptRelationEntry[];
  views?: ConceptViewEntry[];
}

interface ConceptEntry {
  id: string;
  path?: string | null;
  status?: string;
}

interface ConceptRelationEntry {
  from: string;
  to: string;
}

interface ConceptViewEntry {
  id: string;
  concepts?: string[];
}

/**
 * Checks DDL review metadata for structural drift.
 *
 * The command intentionally verifies references and object existence only.
 * Concept/process meaning stays with human and AI review.
 */
export function runCheckDocs(options: CheckDocsOptions): CheckDocsResult {
  const result = checkDocs(options);
  printCheckResult(result);
  if (result.errors.length > 0) {
    throw new Error(`DDL docs metadata check failed: ${result.errors.length} error(s), ${result.warnings.length} warning(s).`);
  }
  return result;
}

export function checkDocs(options: CheckDocsOptions): CheckDocsResult {
  const issues: CheckIssue[] = [];
  const sources = collectCheckSqlSources(options, issues);
  const schemaSettings = resolveSchemaSettings(options.configPath, options.defaultSchema, options.searchPath);
  const snapshot = sources.length > 0
    ? snapshotTableDocs(sources, schemaSettings, { columnOrder: 'definition' })
    : { tables: [], warnings: [] };

  for (const warning of snapshot.warnings) {
    issues.push({
      severity: 'warning',
      code: 'DDL_PARSE_WARNING',
      message: `${warning.source.filePath}: ${warning.message}`,
    });
  }

  const tableIndex = buildTableIndex(snapshot.tables);
  const conceptIds = options.conceptRelationshipPath ? readConceptIds(options.conceptRelationshipPath, issues) : new Set<string>();
  const processIds = options.relationshipPath ? readProcessIds(options.relationshipPath, issues) : new Set<string>();

  if (options.tableDocsPath) {
    checkTableDocsMetadata(options.tableDocsPath, tableIndex, { conceptIds, processIds }, issues);
  }
  if (options.orderPath) {
    checkOrderMetadata(options.orderPath, sources, issues);
  }
  if (options.relationshipPath) {
    checkRelationshipMetadata(options.relationshipPath, sources, issues);
  }
  if (options.conceptRelationshipPath) {
    checkConceptRelationshipMetadata(options.conceptRelationshipPath, issues);
  }

  return {
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
  };
}

function collectCheckSqlSources(options: CheckDocsOptions, issues: CheckIssue[]): SqlSource[] {
  const normalizedDirectories = dedupeDdlInputsByInstanceAndPath(options.ddlDirectories);
  const normalizedFiles = dedupeDdlInputsByInstanceAndPath(options.ddlFiles);
  const normalizedGlobs = dedupeDdlInputsByInstanceAndPath(options.ddlGlobs);
  const mergedFiles: DdlInput[] = [...normalizedFiles];
  for (const globInput of normalizedGlobs) {
    for (const p of expandGlobPatterns([globInput.path])) {
      mergedFiles.push({ path: p, instance: globInput.instance ?? '' });
    }
  }
  const uniqueFiles = dedupeDdlInputsByInstanceAndPath(mergedFiles);
  try {
    const rawSources = collectSqlFiles(normalizedDirectories, uniqueFiles, options.extensions);
    return options.filterPgDump
      ? rawSources.map((source) => ({ ...source, sql: filterPgDump(source.sql) }))
      : rawSources;
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'DDL_INPUT_ERROR',
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function checkTableDocsMetadata(
  metadataPath: string,
  tableIndex: Map<string, TableDocModel>,
  registry: { conceptIds: Set<string>; processIds: Set<string> },
  issues: CheckIssue[]
): void {
  let metadata: TableDocsMetadata;
  try {
    metadata = loadRawTableDocsMetadata(metadataPath);
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'TABLE_DOCS_SCHEMA_ERROR',
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const documentedTables = new Set<string>();
  for (const [tableKey, tableMetadata] of Object.entries(metadata.tables ?? {})) {
    const table = resolveTableKey(tableIndex, tableKey);
    if (!table) {
      issues.push({
        severity: 'error',
        code: 'TABLE_DOCS_UNKNOWN_TABLE',
        message: `table-docs.json references unknown table: ${tableKey}`,
      });
      continue;
    }
    documentedTables.add(`${table.schema}.${table.table}`);

    const columnNames = new Set(table.columns.map((column) => column.name));
    checkDesignIntentRefs(`table-docs.json table ${tableKey}`, tableMetadata, registry, issues);
    for (const columnName of Object.keys(tableMetadata.columns ?? {})) {
      if (!columnNames.has(columnName)) {
        issues.push({
          severity: 'error',
          code: 'TABLE_DOCS_UNKNOWN_COLUMN',
          message: `table-docs.json references unknown column: ${tableKey}.${columnName}`,
        });
      }
      checkDesignIntentRefs(`table-docs.json column ${tableKey}.${columnName}`, tableMetadata.columns?.[columnName], registry, issues);
    }

    const constraintNames = new Set(table.constraints.map((constraint) => constraint.name));
    for (const constraintName of Object.keys(tableMetadata.constraints ?? {})) {
      if (!constraintNames.has(constraintName)) {
        issues.push({
          severity: 'error',
          code: 'TABLE_DOCS_UNKNOWN_CONSTRAINT',
          message: `table-docs.json references unknown index/constraint: ${tableKey}.${constraintName}`,
        });
      }
      checkDesignIntentRefs(
        `table-docs.json index/constraint ${tableKey}.${constraintName}`,
        tableMetadata.constraints?.[constraintName],
        registry,
        issues
      );
    }
  }

  const uniqueTables = Array.from(new Map(
    Array.from(tableIndex.values()).map((table) => [`${table.schema}.${table.table}`, table])
  ).values());
  for (const table of uniqueTables) {
    const tableKey = `${table.schema}.${table.table}`;
    const tableMetadata = metadata.tables?.[tableKey] ?? metadata.tables?.[table.table];
    if (!documentedTables.has(tableKey)) {
      issues.push({
        severity: 'warning',
        code: 'TABLE_DOCS_MISSING_TABLE',
        message: `DDL table has no table-docs metadata: ${tableKey}`,
      });
    }

    for (const column of table.columns) {
      const columnMetadata = tableMetadata?.columns?.[column.name];
      const typeName = column.typeName.toLowerCase();
      if ((typeName.includes('json') || column.name.endsWith('_json')) && columnMetadata?.sample === undefined) {
        issues.push({
          severity: 'warning',
          code: 'TABLE_DOCS_JSON_COLUMN_WITHOUT_SAMPLE',
          message: `JSON column has no sample in table-docs metadata: ${tableKey}.${column.name}`,
        });
      }
      if (column.name.endsWith('_hash') && (columnMetadata?.designNotes?.length ?? 0) === 0) {
        issues.push({
          severity: 'warning',
          code: 'TABLE_DOCS_HASH_COLUMN_WITHOUT_REVIEW_NOTES',
          message: `Hash column has no review notes in table-docs metadata: ${tableKey}.${column.name}`,
        });
      }
    }

    for (const constraint of table.constraints) {
      const constraintMetadata = tableMetadata?.constraints?.[constraint.name];
      if (isImportantConstraintForReview(constraint) && (constraintMetadata?.designNotes?.length ?? 0) === 0) {
        issues.push({
          severity: 'warning',
          code: 'TABLE_DOCS_IMPORTANT_CONSTRAINT_WITHOUT_REVIEW_NOTES',
          message: `Important index/constraint has no review notes in table-docs metadata: ${tableKey}.${constraint.name}`,
        });
      }
    }
  }
}

function checkDesignIntentRefs(
  scope: string,
  value: unknown,
  registry: { conceptIds: Set<string>; processIds: Set<string> },
  issues: CheckIssue[]
): void {
  if (!isRecord(value)) {
    return;
  }
  const conceptRefs = value.conceptRefs;
  if (Array.isArray(conceptRefs)) {
    for (const ref of conceptRefs) {
      if (typeof ref === 'string' && registry.conceptIds.size > 0 && !registry.conceptIds.has(ref)) {
        issues.push({
          severity: 'error',
          code: 'TABLE_DOCS_UNKNOWN_CONCEPT_REF',
          message: `${scope} references unknown conceptRef: ${ref}`,
        });
      }
    }
  }
  const processRefs = value.processRefs;
  if (Array.isArray(processRefs)) {
    for (const ref of processRefs) {
      if (typeof ref === 'string' && registry.processIds.size > 0 && !registry.processIds.has(ref)) {
        issues.push({
          severity: 'error',
          code: 'TABLE_DOCS_UNKNOWN_PROCESS_REF',
          message: `${scope} references unknown processRef: ${ref}`,
        });
      }
    }
  }
}

function checkOrderMetadata(orderPath: string, sources: SqlSource[], issues: CheckIssue[]): void {
  const resolvedPath = path.resolve(process.cwd(), orderPath);
  const value = readJsonFile(resolvedPath, 'order.json', issues);
  if (!value) {
    return;
  }
  if (!isOrderMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'ORDER_SCHEMA_ERROR',
      message: `order.json must be an object with schemaVersion: 1 and string[] order: ${resolvedPath}`,
    });
    return;
  }

  const baseDir = path.dirname(resolvedPath);
  const seen = new Set<string>();
  for (const entry of value.order) {
    const normalized = normalizeRelativePath(entry);
    if (seen.has(normalized)) {
      issues.push({
        severity: 'error',
        code: 'ORDER_DUPLICATE_ENTRY',
        message: `order.json contains duplicate DDL entry: ${entry}`,
      });
    }
    seen.add(normalized);
    const resolvedEntry = path.resolve(baseDir, entry);
    if (!existsSync(resolvedEntry)) {
      issues.push({
        severity: 'error',
        code: 'ORDER_MISSING_DDL_FILE',
        message: `order.json references missing DDL file: ${entry}`,
      });
    }
  }

  const sourceEntries = new Set(
    sources.map((source) => normalizeRelativePath(path.relative(baseDir, path.resolve(process.cwd(), source.path))))
  );
  for (const sourceEntry of sourceEntries) {
    if (!seen.has(sourceEntry)) {
      issues.push({
        severity: 'error',
        code: 'ORDER_UNTRACKED_DDL_FILE',
        message: `DDL file is not registered in order.json: ${sourceEntry}`,
      });
    }
  }
}

function checkRelationshipMetadata(relationshipPath: string, sources: SqlSource[], issues: CheckIssue[]): void {
  const resolvedPath = path.resolve(process.cwd(), relationshipPath);
  const value = readJsonFile(resolvedPath, 'relationship.json', issues);
  if (!value) {
    return;
  }
  if (!isRelationshipMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'RELATIONSHIP_SCHEMA_ERROR',
      message: `relationship.json must be an object with schemaVersion: 1 and relationships[]: ${resolvedPath}`,
    });
    return;
  }

  const baseDir = path.dirname(resolvedPath);
  const ddlPaths = new Set(
    sources.map((source) => normalizeRelativePath(path.relative(baseDir, path.resolve(process.cwd(), source.path))))
  );
  const relationshipDdlPaths = new Set<string>();

  for (const entry of value.relationships) {
    const entryPath = normalizeRelativePath(entry.path);
    const resolvedEntryPath = path.resolve(baseDir, entry.path);
    if (!existsSync(resolvedEntryPath)) {
      issues.push({
        severity: 'error',
        code: 'RELATIONSHIP_MISSING_PATH',
        message: `relationship.json references missing path: ${entry.path}`,
      });
    }
    if (entry.path.endsWith('.sql')) {
      relationshipDdlPaths.add(entryPath);
    }
    if (entry.reason !== undefined && entry.reason.trim() === '') {
      issues.push({
        severity: 'warning',
        code: 'RELATIONSHIP_EMPTY_REASON',
        message: `relationship.json reason is empty for: ${entry.path}`,
      });
    }
    for (const target of entry.concepts ?? []) {
      checkRelationshipTarget(baseDir, 'concept', entry.path, target, issues);
    }
    for (const target of entry.processes ?? []) {
      checkRelationshipTarget(baseDir, 'process', entry.path, target, issues);
    }
  }

  for (const ddlPath of ddlPaths) {
    if (!relationshipDdlPaths.has(ddlPath)) {
      issues.push({
        severity: 'warning',
        code: 'RELATIONSHIP_UNTRACKED_DDL_FILE',
        message: `DDL file is not registered in relationship.json: ${ddlPath}`,
      });
    }
  }
}

function checkRelationshipTarget(
  baseDir: string,
  targetKind: 'concept' | 'process',
  entryPath: string,
  target: RelationshipTarget,
  issues: CheckIssue[]
): void {
  if (!existsSync(path.resolve(baseDir, target.path))) {
    issues.push({
      severity: 'error',
      code: 'RELATIONSHIP_MISSING_TARGET',
      message: `relationship.json ${targetKind} target is missing for ${entryPath}: ${target.path}`,
    });
  }
  if (target.reason !== undefined && target.reason.trim() === '') {
    issues.push({
      severity: 'warning',
      code: 'RELATIONSHIP_EMPTY_TARGET_REASON',
      message: `relationship.json ${targetKind} reason is empty for ${entryPath}: ${target.path}`,
    });
  }
}

function checkConceptRelationshipMetadata(conceptRelationshipPath: string, issues: CheckIssue[]): void {
  const resolvedPath = path.resolve(process.cwd(), conceptRelationshipPath);
  const value = readJsonFile(resolvedPath, 'concept-relationship.json', issues);
  if (!value) {
    return;
  }
  if (!isConceptRelationshipMetadata(value)) {
    issues.push({
      severity: 'error',
      code: 'CONCEPT_RELATIONSHIP_SCHEMA_ERROR',
      message: `concept-relationship.json must be an object with schemaVersion: 1: ${resolvedPath}`,
    });
    return;
  }

  const baseDir = path.dirname(resolvedPath);
  const conceptIds = new Set<string>();
  for (const concept of value.concepts ?? []) {
    if (conceptIds.has(concept.id)) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_DUPLICATE_ID',
        message: `concept-relationship.json contains duplicate concept id: ${concept.id}`,
      });
    }
    conceptIds.add(concept.id);
    if (concept.path !== undefined && concept.path !== null && !existsSync(path.resolve(baseDir, concept.path))) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_MISSING_SPEC_PATH',
        message: `concept-relationship.json references missing concept path for ${concept.id}: ${concept.path}`,
      });
    }
  }

  for (const relationship of value.relationships ?? []) {
    if (!conceptIds.has(relationship.from)) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_RELATIONSHIP_UNKNOWN_FROM',
        message: `concept relationship uses unknown from id: ${relationship.from}`,
      });
    }
    if (!conceptIds.has(relationship.to)) {
      issues.push({
        severity: 'error',
        code: 'CONCEPT_RELATIONSHIP_UNKNOWN_TO',
        message: `concept relationship uses unknown to id: ${relationship.to}`,
      });
    }
  }

  for (const view of value.views ?? []) {
    for (const conceptId of view.concepts ?? []) {
      if (!conceptIds.has(conceptId)) {
        issues.push({
          severity: 'error',
          code: 'CONCEPT_VIEW_UNKNOWN_CONCEPT',
          message: `concept view ${view.id} references unknown concept id: ${conceptId}`,
        });
      }
    }
  }
}

function readConceptIds(conceptRelationshipPath: string, issues: CheckIssue[]): Set<string> {
  const resolvedPath = path.resolve(process.cwd(), conceptRelationshipPath);
  const value = readJsonFile(resolvedPath, 'concept-relationship.json', issues);
  if (!isConceptRelationshipMetadata(value)) {
    return new Set();
  }
  return new Set((value.concepts ?? []).filter(isConceptEntry).map((entry) => entry.id));
}

function readProcessIds(relationshipPath: string, issues: CheckIssue[]): Set<string> {
  const resolvedPath = path.resolve(process.cwd(), relationshipPath);
  const value = readJsonFile(resolvedPath, 'relationship.json', issues);
  if (!isRelationshipMetadata(value)) {
    return new Set();
  }
  const ids = new Set<string>();
  for (const entry of value.relationships) {
    for (const process of entry.processes ?? []) {
      ids.add(path.basename(process.path, path.extname(process.path)));
    }
  }
  return ids;
}

function buildTableIndex(tables: TableDocModel[]): Map<string, TableDocModel> {
  const result = new Map<string, TableDocModel>();
  const tableNameCounts = new Map<string, number>();
  for (const table of tables) {
    result.set(`${table.schema}.${table.table}`, table);
    tableNameCounts.set(table.table, (tableNameCounts.get(table.table) ?? 0) + 1);
  }
  for (const table of tables) {
    if (tableNameCounts.get(table.table) === 1) {
      result.set(table.table, table);
    }
  }
  return result;
}

function resolveTableKey(tableIndex: Map<string, TableDocModel>, tableKey: string): TableDocModel | undefined {
  return tableIndex.get(tableKey);
}

function isImportantConstraintForReview(constraint: { kind: string; name: string; expression: string }): boolean {
  if (!constraint.name) {
    return false;
  }
  if (constraint.kind === 'UK') {
    return true;
  }
  if (constraint.kind === 'INDEX' && /_hash\b/.test(constraint.expression)) {
    return true;
  }
  if (constraint.kind === 'CHECK' && /(status|route|operation|model)/.test(constraint.name)) {
    return true;
  }
  if (constraint.kind === 'FK' && constraint.expression.includes(',')) {
    return true;
  }
  return false;
}

function readJsonFile(filePath: string, label: string, issues: CheckIssue[]): unknown | undefined {
  if (!existsSync(filePath)) {
    issues.push({
      severity: 'error',
      code: 'JSON_FILE_NOT_FOUND',
      message: `${label} file does not exist: ${filePath}`,
    });
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    issues.push({
      severity: 'error',
      code: 'JSON_PARSE_ERROR',
      message: `Failed to parse ${label}: ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    });
    return undefined;
  }
}

function isRelationshipMetadata(value: unknown): value is RelationshipMetadata {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.relationships)) {
    return false;
  }
  return value.relationships.every((entry) => {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.kind !== 'string') {
      return false;
    }
    if (entry.reason !== undefined && typeof entry.reason !== 'string') {
      return false;
    }
    return isTargetArray(entry.concepts) && isTargetArray(entry.processes);
  });
}

function isTargetArray(value: unknown): value is RelationshipTarget[] | undefined {
  if (value === undefined) {
    return true;
  }
  return Array.isArray(value) && value.every((entry) =>
    isRecord(entry)
      && typeof entry.path === 'string'
      && (entry.reason === undefined || typeof entry.reason === 'string')
  );
}

function isOrderMetadata(value: unknown): value is OrderMetadata {
  return isRecord(value)
    && value.schemaVersion === 1
    && Array.isArray(value.order)
    && value.order.every((entry) => typeof entry === 'string');
}

function isConceptRelationshipMetadata(value: unknown): value is ConceptRelationshipMetadata {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }
  if (value.concepts !== undefined && !Array.isArray(value.concepts)) {
    return false;
  }
  if (value.relationships !== undefined && !Array.isArray(value.relationships)) {
    return false;
  }
  if (value.views !== undefined && !Array.isArray(value.views)) {
    return false;
  }
  return true;
}

function isConceptEntry(value: unknown): value is ConceptEntry {
  return isRecord(value) && typeof value.id === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function printCheckResult(result: CheckDocsResult): void {
  console.log(`DDL docs metadata check: ${result.errors.length} error(s), ${result.warnings.length} warning(s).`);
  for (const issue of [...result.errors, ...result.warnings]) {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}`);
  }
}
