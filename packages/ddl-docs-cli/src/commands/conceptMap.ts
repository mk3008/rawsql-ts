import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConceptRegistry } from '../relationshipMetadata';
import { renderConceptMapMarkdown } from '../render/conceptMapMarkdown';

export interface GenerateConceptMapOptions {
  conceptRelationshipPath: string;
  outPath: string;
}

export function runGenerateConceptMap(options: GenerateConceptMapOptions): void {
  const conceptRegistry = loadConceptRegistry(options.conceptRelationshipPath);
  if (!conceptRegistry) {
    throw new Error('--concept-relationship is required.');
  }
  const outPath = path.resolve(process.cwd(), options.outPath);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderConceptMapMarkdown(conceptRegistry), 'utf8');
  console.log(`Generated concept map: ${outPath}`);
}
