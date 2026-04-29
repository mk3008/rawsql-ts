import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { SqlParser } from 'rawsql-ts';
import { ensureDirectory } from '../utils/fs';
import type { RfbaBoundaryKind, RfbaInspectionReport } from './rfba';

export type RfbaReviewDataFormat = 'json';
export type GitChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
export type RfbaChangedFileKind =
  | 'ddl'
  | 'feature-boundary'
  | 'query-boundary'
  | 'query-sql'
  | 'query-case'
  | 'generated-evidence'
  | 'query-verification'
  | 'feature-verification'
  | 'adapter'
  | 'library'
  | 'test-support'
  | 'tool-managed'
  | 'unknown';
export type RfbaReviewWeight = 'high' | 'medium' | 'low';

export interface GitNameStatusEntry {
  status: GitChangeStatus;
  path: string;
  oldPath?: string;
  score?: number;
}

export interface RfbaChangedFile {
  path: string;
  oldPath?: string;
  status: GitChangeStatus;
  kind: RfbaChangedFileKind;
  boundary: string | null;
  parentFeatureBoundary: string | null;
  reviewWeight: RfbaReviewWeight;
  rawDiff?: string;
}

export interface RfbaReviewHint {
  target: string;
  priority: RfbaReviewWeight;
  hint: string;
}

export interface RfbaReviewWarning {
  code: string;
  message: string;
  path?: string;
  paths?: string[];
  boundary?: string;
}

export interface RfbaChangedBoundary {
  boundary: string;
  kind: RfbaBoundaryKind | 'unknown';
  parentBoundary: string | null;
  changedFiles: string[];
  reviewWeight: RfbaReviewWeight;
}

export interface DdlColumnView {
  name: string;
  type: string | null;
  notNull: boolean;
  default: string | null;
  primaryKey: boolean;
  unique: boolean;
}

export interface DdlTableView {
  table: string;
  columnsAfter: DdlColumnView[];
}

export interface DdlChangeDetail {
  kind:
    | 'add-table'
    | 'drop-table'
    | 'add-column'
    | 'drop-column'
    | 'modify-column-type'
    | 'modify-column-nullability'
    | 'modify-column-default'
    | 'add-primary-key'
    | 'drop-primary-key'
    | 'add-unique'
    | 'drop-unique'
    | 'add-index'
    | 'drop-index';
  column?: string;
  index?: string;
  before: unknown;
  after: unknown;
  explanationSql: string;
  reviewHints: string[];
}

export interface DdlChangeItem {
  path: string;
  objectKind: 'table' | 'index';
  object: string;
  explanationSqlPurpose: 'human-readable explanation only; not an auto-apply migration';
  changes: DdlChangeDetail[];
  tableViewAfter?: DdlTableView;
}

export interface SqlChangeItem {
  path: string;
  boundary: string | null;
  statementKindBefore: string | null;
  statementKindAfter: string | null;
  readTablesBefore: string[];
  readTablesAfter: string[];
  writeTablesBefore: string[];
  writeTablesAfter: string[];
  returningColumnsBefore: string[];
  returningColumnsAfter: string[];
  selectedColumnsBefore: string[];
  selectedColumnsAfter: string[];
  whereColumnsBefore: string[];
  whereColumnsAfter: string[];
  joinTablesBefore: string[];
  joinTablesAfter: string[];
  reviewHints: string[];
}

export interface BoundaryChangeItem {
  path: string;
  boundary: string | null;
  kind: RfbaChangedFileKind;
  exportedNamesBefore: string[];
  exportedNamesAfter: string[];
  zodSchemaNamesBefore: string[];
  zodSchemaNamesAfter: string[];
  addedExports: string[];
  removedExports: string[];
  reviewWeight: RfbaReviewWeight;
  reviewHints: string[];
}

export interface VerificationSummaryItem {
  boundary: string;
  changedCases: string[];
  changedGeneratedEvidence: string[];
  changedEntrypoints: string[];
  changedFeatureTests: string[];
  changedTestSupport: string[];
  missingLikelyEvidence: string[];
}

export interface RfbaReviewDataReport {
  schemaVersion: 1;
  command: 'rfba review-data';
  base: string;
  head: string;
  summary: {
    changedFiles: number;
    changedBoundaries: number;
    ddlChanges: number;
    sqlChanges: number;
    boundaryChanges: number;
    adapterChanges: number;
    verificationChanges: number;
    generatedChanges: number;
    warnings: number;
  };
  changedFiles: RfbaChangedFile[];
  changedBoundaries: RfbaChangedBoundary[];
  ddlChanges: DdlChangeItem[];
  sqlChanges: SqlChangeItem[];
  boundaryChanges: BoundaryChangeItem[];
  adapterChanges: RfbaChangedFile[];
  verificationChanges: VerificationSummaryItem[];
  generatedChanges: RfbaChangedFile[];
  reviewHints: RfbaReviewHint[];
  warnings: RfbaReviewWarning[];
}

export interface RfbaReviewDataOptions {
  base?: string;
  head?: string;
  out?: string;
  format?: string;
  scope?: string;
  includeRawDiff?: boolean;
  projectRoot?: string;
  inspectReport: RfbaInspectionReport;
}

interface GitClient {
  nameStatus(base: string, head: string): string;
  show(ref: string, filePath: string): string | null;
  diff(base: string, head: string, filePath: string): string | null;
}

interface DdlTableModel {
  name: string;
  columns: Map<string, DdlColumnView>;
  primaryKeyColumns: string[];
  uniqueColumns: string[][];
}

interface DdlIndexModel {
  name: string;
  table: string;
  unique: boolean;
  columns: string[];
}

interface SqlSummary {
  statementKind: string | null;
  readTables: string[];
  writeTables: string[];
  returningColumns: string[];
  selectedColumns: string[];
  whereColumns: string[];
  joinTables: string[];
  parseWarning: boolean;
}

const EXPLANATION_SQL_PURPOSE = 'human-readable explanation only; not an auto-apply migration' as const;

export function runRfbaReviewData(options: RfbaReviewDataOptions): RfbaReviewDataReport {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const base = normalizeOption(options.base) ?? 'origin/main';
  const head = normalizeOption(options.head) ?? 'HEAD';
  const format = resolveRfbaReviewDataFormat(options.format);
  const scope = normalizeScope(options.scope);
  const git = createGitClient(projectRoot);
  const report = buildRfbaReviewData({
    base,
    head,
    scope,
    includeRawDiff: Boolean(options.includeRawDiff),
    inspectReport: options.inspectReport,
    git,
  });

  if (format !== 'json') {
    throw new Error(`Unsupported RFBA review-data format: ${options.format}`);
  }

  if (options.out) {
    const outPath = path.resolve(projectRoot, options.out);
    ensureDirectory(path.dirname(outPath));
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  return report;
}

export function buildRfbaReviewData(params: {
  base: string;
  head: string;
  scope?: string;
  includeRawDiff: boolean;
  inspectReport: RfbaInspectionReport;
  git: GitClient;
}): RfbaReviewDataReport {
  const entries = parseGitNameStatus(params.git.nameStatus(params.base, params.head))
    .filter((entry) => !params.scope || isInScope(entry.path, params.scope) || (entry.oldPath ? isInScope(entry.oldPath, params.scope) : false));
  const warnings: RfbaReviewWarning[] = [];
  const changedFiles = entries.map((entry) => {
    const file = classifyRfbaChangedFile(entry);
    if (params.includeRawDiff) {
      file.rawDiff = params.git.diff(params.base, params.head, file.path) ?? undefined;
    }
    return file;
  });

  const changedBoundaries = buildChangedBoundarySummary(changedFiles, params.inspectReport);
  const ddlChanges = buildDdlChanges(changedFiles, params.base, params.head, params.git, warnings);
  const sqlChanges = buildSqlChanges(changedFiles, params.base, params.head, params.git, warnings);
  const boundaryChanges = buildBoundaryChanges(changedFiles, params.base, params.head, params.git);
  const verificationChanges = buildVerificationSummary(changedFiles);
  const generatedChanges = changedFiles.filter((file) => file.kind === 'generated-evidence');
  const adapterChanges = changedFiles.filter((file) => file.kind === 'adapter');
  const reviewHints = buildReviewHints(changedFiles, ddlChanges, sqlChanges, boundaryChanges);

  addVerificationWarnings(changedFiles, verificationChanges, warnings);
  addGeneratedOnlyWarnings(changedFiles, generatedChanges, warnings);
  warnings.sort(compareWarnings);

  return {
    schemaVersion: 1,
    command: 'rfba review-data',
    base: params.base,
    head: params.head,
    summary: {
      changedFiles: changedFiles.length,
      changedBoundaries: changedBoundaries.length,
      ddlChanges: ddlChanges.reduce((sum, item) => sum + item.changes.length, 0),
      sqlChanges: sqlChanges.length,
      boundaryChanges: boundaryChanges.length,
      adapterChanges: adapterChanges.length,
      verificationChanges: verificationChanges.length,
      generatedChanges: generatedChanges.length,
      warnings: warnings.length,
    },
    changedFiles: changedFiles.sort(compareByPath),
    changedBoundaries,
    ddlChanges,
    sqlChanges,
    boundaryChanges,
    adapterChanges: adapterChanges.sort(compareByPath),
    verificationChanges,
    generatedChanges: generatedChanges.sort(compareByPath),
    reviewHints: reviewHints.sort((left, right) => left.target.localeCompare(right.target) || left.hint.localeCompare(right.hint)),
    warnings,
  };
}

export function parseGitNameStatus(output: string): GitNameStatusEntry[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const rawStatus = parts[0] ?? '';
      const statusCode = rawStatus.charAt(0);
      const score = rawStatus.length > 1 ? Number(rawStatus.slice(1)) : undefined;
      if (statusCode === 'R' || statusCode === 'C') {
        if (parts.length < 3) {
          throw new Error(`Invalid git name-status rename/copy entry: ${line}`);
        }
        return {
          status: statusCode === 'R' ? 'renamed' : 'copied',
          oldPath: normalizePath(parts[1]),
          path: normalizePath(parts[2]),
          score: Number.isFinite(score) ? score : undefined,
        };
      }
      const pathValue = parts[1] ?? parts[0]?.slice(1).trim();
      if (!pathValue) {
        throw new Error(`Invalid git name-status entry: ${line}`);
      }
      switch (statusCode) {
        case 'A':
          return { status: 'added', path: normalizePath(pathValue) };
        case 'M':
          return { status: 'modified', path: normalizePath(pathValue) };
        case 'D':
          return { status: 'deleted', path: normalizePath(pathValue) };
        default:
          return { status: 'modified', path: normalizePath(pathValue) };
      }
    });
}

export function classifyRfbaChangedFile(entry: GitNameStatusEntry): RfbaChangedFile {
  const pathValue = normalizePath(entry.path);
  const kind = classifyKind(pathValue);
  return {
    path: pathValue,
    oldPath: entry.oldPath ? normalizePath(entry.oldPath) : undefined,
    status: entry.status,
    kind,
    boundary: deriveBoundary(pathValue, kind),
    parentFeatureBoundary: deriveParentFeatureBoundary(pathValue),
    reviewWeight: reviewWeightForKind(kind),
  };
}

export function buildChangedBoundarySummary(
  changedFiles: RfbaChangedFile[],
  inspectReport: RfbaInspectionReport
): RfbaChangedBoundary[] {
  const boundaryByPath = new Map(inspectReport.boundaries.map((boundary) => [boundary.path, boundary]));
  const parentByPath = new Map(inspectReport.boundaries.map((boundary) => {
    const parentPath = boundary.parentBoundaryId
      ? inspectReport.boundaries.find((candidate) => candidate.id === boundary.parentBoundaryId)?.path ?? null
      : null;
    return [boundary.path, parentPath] as const;
  }));
  const grouped = new Map<string, RfbaChangedFile[]>();

  for (const file of changedFiles) {
    if (!file.boundary) {
      continue;
    }
    const list = grouped.get(file.boundary) ?? [];
    list.push(file);
    grouped.set(file.boundary, list);
  }

  return Array.from(grouped.entries())
    .map(([boundaryPath, files]): RfbaChangedBoundary => {
      const boundary = boundaryByPath.get(boundaryPath);
      return {
        boundary: boundaryPath,
        kind: boundary?.kind ?? 'unknown',
        parentBoundary: parentByPath.get(boundaryPath) ?? files[0]?.parentFeatureBoundary ?? null,
        changedFiles: sortUnique(files.map((file) => file.path)),
        reviewWeight: maxReviewWeight(files.map((file) => file.reviewWeight)),
      };
    })
    .sort((left, right) => left.boundary.localeCompare(right.boundary));
}

export function diffDdlTables(beforeSql: string | null, afterSql: string | null, filePath = 'db/ddl/schema.sql'): DdlChangeItem[] {
  const before = parseDdlTables(beforeSql ?? '');
  const after = parseDdlTables(afterSql ?? '');
  const beforeIndexes = parseDdlIndexes(beforeSql ?? '');
  const afterIndexes = parseDdlIndexes(afterSql ?? '');
  const items: DdlChangeItem[] = [];
  const tableNames = sortUnique([...before.keys(), ...after.keys()]);

  for (const tableName of tableNames) {
    const beforeTable = before.get(tableName);
    const afterTable = after.get(tableName);
    const changes: DdlChangeDetail[] = [];
    if (!beforeTable && afterTable) {
      changes.push({
        kind: 'add-table',
        before: null,
        after: tableView(afterTable),
        explanationSql: `CREATE TABLE ${tableName} (...);`,
        reviewHints: ['Review the new table ownership, constraints, and migration rollout semantics.'],
      });
    } else if (beforeTable && !afterTable) {
      changes.push({
        kind: 'drop-table',
        before: tableView(beforeTable),
        after: null,
        explanationSql: `DROP TABLE ${tableName};`,
        reviewHints: ['Confirm whether dropping this table is intended and whether data migration is required.'],
      });
    } else if (beforeTable && afterTable) {
      changes.push(...diffColumns(tableName, beforeTable, afterTable));
      changes.push(...diffPrimaryKey(tableName, beforeTable, afterTable));
      changes.push(...diffUnique(tableName, beforeTable, afterTable));
    }

    if (changes.length > 0) {
      items.push({
        path: filePath,
        objectKind: 'table',
        object: tableName,
        explanationSqlPurpose: EXPLANATION_SQL_PURPOSE,
        changes,
        tableViewAfter: afterTable ? tableView(afterTable) : undefined,
      });
    }
  }

  items.push(...diffDdlIndexes(beforeIndexes, afterIndexes, filePath));

  return items.sort((left, right) => left.object.localeCompare(right.object));
}

export function summarizeSqlChange(beforeSql: string | null, afterSql: string | null, filePath = 'query.sql', boundary: string | null = null): SqlChangeItem {
  const before = summarizeSql(beforeSql ?? '');
  const after = summarizeSql(afterSql ?? '');
  const reviewHints: string[] = [];
  if (before.statementKind !== after.statementKind) {
    reviewHints.push('Confirm whether the query boundary contract changed with the SQL statement kind.');
  }
  if (before.returningColumns.join('\0') !== after.returningColumns.join('\0')) {
    reviewHints.push('Confirm whether the returned result shape change is reflected in the query boundary.');
    reviewHints.push('Confirm whether query-local cases assert the returned columns.');
  }
  if (before.writeTables.join('\0') !== after.writeTables.join('\0')) {
    reviewHints.push('Confirm write table changes against DDL ownership and transaction semantics.');
  }

  return {
    path: filePath,
    boundary,
    statementKindBefore: before.statementKind,
    statementKindAfter: after.statementKind,
    readTablesBefore: before.readTables,
    readTablesAfter: after.readTables,
    writeTablesBefore: before.writeTables,
    writeTablesAfter: after.writeTables,
    returningColumnsBefore: before.returningColumns,
    returningColumnsAfter: after.returningColumns,
    selectedColumnsBefore: before.selectedColumns,
    selectedColumnsAfter: after.selectedColumns,
    whereColumnsBefore: before.whereColumns,
    whereColumnsAfter: after.whereColumns,
    joinTablesBefore: before.joinTables,
    joinTablesAfter: after.joinTables,
    reviewHints: sortUnique(reviewHints),
  };
}

export function buildVerificationSummary(changedFiles: RfbaChangedFile[]): VerificationSummaryItem[] {
  const grouped = new Map<string, VerificationSummaryItem>();
  const ensure = (boundary: string) => {
    const existing = grouped.get(boundary);
    if (existing) {
      return existing;
    }
    const created: VerificationSummaryItem = {
      boundary,
      changedCases: [],
      changedGeneratedEvidence: [],
      changedEntrypoints: [],
      changedFeatureTests: [],
      changedTestSupport: [],
      missingLikelyEvidence: [],
    };
    grouped.set(boundary, created);
    return created;
  };

  for (const file of changedFiles) {
    const boundary = file.boundary ?? file.parentFeatureBoundary ?? 'global';
    if (!isVerificationKind(file.kind)) {
      continue;
    }
    const item = ensure(boundary);
    if (file.kind === 'query-case') {
      item.changedCases.push(file.path);
    } else if (file.kind === 'generated-evidence') {
      item.changedGeneratedEvidence.push(file.path);
    } else if (file.kind === 'feature-verification') {
      item.changedFeatureTests.push(file.path);
    } else if (file.kind === 'test-support') {
      item.changedTestSupport.push(file.path);
    } else {
      item.changedEntrypoints.push(file.path);
    }
  }

  const sqlBoundaries = sortUnique(changedFiles.filter((file) => file.kind === 'query-sql' && file.boundary).map((file) => file.boundary as string));
  for (const boundary of sqlBoundaries) {
    const item = ensure(boundary);
    if (item.changedCases.length === 0 && item.changedGeneratedEvidence.length === 0) {
      item.missingLikelyEvidence.push('SQL changed but no query-local cases or generated evidence changed.');
    }
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      changedCases: sortUnique(item.changedCases),
      changedGeneratedEvidence: sortUnique(item.changedGeneratedEvidence),
      changedEntrypoints: sortUnique(item.changedEntrypoints),
      changedFeatureTests: sortUnique(item.changedFeatureTests),
      changedTestSupport: sortUnique(item.changedTestSupport),
      missingLikelyEvidence: sortUnique(item.missingLikelyEvidence),
    }))
    .sort((left, right) => left.boundary.localeCompare(right.boundary));
}

function createGitClient(projectRoot: string): GitClient {
  return {
    nameStatus(base, head) {
      return runGit(projectRoot, ['diff', '--name-status', `${base}...${head}`]);
    },
    show(ref, filePath) {
      const result = runGitMaybe(projectRoot, ['show', `${ref}:${filePath}`]);
      return result.status === 0 ? result.stdout : null;
    },
    diff(base, head, filePath) {
      const result = runGitMaybe(projectRoot, ['diff', `${base}...${head}`, '--', filePath]);
      return result.status === 0 ? result.stdout : null;
    },
  };
}

function runGit(cwd: string, args: string[]): string {
  const result = runGitMaybe(cwd, args);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function runGitMaybe(cwd: string, args: string[]): { status: number | null; stdout: string; stderr: string; error?: Error } {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function buildDdlChanges(
  changedFiles: RfbaChangedFile[],
  base: string,
  head: string,
  git: GitClient,
  warnings: RfbaReviewWarning[]
): DdlChangeItem[] {
  const result: DdlChangeItem[] = [];
  for (const file of changedFiles.filter((candidate) => candidate.kind === 'ddl')) {
    const before = file.status === 'added' ? null : git.show(base, file.oldPath ?? file.path);
    const after = file.status === 'deleted' ? null : git.show(head, file.path);
    const changes = diffDdlTables(before, after, file.path);
    if ((before || after) && changes.length === 0 && containsSupportedDdl(before ?? after ?? '')) {
      warnings.push({
        code: 'ddl-analysis.partial',
        path: file.path,
        message: 'DDL analysis produced no supported structural changes. AI should inspect the DDL file directly.',
      });
    }
    if ((before || after) && !containsSupportedDdl(before ?? '') && !containsSupportedDdl(after ?? '')) {
      warnings.push({
        code: 'ddl-analysis.partial',
        path: file.path,
        message: 'DDL analysis only supports CREATE TABLE and CREATE INDEX statements in the MVP. AI should inspect this DDL file directly.',
      });
    }
    result.push(...changes);
  }
  return result.sort((left, right) => left.path.localeCompare(right.path) || left.object.localeCompare(right.object));
}

function buildSqlChanges(
  changedFiles: RfbaChangedFile[],
  base: string,
  head: string,
  git: GitClient,
  warnings: RfbaReviewWarning[]
): SqlChangeItem[] {
  const result: SqlChangeItem[] = [];
  for (const file of changedFiles.filter((candidate) => candidate.kind === 'query-sql')) {
    const before = file.status === 'added' ? null : git.show(base, file.oldPath ?? file.path);
    const after = file.status === 'deleted' ? null : git.show(head, file.path);
    const beforeSummary = summarizeSql(before ?? '');
    const afterSummary = summarizeSql(after ?? '');
    if ((before && beforeSummary.parseWarning) || (after && afterSummary.parseWarning)) {
      warnings.push({
        code: 'sql-analysis.partial',
        path: file.path,
        message: 'SQL analysis was partial. AI should inspect the SQL file directly.',
      });
    }
    result.push(summarizeSqlChange(before, after, file.path, file.boundary));
  }
  return result.sort((left, right) => left.path.localeCompare(right.path));
}

function buildBoundaryChanges(
  changedFiles: RfbaChangedFile[],
  base: string,
  head: string,
  git: GitClient
): BoundaryChangeItem[] {
  return changedFiles
    .filter((file) => file.kind === 'feature-boundary' || file.kind === 'query-boundary')
    .map((file) => {
      const before = file.status === 'added' ? '' : git.show(base, file.oldPath ?? file.path) ?? '';
      const after = file.status === 'deleted' ? '' : git.show(head, file.path) ?? '';
      const beforeExports = extractExportedNames(before);
      const afterExports = extractExportedNames(after);
      return {
        path: file.path,
        boundary: file.boundary,
        kind: file.kind,
        exportedNamesBefore: beforeExports,
        exportedNamesAfter: afterExports,
        zodSchemaNamesBefore: extractZodSchemaNames(before),
        zodSchemaNamesAfter: extractZodSchemaNames(after),
        addedExports: afterExports.filter((name) => !beforeExports.includes(name)).sort(),
        removedExports: beforeExports.filter((name) => !afterExports.includes(name)).sort(),
        reviewWeight: file.reviewWeight,
        reviewHints: [
          'Inspect public request and response shape changes manually.',
          'Confirm orchestration still calls query boundaries through public surfaces.',
        ],
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function buildReviewHints(
  changedFiles: RfbaChangedFile[],
  ddlChanges: DdlChangeItem[],
  sqlChanges: SqlChangeItem[],
  boundaryChanges: BoundaryChangeItem[]
): RfbaReviewHint[] {
  const hints: RfbaReviewHint[] = [];
  for (const file of changedFiles) {
    if (file.kind === 'ddl') {
      hints.push({
        target: file.path,
        priority: 'high',
        hint: 'DDL changed. Human should review table, column, constraint, and migration risk semantics.',
      });
    } else if (file.kind === 'query-sql') {
      hints.push({
        target: file.path,
        priority: 'high',
        hint: 'SQL changed. Human should review query behavior, table usage, and returned shape.',
      });
    } else if (file.kind === 'generated-evidence') {
      hints.push({
        target: file.path,
        priority: 'low',
        hint: 'Generated evidence changed. Confirm the source SQL, DDL, or cases explain the generated update.',
      });
    }
  }
  for (const item of ddlChanges) {
    for (const change of item.changes) {
      hints.push(...change.reviewHints.map((hint) => ({ target: item.object, priority: 'high' as const, hint })));
    }
  }
  for (const item of sqlChanges) {
    hints.push(...item.reviewHints.map((hint) => ({ target: item.path, priority: 'high' as const, hint })));
  }
  for (const item of boundaryChanges) {
    hints.push(...item.reviewHints.map((hint) => ({ target: item.path, priority: item.reviewWeight, hint })));
  }
  return uniqueHints(hints);
}

function addVerificationWarnings(
  changedFiles: RfbaChangedFile[],
  verificationChanges: VerificationSummaryItem[],
  warnings: RfbaReviewWarning[]
): void {
  const changedDdl = changedFiles.some((file) => file.kind === 'ddl');
  if (changedDdl && !changedFiles.some((file) => file.kind === 'query-case' || file.kind === 'generated-evidence' || file.kind === 'feature-verification' || file.kind === 'query-verification')) {
    warnings.push({
      code: 'verification.possibly-missing',
      message: 'DDL changed but no obvious RFBA verification or generated evidence changed.',
    });
  }
  for (const item of verificationChanges) {
    for (const missing of item.missingLikelyEvidence) {
      warnings.push({
        code: 'verification.possibly-missing',
        boundary: item.boundary,
        message: missing,
      });
    }
  }
}

function addGeneratedOnlyWarnings(
  changedFiles: RfbaChangedFile[],
  generatedChanges: RfbaChangedFile[],
  warnings: RfbaReviewWarning[]
): void {
  if (generatedChanges.length === 0) {
    return;
  }
  const sourceKinds: RfbaChangedFileKind[] = ['ddl', 'query-sql', 'feature-boundary', 'query-boundary', 'query-case'];
  const hasSourceChange = changedFiles.some((file) => sourceKinds.includes(file.kind));
  if (!hasSourceChange) {
    warnings.push({
      code: 'generated-without-source',
      paths: generatedChanges.map((file) => file.path).sort(),
      message: 'Generated evidence changed without an obvious DDL, SQL, boundary, or case change.',
    });
  }
}

function classifyKind(filePath: string): RfbaChangedFileKind {
  if (/^db\/ddl\/.+\.sql$/i.test(filePath)) {
    return 'ddl';
  }
  if (/^src\/features\/[^/]+\/boundary\.ts$/i.test(filePath)) {
    return 'feature-boundary';
  }
  if (/^src\/features\/[^/]+\/queries\/[^/]+\/boundary\.ts$/i.test(filePath)) {
    return 'query-boundary';
  }
  if (/^src\/features\/[^/]+\/queries\/[^/]+\/.+\.sql$/i.test(filePath)) {
    return 'query-sql';
  }
  if (/^src\/features\/[^/]+\/queries\/[^/]+\/tests\/cases\//i.test(filePath)) {
    return 'query-case';
  }
  if (/^src\/features\/[^/]+\/queries\/[^/]+\/tests\/generated\//i.test(filePath)) {
    return 'generated-evidence';
  }
  if (/^src\/features\/[^/]+\/queries\/[^/]+\/tests\//i.test(filePath)) {
    return 'query-verification';
  }
  if (/^src\/features\/[^/]+\/tests\//i.test(filePath)) {
    return 'feature-verification';
  }
  if (/^src\/adapters\//i.test(filePath)) {
    return 'adapter';
  }
  if (/^src\/libraries\//i.test(filePath)) {
    return 'library';
  }
  if (/^tests\/support\//i.test(filePath)) {
    return 'test-support';
  }
  if (/^\.ztd\//i.test(filePath)) {
    return 'tool-managed';
  }
  return 'unknown';
}

function deriveBoundary(filePath: string, kind: RfbaChangedFileKind): string | null {
  const parts = filePath.split('/');
  if (kind === 'feature-boundary' || kind === 'feature-verification') {
    return parts.length >= 3 ? parts.slice(0, 3).join('/') : null;
  }
  if (kind === 'query-boundary' || kind === 'query-sql' || kind === 'query-case' || kind === 'query-verification' || kind === 'generated-evidence') {
    return parts.length >= 5 ? parts.slice(0, 5).join('/') : null;
  }
  if (kind === 'adapter') {
    return parts.length >= 3 ? parts.slice(0, 3).join('/') : 'src/adapters';
  }
  if (kind === 'library') {
    return parts.length >= 3 ? parts.slice(0, 3).join('/') : 'src/libraries';
  }
  return null;
}

function deriveParentFeatureBoundary(filePath: string): string | null {
  const parts = filePath.split('/');
  if (parts[0] === 'src' && parts[1] === 'features' && parts[2] && !parts[2].startsWith('_')) {
    return parts.slice(0, 3).join('/');
  }
  return null;
}

function reviewWeightForKind(kind: RfbaChangedFileKind): RfbaReviewWeight {
  switch (kind) {
    case 'ddl':
    case 'query-sql':
    case 'feature-boundary':
    case 'query-boundary':
    case 'adapter':
      return 'high';
    case 'generated-evidence':
    case 'tool-managed':
      return 'low';
    default:
      return 'medium';
  }
}

function parseDdlTables(sql: string): Map<string, DdlTableModel> {
  const result = new Map<string, DdlTableModel>();
  for (const match of sql.matchAll(/create\s+(?:unlogged\s+|temporary\s+|temp\s+)?table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*\(([\s\S]*?)\)\s*;/gi)) {
    const tableName = normalizeIdentifier(match[1]);
    const body = match[2] ?? '';
    const columns = new Map<string, DdlColumnView>();
    const primaryKeyColumns: string[] = [];
    const uniqueColumns: string[][] = [];
    for (const part of splitTopLevelComma(body)) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      const tablePrimary = trimmed.match(/^(?:constraint\s+\S+\s+)?primary\s+key\s*\(([^)]+)\)/i);
      if (tablePrimary) {
        primaryKeyColumns.push(...splitIdentifierList(tablePrimary[1]));
        continue;
      }
      const tableUnique = trimmed.match(/^(?:constraint\s+\S+\s+)?unique\s*\(([^)]+)\)/i);
      if (tableUnique) {
        uniqueColumns.push(splitIdentifierList(tableUnique[1]));
        continue;
      }
      if (/^(constraint|foreign|check|exclude)\b/i.test(trimmed)) {
        continue;
      }
      const column = parseDdlColumn(trimmed);
      if (column) {
        columns.set(column.name, column);
        if (column.primaryKey) {
          primaryKeyColumns.push(column.name);
        }
        if (column.unique) {
          uniqueColumns.push([column.name]);
        }
      }
    }
    for (const column of columns.values()) {
      column.primaryKey = primaryKeyColumns.includes(column.name);
      column.unique = uniqueColumns.some((group) => group.length === 1 && group[0] === column.name);
      if (column.primaryKey) {
        column.notNull = true;
      }
    }
    result.set(tableName, { name: tableName, columns, primaryKeyColumns: sortUnique(primaryKeyColumns), uniqueColumns });
  }
  return result;
}

function parseDdlIndexes(sql: string): Map<string, DdlIndexModel> {
  const result = new Map<string, DdlIndexModel>();
  for (const match of sql.matchAll(/create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([^\s]+)\s+on\s+([^\s(]+)\s*\(([^)]+)\)\s*;/gi)) {
    const name = normalizeIdentifier(match[2]);
    result.set(name, {
      name,
      table: normalizeTableRef(match[3]),
      unique: Boolean(match[1]),
      columns: splitIdentifierList(match[4]),
    });
  }
  return result;
}

function parseDdlColumn(definition: string): DdlColumnView | null {
  const match = definition.match(/^("[^"]+"|[a-zA-Z_][\w$]*)\s+(.+)$/);
  if (!match) {
    return null;
  }
  const name = normalizeIdentifier(match[1]);
  const rest = match[2].trim();
  const keywordIndex = findFirstConstraintKeywordIndex(rest);
  const type = (keywordIndex === -1 ? rest : rest.slice(0, keywordIndex)).trim() || null;
  const constraintText = keywordIndex === -1 ? '' : rest.slice(keywordIndex);
  return {
    name,
    type,
    notNull: /\bnot\s+null\b/i.test(constraintText),
    default: extractDefaultValue(constraintText),
    primaryKey: /\bprimary\s+key\b/i.test(constraintText),
    unique: /\bunique\b/i.test(constraintText),
  };
}

function diffColumns(tableName: string, before: DdlTableModel, after: DdlTableModel): DdlChangeDetail[] {
  const changes: DdlChangeDetail[] = [];
  const columnNames = sortUnique([...before.columns.keys(), ...after.columns.keys()]);
  for (const columnName of columnNames) {
    const beforeColumn = before.columns.get(columnName);
    const afterColumn = after.columns.get(columnName);
    if (!beforeColumn && afterColumn) {
      changes.push({
        kind: 'add-column',
        column: columnName,
        before: null,
        after: afterColumn,
        explanationSql: `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${afterColumn.type ?? ''}${afterColumn.notNull ? ' NOT NULL' : ''}${afterColumn.default ? ` DEFAULT ${afterColumn.default}` : ''};`,
        reviewHints: [
          'Confirm whether the default value is correct for business semantics.',
          'Confirm whether this column should have an enum or check constraint.',
        ],
      });
    } else if (beforeColumn && !afterColumn) {
      changes.push({
        kind: 'drop-column',
        column: columnName,
        before: beforeColumn,
        after: null,
        explanationSql: `ALTER TABLE ${tableName} DROP COLUMN ${columnName};`,
        reviewHints: ['Confirm whether dropping this column is intended and whether existing data must be migrated.'],
      });
    } else if (beforeColumn && afterColumn) {
      if ((beforeColumn.type ?? '').toLowerCase() !== (afterColumn.type ?? '').toLowerCase()) {
        changes.push({
          kind: 'modify-column-type',
          column: columnName,
          before: beforeColumn.type,
          after: afterColumn.type,
          explanationSql: `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${afterColumn.type ?? 'unknown'};`,
          reviewHints: ['Confirm type conversion safety and whether a USING clause is required.'],
        });
      }
      if (beforeColumn.notNull !== afterColumn.notNull) {
        changes.push({
          kind: 'modify-column-nullability',
          column: columnName,
          before: { notNull: beforeColumn.notNull },
          after: { notNull: afterColumn.notNull },
          explanationSql: `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${afterColumn.notNull ? 'SET NOT NULL' : 'DROP NOT NULL'};`,
          reviewHints: ['Confirm nullability changes against existing rows and request validation.'],
        });
      }
      if ((beforeColumn.default ?? '') !== (afterColumn.default ?? '')) {
        changes.push({
          kind: 'modify-column-default',
          column: columnName,
          before: beforeColumn.default,
          after: afterColumn.default,
          explanationSql: afterColumn.default
            ? `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} SET DEFAULT ${afterColumn.default};`
            : `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} DROP DEFAULT;`,
          reviewHints: ['Confirm whether the default value is correct for business semantics.'],
        });
      }
    }
  }
  return changes;
}

function diffPrimaryKey(tableName: string, before: DdlTableModel, after: DdlTableModel): DdlChangeDetail[] {
  const beforeKey = before.primaryKeyColumns.join(',');
  const afterKey = after.primaryKeyColumns.join(',');
  if (beforeKey === afterKey) {
    return [];
  }
  return [{
    kind: beforeKey ? 'drop-primary-key' : 'add-primary-key',
    before: before.primaryKeyColumns,
    after: after.primaryKeyColumns,
    explanationSql: afterKey
      ? `ALTER TABLE ${tableName} ADD PRIMARY KEY (${after.primaryKeyColumns.join(', ')});`
      : `ALTER TABLE ${tableName} DROP CONSTRAINT <primary-key-constraint>;`,
    reviewHints: ['Confirm primary key changes against references and application identity semantics.'],
  }];
}

function diffUnique(tableName: string, before: DdlTableModel, after: DdlTableModel): DdlChangeDetail[] {
  const beforeKeys = before.uniqueColumns.map((columns) => columns.join(',')).sort();
  const afterKeys = after.uniqueColumns.map((columns) => columns.join(',')).sort();
  const changes: DdlChangeDetail[] = [];
  for (const key of beforeKeys.filter((candidate) => !afterKeys.includes(candidate))) {
    changes.push({
      kind: 'drop-unique',
      before: key.split(','),
      after: null,
      explanationSql: `ALTER TABLE ${tableName} DROP CONSTRAINT <unique-constraint>;`,
      reviewHints: ['Confirm whether removing uniqueness is intended for business semantics.'],
    });
  }
  for (const key of afterKeys.filter((candidate) => !beforeKeys.includes(candidate))) {
    changes.push({
      kind: 'add-unique',
      before: null,
      after: key.split(','),
      explanationSql: `ALTER TABLE ${tableName} ADD UNIQUE (${key.split(',').join(', ')});`,
      reviewHints: ['Confirm whether existing rows satisfy the new uniqueness rule.'],
    });
  }
  return changes;
}

function diffDdlIndexes(
  before: Map<string, DdlIndexModel>,
  after: Map<string, DdlIndexModel>,
  filePath: string
): DdlChangeItem[] {
  const items: DdlChangeItem[] = [];
  const indexNames = sortUnique([...before.keys(), ...after.keys()]);
  for (const indexName of indexNames) {
    const beforeIndex = before.get(indexName);
    const afterIndex = after.get(indexName);
    if (!beforeIndex && afterIndex) {
      items.push({
        path: filePath,
        objectKind: 'index',
        object: indexName,
        explanationSqlPurpose: EXPLANATION_SQL_PURPOSE,
        changes: [{
          kind: 'add-index',
          index: indexName,
          before: null,
          after: afterIndex,
          explanationSql: `CREATE ${afterIndex.unique ? 'UNIQUE ' : ''}INDEX ${indexName} ON ${afterIndex.table} (${afterIndex.columns.join(', ')});`,
          reviewHints: ['Confirm whether the new index supports the changed query path and whether build cost is acceptable.'],
        }],
      });
    } else if (beforeIndex && !afterIndex) {
      items.push({
        path: filePath,
        objectKind: 'index',
        object: indexName,
        explanationSqlPurpose: EXPLANATION_SQL_PURPOSE,
        changes: [{
          kind: 'drop-index',
          index: indexName,
          before: beforeIndex,
          after: null,
          explanationSql: `DROP INDEX ${indexName};`,
          reviewHints: ['Confirm whether removing this index is safe for existing read paths.'],
        }],
      });
    }
  }
  return items;
}

function summarizeSql(sql: string): SqlSummary {
  const stripped = stripSqlComments(sql).trim();
  if (!stripped) {
    return emptySqlSummary();
  }
  let parseWarning = false;
  try {
    SqlParser.parse(stripped);
  } catch {
    parseWarning = true;
  }
  const statementKind = stripped.match(/^(?:with\b[\s\S]+?\)\s*)?(select|insert|update|delete|merge)\b/i)?.[1]?.toLowerCase() ?? null;
  return {
    statementKind,
    readTables: extractReadTables(stripped, statementKind),
    writeTables: extractWriteTables(stripped, statementKind),
    returningColumns: extractReturningColumns(stripped),
    selectedColumns: extractSelectedColumns(stripped, statementKind),
    whereColumns: extractWhereColumns(stripped),
    joinTables: extractJoinTables(stripped),
    parseWarning,
  };
}

function emptySqlSummary(): SqlSummary {
  return {
    statementKind: null,
    readTables: [],
    writeTables: [],
    returningColumns: [],
    selectedColumns: [],
    whereColumns: [],
    joinTables: [],
    parseWarning: false,
  };
}

function extractReadTables(sql: string, statementKind: string | null): string[] {
  const tables: string[] = [];
  for (const match of sql.matchAll(/\bfrom\s+("[^"]+"|[a-zA-Z_][\w$]*(?:\s*\.\s*"?[\w$]+"?)?)/gi)) {
    tables.push(normalizeTableRef(match[1]));
  }
  for (const match of sql.matchAll(/\bjoin\s+("[^"]+"|[a-zA-Z_][\w$]*(?:\s*\.\s*"?[\w$]+"?)?)/gi)) {
    tables.push(normalizeTableRef(match[1]));
  }
  if (statementKind === 'delete') {
    const writeTables = extractWriteTables(sql, statementKind);
    return sortUnique(tables.filter((table) => !writeTables.includes(table)));
  }
  return sortUnique(tables);
}

function extractWriteTables(sql: string, statementKind: string | null): string[] {
  const patterns: RegExp[] = [];
  if (statementKind === 'insert') {
    patterns.push(/\binsert\s+into\s+("[^"]+"|[a-zA-Z_][\w$]*(?:\s*\.\s*"?[\w$]+"?)?)/i);
  } else if (statementKind === 'update') {
    patterns.push(/\bupdate\s+("[^"]+"|[a-zA-Z_][\w$]*(?:\s*\.\s*"?[\w$]+"?)?)/i);
  } else if (statementKind === 'delete') {
    patterns.push(/\bdelete\s+from\s+("[^"]+"|[a-zA-Z_][\w$]*(?:\s*\.\s*"?[\w$]+"?)?)/i);
  }
  return sortUnique(patterns.map((pattern) => sql.match(pattern)?.[1]).filter((value): value is string => Boolean(value)).map(normalizeTableRef));
}

function extractReturningColumns(sql: string): string[] {
  const returning = sql.match(/\breturning\s+([\s\S]+?)(?:;|$)/i)?.[1];
  if (!returning) {
    return [];
  }
  return splitTopLevelComma(returning).map(cleanSqlExpressionName).filter(Boolean).sort();
}

function extractSelectedColumns(sql: string, statementKind: string | null): string[] {
  if (statementKind !== 'select') {
    return [];
  }
  const selected = sql.match(/\bselect\s+([\s\S]+?)\s+\bfrom\b/i)?.[1];
  if (!selected) {
    return [];
  }
  return splitTopLevelComma(selected).map(cleanSqlExpressionName).filter(Boolean).sort();
}

function extractWhereColumns(sql: string): string[] {
  const where = sql.match(/\bwhere\s+([\s\S]+?)(?:\bgroup\s+by\b|\border\s+by\b|\blimit\b|\breturning\b|;|$)/i)?.[1];
  if (!where) {
    return [];
  }
  return sortUnique(Array.from(where.matchAll(/(?<!['"])(?:[a-zA-Z_][\w$]*\.)?([a-zA-Z_][\w$]*)\s*(?:=|<>|!=|<|>|<=|>=|\bis\b|\bin\b|\blike\b)/gi))
    .map((match) => normalizeIdentifier(match[1]))
    .filter((name) => !SQL_KEYWORDS.has(name.toLowerCase())));
}

function extractJoinTables(sql: string): string[] {
  return sortUnique(Array.from(sql.matchAll(/\bjoin\s+("[^"]+"|[a-zA-Z_][\w$]*(?:\s*\.\s*"?[\w$]+"?)?)/gi))
    .map((match) => normalizeTableRef(match[1])));
}

function extractExportedNames(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/\bexport\s+(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/i)[1] ?? part.trim().split(/\s+as\s+/i)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(name)) {
        names.add(name);
      }
    }
  }
  return Array.from(names).sort();
}

function extractZodSchemaNames(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:Schema|Input|Output|Request|Response))\s*=\s*z\./g)) {
    names.add(match[1]);
  }
  return Array.from(names).sort();
}

function splitTopLevelComma(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if (quote) {
      current += char;
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }
    if (char === '\'' || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') {
      depth += 1;
    } else if (char === ')' && depth > 0) {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current);
  }
  return parts;
}

function splitIdentifierList(value: string): string[] {
  return splitTopLevelComma(value).map((part) => normalizeIdentifier(part.trim())).filter(Boolean).sort();
}

function findFirstConstraintKeywordIndex(value: string): number {
  const match = value.search(/\s(?:constraint|not\s+null|null|default|primary\s+key|unique|references|check|generated)\b/i);
  return match === -1 ? -1 : match + 1;
}

function extractDefaultValue(value: string): string | null {
  const match = value.match(/\bdefault\s+(.+?)(?:\s+(?:constraint|not\s+null|null|primary\s+key|unique|references|check|generated)\b|$)/i);
  return match?.[1]?.trim() ?? null;
}

function tableView(table: DdlTableModel): DdlTableView {
  return {
    table: table.name,
    columnsAfter: Array.from(table.columns.values()).sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function containsCreateTable(sql: string): boolean {
  return /\bcreate\s+(?:unlogged\s+|temporary\s+|temp\s+)?table\b/i.test(sql);
}

function containsSupportedDdl(sql: string): boolean {
  return containsCreateTable(sql) || /\bcreate\s+(?:unique\s+)?index\b/i.test(sql);
}

function cleanSqlExpressionName(value: string): string {
  const trimmed = value.trim();
  const alias = trimmed.match(/\bas\s+("[^"]+"|[a-zA-Z_][\w$]*)$/i)?.[1]
    ?? trimmed.match(/\s+("[^"]+"|[a-zA-Z_][\w$]*)$/)?.[1];
  if (alias && !/[()*/+-]/.test(alias)) {
    return normalizeIdentifier(alias);
  }
  const column = trimmed.match(/(?:^|\.)("[^"]+"|[a-zA-Z_][\w$]*)$/)?.[1];
  return column ? normalizeIdentifier(column) : trimmed.replace(/\s+/g, ' ');
}

function normalizeTableRef(value: string): string {
  return value.split('.').map((part) => normalizeIdentifier(part.trim())).join('.');
}

function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed.replace(/"/g, '');
}

function stripSqlComments(value: string): string {
  return value.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function normalizeScope(value: string | undefined): string | undefined {
  const normalized = normalizeOption(value);
  return normalized ? normalizePath(normalized).replace(/\/$/, '') : undefined;
}

function normalizeOption(value: string | undefined): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  return value;
}

function resolveRfbaReviewDataFormat(value: string | undefined): RfbaReviewDataFormat {
  const normalized = (value ?? 'json').trim().toLowerCase();
  if (normalized === 'json') {
    return 'json';
  }
  throw new Error(`Unsupported RFBA review-data format: ${value}`);
}

function isInScope(filePath: string, scope: string): boolean {
  return filePath === scope || filePath.startsWith(`${scope}/`);
}

function isVerificationKind(kind: RfbaChangedFileKind): boolean {
  return kind === 'query-case'
    || kind === 'generated-evidence'
    || kind === 'query-verification'
    || kind === 'feature-verification'
    || kind === 'test-support';
}

function maxReviewWeight(values: RfbaReviewWeight[]): RfbaReviewWeight {
  if (values.includes('high')) {
    return 'high';
  }
  if (values.includes('medium')) {
    return 'medium';
  }
  return 'low';
}

function sortUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function compareByPath(left: { path: string }, right: { path: string }): number {
  return left.path.localeCompare(right.path);
}

function compareWarnings(left: RfbaReviewWarning, right: RfbaReviewWarning): number {
  return left.code.localeCompare(right.code)
    || (left.path ?? left.boundary ?? left.paths?.join(',') ?? '').localeCompare(right.path ?? right.boundary ?? right.paths?.join(',') ?? '')
    || left.message.localeCompare(right.message);
}

function uniqueHints(hints: RfbaReviewHint[]): RfbaReviewHint[] {
  const seen = new Set<string>();
  const result: RfbaReviewHint[] = [];
  for (const hint of hints) {
    const key = `${hint.target}\0${hint.priority}\0${hint.hint}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(hint);
    }
  }
  return result;
}

const SQL_KEYWORDS = new Set([
  'and',
  'or',
  'not',
  'null',
  'true',
  'false',
  'is',
  'in',
  'like',
  'between',
  'exists',
]);
