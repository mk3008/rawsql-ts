/** Table-usage contexts that sql-grep-core can classify from syntax. */
export const TABLE_QUERY_USAGE_KINDS = [
  'from',
  'subquery-from',
  'cte-body-from',
  'join',
  'using',
  'insert-target',
  'update-target',
  'delete-target',
] as const;

/** Column-usage contexts that sql-grep-core can classify from syntax. */
export const COLUMN_QUERY_USAGE_KINDS = [
  'select',
  'where',
  'group-by',
  'having',
  'order-by',
  'join-on',
  'join-using',
  'update-set',
  'returning',
  'insert-column',
  'subquery',
  'cte',
] as const;

/** Canonical runtime list for every usage kind emitted by sql-grep-core. */
export const QUERY_USAGE_KINDS = [
  ...TABLE_QUERY_USAGE_KINDS,
  ...COLUMN_QUERY_USAGE_KINDS,
] as const;

export type QueryUsageKind = typeof QUERY_USAGE_KINDS[number];

const queryUsageKindSet: ReadonlySet<string> = new Set(QUERY_USAGE_KINDS);

/** Return whether a runtime value is a canonical sql-grep usage kind. */
export function isQueryUsageKind(value: string): value is QueryUsageKind {
  return queryUsageKindSet.has(value);
}
