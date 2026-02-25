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

    if (skipping && line.includes(';')) {
      skipping = false;
    }
  }

  return output.join('\n');
}
