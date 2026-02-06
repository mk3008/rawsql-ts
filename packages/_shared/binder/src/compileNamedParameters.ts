const IDENTIFIER_START = /^[A-Za-z_]$/;
const IDENTIFIER_PART = /^[A-Za-z0-9_]$/;

type State = 'normal' | 'single_quote' | 'double_quote' | 'line_comment' | 'block_comment' | 'dollar_quote';

const isIdentifierStart = (char: string): boolean => IDENTIFIER_START.test(char);
const isIdentifierPart = (char: string): boolean => IDENTIFIER_PART.test(char);

const parseDollarTag = (sql: string, index: number): string | null => {
  if (sql[index] !== '$') {
    return null;
  }

  const next = sql[index + 1];
  if (next === '$') {
    return '$$';
  }

  if (!next || !isIdentifierStart(next)) {
    return null;
  }

  let cursor = index + 1;
  while (cursor < sql.length && isIdentifierPart(sql[cursor])) {
    cursor += 1;
  }

  if (sql[cursor] !== '$') {
    return null;
  }

  return sql.slice(index, cursor + 1);
};

const ensureNamedParams = (params: Record<string, unknown>): void => {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('Named parameters must be provided as an object.');
  }
};

const resolvePlaceholder = (style: PlaceholderStyle, index: number): string => {
  switch (style) {
    case 'pg-indexed':
      return `$${index}`;
    case 'question':
      return '?';
    default:
      throw new Error(`Unsupported placeholder style: ${style}`);
  }
};

/**
 * Object map of named parameters keyed by identifier.
 */
export type NamedParams = Record<string, unknown>;

/**
 * Supported placeholder styles for compiled SQL output.
 */
export type PlaceholderStyle = 'pg-indexed' | 'question';

/**
 * Result of compiling a named-parameter SQL string.
 */
export type CompileResult = {
  sql: string;
  values: unknown[];
  orderedNames: string[];
};

/**
 * Compiles named SQL parameters into driver-specific placeholders.
 *
 * - Named identifiers follow the pattern `[A-Za-z_][A-Za-z0-9_]*`.
 * - String literals, quoted identifiers, and comments are not rewritten.
 * - Missing named parameter values cause an error.
 *
 * @param sql - SQL text containing named parameters.
 * @param params - Named parameter values keyed by identifier.
 * @param style - Placeholder style for the compiled output.
 * @returns The compiled SQL, ordered values, and ordered parameter names.
 */
export const compileNamedParameters = (
  sql: string,
  params: NamedParams,
  style: PlaceholderStyle
): CompileResult => {
  ensureNamedParams(params);

  let state: State = 'normal';
  let dollarTag: string | null = null;
  let compiledSql = '';
  const values: unknown[] = [];
  const orderedNames: string[] = [];
  let found = false;

  // Walk the SQL text to avoid rewriting placeholders inside strings or comments.
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (state === 'line_comment') {
      compiledSql += char;
      if (char === '\n') {
        state = 'normal';
      }
      continue;
    }

    if (state === 'block_comment') {
      compiledSql += char;
      if (char === '*' && next === '/') {
        compiledSql += next;
        index += 1;
        state = 'normal';
      }
      continue;
    }

    if (state === 'single_quote') {
      compiledSql += char;
      if (char === "'" && next === "'") {
        compiledSql += next;
        index += 1;
        continue;
      }
      if (char === "'") {
        state = 'normal';
      }
      continue;
    }

    if (state === 'double_quote') {
      compiledSql += char;
      if (char === '"' && next === '"') {
        compiledSql += next;
        index += 1;
        continue;
      }
      if (char === '"') {
        state = 'normal';
      }
      continue;
    }

    if (state === 'dollar_quote') {
      if (dollarTag && sql.startsWith(dollarTag, index)) {
        compiledSql += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = null;
        state = 'normal';
        continue;
      }
      compiledSql += char;
      continue;
    }

    if (char === '-' && next === '-') {
      compiledSql += char + next;
      index += 1;
      state = 'line_comment';
      continue;
    }

    if (char === '/' && next === '*') {
      compiledSql += char + next;
      index += 1;
      state = 'block_comment';
      continue;
    }

    if (char === "'") {
      compiledSql += char;
      state = 'single_quote';
      continue;
    }

    if (char === '"') {
      compiledSql += char;
      state = 'double_quote';
      continue;
    }

    if (char === '$') {
      const tag = parseDollarTag(sql, index);
      if (tag) {
        compiledSql += tag;
        index += tag.length - 1;
        dollarTag = tag;
        state = 'dollar_quote';
        continue;
      }
    }

    if (char === ':' && next === ':') {
      compiledSql += '::';
      index += 1;
      continue;
    }

    if (char === ':' && next && isIdentifierStart(next)) {
      let cursor = index + 1;
      while (cursor < sql.length && isIdentifierPart(sql[cursor])) {
        cursor += 1;
      }
      const name = sql.slice(index + 1, cursor);
      if (!Object.prototype.hasOwnProperty.call(params, name)) {
        throw new Error(`Missing value for named parameter ":${name}".`);
      }
      const value = params[name];
      // Duplicate placeholders are allowed; each occurrence becomes its own positional binding.
      values.push(value);
      orderedNames.push(name);
      compiledSql += resolvePlaceholder(style, values.length);
      found = true;
      index = cursor - 1;
      continue;
    }

    compiledSql += char;
  }

  if (!found) {
    throw new Error('No named parameters found in SQL.');
  }

  return {
    sql: compiledSql,
    values,
    orderedNames,
  };
};
