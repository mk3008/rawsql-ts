import {
  AlterTableAddConstraint,
  AlterTableAlterColumnDefault,
  AlterTableStatement,
  CommentOnStatement,
  CreateIndexStatement,
  CreateTableQuery,
  MultiQuerySplitter,
  RawString,
  SqlFormatter,
  SqlParser,
  TableConstraintDefinition,
  TypeValue,
  createTableDefinitionFromCreateTableQuery,
  type ColumnConstraintDefinition,
  type ValueComponent,
} from 'rawsql-ts';
import type {
  ColumnDocModel,
  NormalizedSql,
  ReferenceDocModel,
  ResolvedSchemaSettings,
  SnapshotResult,
  SqlSource,
  TableConstraintDocModel,
  TableDocModel,
  TriggerDocModel,
  WarningItem,
} from '../types';
import { normalizePostgresType } from '../analyzer/typeNormalization';
import { slugifyIdentifier } from '../utils/slug';

interface WorkingColumn {
  ordinal: number;
  name: string;
  concept: string;
  conceptSlug: string;
  typeName: string;
  canonicalType: string;
  typeKey: string;
  unknownType: boolean;
  nullable: boolean;
  defaultValue: string;
  isPrimaryKey: boolean;
  comment: string;
}

interface SnapshotOptions {
  columnOrder: 'definition' | 'name';
}

interface OutgoingReference {
  fromTableKey: string;
  fromColumns: string[];
  targetTableKey: string;
  targetColumns: string[];
  onDeleteAction: 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default' | null;
  onUpdateAction: 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default' | null;
}

interface WorkingTable {
  schema: string;
  table: string;
  schemaSlug: string;
  tableSlug: string;
  instance: string;
  tableComment: string;
  sourceFiles: Set<string>;
  columns: Map<string, WorkingColumn>;
  constraints: TableConstraintDocModel[];
  triggers: TriggerDocModel[];
  outgoingReferences: OutgoingReference[];
}

interface CommentAccumulator {
  tableComments: Map<string, string>;
  columnComments: Map<string, string>;
}

interface TriggerAccumulator {
  items: Array<{ tableKey: string; trigger: TriggerDocModel }>;
}

const formatter = new SqlFormatter({
  preset: 'postgres',
  keywordCase: 'lower',
  indentSize: 2,
  indentChar: ' ',
  newline: '\n',
  commaBreak: 'after',
  exportComment: 'none',
  identifierEscape: 'quote',
} as const);

export function snapshotTableDocs(
  sources: SqlSource[],
  schemaSettings: ResolvedSchemaSettings,
  options: SnapshotOptions
): SnapshotResult {
  const registry = new Map<string, WorkingTable>();
  const comments: CommentAccumulator = {
    tableComments: new Map<string, string>(),
    columnComments: new Map<string, string>(),
  };
  const triggerAccumulator: TriggerAccumulator = { items: [] };
  const warnings: WarningItem[] = [];

  for (const source of sources) {
    console.log(`  Splitting: ${source.path}`);
    // Strip psql meta-commands (\connect, \restrict, etc.) that pg_dump emits
    const cleanedSql = source.sql
      .split('\n')
      .map(line => (/^\s*\\/.test(line) ? '' : line))
      .join('\n');
    const statements = MultiQuerySplitter.split(cleanedSql).queries;
    console.log(`  ${statements.length} statements found in ${source.path}`);
    for (let statementIndex = 0; statementIndex < statements.length; statementIndex += 1) {
      if (statementIndex > 0 && statementIndex % 100 === 0) {
        console.log(`  Parsing statement ${statementIndex}/${statements.length} in ${source.path}`);
      }
      const statement = statements[statementIndex];
      if (statement.isEmpty) {
        continue;
      }
      const sql = statement.sql.trim();
      if (!sql) {
        continue;
      }

      // Silently skip statements that are intentionally out of scope
      const sqlLower = sql.toLowerCase().replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '').trim();
      if (sqlLower.startsWith('grant ') || sqlLower.startsWith('revoke ')) {
        continue;
      }

      // Silently skip DDL that is outside table structure scope:
      // - Ownership (OWNER TO) from pg_dump
      // - Session settings (SET, SELECT set_config) from pg_dump
      // - Object types not tracked in table docs (SEQUENCE, FUNCTION, VIEW, SCHEMA, TYPE, DOMAIN, EXTENSION)
      if (
        sqlLower.startsWith('set ') ||
        sqlLower.startsWith('select pg_catalog.set_config(') ||
        sqlLower.startsWith('create sequence ') ||
        sqlLower.startsWith('alter sequence ') ||
        sqlLower.startsWith('create schema ') ||
        sqlLower.startsWith('create function ') ||
        sqlLower.startsWith('create or replace function ') ||
        sqlLower.startsWith('create procedure ') ||
        sqlLower.startsWith('create or replace procedure ') ||
        sqlLower.startsWith('create view ') ||
        sqlLower.startsWith('create or replace view ') ||
        sqlLower.startsWith('create materialized view ') ||
        sqlLower.startsWith('create type ') ||
        sqlLower.startsWith('create or replace type ') ||
        sqlLower.startsWith('create domain ') ||
        sqlLower.startsWith('create extension ') ||
        sqlLower.startsWith('alter function ') ||
        sqlLower.startsWith('alter procedure ') ||
        sqlLower.startsWith('alter view ') ||
        sqlLower.startsWith('alter materialized view ') ||
        sqlLower.startsWith('alter schema ') ||
        sqlLower.startsWith('alter type ') ||
        sqlLower.startsWith('alter default privileges ')
      ) {
        continue;
      }
      // ALTER TABLE/SEQUENCE ... OWNER TO ... (pg_dump ownership statement)
      if (sqlLower.includes(' owner to ')) {
        continue;
      }
      // ALTER TABLE ... ATTACH PARTITION (partitioned table child attachment)
      if (sqlLower.includes(' attach partition ')) {
        continue;
      }
      // ALTER TABLE ... ENABLE [ALWAYS] TRIGGER (trigger state management)
      if (sqlLower.startsWith('alter table ') && sqlLower.includes(' enable ') && sqlLower.includes(' trigger ')) {
        continue;
      }

      // NOTE: CREATE TRIGGER is handled here via regex as an intentional exception.
      // Ideally, trigger parsing should be implemented in the rawsql-ts core parser
      // (SqlParser + DDLStatements model), but that work has not been done yet.
      // Regex parsing is used as a pragmatic workaround until core support is added.
      if (
        sqlLower.startsWith('create trigger ') ||
        sqlLower.startsWith('create or replace trigger ') ||
        sqlLower.startsWith('create constraint trigger ')
      ) {
        collectTrigger(sql, schemaSettings, triggerAccumulator);
        continue;
      }
      // Silently skip DROP/ALTER TRIGGER
      if (sqlLower.startsWith('drop trigger ') || sqlLower.startsWith('alter trigger ')) {
        continue;
      }

      const commentState = applyCommentStatement(sql, schemaSettings, comments);
      if (commentState === 'handled') {
        continue;
      }
      if (commentState === 'ambiguous') {
        const w = {
          kind: 'AMBIGUOUS' as const,
          message: 'COMMENT ON statement could not be fully resolved.',
          statementPreview: previewStatement(sql),
          source: { filePath: source.path, statementIndex: statementIndex + 1 },
        };
        console.warn(`  [WARN] ${w.kind}: ${w.message} (${w.source.filePath}#${w.source.statementIndex})`);
        warnings.push(w);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = SqlParser.parse(sql);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const w = {
          kind: 'PARSE_FAILED' as const,
          message,
          statementPreview: previewStatement(sql),
          source: { filePath: source.path, statementIndex: statementIndex + 1 },
        };
        console.warn(`  [WARN] ${w.kind}: ${w.message} (${w.source.filePath}#${w.source.statementIndex})\n         ${w.statementPreview}`);
        warnings.push(w);
        continue;
      }

      if (parsed instanceof CreateTableQuery) {
        applyCreateTable(parsed, source, schemaSettings, registry);
        continue;
      }

      if (parsed instanceof AlterTableStatement) {
        applyAlterTable(parsed, source, schemaSettings, registry);
        continue;
      }

      if (parsed instanceof CommentOnStatement) {
        applyParsedCommentOn(parsed, schemaSettings, comments);
        continue;
      }

      if (parsed instanceof CreateIndexStatement) {
        applyCreateIndex(parsed, schemaSettings, registry);
        continue;
      }

      const w = {
        kind: 'UNSUPPORTED_DDL' as const,
        message: `Unsupported statement type: ${resolveConstructorName(parsed)}`,
        statementPreview: previewStatement(sql),
        source: { filePath: source.path, statementIndex: statementIndex + 1 },
      };
      console.warn(`  [WARN] ${w.kind}: ${w.message} (${w.source.filePath}#${w.source.statementIndex})`);
      warnings.push(w);
    }
  }

  applyCommentsToRegistry(registry, comments);
  applyTriggersToRegistry(registry, triggerAccumulator);
  const tables = finalizeTables(registry, options);
  inferSuggestedReferences(tables);
  resolveIncomingReferences(tables);

  return {
    tables,
    warnings: warnings.sort(sortWarnings),
  };
}

function applyCreateTable(
  query: CreateTableQuery,
  source: SqlSource,
  schemaSettings: ResolvedSchemaSettings,
  registry: Map<string, WorkingTable>
): void {
  const tableKey = buildTableKey(query.namespaces ?? [], query.tableName.name, schemaSettings);
  const table = registry.get(tableKey) ?? createWorkingTable(tableKey, source.instance);
  table.sourceFiles.add(source.path);

  const definition = createTableDefinitionFromCreateTableQuery(query);
  const definitionColumns = new Map(definition.columns.map((column) => [column.name, column]));

  for (const column of query.columns) {
    const definitionColumn = definitionColumns.get(column.name.name);
    const typeName = normalizeTypeName(column.dataType, definitionColumn?.typeName);
    const normalizedType = normalizePostgresType(typeName);
    const nullable = !column.constraints.some((constraint) => constraint.kind === 'not-null' || constraint.kind === 'primary-key');
    const defaultConstraint = column.constraints.find((constraint) => constraint.kind === 'default');
    const workingColumn: WorkingColumn = {
      ordinal: columnIndex(table, column.name.name),
      name: column.name.name,
      concept: normalizeIdentifier(column.name.name),
      conceptSlug: slugifyIdentifier(normalizeIdentifier(column.name.name)),
      typeName,
      canonicalType: normalizedType.canonicalType,
      typeKey: normalizedType.typeKey,
      unknownType: normalizedType.unknown,
      nullable,
      defaultValue: defaultConstraint?.defaultValue ? renderExpression(defaultConstraint.defaultValue) : '',
      isPrimaryKey: column.constraints.some((constraint) => constraint.kind === 'primary-key'),
      comment: '',
    };
    table.columns.set(workingColumn.name, workingColumn);

    applyColumnConstraints(table, tableKey, column.name.name, column.constraints, schemaSettings);
  }

  for (const constraint of query.tableConstraints) {
    applyTableConstraint(table, tableKey, constraint, schemaSettings);
  }

  table.constraints = dedupeConstraints(table.constraints);
  table.outgoingReferences = dedupeReferences(table.outgoingReferences);
  registry.set(tableKey, table);
}

function applyAlterTable(
  statement: AlterTableStatement,
  source: SqlSource,
  schemaSettings: ResolvedSchemaSettings,
  registry: Map<string, WorkingTable>
): void {
  const tableKey = buildTableKey(statement.table.namespaces ?? [], statement.table.name, schemaSettings);
  const table = registry.get(tableKey) ?? createWorkingTable(tableKey, source.instance);
  table.sourceFiles.add(source.path);

  for (const action of statement.actions) {
    if (action instanceof AlterTableAlterColumnDefault && action.setDefault !== null) {
      const columnName = normalizeIdentifier(action.columnName);
      const column = table.columns.get(columnName);
      if (column) {
        column.defaultValue = renderExpression(action.setDefault);
      }
      continue;
    }
    if (!(action instanceof AlterTableAddConstraint)) {
      continue;
    }
    applyTableConstraint(table, tableKey, action.constraint, schemaSettings);
  }

  table.constraints = dedupeConstraints(table.constraints);
  table.outgoingReferences = dedupeReferences(table.outgoingReferences);
  registry.set(tableKey, table);
}

function applyColumnConstraints(
  table: WorkingTable,
  tableKey: string,
  columnName: string,
  constraints: ColumnConstraintDefinition[],
  schemaSettings: ResolvedSchemaSettings
): void {
  for (const constraint of constraints) {
    if (constraint.kind === 'primary-key') {
      const column = table.columns.get(columnName);
      if (column) {
        column.isPrimaryKey = true;
        column.nullable = false;
      }
      table.constraints.push({
        kind: 'PK',
        name: constraint.constraintName?.name ?? '',
        expression: `${columnName}`,
      });
      continue;
    }

    if (constraint.kind === 'unique') {
      table.constraints.push({
        kind: 'UK',
        name: constraint.constraintName?.name ?? '',
        expression: `${columnName}`,
      });
      continue;
    }

    if (constraint.kind === 'check' && constraint.checkExpression) {
      table.constraints.push({
        kind: 'CHECK',
        name: constraint.constraintName?.name ?? '',
        expression: renderExpression(constraint.checkExpression),
      });
      continue;
    }

    if (constraint.kind === 'references' && constraint.reference) {
      const targetSchema = resolveTargetSchema(constraint.reference.targetTable.namespaces ?? [], schemaSettings);
      const targetTable = normalizeIdentifier(constraint.reference.targetTable.name);
      const targetColumns = (constraint.reference.columns ?? []).map((entry) => normalizeIdentifier(entry.name));
      const onDeleteAction = constraint.reference.onDelete ?? null;
      const onUpdateAction = constraint.reference.onUpdate ?? null;
      table.constraints.push({
        kind: 'FK',
        name: constraint.constraintName?.name ?? '',
        expression: formatReferenceExpression([columnName], `${targetSchema}.${targetTable}`, targetColumns, onDeleteAction, onUpdateAction),
      });
      table.outgoingReferences.push({
        fromTableKey: tableKey,
        fromColumns: [columnName],
        targetTableKey: `${targetSchema}.${targetTable}`,
        targetColumns,
        onDeleteAction,
        onUpdateAction,
      });
    }
  }
}

function applyTableConstraint(
  table: WorkingTable,
  tableKey: string,
  constraint: TableConstraintDefinition,
  schemaSettings: ResolvedSchemaSettings
): void {
  if (constraint.kind === 'primary-key') {
    for (const identifier of constraint.columns ?? []) {
      const column = table.columns.get(identifier.name);
      if (!column) {
        continue;
      }
      column.isPrimaryKey = true;
      column.nullable = false;
    }
    table.constraints.push({
      kind: 'PK',
      name: constraint.constraintName?.name ?? '',
      expression: (constraint.columns ?? []).map((entry) => entry.name).sort().join(', '),
    });
    return;
  }

  if (constraint.kind === 'unique') {
    table.constraints.push({
      kind: 'UK',
      name: constraint.constraintName?.name ?? '',
      expression: (constraint.columns ?? []).map((entry) => entry.name).sort().join(', '),
    });
    return;
  }

  if (constraint.kind === 'check' && constraint.checkExpression) {
    table.constraints.push({
      kind: 'CHECK',
      name: constraint.constraintName?.name ?? '',
      expression: renderExpression(constraint.checkExpression),
    });
    return;
  }

  if (constraint.kind === 'foreign-key' && constraint.reference) {
    const fromColumns = (constraint.columns ?? []).map((entry) => entry.name);
    const targetSchema = resolveTargetSchema(constraint.reference.targetTable.namespaces ?? [], schemaSettings);
    const targetTable = normalizeIdentifier(constraint.reference.targetTable.name);
    const targetColumns = (constraint.reference.columns ?? []).map((entry) => normalizeIdentifier(entry.name));
    const onDeleteAction = constraint.reference.onDelete ?? null;
    const onUpdateAction = constraint.reference.onUpdate ?? null;
    table.constraints.push({
      kind: 'FK',
      name: constraint.constraintName?.name ?? '',
      expression: formatReferenceExpression(fromColumns, `${targetSchema}.${targetTable}`, targetColumns, onDeleteAction, onUpdateAction),
    });
    table.outgoingReferences.push({
      fromTableKey: tableKey,
      fromColumns,
      targetTableKey: `${targetSchema}.${targetTable}`,
      targetColumns,
      onDeleteAction,
      onUpdateAction,
    });
  }
}

function createWorkingTable(tableKey: string, instance = ''): WorkingTable {
  const [schema, table] = tableKey.split('.');
  return {
    schema,
    table,
    schemaSlug: slugifyIdentifier(schema),
    tableSlug: slugifyIdentifier(table),
    instance,
    tableComment: '',
    sourceFiles: new Set<string>(),
    columns: new Map<string, WorkingColumn>(),
    constraints: [],
    triggers: [],
    outgoingReferences: [],
  };
}

function normalizeTypeName(dataType: TypeValue | RawString | undefined, fallbackType: string | undefined): string {
  if (dataType instanceof TypeValue) {
    return dataType.getTypeName();
  }
  if (dataType instanceof RawString) {
    return dataType.value;
  }
  return fallbackType ?? '';
}

function renderExpression(component: ValueComponent): string {
  return formatter.format(component).formattedSql.trim();
}

function applyCreateIndex(
  statement: CreateIndexStatement,
  schemaSettings: ResolvedSchemaSettings,
  registry: Map<string, WorkingTable>
): void {
  const tableKey = buildTableKey(statement.tableName.namespaces ?? [], statement.tableName.name, schemaSettings);
  const table = registry.get(tableKey);
  if (!table) {
    return;
  }
  const kind = statement.unique ? 'UK' : 'INDEX';
  const name = normalizeIdentifier(statement.indexName.name);
  const expression = statement.columns.map((col) => renderExpression(col.expression)).join(', ');
  table.constraints.push({ kind, name, expression, isIndex: true });
  table.constraints = dedupeConstraints(table.constraints);
}

/**
 * Parses a CREATE TRIGGER statement using regex and stores it in the accumulator.
 *
 * NOTE: This is an intentional exception to the design philosophy of this package,
 * which normally delegates all SQL parsing to the rawsql-ts core (SqlParser).
 * CREATE TRIGGER is not yet supported by the core parser, so regex is used here
 * as a pragmatic workaround. Once core support is added, this function should be
 * replaced with a proper SqlParser-based approach.
 */
function collectTrigger(
  sql: string,
  schemaSettings: ResolvedSchemaSettings,
  accumulator: TriggerAccumulator
): void {
  const normalized = sql.replace(/\s+/g, ' ').trim();

  const nameMatch = normalized.match(/\btrigger\s+"?(\w+)"?\s/i);
  if (!nameMatch) return;
  const name = nameMatch[1].toLowerCase();

  const timingMatch = normalized.match(/\b(before|after|instead\s+of)\b/i);
  const timing = timingMatch ? timingMatch[1].toUpperCase().replace(/\s+/g, ' ') : '';

  const onMatch = normalized.match(/\bon\s+([\w."]+(?:\.[\w."]+)*)/i);
  if (!onMatch) return;
  const rawTableRef = onMatch[1].replace(/"/g, '').toLowerCase();
  const parts = rawTableRef.split('.');
  const tableKey =
    parts.length >= 2
      ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}`
      : `${schemaSettings.defaultSchema}.${parts[0]}`;

  const eventsMatch = normalized.match(/\b(?:before|after|instead\s+of)\b\s+(.*?)\s+\bon\b/i);
  const events: string[] = [];
  if (eventsMatch) {
    const eventsStr = eventsMatch[1];
    if (/\binsert\b/i.test(eventsStr)) events.push('INSERT');
    if (/\bupdate\b/i.test(eventsStr)) events.push('UPDATE');
    if (/\bdelete\b/i.test(eventsStr)) events.push('DELETE');
    if (/\btruncate\b/i.test(eventsStr)) events.push('TRUNCATE');
  }

  const forEachMatch = normalized.match(/\bfor\s+(?:each\s+)?(row|statement)\b/i);
  const forEach = forEachMatch ? forEachMatch[1].toUpperCase() : 'ROW';

  const funcMatch = normalized.match(/\bexecute\s+(?:function|procedure)\s+([\w."]+(?:\.[\w."]+)*\s*\([^)]*\))/i);
  const functionName = funcMatch ? funcMatch[1].replace(/"/g, '').toLowerCase().replace(/\s+/g, '') : '';

  const rawSql = normalized.endsWith(';') ? normalized : `${normalized};`;
  accumulator.items.push({ tableKey, trigger: { name, timing, events, forEach, functionName, rawSql } });
}

function applyTriggersToRegistry(
  registry: Map<string, WorkingTable>,
  accumulator: TriggerAccumulator
): void {
  for (const { tableKey, trigger } of accumulator.items) {
    const table = registry.get(tableKey);
    if (!table) continue;
    const already = table.triggers.some((t) => t.name === trigger.name);
    if (!already) {
      table.triggers.push(trigger);
    }
  }
}

function buildTableKey(
  namespaces: Array<string | { name: string }>,
  tableName: string | { name: string } | { value: string },
  schemaSettings: ResolvedSchemaSettings
): string {
  const normalizedTable = normalizeIdentifier(tableName);
  if (namespaces.length > 0) {
    const schema = normalizeIdentifier(namespaces[namespaces.length - 1]);
    return `${schema}.${normalizedTable}`;
  }
  return `${schemaSettings.defaultSchema}.${normalizedTable}`;
}

function normalizeIdentifier(value: string | { name: string } | { value: string }): string {
  const token = typeof value === 'string' ? value : 'name' in value ? value.name : value.value;
  return token.replace(/^"|"$/g, '').toLowerCase();
}

function resolveTargetSchema(namespaces: Array<string | { name: string }>, schemaSettings: ResolvedSchemaSettings): string {
  if (!namespaces || namespaces.length === 0) {
    return schemaSettings.defaultSchema;
  }
  return normalizeIdentifier(namespaces[namespaces.length - 1]);
}

function applyParsedCommentOn(
  statement: CommentOnStatement,
  schemaSettings: ResolvedSchemaSettings,
  comments: CommentAccumulator
): void {
  const commentText = statement.comment !== null
    ? parseCommentLiteral(renderExpression(statement.comment))
    : null;
  if (commentText === null) return;

  const namespaces = statement.target.namespaces ?? [];
  const name = normalizeIdentifier(statement.target.name);

  if (statement.targetKind === 'table') {
    const schema = namespaces.length > 0
      ? normalizeIdentifier(namespaces[namespaces.length - 1])
      : schemaSettings.defaultSchema;
    comments.tableComments.set(`${schema}.${name}`, commentText);
  } else {
    // column: namespaces = [schema, table] or [table]
    if (namespaces.length >= 2) {
      const schema = normalizeIdentifier(namespaces[namespaces.length - 2]);
      const table = normalizeIdentifier(namespaces[namespaces.length - 1]);
      comments.columnComments.set(`${schema}.${table}.${name}`, commentText);
    } else if (namespaces.length === 1) {
      const table = normalizeIdentifier(namespaces[0]);
      comments.columnComments.set(`${schemaSettings.defaultSchema}.${table}.${name}`, commentText);
    }
  }
}

/** Returns true if the lowercase COMMENT ON statement targets an object type we don't track. */
function isUnsupportedCommentOnTarget(lower: string): boolean {
  return (
    lower.startsWith('comment on constraint ') ||
    lower.startsWith('comment on view ') ||
    lower.startsWith('comment on materialized view ') ||
    lower.startsWith('comment on index ') ||
    lower.startsWith('comment on sequence ') ||
    lower.startsWith('comment on function ') ||
    lower.startsWith('comment on procedure ') ||
    lower.startsWith('comment on type ') ||
    lower.startsWith('comment on schema ') ||
    lower.startsWith('comment on extension ')
  );
}

function applyCommentStatement(
  sql: string,
  schemaSettings: ResolvedSchemaSettings,
  comments: CommentAccumulator
): 'handled' | 'ignored' | 'ambiguous' {
  const normalized = sql.trim();
  const lower = normalized.toLowerCase();

  if (!lower.startsWith('comment on ')) {
    // The SQL may have pg_dump section-header comments (-- -- Name: ...) prepended.
    // Strip them to detect the actual statement type, but only for classification.
    // TABLE/COLUMN handling is left to SqlParser (via the 'ignored' return path) so
    // that multi-line comment values and keyword column names are handled correctly.
    const strippedLower = normalized.replace(/^(?:--[^\n]*\n)+/g, '').trim().toLowerCase();
    if (!strippedLower.startsWith('comment on ')) {
      return 'ignored';
    }
    // Silently skip COMMENT ON for object types we don't track in table docs.
    if (isUnsupportedCommentOnTarget(strippedLower)) {
      return 'handled';
    }
    // TABLE/COLUMN COMMENT with pg_dump headers → let SqlParser handle it.
    return 'ignored';
  }

  // Direct COMMENT ON (no pg_dump headers).
  // Silently skip unsupported object types.
  if (isUnsupportedCommentOnTarget(lower)) {
    return 'handled';
  }

  const tableMatch = normalized.match(/^comment\s+on\s+table\s+(.+?)\s+is\s+(.+?);?$/i);
  if (tableMatch) {
    const parsedComment = parseCommentLiteral(tableMatch[2]);
    if (parsedComment === null) {
      return 'handled';
    }
    const target = parseTableTarget(tableMatch[1], schemaSettings);
    comments.tableComments.set(target, parsedComment);
    return 'handled';
  }

  const columnMatch = normalized.match(/^comment\s+on\s+column\s+(.+?)\s+is\s+(.+?);?$/i);
  if (!columnMatch) {
    return 'ambiguous';
  }
  const parsedComment = parseCommentLiteral(columnMatch[2]);
  if (parsedComment === null) {
    return 'handled';
  }
  const target = parseColumnTarget(columnMatch[1], schemaSettings);
  if (!target) {
    return 'ambiguous';
  }
  comments.columnComments.set(target, parsedComment);
  return 'handled';
}

function parseCommentLiteral(rawValue: string): string | null {
  const trimmed = rawValue.trim().replace(/;$/, '');
  if (/^null$/i.test(trimmed)) {
    return null;
  }
  if (!trimmed.startsWith("'") || !trimmed.endsWith("'")) {
    return trimmed;
  }
  const body = trimmed.slice(1, -1);
  return body.replace(/''/g, "'");
}

function parseTableTarget(rawTarget: string, schemaSettings: ResolvedSchemaSettings): string {
  const parts = parseQualifiedParts(rawTarget);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  }
  return `${schemaSettings.defaultSchema}.${parts[0] ?? 'unknown'}`;
}

function parseColumnTarget(rawTarget: string, schemaSettings: ResolvedSchemaSettings): string | null {
  const parts = parseQualifiedParts(rawTarget);
  if (parts.length < 2) {
    return null;
  }
  if (parts.length >= 3) {
    return `${parts[parts.length - 3]}.${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  }
  return `${schemaSettings.defaultSchema}.${parts[0]}.${parts[1]}`;
}

function parseQualifiedParts(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (char === '.' && !inQuote) {
      if (current.trim().length > 0) {
        parts.push(normalizeIdentifier(current.trim()));
      }
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim().length > 0) {
    parts.push(normalizeIdentifier(current.trim()));
  }
  return parts;
}

function applyCommentsToRegistry(registry: Map<string, WorkingTable>, comments: CommentAccumulator): void {
  for (const [tableKey, comment] of comments.tableComments.entries()) {
    const table = registry.get(tableKey);
    if (!table) {
      continue;
    }
    table.tableComment = comment;
  }

  for (const [columnKey, comment] of comments.columnComments.entries()) {
    const [schema, tableName, columnName] = columnKey.split('.');
    if (!schema || !tableName || !columnName) {
      continue;
    }
    const table = registry.get(`${schema}.${tableName}`);
    if (!table) {
      continue;
    }
    const column = table.columns.get(columnName);
    if (!column) {
      continue;
    }
    column.comment = comment;
  }
}

function finalizeTables(registry: Map<string, WorkingTable>, options: SnapshotOptions): TableDocModel[] {
  return Array.from(registry.values())
    .map((entry) => {
      const columns = Array.from(entry.columns.values())
        .sort((a, b) => sortColumns(a, b, options.columnOrder))
        .map(
          (column): ColumnDocModel => ({
            name: column.name,
            concept: column.concept,
            conceptSlug: column.conceptSlug,
            typeName: column.typeName,
            canonicalType: column.canonicalType,
            typeKey: column.typeKey,
            nullable: column.nullable,
            defaultValue: column.defaultValue,
            isPrimaryKey: column.isPrimaryKey,
            comment: column.comment,
            checks: [],
            unknownType: column.unknownType,
          })
        );

      const primaryKey = columns.filter((column) => column.isPrimaryKey).map((column) => column.name).sort();
      const outgoingReferences = entry.outgoingReferences
        .map(
          (reference): ReferenceDocModel => ({
            direction: 'outgoing',
            source: 'ddl',
            fromTableKey: reference.fromTableKey,
            fromTableComment: registry.get(reference.fromTableKey)?.tableComment ?? '',
            targetTableKey: reference.targetTableKey,
            targetTableComment: registry.get(reference.targetTableKey)?.tableComment ?? '',
            fromColumns: [...reference.fromColumns],
            targetColumns: [...reference.targetColumns],
            onDeleteAction: reference.onDeleteAction,
            onUpdateAction: reference.onUpdateAction,
            fromSchemaSlug: slugifyIdentifier(reference.fromTableKey.split('.')[0] ?? ''),
            fromTableSlug: slugifyIdentifier(reference.fromTableKey.split('.')[1] ?? ''),
            targetSchemaSlug: slugifyIdentifier(reference.targetTableKey.split('.')[0] ?? ''),
            targetTableSlug: slugifyIdentifier(reference.targetTableKey.split('.')[1] ?? ''),
            expression: formatReferenceExpression(reference.fromColumns, reference.targetTableKey, reference.targetColumns),
          })
        )
        .sort(sortReferences);

      return {
        schema: entry.schema,
        table: entry.table,
        schemaSlug: entry.schemaSlug,
        tableSlug: entry.tableSlug,
        instance: entry.instance,
        tableComment: entry.tableComment,
        sourceFiles: Array.from(entry.sourceFiles).sort(),
        columns,
        primaryKey,
        constraints: [...entry.constraints].sort(sortConstraints),
        triggers: [...entry.triggers].sort((a, b) => a.name.localeCompare(b.name)),
        outgoingReferences,
        incomingReferences: [],
        normalizedSql: buildNormalizedSql(entry, columns),
      } satisfies TableDocModel;
    })
    .sort((a, b) => `${a.schema}.${a.table}`.localeCompare(`${b.schema}.${b.table}`));
}

function sortColumns(left: WorkingColumn, right: WorkingColumn, mode: 'definition' | 'name'): number {
  if (mode === 'name') {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }
  }
  return left.ordinal - right.ordinal;
}

function columnIndex(table: WorkingTable, columnName: string): number {
  const existing = table.columns.get(columnName);
  if (existing) {
    return existing.ordinal;
  }
  return table.columns.size;
}

function buildNormalizedSql(entry: WorkingTable, columns: ColumnDocModel[]): NormalizedSql {
  // --- Definition block: CREATE TABLE + ALTER TABLE constraints + CREATE [UNIQUE] INDEX ---
  const defStatements: string[] = [];
  const columnLines = columns.map((column) => {
    const segments = [`  ${column.name} ${column.typeName || 'text'}`];
    if (!column.nullable) {
      segments.push('NOT NULL');
    }
    if (column.defaultValue.trim()) {
      segments.push(`DEFAULT ${column.defaultValue}`);
    }
    return segments.join(' ');
  });
  defStatements.push(`CREATE TABLE ${entry.schema}.${entry.table} (\n${columnLines.join(',\n')}\n);`);

  const constraints = [...entry.constraints].sort(sortConstraints);
  for (const constraint of constraints) {
    const prefix = constraint.name ? `CONSTRAINT ${constraint.name} ` : '';
    if (constraint.kind === 'PK') {
      defStatements.push(`ALTER TABLE ${entry.schema}.${entry.table} ADD ${prefix}PRIMARY KEY (${constraint.expression});`);
      continue;
    }
    if (constraint.kind === 'UK' && !constraint.isIndex) {
      defStatements.push(`ALTER TABLE ${entry.schema}.${entry.table} ADD ${prefix}UNIQUE (${constraint.expression});`);
      continue;
    }
    if (constraint.kind === 'UK' && constraint.isIndex) {
      defStatements.push(`CREATE UNIQUE INDEX ${constraint.name} ON ${entry.schema}.${entry.table} (${constraint.expression});`);
      continue;
    }
    if (constraint.kind === 'CHECK') {
      defStatements.push(`ALTER TABLE ${entry.schema}.${entry.table} ADD ${prefix}CHECK (${constraint.expression});`);
      continue;
    }
    if (constraint.kind === 'FK') {
      const [left, right] = constraint.expression.split('->').map((part) => part.trim());
      if (left && right) {
        defStatements.push(`ALTER TABLE ${entry.schema}.${entry.table} ADD ${prefix}FOREIGN KEY (${left}) REFERENCES ${right};`);
      }
      continue;
    }
    if (constraint.kind === 'INDEX') {
      defStatements.push(`CREATE INDEX ${constraint.name} ON ${entry.schema}.${entry.table} (${constraint.expression});`);
      continue;
    }
  }

  const defLines: string[] = ['-- normalized: v1 dialect=postgres'];
  for (const statement of defStatements) {
    const formattedStatement = formatNormalizedStatement(statement);
    if (formattedStatement) {
      defLines.push(formattedStatement);
    }
  }

  // --- Comments block: COMMENT ON TABLE + COMMENT ON COLUMN ---
  const commentStatements: string[] = [];
  if (entry.tableComment.trim()) {
    commentStatements.push(`COMMENT ON TABLE ${entry.schema}.${entry.table} IS '${entry.tableComment.replace(/'/g, "''")}';`);
  }
  for (const column of columns) {
    if (!column.comment.trim()) {
      continue;
    }
    commentStatements.push(
      `COMMENT ON COLUMN ${entry.schema}.${entry.table}.${column.name} IS '${column.comment.replace(/'/g, "''")}';`
    );
  }
  let comments = '';
  if (commentStatements.length > 0) {
    const commentLines: string[] = ['-- normalized: v1 dialect=postgres'];
    for (const statement of commentStatements) {
      const formattedStatement = formatNormalizedStatement(statement);
      if (formattedStatement) {
        commentLines.push(formattedStatement);
      }
    }
    comments = commentLines.join('\n');
  }

  // --- Triggers block: raw CREATE TRIGGER statements (not normalized) ---
  let triggers = '';
  if (entry.triggers.length > 0) {
    const triggerLines: string[] = ['-- raw (not normalized)'];
    for (const trigger of entry.triggers) {
      triggerLines.push(trigger.rawSql);
    }
    triggers = triggerLines.join('\n');
  }

  return {
    definition: defLines.join('\n'),
    comments,
    triggers,
  };
}

function formatNormalizedStatement(statement: string): string {
  const trimmed = statement.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const parsed = SqlParser.parse(trimmed);
    const formatted = formatter.format(parsed).formattedSql.trim().replace(/;$/, '');
    return `${formatted};`;
  } catch {
    return trimmed.endsWith(';') ? trimmed : `${trimmed};`;
  }
}

function resolveIncomingReferences(tables: TableDocModel[]): void {
  const incomingMap = new Map<string, ReferenceDocModel[]>();
  for (const table of tables) {
    for (const outgoing of table.outgoingReferences) {
      const incoming = incomingMap.get(outgoing.targetTableKey) ?? [];
      incoming.push({
        direction: 'incoming',
        source: outgoing.source,
        fromTableKey: outgoing.fromTableKey,
        fromTableComment: outgoing.fromTableComment,
        targetTableKey: outgoing.targetTableKey,
        targetTableComment: outgoing.targetTableComment,
        fromColumns: [...outgoing.fromColumns],
        targetColumns: [...outgoing.targetColumns],
        onDeleteAction: outgoing.onDeleteAction,
        onUpdateAction: outgoing.onUpdateAction,
        fromSchemaSlug: outgoing.fromSchemaSlug,
        fromTableSlug: outgoing.fromTableSlug,
        targetSchemaSlug: outgoing.targetSchemaSlug,
        targetTableSlug: outgoing.targetTableSlug,
        matchRule: outgoing.matchRule,
        expression: `${outgoing.fromTableKey}: ${formatReferenceExpression(
          outgoing.fromColumns,
          outgoing.targetTableKey,
          outgoing.targetColumns
        )}`,
      });
      incomingMap.set(outgoing.targetTableKey, incoming);
    }
  }

  for (const table of tables) {
    table.incomingReferences = (incomingMap.get(`${table.schema}.${table.table}`) ?? []).sort(sortReferences);
  }
}

function inferSuggestedReferences(tables: TableDocModel[]): void {
  const tableByKey = new Map(tables.map((table) => [`${table.schema}.${table.table}`, table]));
  const definedKeys = new Set<string>();
  for (const table of tables) {
    for (const reference of table.outgoingReferences) {
      if (reference.source !== 'ddl') {
        continue;
      }
      definedKeys.add(referenceIdentity(reference.fromTableKey, reference.fromColumns, reference.targetTableKey, reference.targetColumns));
    }
  }

  const pkTargets = tables
    .filter((table) => table.primaryKey.length === 1)
    .map((table) => ({
      tableKey: `${table.schema}.${table.table}`,
      pkColumn: table.primaryKey[0],
      schemaSlug: table.schemaSlug,
      tableSlug: table.tableSlug,
      instance: table.instance,
    }))
    .sort((a, b) => `${a.tableKey}|${a.pkColumn}`.localeCompare(`${b.tableKey}|${b.pkColumn}`));

  for (const table of tables) {
    const fromTableKey = `${table.schema}.${table.table}`;
    for (const column of table.columns) {
      if (column.isPrimaryKey) {
        continue;
      }
      for (const target of pkTargets) {
        if (column.name !== target.pkColumn) {
          continue;
        }
        // Skip cross-instance suggestions: tables from different DB instances
        // should not be suggested as FK candidates.
        if (table.instance && target.instance && table.instance !== target.instance) {
          continue;
        }
        const identity = referenceIdentity(fromTableKey, [column.name], target.tableKey, [target.pkColumn]);
        if (definedKeys.has(identity)) {
          continue;
        }
        if (tableByKey.get(target.tableKey) == null) {
          continue;
        }
        const suggested: ReferenceDocModel = {
          direction: 'outgoing',
          source: 'suggested',
          fromTableKey,
          fromTableComment: tableByKey.get(fromTableKey)?.tableComment ?? '',
          targetTableKey: target.tableKey,
          targetTableComment: tableByKey.get(target.tableKey)?.tableComment ?? '',
          fromColumns: [column.name],
          targetColumns: [target.pkColumn],
          onDeleteAction: null,
          onUpdateAction: null,
          fromSchemaSlug: table.schemaSlug,
          fromTableSlug: table.tableSlug,
          targetSchemaSlug: target.schemaSlug,
          targetTableSlug: target.tableSlug,
          matchRule: 'exact',
          expression: formatReferenceExpression([column.name], target.tableKey, [target.pkColumn]),
        };
        table.outgoingReferences.push(suggested);
      }
    }
    table.outgoingReferences = dedupeDocReferences(table.outgoingReferences).sort(sortReferences);
  }
}

function dedupeDocReferences(references: ReferenceDocModel[]): ReferenceDocModel[] {
  const map = new Map<string, ReferenceDocModel>();
  for (const reference of references) {
    const key = `${reference.source}|${reference.fromTableKey}|${reference.fromColumns.join(',')}|${reference.targetTableKey}|${reference.targetColumns.join(',')}|${reference.onDeleteAction ?? ''}|${reference.onUpdateAction ?? ''}`;
    map.set(key, reference);
  }
  return Array.from(map.values());
}

function referenceIdentity(fromTableKey: string, fromColumns: string[], targetTableKey: string, targetColumns: string[]): string {
  return `${fromTableKey}|${fromColumns.join(',')}|${targetTableKey}|${targetColumns.join(',')}`;
}

function formatReferenceExpression(
  fromColumns: string[],
  targetTableKey: string,
  targetColumns: string[],
  onDeleteAction: 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default' | null = null,
  onUpdateAction: 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default' | null = null
): string {
  const clauses: string[] = [];
  if (onDeleteAction) {
    clauses.push(`ON DELETE ${onDeleteAction.toUpperCase()}`);
  }
  if (onUpdateAction) {
    clauses.push(`ON UPDATE ${onUpdateAction.toUpperCase()}`);
  }
  const actionSuffix = clauses.length > 0 ? ` ${clauses.join(' ')}` : '';
  return `${fromColumns.join(', ')} -> ${targetTableKey}(${targetColumns.join(', ') || '?'})${actionSuffix}`;
}

function dedupeConstraints(constraints: TableConstraintDocModel[]): TableConstraintDocModel[] {
  const map = new Map<string, TableConstraintDocModel>();
  for (const constraint of constraints) {
    const key = `${constraint.kind}|${constraint.name}|${constraint.expression}`;
    map.set(key, constraint);
  }
  return Array.from(map.values()).sort(sortConstraints);
}

function dedupeReferences(references: OutgoingReference[]): OutgoingReference[] {
  const map = new Map<string, OutgoingReference>();
  for (const reference of references) {
    const key = `${reference.fromTableKey}|${reference.fromColumns.join(',')}|${reference.targetTableKey}|${reference.targetColumns.join(',')}|${reference.onDeleteAction ?? ''}|${reference.onUpdateAction ?? ''}`;
    map.set(key, reference);
  }
  return Array.from(map.values()).sort((a, b) => {
    const left = `${a.fromTableKey}|${a.fromColumns.join(',')}|${a.targetTableKey}|${a.targetColumns.join(',')}|${a.onDeleteAction ?? ''}|${a.onUpdateAction ?? ''}`;
    const right = `${b.fromTableKey}|${b.fromColumns.join(',')}|${b.targetTableKey}|${b.targetColumns.join(',')}|${b.onDeleteAction ?? ''}|${b.onUpdateAction ?? ''}`;
    return left.localeCompare(right);
  });
}

function sortConstraints(left: TableConstraintDocModel, right: TableConstraintDocModel): number {
  return `${left.kind}|${left.name}|${left.expression}`.localeCompare(`${right.kind}|${right.name}|${right.expression}`);
}

function sortWarnings(left: WarningItem, right: WarningItem): number {
  const leftKey = `${left.source.filePath}|${left.source.statementIndex ?? 0}|${left.kind}|${left.message}`;
  const rightKey = `${right.source.filePath}|${right.source.statementIndex ?? 0}|${right.kind}|${right.message}`;
  return leftKey.localeCompare(rightKey);
}

function sortReferences(left: ReferenceDocModel, right: ReferenceDocModel): number {
  const leftOther = left.direction === 'outgoing' ? left.targetTableKey : left.fromTableKey;
  const rightOther = right.direction === 'outgoing' ? right.targetTableKey : right.fromTableKey;
  return `${left.direction}|${leftOther}`.localeCompare(`${right.direction}|${rightOther}`);
}

function previewStatement(sql: string): string {
  const compact = sql.replace(/\s+/g, ' ').trim();
  return compact.length > 200 ? `${compact.slice(0, 200)}...` : compact;
}

function resolveConstructorName(value: unknown): string {
  if (value && typeof value === 'object' && 'constructor' in value) {
    const ctor = (value as { constructor?: { name?: string } }).constructor;
    return ctor?.name ?? 'Unknown';
  }
  return typeof value;
}
