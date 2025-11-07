import type { NormalizedFixture } from '../fixtures/FixtureStore';

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
  public static buildCTE(fixture: NormalizedFixture): string {
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

    const parts = [`${quoteIdentifier(fixture.name)} AS (`];

    if (fixture.rows.length === 0) {
      parts.push(
        `  ${projectRow(fixture.columns.map(() => null))}`,
        '  WHERE 1 = 0'
      );
    } else {
      parts.push(
        '  ' + fixture.rows.map(projectRow).join('\n  UNION ALL\n  ')
      );
    }

    parts.push(')');

    return parts.join('\n');
  }
}
