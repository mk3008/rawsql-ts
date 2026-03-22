import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { collectSqlFiles } from '../utils/collectSqlFiles';
import { formatConnectionTarget } from '../utils/connectionSummary';
import type { DbConnectionContext } from '../utils/dbConnection';
import { ensureDirectory } from '../utils/fs';
import { runPgDump } from '../utils/pgDump';
import { withSpanSync } from '../utils/telemetry';

export interface DiffSchemaOptions {
  directories: string[];
  extensions: string[];
  url: string;
  out: string;
  pgDumpPath?: string;
  pgDumpShell?: boolean;
  connectionContext?: DbConnectionContext;
  dryRun?: boolean;
}

export type DdlDiffChangeKind =
  | 'create_table'
  | 'drop_table'
  | 'add_column'
  | 'drop_column'
  | 'alter_type'
  | 'alter_nullability'
  | 'table_rebuild'
  | 'schema_change';

export interface DdlDiffSummaryEntry {
  schema: string;
  table: string;
  changeKind: DdlDiffChangeKind;
  details: Record<string, unknown>;
}

export interface DdlDiffRiskNote {
  level: 'info' | 'warning';
  message: string;
}

export interface DdlDiffArtifacts {
  sql: string;
  text: string;
  json: string;
}

export interface DiffSchemaResult {
  outFile: string;
  sql: string;
  text: string;
  json: string;
  dryRun: boolean;
  hasChanges: boolean;
  summary: DdlDiffSummaryEntry[];
  riskNotes: DdlDiffRiskNote[];
  artifacts: DdlDiffArtifacts;
}

interface TableDefinition {
  key: string;
  schema: string;
  table: string;
  statement: string;
  normalizedStatement: string;
  columns: Map<string, ParsedColumn>;
}

interface ParsedColumn {
  name: string;
  type: string;
  nullable: boolean;
}

interface ParsedSchemaModel {
  tableDefinitions: Map<string, TableDefinition>;
  createSchemaStatements: string[];
  supplementalStatementsByTable: Map<string, string[]>;
}

export const DDL_DIFF_SPAN_NAMES = {
  collectLocalDdl: 'collect-local-ddl',
  pullRemoteDdl: 'pull-remote-ddl',
  computeDiffPlan: 'compute-diff-plan',
  emitDiffPlan: 'emit-diff-plan',
} as const;

export function runDiffSchema(options: DiffSchemaOptions): DiffSchemaResult {
  const localSources = withSpanSync(DDL_DIFF_SPAN_NAMES.collectLocalDdl, () => {
    const discovered = collectSqlFiles(options.directories, options.extensions);
    if (discovered.length === 0) {
      throw new Error(`No SQL files were discovered under ${options.directories.join(', ')}`);
    }
    return discovered;
  }, {
    directoryCount: options.directories.length,
    extensionCount: options.extensions.length,
  });

  // Concatenate the local DDL files in a stable order for deterministic outputs.
  const localSql = localSources.map((source) => source.sql).join('\n\n');
  const remoteSql = withSpanSync(DDL_DIFF_SPAN_NAMES.pullRemoteDdl, () => {
    return runPgDump({
      url: options.url,
      pgDumpPath: options.pgDumpPath,
      pgDumpShell: options.pgDumpShell,
      connectionContext: options.connectionContext
    });
  });

  const plan = withSpanSync(DDL_DIFF_SPAN_NAMES.computeDiffPlan, () => {
    const databaseTarget = formatConnectionTarget(options.connectionContext) || 'target: unknown';
    const localModel = parseSchemaModel(localSql);
    const remoteModel = parseSchemaModel(remoteSql);
    const summary = buildSummary(localModel, remoteModel);
    const riskNotes = buildRiskNotes(summary);
    const hasChanges = summary.length > 0;
    const artifacts = deriveArtifactPaths(options.out);
    const sql = hasChanges
      ? buildApplySql(localSql, localModel, remoteModel)
      : '-- No schema differences detected.\n';
    const text = buildTextSummary({
      summary,
      riskNotes,
      sqlArtifactPath: artifacts.sql,
      databaseTarget,
      hasChanges
    });
    const json = JSON.stringify({
      kind: 'ddl-diff',
      generatedAt: new Date().toISOString(),
      target: {
        connection: databaseTarget
      },
      summary,
      riskNotes,
      hasChanges,
      artifacts: {
        sql: artifacts.sql
      }
    }, null, 2);

    return {
      hasChanges,
      artifacts,
      sql,
      text,
      json,
      summary,
      riskNotes
    };
  }, {
    localFileCount: localSources.length,
  });

  if (!options.dryRun) {
    withSpanSync(DDL_DIFF_SPAN_NAMES.emitDiffPlan, () => {
      ensureDirectory(path.dirname(plan.artifacts.sql));
      writeFileSync(plan.artifacts.sql, plan.sql, 'utf8');
      writeFileSync(plan.artifacts.text, plan.text, 'utf8');
      writeFileSync(plan.artifacts.json, `${plan.json}\n`, 'utf8');
      console.log(`DDL diff SQL written to ${plan.artifacts.sql}`);
      console.log(`DDL diff review text written to ${plan.artifacts.text}`);
      console.log(`DDL diff review JSON written to ${plan.artifacts.json}`);
    }, {
      outFile: plan.artifacts.sql,
    });
  }

  return {
    outFile: plan.artifacts.sql,
    sql: plan.sql,
    text: plan.text,
    json: plan.json,
    dryRun: Boolean(options.dryRun),
    hasChanges: plan.hasChanges,
    summary: plan.summary,
    riskNotes: plan.riskNotes,
    artifacts: plan.artifacts
  };
}

function deriveArtifactPaths(outFile: string): DdlDiffArtifacts {
  if (outFile.endsWith('.sql')) {
    return {
      sql: outFile,
      text: outFile.slice(0, -4) + '.txt',
      json: outFile.slice(0, -4) + '.json'
    };
  }

  return {
    sql: outFile,
    text: `${outFile}.txt`,
    json: `${outFile}.json`
  };
}

function buildTextSummary(options: {
  summary: DdlDiffSummaryEntry[];
  riskNotes: DdlDiffRiskNote[];
  sqlArtifactPath: string;
  databaseTarget: string;
  hasChanges: boolean;
}): string {
  const lines = ['Migration summary', `- target: ${options.databaseTarget}`];

  if (!options.hasChanges) {
    lines.push('- no schema differences detected');
  } else {
    for (const entry of options.summary) {
      lines.push(`- ${entry.schema}.${entry.table}: ${formatSummaryEntry(entry)}`);
    }
  }

  lines.push('', 'Risk notes');
  if (options.riskNotes.length === 0) {
    lines.push('- no additional review warnings');
  } else {
    for (const note of options.riskNotes) {
      lines.push(`- ${note.level}: ${note.message}`);
    }
  }

  lines.push('', 'Generated SQL', `- ${options.sqlArtifactPath}`);
  return `${lines.join('\n')}\n`;
}

function formatSummaryEntry(entry: DdlDiffSummaryEntry): string {
  switch (entry.changeKind) {
    case 'create_table':
      return 'create table';
    case 'drop_table':
      return 'drop table';
    case 'add_column':
      return `add column ${String(entry.details.column)} ${String(entry.details.type)}${entry.details.nullable ? ' null' : ' not null'}`;
    case 'drop_column':
      return `drop column ${String(entry.details.column)}`;
    case 'alter_type':
      return `alter column ${String(entry.details.column)} type ${String(entry.details.from)} -> ${String(entry.details.to)}`;
    case 'alter_nullability':
      return `alter column ${String(entry.details.column)} nullability ${String(entry.details.from)} -> ${String(entry.details.to)}`;
    case 'table_rebuild':
      return 'table definition changed';
    case 'schema_change':
      return String(entry.details.message ?? 'schema-level change');
  }
}

function buildRiskNotes(summary: DdlDiffSummaryEntry[]): DdlDiffRiskNote[] {
  const notes: DdlDiffRiskNote[] = [];

  if (summary.some((entry) => entry.changeKind === 'drop_table' || entry.changeKind === 'drop_column')) {
    notes.push({
      level: 'warning',
      message: 'Destructive drop detected: inspect downstream SQL/spec usage before applying the generated SQL.'
    });
  }

  if (summary.some((entry) => entry.changeKind === 'table_rebuild' || entry.changeKind === 'alter_type')) {
    notes.push({
      level: 'warning',
      message: 'Table recreation or type change detected: validate data backfill and application compatibility before applying the migration.'
    });
  }

  const renameCandidates = findRenameCandidates(summary);
  if (renameCandidates.length > 0) {
    notes.push({
      level: 'warning',
      message: `Rename candidate detected: ${renameCandidates.join(', ')}. Regenerate affected SQL specs and re-run tests after the migration lands.`
    });
  }

  if (summary.length > 0) {
    notes.push({
      level: 'info',
      message: 'After applying the SQL manually, run npx ztd ztd-config and npx vitest run to verify the repair loop.'
    });
  }

  return notes;
}

function findRenameCandidates(summary: DdlDiffSummaryEntry[]): string[] {
  const addedByTable = new Map<string, DdlDiffSummaryEntry[]>();
  const droppedByTable = new Map<string, DdlDiffSummaryEntry[]>();

  for (const entry of summary) {
    const key = `${entry.schema}.${entry.table}`;
    if (entry.changeKind === 'add_column') {
      const bucket = addedByTable.get(key) ?? [];
      bucket.push(entry);
      addedByTable.set(key, bucket);
    } else if (entry.changeKind === 'drop_column') {
      const bucket = droppedByTable.get(key) ?? [];
      bucket.push(entry);
      droppedByTable.set(key, bucket);
    }
  }

  const candidates: string[] = [];
  for (const [key, droppedEntries] of droppedByTable.entries()) {
    const addedEntries = addedByTable.get(key) ?? [];
    for (const dropped of droppedEntries) {
      const matched = addedEntries.find((entry) => entry.details.type === dropped.details.type);
      if (matched) {
        candidates.push(`${key}.${String(dropped.details.column)} -> ${String(matched.details.column)}`);
      }
    }
  }

  return candidates;
}

function buildApplySql(localSql: string, localModel: ParsedSchemaModel, remoteModel: ParsedSchemaModel): string {
  const lines: string[] = [];

  // Create missing schemas before table recreation so the artifact can be applied directly.
  for (const statement of localModel.createSchemaStatements) {
    lines.push(statement.trim().replace(/;?$/, ';'));
  }

  const changedOrDroppedTables = new Set<string>();
  for (const [key, remoteTable] of remoteModel.tableDefinitions.entries()) {
    const localTable = localModel.tableDefinitions.get(key);
    if (!localTable) {
      changedOrDroppedTables.add(key);
      lines.push(`DROP TABLE IF EXISTS ${quoteQualifiedName(remoteTable.schema, remoteTable.table)} CASCADE;`);
      continue;
    }
    if (localTable.normalizedStatement !== remoteTable.normalizedStatement) {
      changedOrDroppedTables.add(key);
      lines.push(`DROP TABLE IF EXISTS ${quoteQualifiedName(localTable.schema, localTable.table)} CASCADE;`);
    }
  }

  for (const [key, localTable] of localModel.tableDefinitions.entries()) {
    const remoteTable = remoteModel.tableDefinitions.get(key);
    if (!remoteTable || changedOrDroppedTables.has(key)) {
      lines.push(localTable.statement.trim().replace(/;?$/, ';'));
      const supplemental = localModel.supplementalStatementsByTable.get(key) ?? [];
      for (const statement of supplemental) {
        lines.push(statement.trim().replace(/;?$/, ';'));
      }
    }
  }

  // Fall back to the local snapshot when no table-level parsing succeeded so the command still emits SQL only.
  const rendered = lines.filter((line) => line.trim().length > 0).join('\n\n');
  return rendered.length > 0 ? `${rendered}\n` : `${localSql.trim()}\n`;
}

function parseSchemaModel(sql: string): ParsedSchemaModel {
  const statements = splitSqlStatements(sql);
  const tableDefinitions = new Map<string, TableDefinition>();
  const createSchemaStatements: string[] = [];
  const supplementalStatementsByTable = new Map<string, string[]>();

  for (const statement of statements) {
    const trimmed = statement.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const tableDefinition = parseCreateTable(trimmed);
    if (tableDefinition) {
      tableDefinitions.set(tableDefinition.key, tableDefinition);
      continue;
    }

    if (/^create\s+schema\b/i.test(trimmed)) {
      createSchemaStatements.push(trimmed);
      continue;
    }

    const referencedTable = extractReferencedTable(trimmed);
    if (referencedTable) {
      const bucket = supplementalStatementsByTable.get(referencedTable) ?? [];
      bucket.push(trimmed);
      supplementalStatementsByTable.set(referencedTable, bucket);
    }
  }

  return {
    tableDefinitions,
    createSchemaStatements,
    supplementalStatementsByTable
  };
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function parseCreateTable(statement: string): TableDefinition | undefined {
  const match = statement.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i);
  if (!match) {
    return undefined;
  }

  const [schema, table] = splitQualifiedName(match[1]);
  const columns = parseColumns(statement);
  const key = `${schema}.${table}`;

  return {
    key,
    schema,
    table,
    statement,
    normalizedStatement: normalizeSql(statement),
    columns
  };
}

function parseColumns(statement: string): Map<string, ParsedColumn> {
  const columns = new Map<string, ParsedColumn>();
  const start = statement.indexOf('(');
  const end = statement.lastIndexOf(')');
  if (start < 0 || end <= start) {
    return columns;
  }

  const body = statement.slice(start + 1, end);
  for (const rawLine of body.split(',')) {
    const line = rawLine.trim().replace(/\s+/g, ' ');
    if (line.length === 0 || /^(constraint|primary key|foreign key|unique|check)\b/i.test(line)) {
      continue;
    }
    const columnMatch = line.match(/^("?[\w$]+"?)\s+(.+)$/);
    if (!columnMatch) {
      continue;
    }

    const name = normalizeIdentifier(columnMatch[1]);
    const remainder = columnMatch[2];
    const nullable = !/\bnot null\b/i.test(remainder);
    const type = remainder
      .replace(/\bnot null\b/ig, '')
      .replace(/\bnull\b/ig, '')
      .replace(/\bdefault\b[\s\S]*$/i, '')
      .trim()
      .replace(/\s+/g, ' ');

    columns.set(name, {
      name,
      type,
      nullable
    });
  }

  return columns;
}

function extractReferencedTable(statement: string): string | undefined {
  const createIndexMatch = statement.match(/\bon\s+((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i);
  if (createIndexMatch) {
    const [schema, table] = splitQualifiedName(createIndexMatch[1]);
    return `${schema}.${table}`;
  }

  const alterTableMatch = statement.match(/^alter\s+table\s+(?:only\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)/i);
  if (alterTableMatch) {
    const [schema, table] = splitQualifiedName(alterTableMatch[1]);
    return `${schema}.${table}`;
  }

  return undefined;
}

function buildSummary(localModel: ParsedSchemaModel, remoteModel: ParsedSchemaModel): DdlDiffSummaryEntry[] {
  const entries: DdlDiffSummaryEntry[] = [];

  for (const [key, localTable] of localModel.tableDefinitions.entries()) {
    const remoteTable = remoteModel.tableDefinitions.get(key);
    if (!remoteTable) {
      entries.push({
        schema: localTable.schema,
        table: localTable.table,
        changeKind: 'create_table',
        details: {}
      });
      continue;
    }

    entries.push(...buildTableChangeSummary(localTable, remoteTable));
  }

  for (const [key, remoteTable] of remoteModel.tableDefinitions.entries()) {
    if (!localModel.tableDefinitions.has(key)) {
      entries.push({
        schema: remoteTable.schema,
        table: remoteTable.table,
        changeKind: 'drop_table',
        details: {}
      });
    }
  }

  return sortSummaryEntries(entries);
}

function buildTableChangeSummary(localTable: TableDefinition, remoteTable: TableDefinition): DdlDiffSummaryEntry[] {
  const entries: DdlDiffSummaryEntry[] = [];
  const key = `${localTable.schema}.${localTable.table}`;

  for (const [columnName, localColumn] of localTable.columns.entries()) {
    const remoteColumn = remoteTable.columns.get(columnName);
    if (!remoteColumn) {
      entries.push({
        schema: localTable.schema,
        table: localTable.table,
        changeKind: 'add_column',
        details: {
          column: localColumn.name,
          type: localColumn.type,
          nullable: localColumn.nullable
        }
      });
      continue;
    }

    if (normalizeSql(localColumn.type) !== normalizeSql(remoteColumn.type)) {
      entries.push({
        schema: localTable.schema,
        table: localTable.table,
        changeKind: 'alter_type',
        details: {
          column: localColumn.name,
          from: remoteColumn.type,
          to: localColumn.type
        }
      });
    }

    if (localColumn.nullable !== remoteColumn.nullable) {
      entries.push({
        schema: localTable.schema,
        table: localTable.table,
        changeKind: 'alter_nullability',
        details: {
          column: localColumn.name,
          from: remoteColumn.nullable ? 'nullable' : 'not-null',
          to: localColumn.nullable ? 'nullable' : 'not-null'
        }
      });
    }
  }

  for (const [columnName, remoteColumn] of remoteTable.columns.entries()) {
    if (!localTable.columns.has(columnName)) {
      entries.push({
        schema: localTable.schema,
        table: localTable.table,
        changeKind: 'drop_column',
        details: {
          column: remoteColumn.name,
          type: remoteColumn.type
        }
      });
    }
  }

  if (entries.length === 0 && localTable.normalizedStatement !== remoteTable.normalizedStatement) {
    entries.push({
      schema: localTable.schema,
      table: localTable.table,
      changeKind: 'table_rebuild',
      details: {
        message: `${key} changed outside the parsed column set`
      }
    });
  }

  return entries;
}

function sortSummaryEntries(entries: DdlDiffSummaryEntry[]): DdlDiffSummaryEntry[] {
  return [...entries].sort((left, right) => {
    const leftKey = `${left.schema}.${left.table}.${left.changeKind}.${String(left.details.column ?? '')}`;
    const rightKey = `${right.schema}.${right.table}.${right.changeKind}.${String(right.details.column ?? '')}`;
    return leftKey.localeCompare(rightKey);
  });
}

function splitQualifiedName(value: string): [string, string] {
  const segments = value.split('.');
  if (segments.length === 1) {
    return ['public', normalizeIdentifier(segments[0])];
  }

  return [normalizeIdentifier(segments[0]), normalizeIdentifier(segments[1])];
}

function normalizeIdentifier(value: string): string {
  return value.replace(/^"/, '').replace(/"$/, '');
}

function normalizeSql(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function quoteQualifiedName(schema: string, table: string): string {
  return `"${schema}"."${table}"`;
}
