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
  /**
   * Literal specification payload used by evidence exporters.
   * This keeps review artifacts aligned with test source facts without inference.
   */
  evidence?: {
    input: unknown;
    expected: 'success' | 'throws' | 'errorResult';
    output?: unknown;
    error?: {
      name: string;
      message: string;
      match: 'equals' | 'contains';
    };
    tags?: string[];
    focus?: string;
    refs?: Array<{ label: string; url: string }>;
  };
}

/**
 * Collection of deterministic test cases grouped under one catalog id.
 */
export interface TestCaseCatalog<TContext = unknown, TResult = unknown> {
  id: string;
  title: string;
  description?: string;
  definitionPath?: string;
  refs?: Array<{ label: string; url: string }>;
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
    definitionPath?: string;
    refs?: Array<{ label: string; url: string }>;
    cases: Array<{
      id: string;
      title: string;
      description?: string;
      input: unknown;
      expected: 'success' | 'throws' | 'errorResult';
      output?: unknown;
      error?: {
        name: string;
        message: string;
        match: 'equals' | 'contains';
      };
      tags?: string[];
      focus?: string;
      refs?: Array<{ label: string; url: string }>;
    }>;
  }>;
}

interface TestCaseCatalogEvidenceInput {
  id: string;
  title: string;
  description?: string;
  definitionPath?: string;
  refs?: Array<{ label: string; url: string }>;
  cases: Array<{
    id: string;
    title: string;
    description?: string;
    input?: unknown;
    expected?: 'success' | 'throws' | 'errorResult';
    output?: unknown;
    error?: {
      name: string;
      message: string;
      match: 'equals' | 'contains';
    };
    tags?: string[];
    focus?: string;
    refs?: Array<{ label: string; url: string }>;
    evidence?: {
      input: unknown;
      expected: 'success' | 'throws' | 'errorResult';
      output?: unknown;
      error?: {
        name: string;
        message: string;
        match: 'equals' | 'contains';
      };
      tags?: string[];
      focus?: string;
      refs?: Array<{ label: string; url: string }>;
    };
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
        ...(catalog.definitionPath ? { definitionPath: catalog.definitionPath } : {}),
        ...(Array.isArray(catalog.refs) && catalog.refs.length > 0
          ? {
            refs: [...catalog.refs]
              .filter((ref) => typeof ref.label === 'string' && ref.label.trim().length > 0 && typeof ref.url === 'string' && ref.url.trim().length > 0)
              .map((ref) => ({ label: ref.label.trim(), url: ref.url.trim() }))
              .sort((a, b) => a.label.localeCompare(b.label) || a.url.localeCompare(b.url))
          }
          : {}),
        cases: [...catalog.cases]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((entry) => {
            const source = entry.evidence ?? entry;
            const expected = source.expected ?? 'success';
            return {
              id: entry.id,
              title: entry.title,
              ...(entry.description ? { description: entry.description } : {}),
              input: source.input,
              expected,
              ...(expected === 'throws' ? { error: source.error } : { output: source.output }),
              ...(source.tags && source.tags.length > 0
                ? { tags: [...source.tags].sort((a, b) => a.localeCompare(b)) }
                : {}),
              ...(source.focus ? { focus: source.focus } : {}),
              ...(Array.isArray(source.refs) && source.refs.length > 0
                ? {
                  refs: [...source.refs]
                    .filter((ref) => typeof ref.label === 'string' && ref.label.trim().length > 0 && typeof ref.url === 'string' && ref.url.trim().length > 0)
                    .map((ref) => ({ label: ref.label.trim(), url: ref.url.trim() }))
                    .sort((a, b) => a.label.localeCompare(b.label) || a.url.localeCompare(b.url))
                }
                : {}),
            };
          }),
      })),
  };
}
