import { SelectFixtureRewriter } from '../rewriter/SelectFixtureRewriter';
import type {
  AnalyzerFailureBehavior,
  SelectRewriteContext,
  SelectRewriterOptions,
} from '../types';

export type CatalogRewriterParams = unknown[] | Record<string, unknown>;

export interface CatalogRewriterInput {
  specId: string;
  spec: {
    id: string;
  };
  sql: string;
  params: CatalogRewriterParams;
  options?: unknown;
}

export interface CatalogRewriter {
  name: string;
  rewrite(input: CatalogRewriterInput): {
    sql: string;
    params: CatalogRewriterParams;
  };
}

export interface CatalogRewriterOptions extends SelectRewriterOptions {
  name?: string;
}

const DEFAULT_REWRITER_NAME = 'testkit-fixture';

/**
 * Creates a structural adapter that plugs SelectFixtureRewriter into
 * CatalogExecutor rewriter pipelines without adding a package dependency.
 */
export function createCatalogRewriter(
  options: CatalogRewriterOptions = {}
): CatalogRewriter {
  const { name = DEFAULT_REWRITER_NAME, ...rewriterOptions } = options;
  const fixtureRewriter = new SelectFixtureRewriter(rewriterOptions);

  return {
    name,
    rewrite({ sql, params, options: executionOptions }) {
      const result = fixtureRewriter.rewrite(
        sql,
        toSelectRewriteContext(executionOptions)
      );
      return {
        sql: result.sql,
        params,
      };
    },
  };
}

function toSelectRewriteContext(
  executionOptions: unknown
): SelectRewriteContext | undefined {
  if (!isPlainObject(executionOptions)) {
    return undefined;
  }

  const context: SelectRewriteContext = {};

  // Forward only the rewrite fields owned by testkit-core so unrelated
  // CatalogExecutor execution options do not leak into the rewriter.
  if (Array.isArray(executionOptions.fixtures)) {
    context.fixtures = executionOptions.fixtures as SelectRewriteContext['fixtures'];
  }

  if (isPlainObject(executionOptions.formatterOptions)) {
    context.formatterOptions =
      executionOptions.formatterOptions as SelectRewriteContext['formatterOptions'];
  }

  const analyzerFailureBehavior = executionOptions.analyzerFailureBehavior;
  if (isAnalyzerFailureBehavior(analyzerFailureBehavior)) {
    context.analyzerFailureBehavior = analyzerFailureBehavior;
  }

  if (Object.keys(context).length === 0) {
    return undefined;
  }

  return context;
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isAnalyzerFailureBehavior(
  value: unknown
): value is AnalyzerFailureBehavior {
  return value === 'error' || value === 'skip' || value === 'inject';
}
