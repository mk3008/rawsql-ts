import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export interface SqlSource {
  path: string;
  sql: string;
}

export function collectSqlFiles(directories: string[], extensions: string[]): SqlSource[] {
  // Guard against caller forgetting to supply directories; defaults should be applied upstream.
  if (directories.length === 0) {
    throw new Error('DDL directories list is empty; caller must provide default paths.');
  }

  // parseExtensions already normalizes casing, but defensively re-normalize to avoid relying solely on the caller.
  const normalized = extensions.map((extension) => extension.toLowerCase());
  const extensionSet = new Set(normalized);
  const sources: SqlSource[] = [];

  for (const directory of directories) {
    // Resolve each configured path so the file order is deterministic.
    const resolvedDirectory = path.resolve(directory);
    if (!existsSync(resolvedDirectory)) {
      throw new Error(`DDL directory not found: ${resolvedDirectory}`);
    }

    scanDirectory(resolvedDirectory, extensionSet, sources);
  }

  return sources.sort((a, b) => a.path.localeCompare(b.path));
}

function scanDirectory(directory: string, extensions: Set<string>, accumulator: SqlSource[]): void {
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      // Recursively descend into subdirectories before collecting files.
      scanDirectory(resolved, extensions, accumulator);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!extensions.has(extension)) {
      continue;
    }

    const sql = readFileSync(resolved, 'utf8');
    // Empty SQL files are intentionally skipped; comment-only fixtures need a different handling path.
    if (!sql.trim()) {
      continue;
    }

    // Store a workspace-relative path so outputs do not leak machine-specific absolute paths.
    const relativePath = path.relative(process.cwd(), resolved).replace(/\\/g, '/');

    accumulator.push({ path: relativePath, sql });
  }
}
