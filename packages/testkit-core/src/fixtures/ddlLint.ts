import {
  AlterTableAddColumn,
  AlterTableAddConstraint,
  AlterTableAlterColumnDefault,
  AlterTableDropColumn,
  AlterTableStatement,
  CastExpression,
  ColumnReference,
  CreateIndexStatement,
  CreateTableQuery,
  MultiQuerySplitter,
  ParenExpression,
  SqlParser,
} from 'rawsql-ts';
import type {
  ColumnConstraintDefinition,
  ReferenceDefinition,
  TableColumnDefinition,
  TableConstraintDefinition,
  ValueComponent,
} from 'rawsql-ts';
import { TableNameResolver } from './TableNameResolver';

/**
 * Controls how DDL lint findings are surfaced during fixture loading.
 */
export type DdlLintMode = 'strict' | 'warn' | 'off';

/**
 * Severity levels reported by the DDL integrity checker.
 */
export type DdlLintSeverity = 'error' | 'warning';

/**
 * Represents a single SQL source used for DDL linting.
 */
export interface DdlLintSource {
  /** Workspace-relative path to the SQL file being linted. */
  path: string;
  /** Raw SQL contents for the file. */
  sql: string;
}

/**
 * Machine-friendly diagnostic information for DDL integrity checks.
 */
export interface DdlLintDiagnostic {
  code: string;
  severity: DdlLintSeverity;
  source: string;
  statementIndex: number;
  message: string;
  table?: string;
  column?: string;
  constraint?: string;
  referencedTable?: string;
  referencedColumn?: string;
}

/**
 * Options to control DDL linting behavior and name resolution.
 */
export interface DdlLintOptions {
  tableNameResolver?: TableNameResolver;
}

/**
 * Default lint mode used when none is specified.
 */
export const DEFAULT_DDL_LINT_MODE: DdlLintMode = 'strict';

/**
 * Normalizes the requested lint mode, falling back to the default.
 */
export function normalizeDdlLintMode(mode?: DdlLintMode | null): DdlLintMode {
  return mode ?? DEFAULT_DDL_LINT_MODE;
}

type StatementContext = {
  source: string;
  statementIndex: number;
};

type ConstraintModel = {
  kind: 'primary-key' | 'unique' | 'foreign-key' | 'check';
  name?: string;
  columns?: string[];
  reference?: ReferenceDefinition;
  checkExpression?: ValueComponent;
  scope: 'table' | 'column';
  source: StatementContext;
};

type TableModel = {
  name: string;
  columns: Map<string, string>;
  constraints: ConstraintModel[];
};

const SEVERITY_RANK: Record<DdlLintSeverity, number> = {
  error: 0,
  warning: 1,
};

/**
 * Runs integrity checks across the supplied DDL sources and returns sorted diagnostics.
 */
export function lintDdlSources(
  sources: DdlLintSource[],
  options: DdlLintOptions = {}
): DdlLintDiagnostic[] {
  if (sources.length === 0) {
    return [];
  }

  const resolver = options.tableNameResolver ?? new TableNameResolver();
  const createStatements: Array<{ ast: CreateTableQuery; context: StatementContext }> = [];
  const alterStatements: Array<{ ast: AlterTableStatement; context: StatementContext }> = [];
  const indexStatements: Array<{ ast: CreateIndexStatement; context: StatementContext }> = [];

  for (const source of sources) {
    const split = MultiQuerySplitter.split(source.sql);
    for (const query of split.queries) {
      if (query.isEmpty) {
        continue;
      }

      let ast: unknown;
      try {
        ast = SqlParser.parse(query.sql);
      } catch (_error) {
        continue;
      }

      const context: StatementContext = {
        source: source.path,
        statementIndex: query.index,
      };

      if (ast instanceof CreateTableQuery) {
        createStatements.push({ ast, context });
      } else if (ast instanceof AlterTableStatement) {
        alterStatements.push({ ast, context });
      } else if (ast instanceof CreateIndexStatement) {
        indexStatements.push({ ast, context });
      }
    }
  }

  const diagnostics: DdlLintDiagnostic[] = [];
  const tables = new Map<string, TableModel>();

  for (const entry of createStatements) {
    const tableName = resolveTableName(entry.ast, resolver);
    if (!tableName) {
      continue;
    }

    let table = tables.get(tableName);
    if (!table) {
      table = {
        name: tableName,
        columns: new Map(),
        constraints: [],
      };
      tables.set(tableName, table);
    }

    // Track duplicate column definitions while populating the column registry.
    for (const column of entry.ast.columns) {
      registerColumnDefinition(table, column, entry.context, diagnostics);
    }

    // Capture table-level constraints for downstream column checks.
    for (const constraint of entry.ast.tableConstraints) {
      registerTableConstraint(table, constraint, entry.context);
    }

    // Capture column-level constraints (e.g. named foreign keys).
    for (const column of entry.ast.columns) {
      for (const constraint of column.constraints) {
        registerColumnConstraint(table, column, constraint, entry.context);
      }
    }
  }

  for (const entry of alterStatements) {
    const tableName = resolveQualifiedName(entry.ast.table, resolver, tables);
    if (!tableName) {
      diagnostics.push({
        code: 'ddl/alter-missing-table',
        severity: 'error',
        source: entry.context.source,
        statementIndex: entry.context.statementIndex,
        table: entry.ast.table.toString(),
        message: `ALTER TABLE targets unknown table "${entry.ast.table.toString()}".`,
      });
      continue;
    }

    const table = tables.get(tableName);
    if (!table) {
      continue;
    }

    // Apply ALTER TABLE actions so column- and constraint-level linting sees the final shape.
    for (const action of entry.ast.actions) {
      if (action instanceof AlterTableAddColumn) {
        registerColumnDefinition(table, action.column, entry.context, diagnostics);
        for (const constraint of action.column.constraints) {
          registerColumnConstraint(table, action.column, constraint, entry.context);
        }
        continue;
      }

      if (action instanceof AlterTableAddConstraint) {
        registerTableConstraint(table, action.constraint, entry.context);
        continue;
      }

      if (action instanceof AlterTableAlterColumnDefault) {
        const targetName = normalizeColumnName(action.columnName.name);
        if (!table.columns.has(targetName)) {
          diagnostics.push({
            code: 'ddl/alter-missing-column',
            severity: 'error',
            source: entry.context.source,
            statementIndex: entry.context.statementIndex,
            table: table.name,
            column: action.columnName.name,
            message: `ALTER COLUMN targets unknown column "${action.columnName.name}" in "${table.name}".`,
          });
        }
        continue;
      }

      if (action instanceof AlterTableDropColumn) {
        const targetName = normalizeColumnName(action.columnName.name);
        if (!table.columns.has(targetName)) {
          diagnostics.push({
            code: 'ddl/alter-missing-column',
            severity: 'error',
            source: entry.context.source,
            statementIndex: entry.context.statementIndex,
            table: table.name,
            column: action.columnName.name,
            message: `ALTER COLUMN targets unknown column "${action.columnName.name}" in "${table.name}".`,
          });
        }
      }
    }
  }

  for (const entry of indexStatements) {
    const tableName = resolveQualifiedName(entry.ast.tableName, resolver, tables);
    if (!tableName) {
      continue;
    }

    const table = tables.get(tableName);
    if (!table) {
      continue;
    }

    // Check only simple column references; expression-based indexes are ignored.
    for (const column of entry.ast.columns) {
      const simpleColumn = getSimpleColumnReference(column.expression);
      if (!simpleColumn) {
        continue;
      }

      if (!table.columns.has(normalizeColumnName(simpleColumn))) {
        diagnostics.push({
          code: 'ddl/missing-column',
          severity: 'error',
          source: entry.context.source,
          statementIndex: entry.context.statementIndex,
          table: table.name,
          column: simpleColumn,
          message: `Index "${entry.ast.indexName.toString()}" references missing column "${simpleColumn}" on "${table.name}".`,
        });
      }
    }

    const includeColumns = entry.ast.include ?? [];
    for (const includeColumn of includeColumns) {
      if (!table.columns.has(normalizeColumnName(includeColumn.name))) {
        diagnostics.push({
          code: 'ddl/missing-column',
          severity: 'error',
          source: entry.context.source,
          statementIndex: entry.context.statementIndex,
          table: table.name,
          column: includeColumn.name,
          message: `Index "${entry.ast.indexName.toString()}" includes missing column "${includeColumn.name}" on "${table.name}".`,
        });
      }
    }
  }

  for (const table of tables.values()) {
    // Detect duplicate constraint names within the same table.
    const namedConstraints = table.constraints.filter((constraint) => constraint.name);
    const seen = new Map<string, ConstraintModel[]>();
    for (const constraint of namedConstraints) {
      const key = normalizeConstraintName(constraint.name ?? '');
      const existing = seen.get(key) ?? [];
      existing.push(constraint);
      seen.set(key, existing);
    }

    for (const constraints of seen.values()) {
      if (constraints.length < 2) {
        continue;
      }
      for (const constraint of constraints) {
        diagnostics.push({
          code: 'ddl/duplicate-constraint',
          severity: 'error',
          source: constraint.source.source,
          statementIndex: constraint.source.statementIndex,
          table: table.name,
          constraint: constraint.name,
          message: `Constraint name "${constraint.name}" is defined multiple times on "${table.name}".`,
        });
      }
    }

    // Validate constraint column references against the resolved table columns.
    for (const constraint of table.constraints) {
      const columns = constraint.columns ?? [];
      if (constraint.kind !== 'check') {
        for (const column of columns) {
          if (!table.columns.has(normalizeColumnName(column))) {
            diagnostics.push({
              code: 'ddl/missing-column',
              severity: 'error',
              source: constraint.source.source,
              statementIndex: constraint.source.statementIndex,
              table: table.name,
              column,
              constraint: constraint.name,
              message: `Constraint "${constraint.name ?? constraint.kind}" references missing column "${column}" on "${table.name}".`,
            });
          }
        }
      }

      if (constraint.kind === 'check') {
        const simpleColumn = getSimpleColumnReference(constraint.checkExpression);
        if (simpleColumn && !table.columns.has(normalizeColumnName(simpleColumn))) {
          diagnostics.push({
            code: 'ddl/missing-column',
            severity: 'error',
            source: constraint.source.source,
            statementIndex: constraint.source.statementIndex,
            table: table.name,
            column: simpleColumn,
            constraint: constraint.name,
            message: `CHECK constraint "${constraint.name ?? 'unnamed'}" references missing column "${simpleColumn}" on "${table.name}".`,
          });
        }
      }

      if (constraint.kind === 'foreign-key' && constraint.reference) {
        const referencing = constraint.columns ?? [];
        const referencedTableName = resolveQualifiedName(
          constraint.reference.targetTable,
          resolver,
          tables
        );
        if (!referencedTableName) {
          diagnostics.push({
            code: 'ddl/foreign-key-missing-table',
            severity: 'error',
            source: constraint.source.source,
            statementIndex: constraint.source.statementIndex,
            table: table.name,
            constraint: constraint.name,
            referencedTable: constraint.reference.targetTable.toString(),
            message: `Foreign key "${constraint.name ?? 'unnamed'}" references unknown table "${constraint.reference.targetTable.toString()}".`,
          });
          continue;
        }

        const referenced = tables.get(referencedTableName);
        if (!referenced) {
          continue;
        }

        const referencedColumns = constraint.reference.columns?.map((column) => column.name) ?? null;
        if (referencedColumns && referencing.length !== referencedColumns.length) {
          diagnostics.push({
            code: 'ddl/foreign-key-column-count',
            severity: 'error',
            source: constraint.source.source,
            statementIndex: constraint.source.statementIndex,
            table: table.name,
            constraint: constraint.name,
            referencedTable: referencedTableName,
            message: `Foreign key "${constraint.name ?? 'unnamed'}" column count (${referencing.length}) does not match referenced column count (${referencedColumns.length}).`,
          });
        }

        if (referencedColumns) {
          for (const column of referencedColumns) {
            if (!referenced.columns.has(normalizeColumnName(column))) {
              diagnostics.push({
                code: 'ddl/foreign-key-missing-column',
                severity: 'error',
                source: constraint.source.source,
                statementIndex: constraint.source.statementIndex,
                table: table.name,
                constraint: constraint.name,
                referencedTable: referencedTableName,
                referencedColumn: column,
                message: `Foreign key "${constraint.name ?? 'unnamed'}" references missing column "${column}" on "${referencedTableName}".`,
              });
            }
          }
        }
      }
    }
  }

  return sortDiagnostics(diagnostics);
}

/**
 * Adjusts diagnostic severities based on the selected lint mode.
 */
export function applyDdlLintMode(
  diagnostics: DdlLintDiagnostic[],
  mode: DdlLintMode
): DdlLintDiagnostic[] {
  if (mode !== 'warn') {
    return diagnostics;
  }

  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    severity: 'warning',
  }));
}

/**
 * Formats DDL diagnostics into a human-readable summary.
 */
export function formatDdlLintDiagnostics(diagnostics: DdlLintDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push(`DDL integrity check found ${diagnostics.length} issue(s):`);
  for (const diagnostic of diagnostics) {
    const meta: string[] = [];
    if (diagnostic.table) {
      meta.push(`table=${diagnostic.table}`);
    }
    if (diagnostic.column) {
      meta.push(`column=${diagnostic.column}`);
    }
    if (diagnostic.constraint) {
      meta.push(`constraint=${diagnostic.constraint}`);
    }
    if (diagnostic.referencedTable) {
      meta.push(`referencedTable=${diagnostic.referencedTable}`);
    }
    if (diagnostic.referencedColumn) {
      meta.push(`referencedColumn=${diagnostic.referencedColumn}`);
    }
    const metaSuffix = meta.length > 0 ? ` (${meta.join(', ')})` : '';
    lines.push(
      `- [${diagnostic.severity}] ${diagnostic.code} ${diagnostic.source}#${diagnostic.statementIndex}${metaSuffix}`
    );
    lines.push(`  ${diagnostic.message}`);
  }

  return lines.join('\n');
}

function resolveTableName(query: CreateTableQuery, resolver: TableNameResolver): string {
  const namespaces = query.namespaces ?? [];
  const rawName = namespaces.length > 0 ? [...namespaces, query.tableName.name].join('.') : query.tableName.name;
  return resolver.resolve(rawName);
}

function resolveQualifiedName(
  tableName: { toString(): string },
  resolver: TableNameResolver,
  tables: Map<string, TableModel>
): string | undefined {
  const rawName = tableName.toString();
  const resolved = resolver.resolve(rawName, (candidate) => tables.has(candidate));
  return tables.has(resolved) ? resolved : undefined;
}

function registerColumnDefinition(
  table: TableModel,
  column: TableColumnDefinition,
  context: StatementContext,
  diagnostics: DdlLintDiagnostic[]
): void {
  const columnName = column.name.name;
  const normalized = normalizeColumnName(columnName);
  if (table.columns.has(normalized)) {
    diagnostics.push({
      code: 'ddl/duplicate-column',
      severity: 'error',
      source: context.source,
      statementIndex: context.statementIndex,
      table: table.name,
      column: columnName,
      message: `Column "${columnName}" is defined multiple times on "${table.name}".`,
    });
    return;
  }

  table.columns.set(normalized, columnName);
}

function registerTableConstraint(
  table: TableModel,
  constraint: TableConstraintDefinition,
  context: StatementContext
): void {
  if (!isLintableTableConstraint(constraint)) {
    return;
  }

  table.constraints.push({
    kind: constraint.kind,
    name: constraint.constraintName?.name,
    columns: constraint.columns?.map((column) => column.name) ?? undefined,
    reference: constraint.reference,
    checkExpression: constraint.checkExpression,
    scope: 'table',
    source: context,
  });
}

function registerColumnConstraint(
  table: TableModel,
  column: TableColumnDefinition,
  constraint: ColumnConstraintDefinition,
  context: StatementContext
): void {
  if (!isLintableColumnConstraint(constraint)) {
    return;
  }

  table.constraints.push({
    kind: constraint.kind === 'references' ? 'foreign-key' : constraint.kind,
    name: constraint.constraintName?.name,
    columns: [column.name.name],
    reference: constraint.reference,
    checkExpression: constraint.checkExpression,
    scope: 'column',
    source: context,
  });
}

function isLintableTableConstraint(
  constraint: TableConstraintDefinition
): constraint is TableConstraintDefinition & {
  kind: 'primary-key' | 'unique' | 'foreign-key' | 'check';
} {
  return (
    constraint.kind === 'primary-key' ||
    constraint.kind === 'unique' ||
    constraint.kind === 'foreign-key' ||
    constraint.kind === 'check'
  );
}

function isLintableColumnConstraint(
  constraint: ColumnConstraintDefinition
): constraint is ColumnConstraintDefinition & {
  kind: 'primary-key' | 'unique' | 'references' | 'check';
} {
  return (
    constraint.kind === 'primary-key' ||
    constraint.kind === 'unique' ||
    constraint.kind === 'references' ||
    constraint.kind === 'check'
  );
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase();
}

function normalizeConstraintName(name: string): string {
  return name.toLowerCase();
}

function getSimpleColumnReference(value?: ValueComponent | null): string | null {
  if (!value) {
    return null;
  }

  let current: ValueComponent = value;
  // Unwrap common wrappers so "(col)" and "col::type" are treated as simple references.
  while (current instanceof ParenExpression || current instanceof CastExpression) {
    current = current instanceof ParenExpression ? current.expression : current.input;
  }

  if (current instanceof ColumnReference) {
    const namespaces = current.namespaces ?? null;
    if (!namespaces || namespaces.length === 0) {
      return current.column.name;
    }
  }

  return null;
}

function sortDiagnostics(diagnostics: DdlLintDiagnostic[]): DdlLintDiagnostic[] {
  return diagnostics.sort((left, right) => {
    const severityDelta = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const sourceDelta = compareOptional(left.source, right.source);
    if (sourceDelta !== 0) {
      return sourceDelta;
    }

    const statementDelta = (left.statementIndex ?? 0) - (right.statementIndex ?? 0);
    if (statementDelta !== 0) {
      return statementDelta;
    }

    const tableDelta = compareOptional(left.table, right.table);
    if (tableDelta !== 0) {
      return tableDelta;
    }

    const columnDelta = compareOptional(left.column, right.column);
    if (columnDelta !== 0) {
      return columnDelta;
    }

    const codeDelta = compareOptional(left.code, right.code);
    if (codeDelta !== 0) {
      return codeDelta;
    }

    return compareOptional(left.message, right.message);
  });
}

function compareOptional(left?: string | null, right?: string | null): number {
  const leftValue = left ?? '';
  const rightValue = right ?? '';
  if (leftValue === rightValue) {
    return 0;
  }
  return leftValue < rightValue ? -1 : 1;
}
