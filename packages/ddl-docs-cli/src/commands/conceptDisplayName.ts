import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ConceptDisplayNameOptions } from '../types';

export interface ConceptDisplayNameReport {
  schemaVersion: 1;
  conceptRelationshipPath: string;
  concept: {
    id: string;
    oldDisplayName: string | null;
    newDisplayName: string;
    status: string | null;
    path: string | null;
  };
  relationships: {
    incoming: ConceptDisplayNameRelationshipRef[];
    outgoing: ConceptDisplayNameRelationshipRef[];
  };
  written: boolean;
}

export interface ConceptDisplayNameRelationshipRef {
  from: string;
  to: string;
  kind: string | null;
  reason: string | null;
}

interface ConceptRelationshipDocument {
  schemaVersion: 1;
  concepts: ConceptRelationshipConceptEntry[];
  relationships?: ConceptDisplayNameRelationshipRef[];
}

interface ConceptRelationshipConceptEntry {
  id: string;
  displayName?: string;
  status?: string;
  path?: string | null;
}

export function runConceptDisplayName(options: ConceptDisplayNameOptions): ConceptDisplayNameReport {
  const report = updateConceptDisplayName(options);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

export function updateConceptDisplayName(options: ConceptDisplayNameOptions): ConceptDisplayNameReport {
  if (options.id.trim().length === 0) {
    throw new Error('concept-display-name requires --id.');
  }
  if (options.displayName.trim().length === 0) {
    throw new Error('concept-display-name requires --display-name.');
  }

  const resolvedPath = path.resolve(process.cwd(), options.conceptRelationshipPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Concept relationship metadata file does not exist: ${resolvedPath}`);
  }

  const document = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
  if (!isConceptRelationshipDocument(document)) {
    throw new Error(`Concept relationship metadata must have schemaVersion: 1 and concepts[]: ${resolvedPath}`);
  }

  const concept = document.concepts.find((entry) => entry.id === options.id);
  if (!concept) {
    throw new Error(`Concept id not found in concept relationship metadata: ${options.id}`);
  }

  const oldDisplayName = typeof concept.displayName === 'string' ? concept.displayName : null;
  concept.displayName = options.displayName;

  const relationships = document.relationships ?? [];
  const incoming = relationships.filter((relationship) => relationship.to === options.id).map(normalizeRelationshipRef);
  const outgoing = relationships.filter((relationship) => relationship.from === options.id).map(normalizeRelationshipRef);

  if (!options.dryRun) {
    writeFileSync(resolvedPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }

  return {
    schemaVersion: 1,
    conceptRelationshipPath: path.relative(process.cwd(), resolvedPath).replace(/\\/g, '/'),
    concept: {
      id: concept.id,
      oldDisplayName,
      newDisplayName: concept.displayName,
      status: typeof concept.status === 'string' ? concept.status : null,
      path: typeof concept.path === 'string' || concept.path === null ? concept.path : null,
    },
    relationships: {
      incoming,
      outgoing,
    },
    written: !options.dryRun,
  };
}

function normalizeRelationshipRef(relationship: ConceptDisplayNameRelationshipRef): ConceptDisplayNameRelationshipRef {
  return {
    from: relationship.from,
    to: relationship.to,
    kind: typeof relationship.kind === 'string' ? relationship.kind : null,
    reason: typeof relationship.reason === 'string' ? relationship.reason : null,
  };
}

function isConceptRelationshipDocument(value: unknown): value is ConceptRelationshipDocument {
  return isRecord(value)
    && value.schemaVersion === 1
    && Array.isArray(value.concepts)
    && value.concepts.every((entry) => isRecord(entry) && typeof entry.id === 'string')
    && (value.relationships === undefined || (Array.isArray(value.relationships) && value.relationships.every(isRelationshipRef)));
}

function isRelationshipRef(value: unknown): value is ConceptDisplayNameRelationshipRef {
  return isRecord(value) && typeof value.from === 'string' && typeof value.to === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
