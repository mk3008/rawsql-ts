import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Minimal SQL catalog spec shape shared across command-layer discovery flows.
 */
export interface SqlCatalogSpecLike {
  id?: unknown;
  sqlFile?: unknown;
  params?: {
    shape?: unknown;
    example?: unknown;
  };
  output?: {
    mapping?: {
      prefix?: unknown;
      columnMap?: unknown;
    } | unknown;
  };
}

/**
 * Discovered SQL catalog spec paired with its source file path.
 */
export interface LoadedSqlCatalogSpec {
  filePath: string;
  spec: SqlCatalogSpecLike;
}

interface DiscoveryErrorFactory {
  (message: string): Error;
}

/**
 * Walk spec-like files under the provided root using deterministic ordering.
 */
export function walkSqlCatalogSpecFiles(
  rootDir: string,
  options?: { excludeTestFiles?: boolean }
): string[] {
  const files: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const lowered = entry.name.toLowerCase();
      const isSpecLike =
        lowered.endsWith('.json') ||
        lowered.endsWith('.ts') ||
        lowered.endsWith('.js') ||
        lowered.endsWith('.mts') ||
        lowered.endsWith('.cts');
      if (!isSpecLike) {
        continue;
      }
      if (options?.excludeTestFiles && lowered.includes('.test.')) {
        continue;
      }
      files.push(absolute);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

/**
 * Load SQL catalog specs from a single file while preserving current lightweight parsing behavior.
 */
export function loadSqlCatalogSpecsFromFile(
  filePath: string,
  createError: DiscoveryErrorFactory
): LoadedSqlCatalogSpec[] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw createError(
        `Failed to parse spec file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (Array.isArray(parsed)) {
      return parsed.map((spec) => ({ spec: spec as SqlCatalogSpecLike, filePath }));
    }
    if (isPlainObject(parsed) && Array.isArray((parsed as Record<string, unknown>).specs)) {
      const specs = (parsed as { specs: unknown[] }).specs;
      return specs.map((spec) => ({ spec: spec as SqlCatalogSpecLike, filePath }));
    }
    if (isPlainObject(parsed)) {
      return [{ spec: parsed as SqlCatalogSpecLike, filePath }];
    }

    throw createError(`Unsupported spec format in ${filePath}`);
  }

  const source = readFileSync(filePath, 'utf8');
  const blocks = extractTsJsSpecBlocks(source);
  return blocks.map((block) => {
    const id = block.match(/id\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
    const sqlFile = block.match(/sqlFile\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
    const shape = block.match(/shape\s*:\s*['"`](positional|named)['"`]/)?.[1];
    const exampleIsArray = /example\s*:\s*\[/.test(block);
    const exampleIsObject = /example\s*:\s*\{/.test(block);

    const columnMapBlock = block.match(/columnMap\s*:\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const columnMap: Record<string, unknown> = {};
    for (const match of Array.from(columnMapBlock.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*['"`]([^'"`]+)['"`]/g))) {
      columnMap[match[1]] = match[2];
    }
    const prefix = block.match(/prefix\s*:\s*['"`]([^'"`]*)['"`]/)?.[1];
    const mapping = {
      ...(typeof prefix === 'string' ? { prefix } : {}),
      ...(Object.keys(columnMap).length > 0 ? { columnMap } : {})
    };

    return {
      spec: {
        id,
        sqlFile,
        params: {
          shape,
          example: exampleIsArray ? [] : exampleIsObject ? {} : undefined
        },
        output: Object.keys(mapping).length > 0 ? { mapping } : undefined
      } as SqlCatalogSpecLike,
      filePath
    };
  });
}

/**
 * Lightweight TS/JS object-literal extraction used by current command implementations.
 */
export function extractTsJsSpecBlocks(source: string): string[] {
  const blocks: string[] = [];
  const seen = new Set<string>();
  const idRegex = /id\s*:\s*['"`][^'"`]+['"`]/g;

  for (const match of Array.from(source.matchAll(idRegex))) {
    if (typeof match.index !== 'number') {
      continue;
    }

    const start = source.lastIndexOf('{', match.index);
    if (start < 0) {
      continue;
    }

    let depth = 0;
    let end = -1;
    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end < 0) {
      continue;
    }

    const block = source.slice(start, end + 1);
    if (!/sqlFile\s*:\s*['"`][^'"`]+['"`]/.test(block)) {
      continue;
    }

    if (!seen.has(block)) {
      seen.add(block);
      blocks.push(block);
    }
  }

  return blocks;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
