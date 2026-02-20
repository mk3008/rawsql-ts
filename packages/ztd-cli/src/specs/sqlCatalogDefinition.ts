/**
 * Canonical SQL catalog metadata shape shared by spec-layer and test-layer code.
 */
export interface SqlCatalogDefinition<TParams extends Record<string, unknown>, TRow extends Record<string, unknown>> {
  id: string;
  params: {
    shape: 'named';
    example: TParams;
  };
  output: {
    mapping: {
      columnMap: Record<string, string>;
    };
  };
  sql: string;
}

/**
 * Define a SQL catalog metadata object without adding test-runtime behavior.
 */
export function defineSqlCatalogDefinition<
  TParams extends Record<string, unknown>,
  TRow extends Record<string, unknown>,
>(def: SqlCatalogDefinition<TParams, TRow>): SqlCatalogDefinition<TParams, TRow> {
  return def;
}
