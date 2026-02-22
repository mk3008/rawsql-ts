import {
  AlterTableAddConstraint,
  AlterTableStatement,
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
  ReferenceDocModel,
  ResolvedSchemaSettings,
  SnapshotResult,
  SqlSource,
  TableConstraintDocModel,
  TableDocModel,
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
  tableComment: string;
  sourceFiles: Set<string>;
  columns: Map<string, WorkingColumn>;
  constraints: TableConstraintDocModel[];
  outgoingReferences: OutgoingReference[];
}

interface CommentAccumulator {
  tableComments: Map<string, string>;
  columnComments: Map<string, string>;
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
  const warnings: WarningItem[] = [];

  for (const source of sources) {
    const statements = MultiQuerySplitter.split(source.sql).queries;
    for (let statementIndex = 0; statementIndex < statements.length; statementIndex += 1) {
      const statement = statements[statementIndex];
      if (statement.isEmpty) {
        continue;
      }
      const sql = statement.sql.trim();
      if (!sql) {
        continue;
      }

      const commentState = applyCommentStatement(sql, schemaSettings, comments);
      if (commentState === 'handled') {
        continue;
      }
      if (commentState === 'ambiguous') {
        warnings.push({
          kind: 'AMBIGUOUS',
          message: 'COMMENT ON statement could not be fully resolved.',
          statementPreview: previewStatement(sql),
          source: { filePath: source.path, statementIndex: statementIndex + 1 },
        });
        continue;
      }

      let parsed: unknown;
      try {
        parsed = SqlParser.parse(sql);
      } catch (error) {
        warnings.push({
          kind: 'PARSE_FAILED',
          message: error instanceof Error ? error.message : String(error),
          statementPreview: previewStatement(sql),
          source: { filePath: source.path, statementIndex: statementIndex + 1 },
        });
        continue;
      }

      if (parsed instanceof CreateTableQuery) {
        applyCreateTable(parsed, source.path, schemaSettings, registry);
        continue;
      }

      if (parsed instanceof AlterTableStatement) {
        applyAlterTable(parsed, source.path, schemaSettings, registry);
        continue;
      }

      warnings.push({
        kind: 'UNSUPPORTED_DDL',
        message: `Unsupported statement type: ${resolveConstructorName(parsed)}`,
        statementPreview: previewStatement(sql),
        source: { filePath: source.path, statementIndex: statementIndex + 1 },
      });
    }
  }

  applyCommentsToRegistry(registry, comments);
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
  sourcePath: string,
  schemaSettings: ResolvedSchemaSettings,
  registry: Map<string, WorkingTable>
): void {
  const tableKey = buildTableKey(query.namespaces ?? [], query.tableName.name, schemaSettings);
  const table = registry.get(tableKey) ?? createWorkingTable(tableKey);
  table.sourceFiles.add(sourcePath);

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
  sourcePath: string,
  schemaSettings: ResolvedSchemaSettings,
  registry: Map<string, WorkingTable>
): void {
  const tableKey = buildTableKey(statement.table.namespaces ?? [], statement.table.name, schemaSettings);
  const table = registry.get(tableKey) ?? createWorkingTable(tableKey);
  table.sourceFiles.add(sourcePath);

  for (const action of statement.actions) {
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

function createWorkingTable(tableKey: string): WorkingTable {
  const [schema, table] = tableKey.split('.');
  return {
    schema,
    table,
    schemaSlug: slugifyIdentifier(schema),
    tableSlug: slugifyIdentifier(table),
    tableComment: '',
    sourceFiles: new Set<string>(),
    columns: new Map<string, WorkingColumn>(),
    constraints: [],
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

function applyCommentStatement(
  sql: string,
  schemaSettings: ResolvedSchemaSettings,
  comments: CommentAccumulator
): 'handled' | 'ignored' | 'ambiguous' {
  const normalized = sql.trim();
  const lower = normalized.toLowerCase();
  if (!lower.startsWith('comment on ')) {
    return 'ignored';
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
            targetTableKey: reference.targetTableKey,
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
        tableComment: entry.tableComment,
        sourceFiles: Array.from(entry.sourceFiles).sort(),
        columns,
        primaryKey,
        constraints: [...entry.constraints].sort(sortConstraints),
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

function buildNormalizedSql(entry: WorkingTable, columns: ColumnDocModel[]): string {
  const statements: string[] = [];
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
  statements.push(`CREATE TABLE ${entry.schema}.${entry.table} (\n${columnLines.join(',\n')}\n);`);

  const constraints = [...entry.constraints].sort(sortConstraints);
  for (const constraint of constraints) {
    const prefix = constraint.name ? `CONSTRAINT ${constraint.name} ` : '';
    if (constraint.kind === 'PK') {
      statements.push(`ALTER TABLE ${entry.schema}.${entry.table} ADD ${prefix}PRIMARY KEY (${constraint.expression});`);
      continue;
    }
    if (constraint.kind === 'UK') {
      statements.push(`ALTER TABLE ${entry.schema}.${entry.table} ADD ${prefix}UNIQUE (${constraint.expression});`);
      continue;
    }
    if (constraint.kind === 'CHECK') {
      statements.push(`ALTER TABLE ${entry.schema}.${entry.table} ADD ${prefix}CHECK (${constraint.expression});`);
      continue;
    }
    if (constraint.kind === 'FK') {
      const [left, right] = constraint.expression.split('->').map((part) => part.trim());
      if (left && right) {
        statements.push(`ALTER TABLE ${entry.schema}.${entry.table} ADD ${prefix}FOREIGN KEY (${left}) REFERENCES ${right};`);
      }
    }
  }

  if (entry.tableComment.trim()) {
    statements.push(`COMMENT ON TABLE ${entry.schema}.${entry.table} IS '${entry.tableComment.replace(/'/g, "''")}';`);
  }
  for (const column of columns) {
    if (!column.comment.trim()) {
      continue;
    }
    statements.push(
      `COMMENT ON COLUMN ${entry.schema}.${entry.table}.${column.name} IS '${column.comment.replace(/'/g, "''")}';`
    );
  }

  const lines: string[] = ['-- normalized: v1 dialect=postgres'];
  for (const statement of statements) {
    const formattedStatement = formatNormalizedStatement(statement);
    if (formattedStatement) {
      lines.push(formattedStatement);
    }
  }
  return lines.join('\n');
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
        targetTableKey: outgoing.targetTableKey,
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
          targetTableKey: target.tableKey,
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
  return `${left.source}|${left.fromTableKey}|${left.targetTableKey}|${left.expression}`.localeCompare(
    `${right.source}|${right.fromTableKey}|${right.targetTableKey}|${right.expression}`
  );
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
