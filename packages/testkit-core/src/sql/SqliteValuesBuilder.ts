import { SelectQueryParser } from 'rawsql-ts';
import type { SelectQuery } from 'rawsql-ts';
import type { NormalizedFixture } from '../fixtures/FixtureStore';

export interface FixtureCteDefinition {
  name: string;
  query: SelectQuery;
}

const quoteIdentifier = (value: string): string => {
  return `"${value.replace(/"/g, '""')}"`;
};

const formatLiteral = (value: string | number | bigint | Buffer | null): string => {
  if (value === null) {
    return 'NULL';
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Buffer) {
    return `X'${value.toString('hex')}'`;
  }

  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }

  const coerced = String(value);
  return `'${coerced.replace(/'/g, "''")}'`;
};

export class SqliteValuesBuilder {
  public static buildCTE(fixture: NormalizedFixture): FixtureCteDefinition {
    // Compose the CTE body as SQL so we can parse it into a SelectQuery.
    const selectSql = this.buildSelectStatement(fixture);
    const query = SelectQueryParser.parse(selectSql);
    return {
      name: fixture.name,
      query,
    };
  }

  private static buildSelectStatement(fixture: NormalizedFixture): string {
    // Build a SELECT statement for a single fixture row with typed literals.
    const projectRow = (row: (string | number | bigint | Buffer | null)[]) => {
      return (
        'SELECT ' +
        fixture.columns
          .map((column, index) => {
            const literal = formatLiteral(row[index] ?? null);
            return `CAST(${literal} AS ${column.affinity}) AS ${quoteIdentifier(column.name)}`;
          })
          .join(', ')
      );
    };

    if (fixture.rows.length === 0) {
      // Emit a zero-row SELECT so downstream code preserves schema metadata.
      return `${projectRow(fixture.columns.map(() => null))} WHERE 1 = 0`;
    }

    if (fixture.rows.length === 1) {
      return projectRow(fixture.rows[0]);
    }

    return fixture.rows.map(projectRow).join('\nUNION ALL\n');
  }
}
