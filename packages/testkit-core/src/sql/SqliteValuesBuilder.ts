import { SelectQueryParser } from 'rawsql-ts';
import type { SelectQuery } from 'rawsql-ts';
import type { NormalizedFixture } from '../fixtures/FixtureStore';

export interface FixtureCteDefinition {
  name: string;
  query: SelectQuery;
  inlineSql: string;
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
    const selectSql = this.buildSelectStatement(fixture);
    const inlineSql = this.wrapAsCte(fixture.name, selectSql);
    const query = SelectQueryParser.parse(selectSql);
    return {
      name: fixture.name,
      query,
      inlineSql,
    };
  }

  private static buildSelectStatement(fixture: NormalizedFixture): string {
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
      return `${projectRow(fixture.columns.map(() => null))} WHERE 1 = 0`;
    }

    if (fixture.rows.length === 1) {
      return projectRow(fixture.rows[0]);
    }

    return fixture.rows.map(projectRow).join('\nUNION ALL\n');
  }

  private static wrapAsCte(name: string, selectSql: string): string {
    const indented = selectSql
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    return `${quoteIdentifier(name)} AS (\n${indented}\n)`;
  }
}
