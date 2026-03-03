export type PlaceholderMode = 'none' | 'named' | 'positional';

export interface SqlScanNamedToken {
  start: number;
  end: number;
  name: string;
}

export interface SqlScanResult {
  mode: PlaceholderMode;
  namedTokens: SqlScanNamedToken[];
  positionalTokens: Array<{ start: number; end: number; token: string }>;
}

const IDENTIFIER_START_PATTERN = /[A-Za-z_]/;
const IDENTIFIER_PART_PATTERN = /[A-Za-z0-9_]/;

export class ModelGenSqlScanError extends Error {
  readonly token: string;

  constructor(message: string, token: string) {
    super(message);
    this.name = 'ModelGenSqlScanError';
    this.token = token;
  }
}

/**
 * Scans SQL text for supported/unsupported placeholder styles without fully parsing SQL grammar.
 * The scanner guarantees that it will not inspect inside string literals, quoted identifiers, or comments.
 */
export function scanModelGenSql(sql: string): SqlScanResult {
  const namedTokens: SqlScanNamedToken[] = [];
  const positionalTokens: Array<{ start: number; end: number; token: string }> = [];
  let index = 0;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1] ?? '';

    if (current === '\'') {
      index = skipSingleQuotedString(sql, index);
      continue;
    }
    if (current === '"') {
      index = skipDoubleQuotedIdentifier(sql, index);
      continue;
    }
    if (current === '-' && next === '-') {
      index = skipLineComment(sql, index);
      continue;
    }
    if (current === '/' && next === '*') {
      index = skipBlockComment(sql, index);
      continue;
    }
    if (current === '$') {
      const dollarQuote = readDollarQuoteDelimiter(sql, index);
      if (dollarQuote) {
        index = skipDollarQuotedString(sql, index, dollarQuote);
        continue;
      }

      if (/[0-9]/.test(next)) {
        const end = consumeDigits(sql, index + 1);
        positionalTokens.push({ start: index, end, token: sql.slice(index, end) });
        index = end;
        continue;
      }

      if (next === '{') {
        throw new ModelGenSqlScanError('Detected unsupported placeholder syntax "${name}".', consumeUnsupportedToken(sql, index));
      }
    }
    if (current === '?') {
      throw new ModelGenSqlScanError('Detected unsupported placeholder syntax "?".', '?');
    }
    if (current === '@' && IDENTIFIER_START_PATTERN.test(next)) {
      throw new ModelGenSqlScanError('Detected unsupported placeholder syntax "@name".', consumeUnsupportedToken(sql, index));
    }
    if (current === ':') {
      // PostgreSQL casts use `::`, which must not be treated as a named placeholder.
      if (next === ':') {
        index += 2;
        continue;
      }
      if (IDENTIFIER_START_PATTERN.test(next)) {
        const end = consumeIdentifier(sql, index + 1);
        if ((sql[end] ?? '') === '-') {
          throw new ModelGenSqlScanError('Detected unsupported named parameter syntax.', consumeUnsupportedToken(sql, index));
        }
        namedTokens.push({
          start: index,
          end,
          name: sql.slice(index + 1, end)
        });
        index = end;
        continue;
      }
      if (/[0-9]/.test(next)) {
        throw new ModelGenSqlScanError('Detected unsupported placeholder syntax ":1".', consumeUnsupportedToken(sql, index));
      }
      if (next && !isStructuralDelimiter(next)) {
        throw new ModelGenSqlScanError('Detected unsupported named parameter syntax.', consumeUnsupportedToken(sql, index));
      }
    }

    index += 1;
  }

  if (namedTokens.length > 0 && positionalTokens.length > 0) {
    throw new ModelGenSqlScanError('Detected mixed named and positional placeholder styles.', 'mixed');
  }

  return {
    mode:
      namedTokens.length > 0
        ? 'named'
        : positionalTokens.length > 0
        ? 'positional'
        : 'none',
    namedTokens,
    positionalTokens
  };
}

function skipSingleQuotedString(sql: string, start: number): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === '\'' && sql[index + 1] === '\'') {
      index += 2;
      continue;
    }
    if (sql[index] === '\'') {
      return index + 1;
    }
    index += 1;
  }
  return sql.length;
}

function skipDoubleQuotedIdentifier(sql: string, start: number): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === '"' && sql[index + 1] === '"') {
      index += 2;
      continue;
    }
    if (sql[index] === '"') {
      return index + 1;
    }
    index += 1;
  }
  return sql.length;
}

function skipLineComment(sql: string, start: number): number {
  let index = start + 2;
  while (index < sql.length && sql[index] !== '\n') {
    index += 1;
  }
  return index;
}

function skipBlockComment(sql: string, start: number): number {
  let index = start + 2;
  while (index < sql.length) {
    if (sql[index] === '*' && sql[index + 1] === '/') {
      return index + 2;
    }
    index += 1;
  }
  return sql.length;
}

function readDollarQuoteDelimiter(sql: string, start: number): string | null {
  let index = start + 1;
  while (index < sql.length && /[A-Za-z0-9_]/.test(sql[index] ?? '')) {
    index += 1;
  }
  if (sql[index] !== '$') {
    return null;
  }
  return sql.slice(start, index + 1);
}

function skipDollarQuotedString(sql: string, start: number, delimiter: string): number {
  const end = sql.indexOf(delimiter, start + delimiter.length);
  if (end < 0) {
    return sql.length;
  }
  return end + delimiter.length;
}

function consumeDigits(sql: string, start: number): number {
  let index = start;
  while (index < sql.length && /[0-9]/.test(sql[index] ?? '')) {
    index += 1;
  }
  return index;
}

function consumeIdentifier(sql: string, start: number): number {
  let index = start;
  while (index < sql.length && IDENTIFIER_PART_PATTERN.test(sql[index] ?? '')) {
    index += 1;
  }
  return index;
}

function consumeUnsupportedToken(sql: string, start: number): string {
  let index = start + 1;
  while (index < sql.length && !isStructuralDelimiter(sql[index] ?? '')) {
    index += 1;
  }
  return sql.slice(start, index);
}

function isStructuralDelimiter(value: string): boolean {
  return /\s|[,;()<>+=*/%|&!~[\]{}]/.test(value);
}
