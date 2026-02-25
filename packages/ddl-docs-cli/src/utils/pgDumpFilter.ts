// pg_dump administrative statements are line-start keyword driven, so a small
// regex list is a guarded fallback here instead of a full SQL AST parse.
const SKIP_PATTERNS: RegExp[] = [
  /^GRANT\b/i,
  /^REVOKE\b/i,
  /^ALTER\b.*\bOWNER\s+TO\b/i,
  /^SET\b/i,
  /^SELECT\s+pg_catalog\.set_config\b/i,
];

/**
 * Removes pg_dump-specific administrative SQL statements from DDL output.
 *
 * Filters out GRANT, REVOKE, ALTER ... OWNER TO, SET, \connect, and
 * SELECT pg_catalog.set_config statements that appear in pg_dump output
 * but are not relevant for schema documentation.
 */
export function filterPgDump(sql: string): string {
  const lines = sql.split('\n');
  const output: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (!skipping) {
      if (/^\\connect\b/i.test(trimmed)) {
        continue;
      }

      if (SKIP_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        skipping = true;
      } else {
        output.push(line);
      }
    }

    if (skipping && hasStatementTerminator(line)) {
      skipping = false;
    }
  }

  return output.join('\n');
}

function hasStatementTerminator(line: string): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (inLineComment) {
      break;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        index += 1;
        continue;
      }
      if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"' && next === '"') {
        index += 1;
        continue;
      }
      if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      inLineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === ';') {
      return true;
    }
  }

  return false;
}
