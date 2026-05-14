import path from 'node:path';
import { loadConceptRegistry, loadDfdRegistry } from '../relationshipMetadata';
import { renderConceptIndex, renderConceptPages, renderDfdBusinessPages, renderDfdBusinessProcessPages, renderDfdIndex, renderDfdRoleIndex, renderDfdSubsystemPages, renderProcessIndex, renderProcessPages } from '../render/sourcePages';
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
  const dfdRegistry = loadDfdRegistry(options.dfdRelationshipPath);

  const pages = [
    ...renderConceptPages(options.outDir, conceptRegistry),
    ...renderProcessPages(options.outDir, undefined, conceptRegistry),
    ...renderDfdSubsystemPages(options.outDir, dfdRegistry),
    ...renderDfdBusinessPages(options.outDir, dfdRegistry, conceptRegistry),
    ...renderDfdBusinessProcessPages(options.outDir, dfdRegistry),
  ];
  const conceptIndex = renderConceptIndex(options.outDir, conceptRegistry);
  const processIndex = renderProcessIndex(options.outDir, undefined, conceptRegistry);
  const dfdIndex = renderDfdIndex(options.outDir, dfdRegistry);
  const roleIndex = renderDfdRoleIndex(options.outDir, dfdRegistry);
  if (conceptIndex) {
    pages.push(conceptIndex);
  }
  if (processIndex) {
    pages.push(processIndex);
  }
  if (dfdIndex) {
    pages.push(dfdIndex);
  }
  if (roleIndex) {
    pages.push(roleIndex);
  }
  pages.push({
    path: path.join(options.outDir, 'index.md'),
    content: renderConceptSiteRootIndex({ hasDfd: dfdRegistry !== undefined }),
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

function renderConceptSiteRootIndex(options: { hasDfd: boolean }): string {
  const links = [
    '- [Concepts](./concepts/)',
  ];
  if (options.hasDfd) {
    links.push('- [DFDs](./dfd/)');
    links.push('- [Roles](./roles/)');
  }
  links.push('- [Processes](./processes/)');
  return [
    '<!-- generated-by: @rawsql-ts/ddl-docs-cli -->',
    '',
    '# Concept Spec Review',
    '',
    'Generated from Concept Spec source files and concept relationship metadata.',
    '',
    ...links,
    '',
  ].join('\n');
}
