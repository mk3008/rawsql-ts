import { existsSync, lstatSync } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { DEFAULT_EXTENSIONS } from '../commands/options';
import { collectSqlFiles } from './collectSqlFiles';
import type { TableDefinitionModel } from 'rawsql-ts';
import type { FixtureRow } from '@rawsql-ts/testkit-core';

/**
 * Resolve a CLI argument into an absolute list of `.sql` files.
 */
export function resolveSqlFiles(pattern: string): string[] {
  const absolutePattern = path.resolve(pattern);
  if (existsSync(absolutePattern)) {
    const stats = lstatSync(absolutePattern);
    if (stats.isFile()) {
      return [toPosixPattern(absolutePattern)];
    }
    if (stats.isDirectory()) {
      const matches = fg.sync(toPosixPattern(path.join(absolutePattern, '**', '*.sql')), {
        absolute: true,
        onlyFiles: true
      });
      if (matches.length === 0) {
        throw new Error(`No SQL files were found under ${absolutePattern}`);
      }
      return matches.map(toPosixPattern).sort();
    }
  }

  const globMatches = fg.sync(toPosixPattern(pattern), {
    absolute: true,
    onlyFiles: true
  });
  if (globMatches.length === 0) {
    throw new Error(`No SQL files matched ${pattern}`);
  }
  return globMatches.map(toPosixPattern).sort();
}

/**
 * Scan the configured DDL directories for CREATE TYPE ... AS ENUM definitions.
 */
export function extractEnumLabels(
  directories: string[],
  extensions: string[] = DEFAULT_EXTENSIONS
): Map<string, string[]> {
  const enums = new Map<string, string[]>();
  for (const directory of directories) {
    if (!existsSync(directory)) {
      continue;
    }
    const files = collectSqlFiles([directory], extensions);
    for (const { sql } of files) {
      for (const { name, labels } of parseEnumDefinitions(sql)) {
        if (!labels.length) {
          continue;
        }
        const normalized = normalizeQualifiedName(name);
        if (!normalized) {
          continue;
        }
        if (!enums.has(normalized)) {
          enums.set(normalized, labels);
        }
      }
    }
  }
  return enums;
}

/**
 * Build a fixture row for linting using minimal values derived from the column types.
 */
export function buildLintFixtureRow(
  definition: TableDefinitionModel,
  enumLabels: Map<string, string[]>
): FixtureRow {
  const row: FixtureRow = {};
  for (const column of definition.columns) {
    row[column.name] = column.required
      ? inferDefaultValue(column.typeName, enumLabels)
      : null;
  }
  return row;
}

/**
 * Infer a default value for a required column to keep Postgres happy.
 */
export function inferDefaultValue(
  typeName: string | undefined,
  enumLabels: Map<string, string[]>
): unknown {
  if (!typeName) {
    return '';
  }
  const normalized = normalizeTypeName(typeName);
  const enumMatch = enumLabels.get(normalized.key);
  if (enumMatch && enumMatch.length > 0) {
    return enumMatch[0];
  }
  if (normalized.isArray) {
    return '{}';
  }
  if (
    normalized.base.startsWith('int') ||
    normalized.base.includes('serial') ||
    normalized.base === 'numeric' ||
    normalized.base === 'decimal' ||
    normalized.base === 'real' ||
    normalized.base === 'double precision'
  ) {
    return 0;
  }
  if (normalized.base === 'boolean' || normalized.base === 'bool') {
    return false;
  }
  if (normalized.base === 'uuid') {
    return '00000000-0000-0000-0000-000000000000';
  }
  if (
    normalized.base.startsWith('character') ||
    normalized.base.startsWith('varchar') ||
    normalized.base === 'text' ||
    normalized.base === 'citext' ||
    normalized.base === 'name'
  ) {
    return '';
  }
  if (normalized.base === 'date') {
    return '1970-01-01';
  }
  if (normalized.base.startsWith('timestamp')) {
    return '1970-01-01 00:00:00';
  }
  if (normalized.base.startsWith('time')) {
    return '00:00:00';
  }
  if (normalized.base === 'json' || normalized.base === 'jsonb') {
    return '{}';
  }
  return '';
}

interface NormalizedTypeName {
  base: string;
  key: string;
  isArray: boolean;
}

function normalizeTypeName(typeName: string): NormalizedTypeName {
  const segments = splitQualifiedName(typeName);
  if (segments.length === 0) {
    return { base: '', key: '', isArray: false };
  }
  const cleaned = segments.map((token) =>
    compactIdentifier(token).toLowerCase()
  );
  let isArray = false;
  let lastSegment = cleaned[cleaned.length - 1];
  if (lastSegment.endsWith('[]')) {
    isArray = true;
    lastSegment = lastSegment.slice(0, -2).trim();
  }
  const base = lastSegment.replace(/\(.*\)$/, '').trim();
  cleaned[cleaned.length - 1] = base;
  return {
    base,
    key: cleaned.join('.'),
    isArray
  };
}

function normalizeQualifiedName(value: string): string | null {
  const segments = splitQualifiedName(value);
  if (segments.length === 0) {
    return null;
  }
  const cleaned = segments.map((segment) =>
    compactIdentifier(segment).toLowerCase()
  );
  return cleaned.join('.');
}

function splitQualifiedName(value: string): string[] {
  const parts: string[] = [];
  let buffer = '';
  let inQuotes = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === '"') {
      buffer += char;
      if (inQuotes && value[i + 1] === '"') {
        buffer += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === '.' && !inQuotes) {
      if (buffer.length > 0) {
        parts.push(buffer);
      }
      buffer = '';
      continue;
    }
    buffer += char;
  }
  if (buffer.length > 0) {
    parts.push(buffer);
  }
  return parts
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function compactIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/""/g, '"');
  }
  return trimmed.replace(/\s+/g, ' ');
}

function parseEnumDefinitions(
  sql: string
): Array<{ name: string; labels: string[] }> {
  const results: Array<{ name: string; labels: string[] }> = [];
  const regex = /create\s+type\s+(.+?)\s+as\s+enum\s*\(/gsi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql))) {
    const rawName = match[1].trim();
    const openParenIndex = regex.lastIndex - 1;
    if (openParenIndex < 0 || sql[openParenIndex] !== '(') {
      continue;
    }
    const { labels, end } = parseEnumLabelList(sql, openParenIndex);
    results.push({ name: rawName, labels });
    regex.lastIndex = end;
  }
  return results;
}

function parseEnumLabelList(
  sql: string,
  startIndex: number
): { labels: string[]; end: number } {
  const labels: string[] = [];
  let idx = startIndex + 1;
  while (idx < sql.length) {
    idx = skipWhitespace(sql, idx);
    if (sql[idx] === ')') {
      idx += 1;
      break;
    }
    if (sql[idx] === ',') {
      idx += 1;
      continue;
    }
    if (sql[idx] !== "'") {
      idx += 1;
      continue;
    }
    const { value, newIndex } = parseStringLiteral(sql, idx);
    labels.push(value);
    idx = newIndex;
  }
  return { labels, end: idx };
}

function parseStringLiteral(
  sql: string,
  index: number
): { value: string; newIndex: number } {
  let idx = index + 1;
  let value = '';
  while (idx < sql.length) {
    const char = sql[idx];
    if (char === "'") {
      if (sql[idx + 1] === "'") {
        value += "'";
        idx += 2;
        continue;
      }
      idx += 1;
      break;
    }
    value += char;
    idx += 1;
  }
  return { value, newIndex: idx };
}

function skipWhitespace(sql: string, index: number): number {
  while (index < sql.length && /\s/.test(sql[index])) {
    index += 1;
  }
  return index;
}

function toPosixPattern(value: string): string {
  return value.replace(/\\/g, '/');
}
