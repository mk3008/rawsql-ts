import { promises as fs } from 'node:fs';
import path from 'node:path';
import { collectSqlFiles, ensureDirectoryExists, fileExists } from '../utils/filesystem.js';

type ExportArgs = {
  targets: string[];
};

type ExportResult = {
  relativePath: string;
  sourceKind: 'built' | 'source';
};

type ExportSource = {
  path: string;
  kind: 'built' | 'source';
};

export async function exportCommand(args: string[]): Promise<void> {
  const { targets } = parseArgs(args);
  const cwd = process.cwd();
  const rootDir = path.resolve(cwd, 'rawsql', 'root');
  const outputDir = path.resolve(cwd, 'sql');

  await ensureDirectoryExists(rootDir, 'rawsql/root directory');
  await fs.mkdir(outputDir, { recursive: true });

  const files = targets.length > 0
    ? await resolveExportTargets(targets, rootDir)
    : await collectSqlFiles(rootDir);

  if (files.length === 0) {
    console.log('No .sql files found to export.');
    return;
  }

  const results: ExportResult[] = [];

  for (const filePath of files) {
    const relativePath = ensureWithinRoot(filePath, rootDir);
    const source = await pickExportSource(filePath);
    const destination = path.join(outputDir, relativePath);

    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source.path, destination);

    results.push({ relativePath, sourceKind: source.kind });
  }

  for (const result of results) {
    const label = result.sourceKind === 'built' ? 'built' : 'source';
    console.log(`[export] ${result.relativePath} (${label})`);
  }
}

function parseArgs(args: string[]): ExportArgs {
  const targets: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      throw new Error(`Unknown option for export command: ${arg}`);
    }
    targets.push(arg);
  }

  return { targets };
}

async function resolveExportTargets(targets: string[], rootDir: string): Promise<string[]> {
  const resolved = new Set<string>();

  for (const target of targets) {
    const absolute = path.resolve(process.cwd(), target);
    let stats;
    try {
      stats = await fs.stat(absolute);
    } catch {
      throw new Error(`Target not found: ${target}`);
    }

    if (stats.isDirectory()) {
      const files = await collectSqlFiles(absolute);
      files.forEach((filePath) => {
        ensureWithinRoot(filePath, rootDir);
        resolved.add(filePath);
      });
    } else if (stats.isFile()) {
      if (!absolute.toLowerCase().endsWith('.sql') || absolute.toLowerCase().endsWith('.built.sql')) {
        throw new Error(`Target must be a source .sql file: ${target}`);
      }
      ensureWithinRoot(absolute, rootDir);
      resolved.add(absolute);
    }
  }

  return Array.from(resolved).sort();
}

async function pickExportSource(originalPath: string): Promise<ExportSource> {
  const parsed = path.parse(originalPath);
  const builtCandidate = path.join(parsed.dir, `${parsed.name}.built.sql`);

  if (await fileExists(builtCandidate)) {
    return { path: builtCandidate, kind: 'built' };
  }

  return { path: originalPath, kind: 'source' };
}

function ensureWithinRoot(filePath: string, rootDir: string): string {
  const relative = path.relative(rootDir, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`File is outside rawsql/root: ${filePath}`);
  }
  return relative.replace(/\\/g, '/');
}