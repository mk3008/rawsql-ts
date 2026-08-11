import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { DdlInput } from '@rawsql-ts/investigation-core';
import { discoverObservedSqlAssetFiles } from '@rawsql-ts/sql-grep-core';
import { McpInputError } from './inputError';
import { normalizeWorkspaceRoot, resolveWorkspacePath } from './workspacePaths';

/** Resource limits applied before DDL sources are returned to analysis code. */
export interface DdlSourceLimits {
  maxFileBytes: number;
  maxFiles: number;
  maxInlineBytes: number;
  maxTotalBytes: number;
}

/** Inline and workspace-relative inputs accepted by the common DDL resolver. */
export interface ResolveDdlSourcesInput {
  inlineDdl?: string | readonly string[];
  limits?: Partial<DdlSourceLimits>;
  paths?: string | readonly string[];
  workspaceRoot: string;
}

/** Default limits aligned with the existing workspace SQL scan policy. */
export const DEFAULT_DDL_SOURCE_LIMITS: Readonly<DdlSourceLimits> = {
  maxFileBytes: 50 * 1024 * 1024,
  maxFiles: 5_000,
  maxInlineBytes: 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
};

/**
 * Resolve inline and workspace-backed DDL into the existing analysis input type.
 * Sources remain separate and retain file identity; this utility does not merge
 * schema objects or define a conflict-precedence rule.
 */
export function resolveDdlSources(input: ResolveDdlSourcesInput): DdlInput[] {
  const workspaceRoot = normalizeWorkspaceRoot(input.workspaceRoot);
  const limits = resolveLimits(input.limits);
  const inlineDdl = normalizeMany(input.inlineDdl);
  const requestedPaths = normalizeMany(input.paths);
  let totalBytes = 0;
  const inlineSources = inlineDdl.map((sql, index): DdlInput => {
    const bytes = validateDdlText(sql, limits.maxInlineBytes, `<inline:${index + 1}>`);
    totalBytes = checkedTotalBytes(totalBytes, bytes, limits.maxTotalBytes);
    return { filePath: `<inline:${index + 1}>`, sql };
  });

  const fileCandidates = new Map<string, string>();
  for (const requestedPath of requestedPaths) {
    const resolved = resolveWorkspacePath(workspaceRoot, requestedPath, 'file-or-directory');
    if (resolved.kind === 'file') {
      addSqlFileCandidate(fileCandidates, resolved.absolutePath, resolved.relativePath);
    } else {
      const discovered = discoverObservedSqlAssetFiles(resolved.absolutePath, {
        maxFiles: Math.min(limits.maxFiles + 1, Number.MAX_SAFE_INTEGER),
      });
      if (discovered.length === 0) {
        throw new McpInputError('DDL_DIRECTORY_EMPTY', `DDL directory contains no discoverable .sql files: ${requestedPath}`);
      }
      if (discovered.length > limits.maxFiles) {
        throw new McpInputError('DDL_FILE_LIMIT', `DDL files exceed the configured limit of ${limits.maxFiles}.`);
      }
      for (const absolutePath of discovered) {
        const relativeCandidate = path.relative(workspaceRoot, absolutePath);
        const confined = resolveWorkspacePath(workspaceRoot, relativeCandidate, 'file');
        addSqlFileCandidate(fileCandidates, confined.absolutePath, confined.relativePath);
      }
    }
    if (fileCandidates.size > limits.maxFiles) {
      throw new McpInputError('DDL_FILE_LIMIT', `DDL files exceed the configured limit of ${limits.maxFiles}.`);
    }
  }

  const pathSources = [...fileCandidates.entries()]
    .map(([absolutePath, relativePath]) => ({ absolutePath, relativePath }))
    .sort((left, right) => compareCodeUnits(left.relativePath, right.relativePath))
    .map(({ absolutePath, relativePath }): DdlInput => {
      const bytes = statSync(absolutePath).size;
      if (bytes > limits.maxFileBytes) {
        throw new McpInputError('DDL_FILE_SIZE_LIMIT', `DDL file exceeds ${limits.maxFileBytes} bytes: ${relativePath}`);
      }
      totalBytes = checkedTotalBytes(totalBytes, bytes, limits.maxTotalBytes);
      const sql = readFileSync(absolutePath, 'utf8');
      validateDdlText(sql, limits.maxFileBytes, relativePath);
      return { filePath: relativePath, sql };
    });

  return [...inlineSources, ...pathSources];
}

function addSqlFileCandidate(candidates: Map<string, string>, absolutePath: string, relativePath: string): void {
  if (path.extname(relativePath).toLowerCase() !== '.sql') {
    throw new McpInputError('DDL_FILE_EXTENSION', `DDL files must use the .sql extension: ${relativePath}`);
  }
  candidates.set(absolutePath, relativePath);
}

function checkedTotalBytes(current: number, added: number, limit: number): number {
  if (current + added > limit) {
    throw new McpInputError('DDL_TOTAL_SIZE_LIMIT', `DDL sources exceed the configured total limit of ${limit} bytes.`);
  }
  return current + added;
}

function validateDdlText(sql: string, byteLimit: number, source: string): number {
  if (sql.includes('\0')) throw new McpInputError('BINARY_INPUT', `DDL source contains a NUL byte: ${source}`);
  const bytes = Buffer.byteLength(sql);
  if (bytes === 0) throw new McpInputError('DDL_SOURCE_EMPTY', `DDL source is empty: ${source}`);
  if (bytes > byteLimit) {
    throw new McpInputError('DDL_FILE_SIZE_LIMIT', `DDL source exceeds ${byteLimit} bytes: ${source}`);
  }
  return bytes;
}

function normalizeMany(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : [...value];
}

function resolveLimits(overrides: Partial<DdlSourceLimits> | undefined): DdlSourceLimits {
  const limits = { ...DEFAULT_DDL_SOURCE_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new McpInputError('DDL_LIMIT_INVALID', `${name} must be a positive integer.`);
    }
  }
  return limits;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
