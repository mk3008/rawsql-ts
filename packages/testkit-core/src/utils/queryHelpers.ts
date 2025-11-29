type PrimitiveRow = Record<string, unknown> | unknown[];

const CRUD_COMMANDS = new Set(['insert', 'update', 'delete', 'merge']);

/**
 * Describes the minimal piece of a QueryResult needed for count-wrapper normalization.
 */
export interface CountableResult<Row extends PrimitiveRow = PrimitiveRow> {
  command?: string | null;
  rowCount?: number | null;
  fields?: { name: string }[] | null;
  rows: Row[];
}

/**
 * Extracts the numeric value from a SELECT COUNT(*) row emitted by the rewriter.
 */
export const extractCountValue = <T extends CountableResult>(result: T): number | null => {
  // Only consider SELECT results that expose a single `count` column.
  if ((result.command ?? '').toLowerCase() !== 'select') {
    return null;
  }

  const [field] = result.fields ?? [];
  if (!field || field.name !== 'count' || result.rows.length !== 1) {
    return null;
  }

  const row = result.rows[0];
  const value =
    Array.isArray(row) ?
      row[0] :
      (row as Record<string, unknown>)[field.name];

  const numericCount = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isNaN(numericCount) ? null : numericCount;
};

/**
 * Rewrites a count-wrapper response back into the originating CRUD command shape.
 */
export const applyCountWrapper = <T extends CountableResult>(
  result: T,
  sourceCommand: string | null,
  isCountWrapper: boolean
): T => {
  // Skip normalization when the rewrite did not produce a SELECT-based count wrapper.
  if (!isCountWrapper) {
    return result;
  }

  // Map the stored command back to lowercase CRUD names that pg clients expect.
  const commandName = sourceCommand?.toLowerCase() ?? null;
  if (!commandName || !CRUD_COMMANDS.has(commandName)) {
    return result;
  }

  // Rely on the synthetic COUNT result to update rowCount/command for consumers.
  const countValue = extractCountValue(result);
  if (countValue === null) {
    return result;
  }

  return {
    ...result,
    rowCount: countValue,
    command: commandName as typeof result.command,
  };
};

/**
 * Reindexes `$N` placeholders so newly injected bindings remain contiguous.
 */
export const alignRewrittenParameters = (sql: string, params?: unknown[]): { sql: string; params?: unknown[] } => {
  if (!params || params.length === 0) {
    return { sql, params };
  }

  // Capture every rewritten placeholder index so we can renumber them from 1..N.
  const matches = Array.from(sql.matchAll(/\$(\d+)/g));
  if (matches.length === 0) {
    return { sql, params: [] };
  }

  // Assign contiguous placeholder numbers in the order they appear.
  const placeholderSet = new Map<number, number>();
  const orderedIndexes = [...new Set(matches.map((match) => Number(match[1])))].sort((a, b) => a - b);
  orderedIndexes.forEach((index, idx) => {
    placeholderSet.set(index, idx + 1);
  });

  // Replace the SQL text so higher-numbered placeholders cascade down to the new indexes.
  const alignedSql = [...placeholderSet.entries()]
    .sort((a, b) => b[0] - a[0])
    .reduce((acc, [original, mapped]) => acc.split(`$${original}`).join(`$${mapped}`), sql);

  // Reorder the parameter array to match the renumbered placeholders.
  const alignedValues = [...placeholderSet.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([original]) => params[original - 1]);

  return { sql: alignedSql, params: alignedValues };
};
