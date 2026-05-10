import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  ConceptRegistry,
  DdlRelationshipMetadata,
} from '../relationshipMetadata';
import { conceptPagePath, processPagePath, processPageSlug } from '../relationshipMetadata';
import { formatCodeCell, formatTableCell } from '../utils/markdown';
import { slugifyIdentifier } from '../utils/slug';

export interface RenderedSourcePage {
  path: string;
  content: string;
}

export function renderConceptPages(outDir: string, conceptRegistry: ConceptRegistry | undefined): RenderedSourcePage[] {
  if (!conceptRegistry) {
    return [];
  }
  const pages: RenderedSourcePage[] = [];
  for (const concept of conceptRegistry.concepts) {
    if (!concept.path) {
      continue;
    }
    const sourcePath = path.resolve(conceptRegistry.baseDir, concept.path);
    if (!existsSync(sourcePath)) {
      continue;
    }
    const source = readFileSync(sourcePath, 'utf8');
    const lines: string[] = [];
    lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
    lines.push('');
    lines.push(`# ${concept.id}`);
    lines.push('');
    lines.push(`- Source: ${formatCodeCell(concept.path)}`);
    if (concept.status) {
      lines.push(`- Status: ${formatCodeCell(concept.status)}`);
    }
    if (concept.summary) {
      lines.push(`- Summary: ${formatTableCell(concept.summary)}`);
    }
    lines.push('');
    lines.push('## Source Document');
    lines.push('');
    lines.push(renderSourceDocument(source));
    lines.push('');
    pages.push({
      path: conceptPagePath(outDir, concept.id),
      content: lines.join('\n'),
    });
  }
  return pages;
}

export function renderProcessPages(outDir: string, relationshipMetadata: DdlRelationshipMetadata | undefined): RenderedSourcePage[] {
  if (!relationshipMetadata) {
    return [];
  }
  const processPaths = new Set<string>();
  for (const relationship of relationshipMetadata.relationships) {
    for (const process of relationship.processes) {
      processPaths.add(process.path);
    }
  }
  const pages: RenderedSourcePage[] = [];
  for (const processPath of Array.from(processPaths).sort()) {
    const sourcePath = path.resolve(relationshipMetadata.baseDir, processPath);
    if (!existsSync(sourcePath)) {
      continue;
    }
    const source = readFileSync(sourcePath, 'utf8');
    const label = path.basename(processPath, path.extname(processPath));
    const lines: string[] = [];
    lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
    lines.push('');
    lines.push(`# ${label}`);
    lines.push('');
    lines.push(`- Source: ${formatCodeCell(processPath)}`);
    lines.push('');
    lines.push('## Source Document');
    lines.push('');
    lines.push(renderSourceDocument(source));
    lines.push('');
    pages.push({
      path: processPagePath(outDir, processPath),
      content: lines.join('\n'),
    });
  }
  return pages;
}

function renderSourceDocument(source: string): string {
  return source.trimEnd().replace(
    /```mermaid[^\n]*\r?\n([\s\S]*?)\r?\n```/g,
    (_match, diagram: string) => [
      '<pre v-pre class="ddl-docs-mermaid">',
      escapeHtml(normalizeMermaidDiagram(diagram)),
      '</pre>',
    ].join('\n')
  );
}

function normalizeMermaidDiagram(diagram: string): string {
  return diagram.trim()
    .replace(/\{\{"([^"]+)"\}\}/g, '{{$1}}')
    .replace(/\[\/"([^"]+)"\/\]/g, '[/$1/]')
    .replace(/-->\|"([^"]+)"\|/g, '-->|$1|')
    .replace(/-\.\s+"([^"]+)"\s+\.->/g, '-. $1 .->');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderConceptIndex(outDir: string, conceptRegistry: ConceptRegistry | undefined): RenderedSourcePage | undefined {
  if (!conceptRegistry) {
    return undefined;
  }
  const concepts = conceptRegistry.concepts.filter((concept) =>
    concept.path && existsSync(path.resolve(conceptRegistry.baseDir, concept.path))
  );
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# Concepts');
  lines.push('');
  lines.push('| Concept | Status | Summary |');
  lines.push('| --- | --- | --- |');
  for (const concept of concepts) {
    const link = `./${slugifyIdentifier(concept.id)}.md`;
    lines.push(`| [${concept.id}](${link}) | ${formatCodeCell(concept.status ?? '')} | ${formatTableCell(concept.summary)} |`);
  }
  lines.push('');
  return {
    path: path.join(outDir, 'concepts', 'index.md'),
    content: lines.join('\n'),
  };
}

export function renderProcessIndex(outDir: string, relationshipMetadata: DdlRelationshipMetadata | undefined): RenderedSourcePage | undefined {
  if (!relationshipMetadata) {
    return undefined;
  }
  const processPaths = Array.from(new Set(
    relationshipMetadata.relationships.flatMap((relationship) => relationship.processes.map((process) => process.path))
  ))
    .filter((processPath) => existsSync(path.resolve(relationshipMetadata.baseDir, processPath)))
    .sort();
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# Processes');
  lines.push('');
  lines.push('| Process | Source |');
  lines.push('| --- | --- |');
  for (const processPath of processPaths) {
    const label = path.basename(processPath, path.extname(processPath));
    const link = `./${processPageSlug(processPath)}.md`;
    lines.push(`| [${label}](${link}) | ${formatCodeCell(processPath)} |`);
  }
  lines.push('');
  return {
    path: path.join(outDir, 'processes', 'index.md'),
    content: lines.join('\n'),
  };
}
