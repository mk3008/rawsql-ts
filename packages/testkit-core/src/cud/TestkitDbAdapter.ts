import {
  InsertQuery,
  SelectQuery,
  SimpleSelectQuery,
  SqlParser,
} from 'rawsql-ts';
import {
  applyTypeCastsToSelect,
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

  private resolveTableName(insert: InsertQuery): string {
    const alias = insert.insertClause.source.getAliasName();
    if (!alias) {
      throw new Error('Unsupported insert target expression.');
    }
    return alias;
  }
}
