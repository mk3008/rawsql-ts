import { BinarySelectQuery, SelectQueryParser, SimpleSelectQuery, SqlSchemaValidator } from 'rawsql-ts';
import {
  createTableColumnResolver,
  parseSchemaFactsFromDdl,
  type DdlInput,
  type SchemaFacts,
} from '../lineage/schemaFacts';

export interface SqlValidationDiagnosticV1 {
  category: 'limitation' | 'schema' | 'syntax';
  code: string;
  columnName?: string;
  columnNames?: string[];
  filePath?: string;
  location?: { offset: number };
  message: string;
  severity: 'error' | 'info' | 'warning';
  tableName?: string;
}

export interface SqlValidationInputV1 {
  ddl?: DdlInput[];
  schemaFacts?: SchemaFacts;
  sql: string;
}

export interface SqlValidationResultV1 {
  diagnostics: SqlValidationDiagnosticV1[];
  kind: 'sql-validation';
  parserVersion: string;
  valid: boolean;
  version: 1;
}

// API output shape review: validation returns a small DTO with diagnostics;
// parser AST objects remain internal and invalid SQL stays a domain result.

/**
 * Validate one SELECT statement without connecting to a database or executing SQL.
 * Syntax and schema failures are returned as structured domain diagnostics.
 */
export function validateSql(input: SqlValidationInputV1): SqlValidationResultV1 {
  const schemaFacts = input.schemaFacts ?? (input.ddl && input.ddl.length > 0 ? parseSchemaFactsFromDdl(input.ddl) : undefined);
  const diagnostics: SqlValidationDiagnosticV1[] = (schemaFacts?.diagnostics ?? []).map((diagnostic) => ({
    category: 'schema',
    code: diagnostic.code,
    ...(diagnostic.filePath ? { filePath: diagnostic.filePath } : {}),
    message: diagnostic.message,
    severity: diagnostic.severity,
  }));
  const parsed = SelectQueryParser.analyze(input.sql);

  if (!parsed.success || !parsed.query) {
    diagnostics.push({
      category: 'syntax',
      code: 'SQL_PARSE_ERROR',
      ...(parsed.errorPosition === undefined ? {} : { location: { offset: parsed.errorPosition } }),
      message: parsed.error ?? 'SQL could not be parsed as one SELECT statement.',
      severity: 'error',
    });
    return result(diagnostics);
  }

  if (!(parsed.query instanceof SimpleSelectQuery || parsed.query instanceof BinarySelectQuery)) {
    diagnostics.push({
      category: 'limitation',
      code: 'SCHEMA_VALIDATION_UNSUPPORTED_QUERY_ROOT',
      message: 'This SELECT root was parsed successfully, but static schema validation does not support it.',
      severity: 'warning',
    });
    return result(diagnostics);
  }

  if (!schemaFacts) {
    diagnostics.push({
      category: 'limitation',
      code: 'SCHEMA_VALIDATION_SKIPPED',
      message: 'No DDL was supplied, so table and column existence was not validated.',
      severity: 'warning',
    });
    return result(diagnostics);
  }

  const schemaValidation = SqlSchemaValidator.analyze(parsed.query, createTableColumnResolver(schemaFacts));
  diagnostics.push(...schemaValidation.diagnostics.map((diagnostic) => ({
    category: diagnostic.code === 'COLUMN_REFERENCE_UNRESOLVED' ? 'limitation' as const : 'schema' as const,
    code: diagnostic.code,
    ...(diagnostic.columnName ? { columnName: diagnostic.columnName } : {}),
    ...(diagnostic.columnNames ? { columnNames: diagnostic.columnNames } : {}),
    message: diagnostic.message,
    severity: diagnostic.code === 'COLUMN_REFERENCE_UNRESOLVED' ? 'warning' as const : 'error' as const,
    ...(diagnostic.tableName ? { tableName: diagnostic.tableName } : {}),
  })));
  return result(diagnostics);
}

function result(diagnostics: SqlValidationDiagnosticV1[]): SqlValidationResultV1 {
  return {
    diagnostics,
    kind: 'sql-validation',
    parserVersion: 'rawsql-ts',
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    version: 1,
  };
}
