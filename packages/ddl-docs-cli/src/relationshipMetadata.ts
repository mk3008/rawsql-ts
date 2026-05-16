import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { slugifyIdentifier } from './utils/slug';

export interface DdlRelationshipMetadata {
  baseDir: string;
  metadataLanguagePolicy?: string;
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
  relationships: ConceptRegistryRelationshipEntry[];
  glossaryTerms: ConceptRegistryGlossaryTermEntry[];
  relatedProcessMaps: ConceptRegistryProcessMapEntry[];
}

export interface ConceptRegistryEntry {
  id: string;
  displayName?: string;
  path?: string | null;
  status?: string;
  summary?: string;
  note?: string;
}

export interface ConceptRegistryRelationshipEntry {
  from: string;
  to: string;
  kind?: string;
  reason?: string;
}

export interface ConceptRegistryGlossaryTermEntry {
  id: string;
  displayTerm: string;
  definedIn: string[];
  meaning?: string;
  note?: string;
}

export interface ConceptRegistryProcessMapEntry {
  id: string;
  displayName?: string;
  path: string;
  summary?: string;
  reason?: string;
}

export interface DfdRegistry {
  baseDir: string;
  subsystems: DfdRegistrySubsystemEntry[];
  externalStores: DfdRegistryExternalStoreEntry[];
  conceptGroups: DfdRegistryConceptGroupEntry[];
  dfds: DfdRegistryEntry[];
}

export interface DfdRegistrySubsystemEntry {
  id: string;
  displayName?: string;
  summary?: string;
}

export interface DfdRegistryExternalStoreEntry {
  id: string;
  displayName?: string;
}

export interface DfdRegistryConceptGroupEntry {
  id: string;
  displayName?: string;
  scope?: string;
  summary?: string;
  members: DfdRegistryTermRef[];
}

export interface DfdRegistryEntry {
  id: string;
  displayName?: string;
  subsystem?: string;
  path: string;
  summary?: string;
  businessOperations?: DfdRegistryBusinessOperationEntry[];
}

export interface DfdRegistryBusinessOperationEntry {
  id: string;
  displayName?: string;
  summary?: string;
  relatedProcesses?: DfdRegistryRelatedProcessEntry[];
  inputs?: DfdRegistryTermRef[];
  outputs?: DfdRegistryTermRef[];
  uses?: DfdRegistryTermRef[];
}

export interface DfdRegistryRelatedProcessEntry {
  id: string;
  path: string;
  reason?: string;
}

export interface DfdRegistryTermRef {
  type: string;
  id: string;
}

export interface ResolvedTableRelationship {
  concepts: ResolvedRelationshipTarget[];
  processes: ResolvedRelationshipTarget[];
  businesses: ResolvedRelationshipTarget[];
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
    metadataLanguagePolicy: typeof raw.metadataLanguagePolicy === 'string' ? raw.metadataLanguagePolicy : undefined,
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
        displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined,
        path: typeof entry.path === 'string' || entry.path === null ? entry.path : undefined,
        status: typeof entry.status === 'string' ? entry.status : undefined,
        summary: typeof entry.summary === 'string' ? entry.summary : undefined,
        note: typeof entry.note === 'string' ? entry.note : undefined,
      };
    }),
    relationships: parseConceptRelationships(raw.relationships, resolvedPath),
    glossaryTerms: parseGlossaryTerms(raw.glossaryTerms, resolvedPath),
    relatedProcessMaps: parseRelatedProcessMaps(raw.relatedProcessMaps, resolvedPath),
  };
}

export function loadDfdRegistry(metadataPath: string | undefined): DfdRegistry | undefined {
  if (!metadataPath) {
    return undefined;
  }
  const resolvedPath = path.resolve(process.cwd(), metadataPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`DFD relationship metadata file does not exist: ${resolvedPath}`);
  }
  const raw = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.dfds)) {
    throw new Error(`DFD relationship metadata must have schemaVersion: 1 and dfds[]: ${resolvedPath}`);
  }
  return {
    baseDir: path.dirname(resolvedPath),
    subsystems: parseDfdSubsystems(raw.subsystems, resolvedPath),
    externalStores: parseDfdExternalStores(raw.externalStores, resolvedPath),
    conceptGroups: parseDfdConceptGroups(raw.conceptGroups, resolvedPath),
    dfds: raw.dfds.map((entry) => {
      if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
        throw new Error(`DFD relationship entry must include id and path: ${resolvedPath}`);
      }
      return {
        id: entry.id,
        displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined,
        subsystem: typeof entry.subsystem === 'string' ? entry.subsystem : undefined,
        path: entry.path,
        summary: typeof entry.summary === 'string' ? entry.summary : undefined,
        businessOperations: parseDfdBusinessOperations(entry.businessOperations, resolvedPath),
      };
    }),
  };
}

function parseDfdSubsystems(value: unknown, sourcePath: string): DfdRegistrySubsystemEntry[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`DFD relationship subsystems must be an array when provided: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      throw new Error(`DFD relationship subsystem entry must include id: ${sourcePath}`);
    }
    return {
      id: entry.id,
      displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined,
      summary: typeof entry.summary === 'string' ? entry.summary : undefined,
    };
  });
}

function parseDfdExternalStores(value: unknown, sourcePath: string): DfdRegistryExternalStoreEntry[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`DFD relationship externalStores must be an array when provided: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      throw new Error(`DFD external store entry must include id: ${sourcePath}`);
    }
    return {
      id: entry.id,
      displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined,
    };
  });
}

function parseDfdConceptGroups(value: unknown, sourcePath: string): DfdRegistryConceptGroupEntry[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`DFD relationship conceptGroups must be an array when provided: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      throw new Error(`DFD concept group entry must include id: ${sourcePath}`);
    }
    return {
      id: entry.id,
      displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined,
      scope: typeof entry.scope === 'string' ? entry.scope : undefined,
      summary: typeof entry.summary === 'string' ? entry.summary : undefined,
      members: parseDfdTermRefs(entry.members, sourcePath) ?? [],
    };
  });
}

function parseDfdBusinessOperations(value: unknown, sourcePath: string): DfdRegistryBusinessOperationEntry[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`DFD relationship businessOperations must be an array when provided: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      throw new Error(`DFD business operation entry must include id: ${sourcePath}`);
    }
    return {
      id: entry.id,
      displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined,
      summary: typeof entry.summary === 'string' ? entry.summary : undefined,
      relatedProcesses: parseDfdRelatedProcesses(entry.relatedProcesses, sourcePath),
      inputs: parseDfdTermRefs(entry.inputs, sourcePath),
      outputs: parseDfdTermRefs(entry.outputs, sourcePath),
      uses: parseDfdTermRefs(entry.uses, sourcePath),
    };
  });
}

function parseDfdRelatedProcesses(value: unknown, sourcePath: string): DfdRegistryRelatedProcessEntry[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`DFD business operation relatedProcesses must be an array when provided: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
      throw new Error(`DFD business operation related process entry must include id and path: ${sourcePath}`);
    }
    return {
      id: entry.id,
      path: entry.path,
      reason: typeof entry.reason === 'string' ? entry.reason : undefined,
    };
  });
}

function parseDfdTermRefs(value: unknown, sourcePath: string): DfdRegistryTermRef[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`DFD term references must be an array when provided: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.type !== 'string' || typeof entry.id !== 'string') {
      throw new Error(`DFD term reference entry must include type and id: ${sourcePath}`);
    }
    return {
      type: entry.type,
      id: entry.id,
    };
  });
}


export function resolveTableRelationship(
  sourceFiles: string[],
  relationshipMetadata: DdlRelationshipMetadata | undefined,
  conceptRegistry: ConceptRegistry | undefined,
  dfdRegistry?: DfdRegistry
): ResolvedTableRelationship {
  const empty = { concepts: [], processes: [], businesses: [] };
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
  const conceptIds = new Set<string>();
  for (const entry of relationshipMetadata.relationships) {
    if (!sourceSet.has(entry.path)) {
      continue;
    }
    for (const target of entry.concepts) {
      const resolved = resolveConceptTarget(target, relationshipMetadata, conceptRegistry);
      conceptTargets.push(resolved);
      const conceptId = resolveConceptId(target, relationshipMetadata, conceptRegistry);
      if (conceptId) {
        conceptIds.add(conceptId);
      }
    }
    processTargets.push(...entry.processes.map((target) => resolveProcessTarget(target)));
  }
  return {
    concepts: dedupeTargets(conceptTargets),
    processes: dedupeTargets(processTargets),
    businesses: collectBusinessTargetsForConcepts(conceptIds, dfdRegistry),
  };
}

export function conceptPagePath(outDir: string, conceptId: string): string {
  return path.join(outDir, 'concepts', `${slugifyIdentifier(conceptId)}.md`);
}

export function processPagePath(outDir: string, processPath: string): string {
  return path.join(outDir, 'processes', `${slugifyIdentifier(path.basename(processPath, path.extname(processPath)))}.md`);
}

export function dfdPagePath(outDir: string, dfdPath: string): string {
  return path.join(outDir, 'dfd', `${slugifyIdentifier(path.basename(dfdPath, path.extname(dfdPath)))}.md`);
}

export function dfdSubsystemPagePath(outDir: string, subsystemId: string): string {
  return path.join(outDir, 'dfd', slugifyIdentifier(subsystemId), 'index.md');
}

export function dfdBusinessPagePath(outDir: string, subsystemId: string, businessId: string): string {
  return path.join(outDir, 'dfd', slugifyIdentifier(subsystemId), 'business', `${slugifyIdentifier(businessId)}.md`);
}

export function dfdBusinessProcessPagePath(outDir: string, subsystemId: string, businessId: string, processPath: string): string {
  return path.join(
    outDir,
    'dfd',
    slugifyIdentifier(subsystemId),
    'business',
    slugifyIdentifier(businessId),
    'process',
    `${slugifyIdentifier(path.basename(processPath, path.extname(processPath)))}.md`
  );
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
    href: `/concepts/${slugifyIdentifier(label)}`,
  };
}

function resolveProcessTarget(target: DdlRelationshipTarget): ResolvedRelationshipTarget {
  const label = path.basename(target.path, path.extname(target.path));
  return {
    label,
    path: target.path,
    reason: target.reason ?? '',
    href: `/processes/${slugifyIdentifier(label)}`,
  };
}

function resolveConceptId(
  target: DdlRelationshipTarget,
  relationshipMetadata: DdlRelationshipMetadata,
  conceptRegistry: ConceptRegistry | undefined
): string | undefined {
  const resolvedTarget = path.resolve(relationshipMetadata.baseDir, target.path);
  const concept = conceptRegistry?.concepts.find((entry) =>
    entry.path != null && path.resolve(conceptRegistry.baseDir, entry.path) === resolvedTarget
  );
  return concept?.id;
}

function collectBusinessTargetsForConcepts(
  conceptIds: Set<string>,
  dfdRegistry: DfdRegistry | undefined
): ResolvedRelationshipTarget[] {
  if (!dfdRegistry || conceptIds.size === 0) {
    return [];
  }
  const targets: ResolvedRelationshipTarget[] = [];
  for (const dfd of dfdRegistry.dfds) {
    const subsystemId = dfd.subsystem ?? 'default';
    for (const operation of dfd.businessOperations ?? []) {
      const operationConceptRefs = collectOperationConceptReferences(operation, dfdRegistry);
      const matchedConceptRefs = operationConceptRefs
        .filter((ref) => conceptIds.has(ref.conceptId))
        .sort((left, right) => {
          const leftKey = `${left.groupId ?? ''}:${left.conceptId}`;
          const rightKey = `${right.groupId ?? ''}:${right.conceptId}`;
          return leftKey.localeCompare(rightKey);
        });
      if (matchedConceptRefs.length === 0) {
        continue;
      }
      targets.push({
        label: operation.displayName ?? operation.id,
        path: dfd.path,
        reason: formatBusinessConceptReason(matchedConceptRefs),
        href: `/dfd/${slugifyIdentifier(subsystemId)}/business/${slugifyIdentifier(operation.id)}`,
      });
    }
  }
  return dedupeTargets(targets);
}

interface OperationConceptReference {
  conceptId: string;
  groupId?: string;
}

function collectOperationConceptReferences(
  operation: DfdRegistryBusinessOperationEntry,
  dfdRegistry: DfdRegistry
): OperationConceptReference[] {
  const result: OperationConceptReference[] = [];
  const seen = new Set<string>();
  for (const ref of [...(operation.inputs ?? []), ...(operation.outputs ?? []), ...(operation.uses ?? [])]) {
    if (ref.type === 'concept') {
      pushOperationConceptReference(result, seen, { conceptId: ref.id });
      continue;
    }
    if (ref.type === 'concept-group') {
      const group = dfdRegistry.conceptGroups.find((entry) => entry.id === ref.id);
      for (const member of group?.members ?? []) {
        if (member.type === 'concept') {
          pushOperationConceptReference(result, seen, { conceptId: member.id, groupId: ref.id });
        }
      }
    }
  }
  return result;
}

function pushOperationConceptReference(
  result: OperationConceptReference[],
  seen: Set<string>,
  ref: OperationConceptReference
): void {
  const key = `${ref.groupId ?? ''}:${ref.conceptId}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  result.push(ref);
}

function formatBusinessConceptReason(refs: OperationConceptReference[]): string {
  const clauses = refs.map((ref) => {
    if (ref.groupId) {
      return `\`${ref.groupId}\` に含まれる \`${ref.conceptId}\``;
    }
    return `\`${ref.conceptId}\``;
  });
  return `DFDの業務メタデータで ${clauses.join('、')} を参照しているため。`;
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

function parseConceptRelationships(value: unknown, sourcePath: string): ConceptRegistryRelationshipEntry[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Concept relationships must be an array: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.from !== 'string' || typeof entry.to !== 'string') {
      throw new Error(`Concept relationship entry must include from and to: ${sourcePath}`);
    }
    return {
      from: entry.from,
      to: entry.to,
      kind: typeof entry.kind === 'string' ? entry.kind : undefined,
      reason: typeof entry.reason === 'string' ? entry.reason : undefined,
    };
  });
}

function parseGlossaryTerms(value: unknown, sourcePath: string): ConceptRegistryGlossaryTermEntry[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Concept glossary terms must be an array: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.displayTerm !== 'string') {
      throw new Error(`Concept glossary term entry must include id and displayTerm: ${sourcePath}`);
    }
    if (entry.definedIn !== undefined && !Array.isArray(entry.definedIn)) {
      throw new Error(`Concept glossary term definedIn must be an array: ${sourcePath}`);
    }
    return {
      id: entry.id,
      displayTerm: entry.displayTerm,
      definedIn: Array.isArray(entry.definedIn) ? entry.definedIn.filter((item): item is string => typeof item === 'string') : [],
      meaning: typeof entry.meaning === 'string' ? entry.meaning : undefined,
      note: typeof entry.note === 'string' ? entry.note : undefined,
    };
  });
}

function parseRelatedProcessMaps(value: unknown, sourcePath: string): ConceptRegistryProcessMapEntry[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Concept related process maps must be an array: ${sourcePath}`);
  }
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
      throw new Error(`Concept related process map entry must include id and path: ${sourcePath}`);
    }
    return {
      id: entry.id,
      displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined,
      path: entry.path,
      summary: typeof entry.summary === 'string' ? entry.summary : undefined,
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
