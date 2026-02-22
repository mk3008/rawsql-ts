import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { SqlSource } from '../types';

export function ensureDirectory(directoryPath: string): void {
  if (!existsSync(directoryPath)) {
    mkdirSync(directoryPath, { recursive: true });
  }
}

export function toWorkspaceRelative(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

export function collectSqlFiles(directories: string[], files: string[], extensions: string[]): SqlSource[] {
  const extensionSet = new Set(extensions.map((entry) => normalizeExtension(entry)));
  const sources: SqlSource[] = [];
  const seen = new Set<string>();

  for (const directory of directories) {
    const resolvedDirectory = path.resolve(directory);
    if (!existsSync(resolvedDirectory)) {
      throw new Error(`DDL directory not found: ${resolvedDirectory}`);
    }
    scanDirectory(resolvedDirectory, extensionSet, sources, seen);
  }

  for (const filePath of files) {
    const resolvedPath = path.resolve(filePath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`DDL file not found: ${resolvedPath}`);
    }
    appendSqlFile(resolvedPath, extensionSet, sources, seen);
  }

  return sources.sort((a, b) => a.path.localeCompare(b.path));
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

function scanDirectory(
  directory: string,
  extensionSet: Set<string>,
  sources: SqlSource[],
  seen: Set<string>
): void {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(resolved, extensionSet, sources, seen);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    appendSqlFile(resolved, extensionSet, sources, seen);
  }
}

function appendSqlFile(filePath: string, extensionSet: Set<string>, sources: SqlSource[], seen: Set<string>): void {
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
