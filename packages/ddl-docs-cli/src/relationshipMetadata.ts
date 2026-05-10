import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { slugifyIdentifier } from './utils/slug';

export interface DdlRelationshipMetadata {
  baseDir: string;
  relationships: DdlRelationshipEntry[];
}

export interface DdlRelationshipEntry {
  path: string;
  kind: string;
  reason?: string;
  concepts: DdlRelationshipTarget[];
  processes: DdlRelationshipTarget[];
}

export interface DdlRelationshipTarget {
  path: string;
  reason?: string;
}

export interface ConceptRegistry {
  baseDir: string;
  concepts: ConceptRegistryEntry[];
}

export interface ConceptRegistryEntry {
  id: string;
  path?: string | null;
  status?: string;
  summary?: string;
}

export interface ResolvedTableRelationship {
  concepts: ResolvedRelationshipTarget[];
  processes: ResolvedRelationshipTarget[];
}

export interface ResolvedRelationshipTarget {
  label: string;
  path: string;
  reason: string;
  href: string;
}

export function loadDdlRelationshipMetadata(metadataPath: string | undefined): DdlRelationshipMetadata | undefined {
  if (!metadataPath) {
    return undefined;
  }
  const resolvedPath = path.resolve(process.cwd(), metadataPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`DDL relationship metadata file does not exist: ${resolvedPath}`);
  }
  const raw = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.relationships)) {
    throw new Error(`DDL relationship metadata must have schemaVersion: 1 and relationships[]: ${resolvedPath}`);
  }
  return {
    baseDir: path.dirname(resolvedPath),
    relationships: raw.relationships.map((entry) => {
      if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.kind !== 'string') {
        throw new Error(`DDL relationship entry must include path and kind: ${resolvedPath}`);
      }
      return {
        path: normalizeRelativePath(entry.path),
        kind: entry.kind,
        reason: typeof entry.reason === 'string' ? entry.reason : undefined,
        concepts: parseTargets(entry.concepts, resolvedPath),
        processes: parseTargets(entry.processes, resolvedPath),
      };
    }),
  };
}

export function loadConceptRegistry(metadataPath: string | undefined): ConceptRegistry | undefined {
  if (!metadataPath) {
    return undefined;
  }
  const resolvedPath = path.resolve(process.cwd(), metadataPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Concept relationship metadata file does not exist: ${resolvedPath}`);
  }
  const raw = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.concepts)) {
    throw new Error(`Concept relationship metadata must have schemaVersion: 1 and concepts[]: ${resolvedPath}`);
  }
  return {
    baseDir: path.dirname(resolvedPath),
    concepts: raw.concepts.map((entry) => {
      if (!isRecord(entry) || typeof entry.id !== 'string') {
        throw new Error(`Concept registry entry must include id: ${resolvedPath}`);
      }
      return {
        id: entry.id,
        path: typeof entry.path === 'string' || entry.path === null ? entry.path : undefined,
        status: typeof entry.status === 'string' ? entry.status : undefined,
        summary: typeof entry.summary === 'string' ? entry.summary : undefined,
      };
    }),
  };
}

export function resolveTableRelationship(
  sourceFiles: string[],
  relationshipMetadata: DdlRelationshipMetadata | undefined,
  conceptRegistry: ConceptRegistry | undefined
): ResolvedTableRelationship {
  const empty = { concepts: [], processes: [] };
  if (!relationshipMetadata) {
    return empty;
  }
  const sourceSet = new Set(
    sourceFiles.map((sourceFile) =>
      normalizeRelativePath(path.relative(relationshipMetadata.baseDir, path.resolve(process.cwd(), sourceFile)))
    )
  );
  const conceptTargets: ResolvedRelationshipTarget[] = [];
  const processTargets: ResolvedRelationshipTarget[] = [];
  for (const entry of relationshipMetadata.relationships) {
    if (!sourceSet.has(entry.path)) {
      continue;
    }
    conceptTargets.push(...entry.concepts.map((target) => resolveConceptTarget(target, relationshipMetadata, conceptRegistry)));
    processTargets.push(...entry.processes.map((target) => resolveProcessTarget(target)));
  }
  return {
    concepts: dedupeTargets(conceptTargets),
    processes: dedupeTargets(processTargets),
  };
}

export function conceptPagePath(outDir: string, conceptId: string): string {
  return path.join(outDir, 'concepts', `${slugifyIdentifier(conceptId)}.md`);
}

export function processPagePath(outDir: string, processPath: string): string {
  return path.join(outDir, 'processes', `${slugifyIdentifier(path.basename(processPath, path.extname(processPath)))}.md`);
}

function resolveConceptTarget(
  target: DdlRelationshipTarget,
  relationshipMetadata: DdlRelationshipMetadata,
  conceptRegistry: ConceptRegistry | undefined
): ResolvedRelationshipTarget {
  const resolvedTarget = path.resolve(relationshipMetadata.baseDir, target.path);
  const concept = conceptRegistry?.concepts.find((entry) =>
    entry.path != null && path.resolve(conceptRegistry.baseDir, entry.path) === resolvedTarget
  );
  const label = concept?.id ?? (path.basename(path.dirname(target.path)) || target.path);
  return {
    label,
    path: target.path,
    reason: target.reason ?? '',
    href: `../concepts/${slugifyIdentifier(label)}.md`,
  };
}

function resolveProcessTarget(target: DdlRelationshipTarget): ResolvedRelationshipTarget {
  const label = path.basename(target.path, path.extname(target.path));
  return {
    label,
    path: target.path,
    reason: target.reason ?? '',
    href: `../processes/${slugifyIdentifier(label)}.md`,
  };
}

function parseTargets(value: unknown, sourcePath: string): DdlRelationshipTarget[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`DDL relationship targets must be arrays: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.path !== 'string') {
      throw new Error(`DDL relationship target must include path: ${sourcePath}`);
    }
    return {
      path: entry.path,
      reason: typeof entry.reason === 'string' ? entry.reason : undefined,
    };
  });
}

function dedupeTargets(targets: ResolvedRelationshipTarget[]): ResolvedRelationshipTarget[] {
  const seen = new Set<string>();
  const result: ResolvedRelationshipTarget[] = [];
  for (const target of targets) {
    const key = `${target.href}|${target.reason}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(target);
  }
  return result.sort((left, right) => `${left.label}|${left.reason}`.localeCompare(`${right.label}|${right.reason}`));
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
