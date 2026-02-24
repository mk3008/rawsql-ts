import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { DdlInput, SqlSource } from '../types';

export function ensureDirectory(directoryPath: string): void {
  if (!existsSync(directoryPath)) {
    mkdirSync(directoryPath, { recursive: true });
  }
}

export function toWorkspaceRelative(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

export function collectSqlFiles(directories: DdlInput[], files: DdlInput[], extensions: string[]): SqlSource[] {
  const extensionSet = new Set(extensions.map((entry) => normalizeExtension(entry)));
  const sources: SqlSource[] = [];
  const seen = new Set<string>();

  for (const entry of directories) {
    const { path: directory, instance } = normalizeDdlInput(entry);
    const resolvedDirectory = path.resolve(directory);
    if (!existsSync(resolvedDirectory)) {
      throw new Error(`DDL directory not found: ${resolvedDirectory}`);
    }
    // Recommended layout: ddl/{instance}/{schema}.sql
    // If no explicit instance is given, auto-detect from first-level subfolder names.
    // Files placed directly under the root dir get instance = "" (no instance).
    if (instance) {
      scanDirectoryRecursive(resolvedDirectory, extensionSet, sources, seen, instance);
    } else {
      scanRootDirectory(resolvedDirectory, extensionSet, sources, seen);
    }
  }

  for (const entry of files) {
    const { path: filePath, instance } = normalizeDdlInput(entry);
    const resolvedPath = path.resolve(filePath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`DDL file not found: ${resolvedPath}`);
    }
    appendSqlFile(resolvedPath, extensionSet, sources, seen, instance);
  }

  return sources.sort((a, b) => a.path.localeCompare(b.path));
}

function normalizeDdlInput(entry: DdlInput | string): { path: string; instance: string } {
  if (typeof entry === 'string') {
    return { path: entry, instance: '' };
  }
  return {
    path: entry.path,
    instance: entry.instance ?? '',
  };
}

export function expandGlobPatterns(patterns: string[]): string[] {
  const matches = new Set<string>();
  for (const pattern of patterns) {
    const normalizedPattern = pattern.replace(/\\/g, '/');
    const rootDir = resolveGlobRoot(normalizedPattern);
    if (!existsSync(rootDir)) {
      continue;
    }
    const allFiles: string[] = [];
    collectAllFiles(rootDir, allFiles);
    const matcher = globToRegExp(path.resolve(normalizedPattern).replace(/\\/g, '/'));
    for (const filePath of allFiles) {
      const normalizedFile = filePath.replace(/\\/g, '/');
      if (matcher.test(normalizedFile)) {
        matches.add(filePath);
      }
    }
  }
  return Array.from(matches).sort((a, b) => a.localeCompare(b));
}

/**
 * Scans the root DDL directory.
 * First-level subdirectories become instance names (recommended: ddl/{instance}/{schema}.sql).
 * Files placed directly in the root get instance = "" (no instance).
 */
function scanRootDirectory(
  rootDirectory: string,
  extensionSet: Set<string>,
  sources: SqlSource[],
  seen: Set<string>
): void {
  const entries = readdirSync(rootDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = path.join(rootDirectory, entry.name);
    if (entry.isDirectory()) {
      scanDirectoryRecursive(resolved, extensionSet, sources, seen, entry.name);
      continue;
    }
    if (entry.isFile()) {
      appendSqlFile(resolved, extensionSet, sources, seen, '');
    }
  }
}

/**
 * Recursively scans a directory with a fixed instance name.
 */
function scanDirectoryRecursive(
  directory: string,
  extensionSet: Set<string>,
  sources: SqlSource[],
  seen: Set<string>,
  instance: string
): void {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanDirectoryRecursive(resolved, extensionSet, sources, seen, instance);
      continue;
    }
    if (entry.isFile()) {
      appendSqlFile(resolved, extensionSet, sources, seen, instance);
    }
  }
}

function appendSqlFile(
  filePath: string,
  extensionSet: Set<string>,
  sources: SqlSource[],
  seen: Set<string>,
  instance: string
): void {
  const extension = normalizeExtension(path.extname(filePath));
  if (!extensionSet.has(extension)) {
    return;
  }
  const normalizedPath = path.normalize(filePath);
  if (seen.has(normalizedPath)) {
    return;
  }
  const sql = readFileSync(filePath, 'utf8');
  if (!sql.trim()) {
    return;
  }
  seen.add(normalizedPath);
  sources.push({
    path: toWorkspaceRelative(filePath),
    sql,
    instance,
  });
}

function normalizeExtension(extension: string): string {
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

function collectAllFiles(directory: string, acc: string[]): void {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectAllFiles(resolved, acc);
      continue;
    }
    if (entry.isFile()) {
      acc.push(path.resolve(resolved));
    }
  }
}

function resolveGlobRoot(pattern: string): string {
  const absolute = path.resolve(pattern);
  const tokens = absolute.split('/');
  const rootTokens: string[] = [];
  for (const token of tokens) {
    if (token.includes('*') || token.includes('?')) {
      break;
    }
    rootTokens.push(token);
  }
  if (rootTokens.length === 0) {
    return process.cwd();
  }
  return rootTokens.join('/');
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withGlob = escaped
    .replace(/\\\*\\\*/g, '___DOUBLE_STAR___')
    .replace(/\\\*/g, '[^/]*')
    .replace(/\\\?/g, '[^/]')
    .replace(/___DOUBLE_STAR___/g, '.*');
  return new RegExp(`^${withGlob}$`);
}
