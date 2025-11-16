import {
  InsertQuery,
  SelectQuery,
  SimpleSelectQuery,
  SqlParser,
} from 'rawsql-ts';
import {
  applyTypeCastsToSelect,
  ColumnDef,
  extractDtoRowsFromSelect,
  normalizeInsertValuesToSelect,
  validateDtoSelectRuntime,
  validateInsertShape,
  TableDef,
  CudValidationIssue,
} from './helpers';

export interface TestkitCudOptions {
  enableTypeCasts?: boolean;
  enableRuntimeDtoValidation?: boolean;
  failOnShapeIssues?: boolean;
}

export class CudValidationError extends Error {
  constructor(public readonly issues: CudValidationIssue[]) {
    super(`CUD validation failed: ${issues.map((issue) => issue.message).join('; ')}`);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TestkitDbAdapter {
  private readonly tables: Record<string, TableDef>;
  private readonly autoNumberCounters: Record<string, number> = {};

  constructor(tableDefs: TableDef[]) {
    this.tables = {};
    for (const table of tableDefs) {
      this.tables[table.tableName.toLowerCase()] = table;
    }
  }

  public rewriteInsert(sql: string, options: TestkitCudOptions = {}): InsertQuery | null {
    let parsed: InsertQuery;
    try {
      parsed = SqlParser.parse(sql) as InsertQuery;
    } catch {
      // Fall back to passthrough when the SQL cannot be parsed (e.g., parameterized INSERTs).
      return null;
    }

    if (!(parsed instanceof InsertQuery)) {
      throw new Error('TestkitDbAdapter currently supports INSERT statements only.');
    }

    const insert = parsed;
    const tableName = this.resolveTableName(insert);
    const table = this.tables[tableName.toLowerCase()];
    if (!table) {
      throw new Error(`No TableDef metadata for table "${tableName}".`);
    }

    const shapeIssues = validateInsertShape(insert, table);
    if (shapeIssues.length > 0) {
      const shouldFailOnShapeIssues = options.failOnShapeIssues ?? true;
      // Bail out when the INSERT shape is noisy unless strict validation was requested.
      if (shouldFailOnShapeIssues) {
        throw new CudValidationError(shapeIssues);
      }
      return null;
    }

    normalizeInsertValuesToSelect(insert);

    let select = insert.selectQuery;
    if (!select) {
      throw new Error('INSERT statement lacks a SELECT payload.');
    }

    const simpleSelect = select instanceof SimpleSelectQuery ? select : select.toSimpleQuery();
    insert.selectQuery = simpleSelect;

    if (options.enableTypeCasts ?? true) {
      applyTypeCastsToSelect(simpleSelect, table);
    }

    if (options.enableRuntimeDtoValidation ?? true) {
      const runtimeIssues = validateDtoSelectRuntime(simpleSelect, table);
      if (runtimeIssues.length > 0) {
        throw new CudValidationError(runtimeIssues);
      }
    }

    return insert;
  }

  public simulateReturningRows(insert: InsertQuery, params?: unknown[]): Record<string, unknown>[] | null {
    if (!insert.selectQuery) {
      return null;
    }

    const tableName = this.resolveTableName(insert);
    const table = this.tables[tableName.toLowerCase()];
    if (!table) {
      return null;
    }

    const simpleSelect =
      insert.selectQuery instanceof SimpleSelectQuery
        ? insert.selectQuery
        : insert.selectQuery.toSimpleQuery();
    const dtoRows = extractDtoRowsFromSelect(simpleSelect, params);
    if (!dtoRows || dtoRows.length === 0) {
      return null;
    }

    const returningColumns = this.determineReturningTargets(insert, table);
    return dtoRows.map((dtoRow) =>
      this.buildReturningRow(dtoRow, table, returningColumns, tableName),
    );
  }

  private resolveTableName(insert: InsertQuery): string {
    const alias = insert.insertClause.source.getAliasName();
    if (!alias) {
      throw new Error('Unsupported insert target expression.');
    }
    return alias;
  }

  private determineReturningTargets(insert: InsertQuery, table: TableDef): string[] {
    const returning = insert.returningClause?.columns;
    if (returning && returning.length > 0) {
      return returning.map((identifier) => identifier.name);
    }

    const insertColumns = insert.insertClause.columns;
    if (insertColumns && insertColumns.length > 0) {
      return insertColumns.map((identifier) => identifier.name);
    }

    return table.columns.map((column) => column.name);
  }

  private buildReturningRow(
    dtoRow: Record<string, unknown>,
    table: TableDef,
    targets: string[],
    tableName: string,
  ): Record<string, unknown> {
    const lowerCasedValues = new Map<string, unknown>();
    // Respect DTO column casing by normalizing to lowercase for lookups.
    Object.entries(dtoRow).forEach(([key, value]) => {
      lowerCasedValues.set(key.toLowerCase(), value);
    });

    const row: Record<string, unknown> = {};

    // Populate each requested returning column, defaulting to auto-number values when needed.
    targets.forEach((target) => {
      const normalized = target.toLowerCase();
      if (lowerCasedValues.has(normalized)) {
        row[target] = lowerCasedValues.get(normalized);
        return;
      }

      const columnDef = table.columns.find((column) => column.name.toLowerCase() === normalized);
      row[target] = columnDef ? this.resolveDefaultValue(tableName, columnDef) : undefined;
    });

    return row;
  }

  private resolveDefaultValue(tableName: string, column: ColumnDef): unknown {
    if (column.hasDefault && this.isAutoNumber(column.dbType)) {
      return this.nextAutoNumberValue(tableName, column);
    }

    if (column.nullable) {
      return null;
    }

    return undefined;
  }

  private isAutoNumber(dbType: string): boolean {
    return /(int|serial|bigint|numeric)/i.test(dbType);
  }

  private nextAutoNumberValue(tableName: string, column: ColumnDef): number {
    const key = `${tableName.toLowerCase()}.${column.name.toLowerCase()}`;
    const next = (this.autoNumberCounters[key] ?? 0) + 1;
    this.autoNumberCounters[key] = next;
    return next;
  }
}
