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

export type RiskGuidanceKind =
  | 'review_if_required'
  | 'avoid_if_possible'
  | 'cli_option_not_exposed';

export type DestructiveRiskKind =
  | 'drop_table'
  | 'drop_column'
  | 'cascade_drop'
  | 'alter_type'
  | 'rename_candidate'
  | 'nullability_tighten'
  | 'semantic_constraint_change';

export type OperationalRiskKind =
  | 'table_rebuild'
  | 'index_rebuild'
  | 'full_table_copy';

export interface DestructiveRisk {
  kind: DestructiveRiskKind;
  target?: string;
  from?: string;
  to?: string;
  avoidable?: boolean;
  guidance?: RiskGuidanceKind[];
}

export interface OperationalRisk {
  kind: OperationalRiskKind;
  target: string;
}

export interface DdlDiffRisks {
  destructiveRisks: DestructiveRisk[];
  operationalRisks: OperationalRisk[];
}

export interface DdlDiffArtifacts {
  sql: string;
  text: string;
  json: string;
}

export type ApplyPlanOperationKind =
  | 'emit_schema_statement'
  | 'drop_table_cascade'
  | 'create_table'
  | 'recreate_table'
  | 'reapply_statement'
  | 'drop_column_effect'
  | 'alter_type_effect'
  | 'nullability_tighten_effect'
  | 'rename_candidate_effect'
  | 'semantic_constraint_change_effect'
  | 'index_rebuild_effect';

export interface ApplyPlanOperation {
  kind: ApplyPlanOperationKind;
  target?: string;
  from?: string;
  to?: string;
  sql?: string;
  statementKind?: 'index' | 'other';
}

export interface DdlApplyPlan {
  operations: ApplyPlanOperation[];
}

export interface DiffSchemaResult {
  outFile: string;
  sql: string;
  text: string;
  json: string;
  dryRun: boolean;
  hasChanges: boolean;
  summary: DdlDiffSummaryEntry[];
  applyPlan: DdlApplyPlan;
  risks: DdlDiffRisks;
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

interface SupplementalStatement {
  sql: string;
  kind: 'index' | 'other';
  name?: string;
}

interface ParsedSchemaModel {
  tableDefinitions: Map<string, TableDefinition>;
  createSchemaStatements: string[];
  supplementalStatementsByTable: Map<string, SupplementalStatement[]>;
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
    const applyPlan = buildApplyPlan(localSql, localModel, remoteModel, summary);
    const risks = buildRisks(applyPlan, summary);
    const hasChanges = summary.length > 0;
    const artifacts = deriveArtifactPaths(options.out);
    const sql = hasChanges ? renderApplySql(localSql, applyPlan) : '-- No schema differences detected.\n';
    const text = buildTextSummary({
      summary,
      risks,
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
      applyPlan,
      risks,
      hasChanges,
      artifacts
    }, null, 2);

    return {
      hasChanges,
      artifacts,
      sql,
      text,
      json,
      summary,
      applyPlan,
      risks
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
    applyPlan: plan.applyPlan,
    risks: plan.risks,
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
  risks: DdlDiffRisks;
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

  lines.push('', 'Destructive risks');
  lines.push(...formatRiskLines(options.risks.destructiveRisks));

  lines.push('', 'Operational risks');
  lines.push(...formatRiskLines(options.risks.operationalRisks));

  lines.push('', 'Generated SQL', `- ${options.sqlArtifactPath}`);
  return `${lines.join('\n')}\n`;
}

function formatRiskLines(risks: Array<DestructiveRisk | OperationalRisk>): string[] {
  if (risks.length === 0) {
    return ['- none'];
  }

  const lines: string[] = [];
  for (const risk of risks) {
    if ('from' in risk && risk.from && risk.to) {
      lines.push(`- ${risk.kind}: ${risk.from} -> ${risk.to}`);
    } else {
      lines.push(`- ${risk.kind}: ${String(risk.target ?? 'unknown')}`);
    }

    if ('guidance' in risk && risk.guidance && risk.guidance.length > 0) {
      lines.push(`  guidance: ${risk.guidance.join(', ')}`);
    }
  }
  return lines;
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

function buildApplyPlan(
  localSql: string,
  localModel: ParsedSchemaModel,
  remoteModel: ParsedSchemaModel,
  summary: DdlDiffSummaryEntry[]
): DdlApplyPlan {
  const operations: ApplyPlanOperation[] = [];
  const summaryByTable = groupSummaryByTable(summary);

  // Create schemas first so the generated SQL can be applied without extra setup.
  for (const statement of localModel.createSchemaStatements) {
    operations.push({
      kind: 'emit_schema_statement',
      sql: statement.trim().replace(/;?$/, ';')
    });
  }

  // Decide which remote tables must be removed or rebuilt before replaying local DDL.
  for (const [key, remoteTable] of remoteModel.tableDefinitions.entries()) {
    const localTable = localModel.tableDefinitions.get(key);
    if (!localTable) {
      operations.push({
        kind: 'drop_table_cascade',
        target: key,
        sql: `DROP TABLE IF EXISTS ${quoteQualifiedName(remoteTable.schema, remoteTable.table)} CASCADE;`
      });
      continue;
    }

    if (localTable.normalizedStatement !== remoteTable.normalizedStatement) {
      operations.push({
        kind: 'drop_table_cascade',
        target: key,
        sql: `DROP TABLE IF EXISTS ${quoteQualifiedName(localTable.schema, localTable.table)} CASCADE;`
      });
      operations.push({
        kind: 'recreate_table',
        target: key
      });

      const tableEntries = summaryByTable.get(key) ?? [];
      for (const entry of tableEntries) {
        const columnTarget = entry.details.column ? `${key}.${String(entry.details.column)}` : key;
        if (entry.changeKind === 'drop_column') {
          operations.push({ kind: 'drop_column_effect', target: columnTarget });
        } else if (entry.changeKind === 'alter_type') {
          operations.push({ kind: 'alter_type_effect', target: columnTarget });
        } else if (entry.changeKind === 'alter_nullability' && entry.details.from === 'nullable' && entry.details.to === 'not-null') {
          operations.push({ kind: 'nullability_tighten_effect', target: columnTarget });
        }
      }

      for (const candidate of findRenameCandidates(tableEntries)) {
        operations.push({
          kind: 'rename_candidate_effect',
          from: candidate.from,
          to: candidate.to
        });
      }

      if (hasConstraintChange(localTable.statement, remoteTable.statement)) {
        operations.push({
          kind: 'semantic_constraint_change_effect',
          target: key
        });
      }
    }
  }

  // Replay local table definitions and supplemental statements after destructive operations.
  for (const [key, localTable] of localModel.tableDefinitions.entries()) {
    const remoteTable = remoteModel.tableDefinitions.get(key);
    const recreated = operations.some((operation) => operation.kind === 'recreate_table' && operation.target === key);
    if (!remoteTable || recreated) {
      operations.push({
        kind: 'create_table',
        target: key,
        sql: localTable.statement.trim().replace(/;?$/, ';')
      });

      const supplemental = localModel.supplementalStatementsByTable.get(key) ?? [];
      for (const statement of supplemental) {
        operations.push({
          kind: 'reapply_statement',
          target: statement.name ?? key,
          sql: statement.sql.trim().replace(/;?$/, ';'),
          statementKind: statement.kind
        });
        if (statement.kind === 'index') {
          operations.push({
            kind: 'index_rebuild_effect',
            target: statement.name ?? key
          });
        }
      }
    }
  }

  // Fall back to the local snapshot when no table-level parsing succeeded so SQL output stays valid.
  if (operations.length === 0 && localSql.trim().length > 0) {
    return {
      operations: [
        {
          kind: 'create_table',
          target: 'local_snapshot',
          sql: `${localSql.trim()}\n`
        }
      ]
    };
  }

  return { operations };
}

function renderApplySql(localSql: string, applyPlan: DdlApplyPlan): string {
  const sqlStatements = applyPlan.operations
    .map((operation) => operation.sql?.trim())
    .filter((statement): statement is string => Boolean(statement && statement.length > 0));

  const rendered = sqlStatements.join('\n\n');
  if (rendered.length > 0) {
    return `${rendered}\n`;
  }
  return `${localSql.trim()}\n`;
}

function buildRisks(applyPlan: DdlApplyPlan, summary: DdlDiffSummaryEntry[]): DdlDiffRisks {
  const destructiveRisks: DestructiveRisk[] = [];
  const operationalRisks: OperationalRisk[] = [];
  const summaryByTable = groupSummaryByTable(summary);
  const rebuiltTables = new Set(
    applyPlan.operations
      .filter((operation) => operation.kind === 'recreate_table')
      .map((operation) => operation.target)
      .filter((target): target is string => Boolean(target))
  );

  for (const operation of applyPlan.operations) {
    switch (operation.kind) {
      case 'drop_table_cascade':
        if (operation.target) {
          destructiveRisks.push(createGuidedRisk('drop_table', operation.target));
          destructiveRisks.push(createGuidedRisk('cascade_drop', operation.target));
        }
        break;
      case 'drop_column_effect':
        if (operation.target) {
          destructiveRisks.push(createGuidedRisk('drop_column', operation.target));
        }
        break;
      case 'alter_type_effect':
        if (operation.target) {
          destructiveRisks.push(createDestructiveRisk('alter_type', operation.target));
        }
        break;
      case 'nullability_tighten_effect':
        if (operation.target) {
          destructiveRisks.push(createDestructiveRisk('nullability_tighten', operation.target));
        }
        break;
      case 'rename_candidate_effect':
        destructiveRisks.push(createDestructiveRisk('rename_candidate', undefined, operation.from, operation.to));
        break;
      case 'semantic_constraint_change_effect':
        if (operation.target) {
          destructiveRisks.push(createDestructiveRisk('semantic_constraint_change', operation.target));
        }
        break;
      case 'recreate_table':
        if (operation.target) {
          operationalRisks.push({ kind: 'table_rebuild', target: operation.target });
          operationalRisks.push({ kind: 'full_table_copy', target: operation.target });
        }
        break;
      case 'index_rebuild_effect':
        if (operation.target) {
          operationalRisks.push({ kind: 'index_rebuild', target: operation.target });
        }
        break;
    }
  }

  // Surface rename candidates and constraint changes even when only the logical summary knows them.
  for (const [tableKey, entries] of summaryByTable.entries()) {
    for (const candidate of findRenameCandidates(entries)) {
      destructiveRisks.push(createDestructiveRisk('rename_candidate', undefined, candidate.from, candidate.to));
    }
    if (!rebuiltTables.has(tableKey)) {
      continue;
    }
    if (entries.some((entry) => entry.changeKind === 'alter_type')) {
      for (const entry of entries.filter((item) => item.changeKind === 'alter_type')) {
        destructiveRisks.push(createDestructiveRisk('alter_type', `${tableKey}.${String(entry.details.column)}`));
      }
    }
  }

  return {
    destructiveRisks: dedupeDestructiveRisks(destructiveRisks),
    operationalRisks: dedupeOperationalRisks(operationalRisks)
  };
}

function createGuidedRisk(kind: 'drop_table' | 'drop_column' | 'cascade_drop', target: string): DestructiveRisk {
  return {
    kind,
    target,
    avoidable: true,
    guidance: ['review_if_required', 'avoid_if_possible', 'cli_option_not_exposed']
  };
}

function createDestructiveRisk(kind: Exclude<DestructiveRiskKind, 'drop_table' | 'drop_column' | 'cascade_drop'>, target?: string, from?: string, to?: string): DestructiveRisk {
  return {
    kind,
    target,
    from,
    to,
    guidance: ['review_if_required']
  };
}

function dedupeDestructiveRisks(risks: DestructiveRisk[]): DestructiveRisk[] {
  const seen = new Map<string, DestructiveRisk>();
  for (const risk of risks) {
    const key = JSON.stringify({
      kind: risk.kind,
      target: risk.target ?? '',
      from: risk.from ?? '',
      to: risk.to ?? ''
    });
    if (!seen.has(key)) {
      seen.set(key, risk);
    }
  }

  return [...seen.values()].sort((left, right) => {
    const leftKey = `${left.kind}:${left.target ?? left.from ?? ''}:${left.to ?? ''}`;
    const rightKey = `${right.kind}:${right.target ?? right.from ?? ''}:${right.to ?? ''}`;
    return leftKey.localeCompare(rightKey);
  });
}

function dedupeOperationalRisks(risks: OperationalRisk[]): OperationalRisk[] {
  const seen = new Map<string, OperationalRisk>();
  for (const risk of risks) {
    const key = `${risk.kind}:${risk.target}`;
    if (!seen.has(key)) {
      seen.set(key, risk);
    }
  }

  return [...seen.values()].sort((left, right) => {
    const leftKey = `${left.kind}:${left.target}`;
    const rightKey = `${right.kind}:${right.target}`;
    return leftKey.localeCompare(rightKey);
  });
}

function groupSummaryByTable(summary: DdlDiffSummaryEntry[]): Map<string, DdlDiffSummaryEntry[]> {
  const grouped = new Map<string, DdlDiffSummaryEntry[]>();
  for (const entry of summary) {
    const key = `${entry.schema}.${entry.table}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(entry);
    grouped.set(key, bucket);
  }
  return grouped;
}

function findRenameCandidates(entries: DdlDiffSummaryEntry[]): Array<{ from: string; to: string }> {
  const addedColumns = entries.filter((entry) => entry.changeKind === 'add_column');
  const droppedColumns = entries.filter((entry) => entry.changeKind === 'drop_column');
  const candidates: Array<{ from: string; to: string }> = [];

  for (const dropped of droppedColumns) {
    const matched = addedColumns.find((entry) => normalizeSql(String(entry.details.type)) === normalizeSql(String(dropped.details.type)));
    if (!matched) {
      continue;
    }

    const tableKey = `${dropped.schema}.${dropped.table}`;
    candidates.push({
      from: `${tableKey}.${String(dropped.details.column)}`,
      to: `${tableKey}.${String(matched.details.column)}`
    });
  }

  return candidates;
}

function parseSchemaModel(sql: string): ParsedSchemaModel {
  const statements = splitSqlStatements(sql);
  const tableDefinitions = new Map<string, TableDefinition>();
  const createSchemaStatements: string[] = [];
  const supplementalStatementsByTable = new Map<string, SupplementalStatement[]>();

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
      bucket.push({
        sql: trimmed,
        kind: isCreateIndexStatement(trimmed) ? 'index' : 'other',
        name: extractIndexName(trimmed)
      });
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

function isCreateIndexStatement(statement: string): boolean {
  return /^create\s+(?:unique\s+)?index\b/i.test(statement);
}

function extractIndexName(statement: string): string | undefined {
  const match = statement.match(/^create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?("?[\w$]+"?)/i);
  if (!match) {
    return undefined;
  }
  return normalizeIdentifier(match[1]);
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

function hasConstraintChange(localStatement: string, remoteStatement: string): boolean {
  const localConstraints = extractConstraintLines(localStatement);
  const remoteConstraints = extractConstraintLines(remoteStatement);
  if (localConstraints.length === 0 && remoteConstraints.length === 0) {
    return false;
  }

  return normalizeSql(localConstraints.join(' ')) !== normalizeSql(remoteConstraints.join(' '));
}

function extractConstraintLines(statement: string): string[] {
  const start = statement.indexOf('(');
  const end = statement.lastIndexOf(')');
  if (start < 0 || end <= start) {
    return [];
  }

  return statement
    .slice(start + 1, end)
    .split(',')
    .map((line) => line.trim())
    .filter((line) => /^(constraint|primary key|foreign key|unique|check)\b/i.test(line));
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
