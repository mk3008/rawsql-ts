import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DocsManifest, PruneResult } from '../types';
import { ensureDirectory } from '../utils/fs';
import { normalizeLf } from '../utils/io';

const MANIFEST_FILE = 'manifest.json';
const GENERATED_HEADER = '<!-- generated-by: @rawsql-ts/ddl-docs-cli -->';

export interface ManifestWriteOptions {
  outDir: string;
  generatorVersion: string;
  dialect: 'postgres';
  optionsForHash: Record<string, unknown>;
  nameMap: Record<string, string>;
  tableOutputs: string[];
  columnOutputs: string[];
}

export function manifestPath(outDir: string): string {
  return path.join(outDir, '_meta', MANIFEST_FILE);
}

export function writeManifest(options: ManifestWriteOptions): string {
  ensureDirectory(path.join(options.outDir, '_meta'));
  const manifest: DocsManifest = {
    generator: {
      version: options.generatorVersion,
      dialect: options.dialect,
      optionsHash: hashOptions(options.optionsForHash),
    },
    naming: {
      slugRules: 'lowercase; replace non [a-z0-9] with -; trim dashes; fallback unnamed',
      nameMap: options.nameMap,
    },
    outputs: {
      tables: toSortedPosix(options.outDir, options.tableOutputs),
      columns: toSortedPosix(options.outDir, options.columnOutputs),
    },
  };
  const outputPath = manifestPath(options.outDir);
  writeFileSync(outputPath, normalizeLf(JSON.stringify(manifest, null, 2)), 'utf8');
  return outputPath;
}

export function readManifest(outDir: string): DocsManifest | null {
  const filePath = manifestPath(outDir);
  if (!existsSync(filePath)) {
    return null;
  }
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<DocsManifest>;
  if (!parsed?.generator || !parsed?.naming || !parsed?.outputs) {
    throw new Error(`Invalid manifest format: ${filePath}`);
  }
  return {
    generator: parsed.generator,
    naming: parsed.naming,
    outputs: {
      tables: parsed.outputs.tables ?? [],
      columns: parsed.outputs.columns ?? [],
    },
  } as DocsManifest;
}

export function pruneManagedFiles(outDir: string, dryRun: boolean, pruneOrphans: boolean): PruneResult {
  const manifest = readManifest(outDir);
  if (!manifest) {
    return { removed: [], dryRun };
  }

  const managed = [...manifest.outputs.tables, ...manifest.outputs.columns];
  const removed: string[] = [];
  for (const relativeFile of managed) {
    const resolvedFile = path.resolve(outDir, relativeFile);
    if (!existsSync(resolvedFile) || !isManagedGeneratedFile(resolvedFile)) {
      continue;
    }
    if (!dryRun) {
      rmSync(resolvedFile, { force: true });
    }
    removed.push(resolvedFile);
  }

  if (pruneOrphans) {
    const orphanCandidates = findGeneratedMarkdownFiles(outDir);
    const managedSet = new Set(managed.map((entry) => path.resolve(outDir, entry)));
    for (const candidate of orphanCandidates) {
      if (managedSet.has(candidate)) {
        continue;
      }
      if (!dryRun) {
        rmSync(candidate, { force: true });
      }
      removed.push(candidate);
    }
  }

  const metaFiles = [
    manifestPath(outDir),
    path.join(outDir, '_meta', 'warnings.json'),
    path.join(outDir, '_meta', 'warnings.md'),
    path.join(outDir, '_meta', 'findings.json'),
    path.join(outDir, '_meta', 'findings.md'),
    path.join(outDir, '_meta', 'snapshot.json'),
    path.join(outDir, '_meta', 'observed-column-dictionary.json'),
    path.join(outDir, '_meta', 'suggested.sql'),
  ];
  if (!dryRun) {
    for (const metaFile of metaFiles) {
      if (existsSync(metaFile)) {
        rmSync(metaFile, { force: true });
      }
    }
  }

  return { removed: Array.from(new Set(removed)).sort(), dryRun };
}

function hashOptions(options: Record<string, unknown>): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(options, Object.keys(options).sort()));
  return hash.digest('hex');
}

function toSortedPosix(outDir: string, files: string[]): string[] {
  return Array.from(new Set(files.map((entry) => path.relative(outDir, entry).replace(/\\/g, '/')))).sort();
}

function isManagedGeneratedFile(filePath: string): boolean {
  if (!filePath.toLowerCase().endsWith('.md')) {
    return false;
  }
  const content = readFileSync(filePath, 'utf8');
  return content.includes(GENERATED_HEADER);
}

function findGeneratedMarkdownFiles(rootDir: string): string[] {
  const files: string[] = [];
  walk(rootDir, files);
  return files.sort();
}

function walk(currentDir: string, files: string[]): void {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_meta' || entry.name === 'node_modules') {
        continue;
      }
      walk(resolved, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!resolved.toLowerCase().endsWith('.md')) {
      continue;
    }
    if (!isManagedGeneratedFile(resolved)) {
      continue;
    }
    files.push(resolved);
  }
}
