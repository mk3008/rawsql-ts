import type { TableFixture } from '@rawsql-ts/testkit-core';
import { expect, it } from 'vitest';
import {
  defineSqlCatalogDefinition as defineSqlCatalogDefinitionFn,
  type SqlCatalogDefinition,
} from '../../src/specs/sqlCatalogDefinition';

/**
 * Pure SQL catalog definition type shared with src-level specs.
 */
export type { SqlCatalogDefinition };

/**
 * Single runnable SQL catalog case with optional arranged parameters and expected rows.
 */
export interface SqlCatalogTestCase<
  TParams extends Record<string, unknown>,
  TRow extends Record<string, unknown>,
> {
  id: string;
  title: string;
  arrange?: () => TParams;
  expected: TRow[];
}

/**
 * Executable SQL catalog test specification including fixtures and deterministic cases.
 */
export interface SqlCatalogTestSpec<
  TParams extends Record<string, unknown>,
  TRow extends Record<string, unknown>,
> {
  id: string;
  title: string;
  description?: string;
  definitionPath?: string;
  fixtures: TableFixture[];
  catalog: SqlCatalogDefinition<TParams, TRow>;
  cases: SqlCatalogTestCase<TParams, TRow>[];
}

export type SqlCatalog<
  TParams extends Record<string, unknown> = Record<string, unknown>,
  TRow extends Record<string, unknown> = Record<string, unknown>,
> = SqlCatalogTestSpec<TParams, TRow>;

/**
 * Executes SQL with fixtures and projects engine rows into DTO rows by `columnMap`.
 */
export type SqlCatalogExecutor = (
  sql: string,
  params: Record<string, unknown>,
  fixtures: TableFixture[],
  columnMap: Record<string, string>
) => Promise<Record<string, unknown>[]>;

/**
 * Runtime hooks used by `runSqlCatalog`.
 */
export interface RunSqlCatalogOptions {
  executor: SqlCatalogExecutor;
  onCaseExecuted?: (id: string) => void;
}

/**
 * Define SQL catalog metadata in a pure, reusable shape.
 */
export const defineSqlCatalogDefinition = defineSqlCatalogDefinitionFn;

/**
 * Define deterministic SQL catalog test specs with stable case ordering.
 */
export function defineSqlCatalog<
  TParams extends Record<string, unknown>,
  TRow extends Record<string, unknown>,
>(spec: SqlCatalogTestSpec<TParams, TRow>): SqlCatalogTestSpec<TParams, TRow> {
  return {
    ...spec,
    cases: [...spec.cases].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/**
 * Register each SQL catalog case as an executable vitest test.
 */
export function runSqlCatalog<
  TParams extends Record<string, unknown>,
  TRow extends Record<string, unknown>,
>(spec: SqlCatalogTestSpec<TParams, TRow>, opts: RunSqlCatalogOptions): void {
  for (const item of spec.cases) {
    it(`[${spec.catalog.id}] ${item.id} ${item.title}`, async () => {
      const params = item.arrange ? item.arrange() : spec.catalog.params.example;
      const actualRows = await opts.executor(
        spec.catalog.sql,
        params,
        spec.fixtures,
        spec.catalog.output.mapping.columnMap
      );

      // Keep verification deterministic in the runner, not in spec definitions.
      expect(actualRows as TRow[]).toEqual(item.expected);
      opts.onCaseExecuted?.(item.id);
    });
  }
}

/**
 * Export SQL catalog evidence in a deterministic, pure shape for specification mode.
 */
export function exportSqlCatalogEvidence(
  catalogs: Array<SqlCatalogTestSpec<Record<string, unknown>, Record<string, unknown>>>
): {
  catalogs: Array<{
    id: string;
    title: string;
    description?: string;
    definitionPath?: string;
    params: { shape: 'named'; example: Record<string, unknown> };
    output: { mapping: { columnMap: Record<string, string> } };
    sql: string;
    fixtures: Array<{
      tableName: string;
      schema?: { columns: Record<string, string> };
      rowsCount: number;
    }>;
    cases: Array<{
      id: string;
      title: string;
      params: Record<string, unknown>;
      expected: Record<string, unknown>[];
    }>;
  }>;
} {
  return {
    catalogs: [...catalogs]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((catalog) => ({
        id: catalog.id,
        title: catalog.title,
        ...(catalog.description ? { description: catalog.description } : {}),
        ...(catalog.definitionPath ? { definitionPath: catalog.definitionPath } : {}),
        params: {
          shape: 'named',
          example: { ...catalog.catalog.params.example },
        },
        output: {
          mapping: {
            columnMap: Object.fromEntries(
              Object.entries(catalog.catalog.output.mapping.columnMap).sort((a, b) => a[0].localeCompare(b[0]))
            ),
          },
        },
        // Keep SQL as-is so evidence is a lossless projection of primary test inputs.
        sql: catalog.catalog.sql,
        fixtures: [...catalog.fixtures]
          .map((fixture) => ({
            tableName: fixture.tableName,
            ...(fixture.schema && fixture.schema.columns
              ? {
                  schema: {
                    columns: Object.fromEntries(
                      Object.entries(fixture.schema.columns).sort((a, b) => a[0].localeCompare(b[0]))
                    ),
                  },
                }
              : {}),
            rowsCount: Array.isArray(fixture.rows) ? fixture.rows.length : 0,
          }))
          .sort((a, b) => a.tableName.localeCompare(b.tableName)),
        cases: [...catalog.cases]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((item) => ({
            id: item.id,
            title: item.title,
            params: buildCaseParams(catalog.catalog.params.example, item.arrange),
            expected: item.expected.map((row) => ({ ...row })),
          })),
      })),
  };
}

function buildCaseParams(
  baseParams: Record<string, unknown>,
  arrange?: () => Record<string, unknown>
): Record<string, unknown> {
  const arranged = arrange ? arrange() : undefined;
  const merged = arranged ? { ...baseParams, ...arranged } : { ...baseParams };
  return Object.fromEntries(Object.entries(merged).sort((a, b) => a[0].localeCompare(b[0])));
}
