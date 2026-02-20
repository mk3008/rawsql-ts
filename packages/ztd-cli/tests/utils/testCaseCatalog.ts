import { test } from 'vitest';

/**
 * A deterministic executable test-case entry.
 */
export interface TestCaseCatalogEntry<TContext = unknown, TResult = unknown> {
  id: string;
  title: string;
  description?: string;
  arrange?: () => Promise<TContext> | TContext;
  act: (context: TContext) => Promise<TResult> | TResult;
  assert: (result: TResult, context: TContext) => Promise<void> | void;
}

/**
 * Collection of deterministic test cases grouped under one catalog id.
 */
export interface TestCaseCatalog<TContext = unknown, TResult = unknown> {
  id: string;
  title: string;
  description?: string;
  cases: TestCaseCatalogEntry<TContext, TResult>[];
}

/**
 * Stable evidence document format exported from test-case catalogs.
 */
export interface TestCaseCatalogEvidenceDocument {
  schemaVersion: 1;
  catalogs: Array<{
    id: string;
    title: string;
    description?: string;
    cases: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

interface TestCaseCatalogEvidenceInput {
  id: string;
  title: string;
  description?: string;
  cases: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

/**
 * Define an executable test-case catalog with stable IDs.
 */
export function defineTestCaseCatalog<TContext = unknown, TResult = unknown>(
  catalog: TestCaseCatalog<TContext, TResult>
): TestCaseCatalog<TContext, TResult> {
  return {
    ...catalog,
    cases: [...catalog.cases].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/**
 * Register all catalog entries as vitest tests without inferring behavior from source text.
 * When `arrange` is omitted, the runner passes `undefined` as context.
 */
export function runTestCaseCatalog<TContext = unknown, TResult = unknown>(
  catalog: TestCaseCatalog<TContext, TResult>,
  hooks?: { onCaseExecuted?: (id: string) => void }
): void {
  for (const entry of catalog.cases) {
    test(`[${catalog.id}] ${entry.id} ${entry.title}`, async () => {
      const context = entry.arrange ? await entry.arrange() : (undefined as TContext);
      const result = await entry.act(context);
      await entry.assert(result, context);
      hooks?.onCaseExecuted?.(entry.id);
    });
  }
}

/**
 * Convert catalog objects into a deterministic evidence document for specification mode.
 */
export function exportTestCaseCatalogEvidence(
  catalogs: TestCaseCatalogEvidenceInput[]
): TestCaseCatalogEvidenceDocument {
  return {
    schemaVersion: 1,
    catalogs: [...catalogs]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((catalog) => ({
        id: catalog.id,
        title: catalog.title,
        ...(catalog.description ? { description: catalog.description } : {}),
        cases: [...catalog.cases]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((entry) => ({
            id: entry.id,
            title: entry.title,
            ...(entry.description ? { description: entry.description } : {}),
          })),
      })),
  };
}
