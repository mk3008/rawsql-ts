import path from 'node:path';
import { loadConceptRegistry } from '../relationshipMetadata';
import { renderConceptIndex, renderConceptPages, renderProcessIndex, renderProcessPages } from '../render/sourcePages';
import { ensureDirectory } from '../utils/fs';
import { writeTextFileNormalized } from '../utils/io';
import type { GenerateConceptSiteOptions } from '../types';
import { writeVitePressPreviewAssets } from './generate';

/**
 * Generates VitePress-ready Concept Spec review pages from concept relationship metadata.
 */
export function runGenerateConceptSite(options: GenerateConceptSiteOptions): void {
  const conceptRegistry = loadConceptRegistry(options.conceptRelationshipPath);
  if (!conceptRegistry) {
    throw new Error('concept-site requires --concept-relationship.');
  }

  const pages = [
    ...renderConceptPages(options.outDir, conceptRegistry),
    ...renderProcessPages(options.outDir, undefined, conceptRegistry),
  ];
  const conceptIndex = renderConceptIndex(options.outDir, conceptRegistry);
  const processIndex = renderProcessIndex(options.outDir, undefined, conceptRegistry);
  if (conceptIndex) {
    pages.push(conceptIndex);
  }
  if (processIndex) {
    pages.push(processIndex);
  }
  pages.push({
    path: path.join(options.outDir, 'index.md'),
    content: renderConceptSiteRootIndex(),
  });

  for (const page of pages) {
    ensureDirectory(path.dirname(page.path));
    writeTextFileNormalized(page.path, page.content);
  }
  writeVitePressPreviewAssets(options.outDir, {
    title: 'Concept Spec Review',
    description: 'Generated Concept Spec review docs',
  });
}

function renderConceptSiteRootIndex(): string {
  return [
    '<!-- generated-by: @rawsql-ts/ddl-docs-cli -->',
    '',
    '# Concept Spec Review',
    '',
    'Generated from Concept Spec source files and concept relationship metadata.',
    '',
    '- [Concepts](./concepts/)',
    '- [Processes](./processes/)',
    '',
  ].join('\n');
}
