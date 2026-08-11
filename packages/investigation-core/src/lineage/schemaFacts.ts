import {
  AlterTableAddColumn,
  AlterTableAddConstraint,
  AlterTableStatement,
  ColumnReference,
  CreateIndexStatement,
  CreateTableQuery,
  SqlFormatter,
  SqlParser,
  splitQueries,
} from 'rawsql-ts';
import type {
  ColumnConstraintDefinition,
  QualifiedName,
  SqlFormatterOptions,
  TableColumnDefinition,
  TableConstraintDefinition,
} from 'rawsql-ts';

export interface SchemaFacts {
  diagnostics?: SchemaFactsDiagnostic[];
  kind: 'schema-facts';
  tables: Record<string, SchemaTableFacts>;
  version: 1;
}

export interface SchemaTableFacts {
  columns: Record<string, SchemaColumnFacts>;
  /**
   * Caller-declared relationships for legacy schemas that lack a physical FK.
   * Fixture extraction accepts them only when the declaration is explicitly
   * marked reviewed and the referenced columns form a known unique key.
   */
  declaredLogicalForeignKeys?: SchemaDeclaredLogicalForeignKeyFacts[];
  foreignKeys?: SchemaForeignKeyFacts[];
  name: string;
  primaryKey?: string[];
  schemaName?: string;
  uniqueKeys?: string[][];
}

export interface SchemaColumnFacts {
  defaultSql?: string;
  name: string;
  nullable?: boolean;
  type?: string;
}

export interface SchemaForeignKeyFacts {
  columns: string[];
  refColumns: string[];
  refTable: string;
}

export interface SchemaDeclaredLogicalForeignKeyFacts extends SchemaForeignKeyFacts {
  readonly reviewed: true;
}

export interface SchemaFactsDiagnostic {
  code: string;
  filePath?: string;
  message: string;
  severity: 'error' | 'info' | 'warning';
}

export interface DdlInput {
  filePath?: string;
  sql: string;
}

const ddlFormatterOptions: SqlFormatterOptions = {
  exportComment: 'none',
  identifierEscape: 'none',
  identifierEscapeTarget: 'minimal',
  keywordCase: 'lower',
  newline: 'lf',
};
const ddlFormatter = new SqlFormatter(ddlFormatterOptions);

export function parseSchemaFactsFromDdl(inputs: DdlInput[]): SchemaFacts {
  const facts: SchemaFacts = { diagnostics: [], kind: 'schema-facts', tables: {}, version: 1 };
  for (const input of inputs) {
    const queries = splitDdlQueries(input);
    for (const query of queries) {
      applyDdlStatement(facts, query.sql, input.filePath);
    }
  }
  return normalizeSchemaFacts(facts);
}

export function createTableColumnResolver(schemaFacts: SchemaFacts): (tableName: string) => string[] {
  return (tableName: string) => {
    const table = resolveTableFacts(schemaFacts, tableName);
    return table ? Object.keys(table.columns) : [];
  };
}

export function resolveTableFacts(schemaFacts: SchemaFacts | undefined, tableName: string): SchemaTableFacts | undefined {
  if (!schemaFacts) {
    return undefined;
  }
  const normalized = normalizeName(tableName);
  return schemaFacts.tables[normalized]
    ?? Object.values(schemaFacts.tables).find((table) => normalizeName(table.name) === normalized)
    ?? Object.values(schemaFacts.tables).find((table) => normalizeName(`${table.schemaName ?? ''}.${table.name}`) === normalized);
}

export function isUniqueKey(schemaFacts: SchemaFacts | undefined, tableName: string, columns: string[]): boolean {
  const table = resolveTableFacts(schemaFacts, tableName);
  if (!table) {
    return false;
  }
  const normalizedColumns = normalizeColumnSet(columns);
  return [table.primaryKey, ...(table.uniqueKeys ?? [])]
    .filter((key): key is string[] => Array.isArray(key))
    .some((key) => sameColumnSet(normalizeColumnSet(key), normalizedColumns));
}

function splitDdlQueries(input: DdlInput): DdlInput[] {
  try {
    const collection = splitQueries(input.sql);
    const queries = Array.isArray(collection)
      ? collection
      : 'queries' in collection && Array.isArray(collection.queries)
        ? collection.queries
        : [];
    if (queries.length > 0) {
      return queries
        .map((query) => ({
          filePath: input.filePath,
          sql: typeof query === 'string' ? query : 'sql' in query ? String(query.sql) : String(query),
        }))
        .filter((query) => query.sql.trim().length > 0);
    }
  } catch {
    // Fall back to a simple semicolon split below and let statement parsing report warnings.
  }

  return input.sql
    .split(';')
    .map((sql) => sql.trim())
    .filter(Boolean)
    .map((sql) => ({ filePath: input.filePath, sql }));
}

function applyDdlStatement(facts: SchemaFacts, sql: string, filePath?: string): void {
  let statement: unknown;
  try {
    statement = SqlParser.parse(sql);
  } catch (error) {
    facts.diagnostics?.push({
      code: 'ddl_parse_warning',
      filePath,
      message: `Some DDL statements could not be parsed and were skipped: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'warning',
    });
    return;
  }

  if (statement instanceof CreateTableQuery) {
    mergeCreateTable(facts, statement);
    return;
  }
  if (statement instanceof CreateIndexStatement) {
    mergeCreateIndex(facts, statement);
    return;
  }
  if (statement instanceof AlterTableStatement) {
    mergeAlterTable(facts, statement);
  }
}

function mergeCreateTable(facts: SchemaFacts, statement: CreateTableQuery): void {
  const table = ensureTable(facts, statement.namespaces?.join('.'), statement.tableName.name);
  for (const column of statement.columns) {
    mergeColumn(table, column);
  }
  for (const constraint of statement.tableConstraints) {
    mergeTableConstraint(table, constraint);
  }
}

function mergeCreateIndex(facts: SchemaFacts, statement: CreateIndexStatement): void {
  if (!statement.unique || statement.where) {
    return;
  }
  const tableName = qualifiedNameText(statement.tableName);
  const table = resolveTableFacts(facts, tableName) ?? ensureTable(facts, schemaName(statement.tableName), identifierText(statement.tableName.name));
  const columns = statement.columns.flatMap((column) => {
    if (column.expression instanceof ColumnReference && !column.expression.getNamespace()) {
      return [column.expression.column.name];
    }
    return [];
  });
  if (columns.length === statement.columns.length && columns.length > 0) {
    addUniqueKey(table, columns);
  }
}

function mergeAlterTable(facts: SchemaFacts, statement: AlterTableStatement): void {
  const table = resolveTableFacts(facts, qualifiedNameText(statement.table)) ?? ensureTable(facts, schemaName(statement.table), identifierText(statement.table.name));
  for (const action of statement.actions) {
    if (action instanceof AlterTableAddColumn) {
      mergeColumn(table, action.column);
    }
    if (action instanceof AlterTableAddConstraint) {
      mergeTableConstraint(table, action.constraint);
    }
  }
}

function ensureTable(facts: SchemaFacts, schemaNameValue: string | undefined, tableName: string): SchemaTableFacts {
  const key = normalizeName(schemaNameValue ? `${schemaNameValue}.${tableName}` : tableName);
  const existing = facts.tables[key];
  if (existing) {
    return existing;
  }
  const table: SchemaTableFacts = {
    columns: {},
    name: tableName,
    schemaName: schemaNameValue,
  };
  facts.tables[key] = table;
  return table;
}

function mergeColumn(table: SchemaTableFacts, column: TableColumnDefinition): void {
  const name = column.name.name;
  const existing = table.columns[name] ?? { name };
  const nullable = resolveColumnNullable(column.constraints);
  table.columns[name] = {
    ...existing,
    defaultSql: resolveColumnDefault(column.constraints) ?? existing.defaultSql,
    nullable: nullable ?? existing.nullable ?? true,
    type: formatSql(column.dataType) ?? existing.type,
  };

  if (column.constraints.some((constraint) => constraint.kind === 'primary-key')) {
    table.primaryKey = [name];
  }
  if (column.constraints.some((constraint) => constraint.kind === 'unique')) {
    addUniqueKey(table, [name]);
  }
  for (const constraint of column.constraints) {
    if (constraint.kind === 'references' && constraint.reference) {
      addForeignKey(table, {
        columns: [name],
        refColumns: constraint.reference.columns?.map((item) => item.name) ?? [],
        refTable: qualifiedNameText(constraint.reference.targetTable),
      });
    }
  }
}

function mergeTableConstraint(table: SchemaTableFacts, constraint: TableConstraintDefinition): void {
  const columns = constraint.columns?.map((column) => column.name) ?? [];
  if (constraint.kind === 'primary-key' && columns.length > 0) {
    table.primaryKey = columns;
    return;
  }
  if (constraint.kind === 'unique' && columns.length > 0) {
    addUniqueKey(table, columns);
    return;
  }
  if (constraint.kind === 'foreign-key' && constraint.reference && columns.length > 0) {
    addForeignKey(table, {
      columns,
      refColumns: constraint.reference.columns?.map((item) => item.name) ?? [],
      refTable: qualifiedNameText(constraint.reference.targetTable),
    });
  }
}

function addUniqueKey(table: SchemaTableFacts, columns: string[]): void {
  const uniqueKeys = table.uniqueKeys ?? [];
  if (!uniqueKeys.some((key) => sameColumnSet(normalizeColumnSet(key), normalizeColumnSet(columns)))) {
    table.uniqueKeys = [...uniqueKeys, columns];
  }
}

function addForeignKey(table: SchemaTableFacts, foreignKey: SchemaForeignKeyFacts): void {
  table.foreignKeys = [...(table.foreignKeys ?? []), foreignKey];
}

function resolveColumnNullable(constraints: ColumnConstraintDefinition[]): boolean | undefined {
  if (constraints.some((constraint) => constraint.kind === 'primary-key' || constraint.kind === 'not-null')) {
    return false;
  }
  if (constraints.some((constraint) => constraint.kind === 'null')) {
    return true;
  }
  return undefined;
}

function resolveColumnDefault(constraints: ColumnConstraintDefinition[]): string | undefined {
  const defaultConstraint = constraints.find((constraint) => constraint.kind === 'default' && constraint.defaultValue);
  return formatSql(defaultConstraint?.defaultValue);
}

function normalizeSchemaFacts(facts: SchemaFacts): SchemaFacts {
  if (facts.diagnostics?.length === 0) {
    delete facts.diagnostics;
  }
  return facts;
}

function schemaName(name: QualifiedName): string | undefined {
  return name.namespaces?.map((item) => item.name).join('.');
}

function qualifiedNameText(name: QualifiedName): string {
  return [...(name.namespaces?.map((item) => item.name) ?? []), identifierText(name.name)].join('.');
}

function identifierText(value: { name?: string; value?: string } | string): string {
  if (typeof value === 'string') {
    return value;
  }
  return value.name ?? value.value ?? String(value);
}

function formatSql(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return ddlFormatter.format(value as Parameters<SqlFormatter['format']>[0]).formattedSql.trim();
  } catch {
    if (typeof value === 'object' && value && 'toSql' in value && typeof value.toSql === 'function') {
      return String(value.toSql());
    }
    return undefined;
  }
}

function normalizeName(value: string): string {
  return value.replace(/"/g, '').toLowerCase();
}

function normalizeColumnSet(columns: string[]): string[] {
  return columns.map(normalizeName).sort();
}

function sameColumnSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((column, index) => column === right[index]);
}
