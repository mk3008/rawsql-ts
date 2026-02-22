/**
 * Supported major schema version for PreviewJson consumed by the diff core.
 */
export const PREVIEW_SCHEMA_VERSION = 1;

/**
 * Supported major schema version for DiffJson produced by the diff core.
 */
export const DIFF_SCHEMA_VERSION = 1;

/**
 * Error code taxonomy emitted by the diff core.
 */
export type DiffCoreErrorCode = 'INVALID_INPUT' | 'UNSUPPORTED_SCHEMA_VERSION';

/**
 * Runtime error emitted by the diff core when preview input is invalid.
 */
export class DiffCoreError extends Error {
  readonly code: DiffCoreErrorCode;
  readonly path?: string;
  readonly schemaVersion?: number;
  readonly details?: string;

  constructor(
    message: string,
    options: {
      code: DiffCoreErrorCode;
      path?: string;
      schemaVersion?: number;
      details?: string;
    }
  ) {
    super(message);
    this.name = 'DiffCoreError';
    this.code = options.code;
    this.path = options.path;
    this.schemaVersion = options.schemaVersion;
    this.details = options.details;
  }
}

/**
 * Normalized case payload used for deterministic diff calculation.
 */
export interface DiffCase {
  id: string;
  title: string;
  input: unknown;
  output: unknown;
}

/**
 * Normalized catalog payload used for deterministic diff calculation.
 */
export interface DiffCatalog {
  kind: 'sql' | 'function';
  catalogId: string;
  title: string;
  description?: string;
  definition?: string;
  fixtures?: string[];
  cases: DiffCase[];
}

/**
 * Pure intermediate specification model derived from PreviewJson.
 */
export interface SpecificationModel {
  schemaVersion: typeof PREVIEW_SCHEMA_VERSION;
  totals: {
    catalogs: number;
    sqlCatalogs: number;
    functionCatalogs: number;
    tests: number;
  };
  catalogs: DiffCatalog[];
}

/**
 * Deterministic diff JSON contract generated from base/head preview JSON documents.
 */
export interface DiffJson {
  schemaVersion: typeof DIFF_SCHEMA_VERSION;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
  baseMode: 'merge-base' | 'ref';
  totals: {
    base: { catalogs: number; tests: number };
    head: { catalogs: number; tests: number };
  };
  summary: {
    catalogs: { added: number; removed: number; updated: number };
    cases: { added: number; removed: number; updated: number };
  };
  catalogs: {
    added: Array<{ catalogAfter: DiffCatalog }>;
    removed: Array<{ catalogBefore: DiffCatalog }>;
    updated: Array<{
      catalogId: string;
      catalogBefore: DiffCatalog;
      catalogAfter: DiffCatalog;
      cases: {
        added: Array<{ after: DiffCase }>;
        removed: Array<{ before: DiffCase }>;
        updated: Array<{ before: DiffCase; after: DiffCase }>;
      };
    }>;
  };
}

/**
 * SQL catalog case shape required by the diff core preview input.
 */
export interface PreviewSqlCase {
  id: string;
  title: string;
  params: Record<string, unknown>;
  expected: unknown;
}

/**
 * SQL catalog shape required by the diff core preview input.
 */
export interface PreviewSqlCatalog {
  id: string;
  title: string;
  description?: string;
  definitionPath?: string;
  fixtures?: Array<{ tableName: string }>;
  cases: PreviewSqlCase[];
}

/**
 * Function test case shape required by the diff core preview input.
 */
export interface PreviewFunctionCase {
  id: string;
  title: string;
  input: unknown;
  output: unknown;
}

/**
 * Function catalog shape required by the diff core preview input.
 */
export interface PreviewFunctionCatalog {
  id: string;
  title: string;
  description?: string;
  definitionPath?: string;
  cases: PreviewFunctionCase[];
}

/**
 * Deterministic preview JSON contract consumed by the diff core.
 */
export interface PreviewJson {
  schemaVersion: number;
  sqlCaseCatalogs: PreviewSqlCatalog[];
  testCaseCatalogs: PreviewFunctionCatalog[];
}

/**
 * Input arguments for `buildDiffJson`.
 */
export interface BuildDiffJsonArgs {
  base: { ref: string; sha: string; previewJson: PreviewJson };
  head: { ref: string; sha: string; previewJson: PreviewJson };
  baseMode: 'merge-base' | 'ref';
}
