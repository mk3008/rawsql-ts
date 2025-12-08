import type { MissingFixtureStrategy } from '../types';

export interface MissingFixtureColumnDetail {
  name: string;
  typeName: string;
}

export interface MissingFixtureDiagnostics {
  tableName: string;
  sql?: string;
  strategy: MissingFixtureStrategy;
  schemaColumns?: MissingFixtureColumnDetail[];
  schemaSource?: 'fixture' | 'schema';
}

/**
 * Raised when the rewriter cannot locate fixture data for a referenced table.
 */
export class MissingFixtureError extends Error {
  constructor(public readonly diagnostics: MissingFixtureDiagnostics) {
    super(MissingFixtureError.buildMessage(diagnostics));
    this.name = 'MissingFixtureError';
  }

  private static buildMessage(diagnostics: MissingFixtureDiagnostics): string {
    const lines: string[] = [];
    lines.push(`Fixture for table "${diagnostics.tableName}" was not provided.`);
    lines.push('');
    lines.push('Diagnostics:');
    lines.push(`  - Strategy: ${diagnostics.strategy}`);
    lines.push(`  - Table: ${diagnostics.tableName}`);
    if (diagnostics.sql) {
      lines.push(`  - SQL snippet: ${MissingFixtureError.formatSqlSnippet(diagnostics.sql)}`);
    }

    if (diagnostics.schemaColumns && diagnostics.schemaColumns.length > 0) {
      const sourceLabel =
        diagnostics.schemaSource === 'schema' ? 'schema registry' : 'fixture metadata';
      lines.push(`  - Required columns (${sourceLabel}):`);
      diagnostics.schemaColumns.forEach((column) => {
        lines.push(`      • ${column.name} (${column.typeName})`);
      });
      lines.push('  - Suggested fixture template:');
      lines.push(...MissingFixtureError.buildFixtureTemplate(diagnostics.tableName, diagnostics.schemaColumns));
    } else {
      lines.push(
        '  - Column definitions: unavailable. Register schema via options.schema or include schema per fixture.'
      );
    }

    lines.push('');
    lines.push('Next steps:');
    lines.push('  1. Declare a fixture for the table with the columns listed above.');
    lines.push('  2. Provide at least one row so rewritten SELECT statements shadow the physical table.');
    lines.push('  3. Pass fixtures via SelectRewriterOptions.fixtures or rewrite context overrides.');
    return lines.join('\n');
  }

  /**
   * Produces a compact preview of the provided SQL snippet for diagnostics.
   */
  private static formatSqlSnippet(sql: string): string {
    const compact = sql.replace(/\s+/g, ' ').trim();
    const limit = 280;
    if (compact.length <= limit) {
      return compact;
    }
    return `${compact.slice(0, limit)}…`;
  }

  /**
   * Builds a human-readable template that mirrors the missing fixture schema.
   */
  private static buildFixtureTemplate(
    tableName: string,
    columns: MissingFixtureColumnDetail[]
  ): string[] {
    const indent = (level: number): string => ' '.repeat(level * 2);
    const template: string[] = [];
    template.push(`${indent(3)}{`);
    template.push(`${indent(4)}tableName: '${tableName}',`);
    template.push(`${indent(4)}schema: {`);
    template.push(`${indent(5)}columns: {`);
    columns.forEach((column, index) => {
      const suffix = index === columns.length - 1 ? '' : ',';
      template.push(`${indent(6)}${column.name}: '${column.typeName}'${suffix}`);
    });
    template.push(`${indent(5)}}`);
    template.push(`${indent(4)}},`);
    template.push(`${indent(4)}rows: [`);
    const rowExample = columns.map((column) => `${column.name}: /* ${column.typeName} */`).join(', ');
    template.push(`${indent(5)}{ ${rowExample} }`);
    template.push(`${indent(4)}],`);
    template.push(`${indent(3)}}`);
    return template;
  }
}

/**
 * Signals that a fixture schema definition lacks required metadata or is inconsistent.
 */
export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Wraps unexpected failures encountered during select statement rewriting.
 */
export class QueryRewriteError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'QueryRewriteError';
  }
}

