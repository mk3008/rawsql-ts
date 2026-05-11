import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  ConceptRegistry,
  DdlRelationshipMetadata,
} from '../relationshipMetadata';
import { conceptPagePath, processPagePath } from '../relationshipMetadata';
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
    lines.push(source.trimEnd());
    lines.push('');
    pages.push({
      path: conceptPagePath(outDir, concept.id),
      content: lines.join('\n'),
    });
  }
  return pages;
}

export function renderProcessPages(
  outDir: string,
  relationshipMetadata: DdlRelationshipMetadata | undefined,
  conceptRegistry?: ConceptRegistry
): RenderedSourcePage[] {
  if (!relationshipMetadata && !conceptRegistry) {
    return [];
  }
  const pages: RenderedSourcePage[] = [];
  for (const processPath of collectProcessPaths(relationshipMetadata, conceptRegistry)) {
    if (!existsSync(processPath)) {
      continue;
    }
    const source = readFileSync(processPath, 'utf8');
    const label = path.basename(processPath, path.extname(processPath));
    const lines: string[] = [];
    lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
    lines.push('');
    lines.push(`# ${label}`);
    lines.push('');
    lines.push(`- Source: ${formatCodeCell(formatProcessSourcePath(processPath, relationshipMetadata, conceptRegistry))}`);
    lines.push('');
    lines.push('## Source Document');
    lines.push('');
    lines.push(source.trimEnd());
    lines.push('');
    pages.push({
      path: processPagePath(outDir, processPath),
      content: lines.join('\n'),
    });
  }
  return pages;
}

export function renderConceptIndex(outDir: string, conceptRegistry: ConceptRegistry | undefined): RenderedSourcePage | undefined {
  if (!conceptRegistry) {
    return undefined;
  }
  const concepts = [...conceptRegistry.concepts].sort((left, right) => left.id.localeCompare(right.id));
  const definedConcepts = concepts.filter((concept) => concept.status === 'defined' && concept.path);
  const nonAuthoritativeConcepts = concepts.filter((concept) => concept.status !== 'defined' || !concept.path);
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# Concept Map');
  lines.push('');
  lines.push('Generated from concept-relationship metadata.');
  lines.push('');
  lines.push('## Defined Concepts');
  lines.push('');
  lines.push('| Concept ID | Display Name | Status | Summary |');
  lines.push('| --- | --- | --- | --- |');
  for (const concept of definedConcepts) {
    const link = `./${slugifyIdentifier(concept.id)}.md`;
    lines.push(`| [${concept.id}](${link}) | ${formatTableCell(concept.displayName ?? '')} | ${formatCodeCell(concept.status ?? '')} | ${formatTableCell(concept.summary)} |`);
  }
  if (definedConcepts.length === 0) {
    lines.push('| - | - | - | - |');
  }
  if (conceptRegistry.glossaryTerms.length > 0) {
    lines.push('');
    lines.push('## Glossary Terms');
    lines.push('');
    lines.push('| Term ID | Display Term | Defined In | Meaning | Notes |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const term of [...conceptRegistry.glossaryTerms].sort((left, right) => left.id.localeCompare(right.id))) {
      const definedIn = term.definedIn.map((sourcePath) => formatConceptSourceLink(sourcePath, conceptRegistry)).join(', ');
      lines.push(`| ${formatCodeCell(term.id)} | ${formatTableCell(term.displayTerm)} | ${definedIn || '-'} | ${formatTableCell(term.meaning)} | ${formatTableCell(term.note)} |`);
    }
  }
  if (nonAuthoritativeConcepts.length > 0) {
    lines.push('');
    lines.push('## Planned Or Candidate Concepts');
    lines.push('');
    lines.push('| Concept ID | Display Name | Status | Summary | Notes |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const concept of nonAuthoritativeConcepts) {
      lines.push(`| ${formatCodeCell(concept.id)} | ${formatTableCell(concept.displayName ?? '')} | ${formatCodeCell(concept.status ?? '')} | ${formatTableCell(concept.summary)} | ${formatTableCell(concept.note)} |`);
    }
  }
  if (conceptRegistry.relatedProcessMaps.length > 0) {
    lines.push('');
    lines.push('## Related Process Maps');
    lines.push('');
    lines.push('| Process Map | Reason |');
    lines.push('| --- | --- |');
    for (const process of [...conceptRegistry.relatedProcessMaps].sort((left, right) => left.id.localeCompare(right.id))) {
      const label = process.displayName ?? process.id;
      const link = `../processes/${slugifyIdentifier(path.basename(process.path, path.extname(process.path)))}.md`;
      lines.push(`| [${formatTableCell(label)}](${link}) | ${formatTableCell(process.reason)} |`);
    }
  }
  if (conceptRegistry.relationships.length > 0) {
    lines.push('');
    lines.push('## Relationships');
    lines.push('');
    lines.push('| From | Kind | To | Reason |');
    lines.push('| --- | --- | --- | --- |');
    const relationships = [...conceptRegistry.relationships].sort((left, right) =>
      `${left.from}|${left.kind ?? ''}|${left.to}`.localeCompare(`${right.from}|${right.kind ?? ''}|${right.to}`)
    );
    for (const relationship of relationships) {
      lines.push(`| ${formatCodeCell(relationship.from)} | ${formatCodeCell(relationship.kind ?? '')} | ${formatCodeCell(relationship.to)} | ${formatTableCell(relationship.reason)} |`);
    }
  }
  lines.push('');
  return {
    path: path.join(outDir, 'concepts', 'index.md'),
    content: lines.join('\n'),
  };
}

function formatConceptSourceLink(sourcePath: string, conceptRegistry: ConceptRegistry): string {
  const concept = conceptRegistry.concepts.find((entry) => entry.path === sourcePath);
  if (!concept) {
    return formatCodeCell(sourcePath);
  }
  return `[${formatTableCell(sourcePath)}](./${slugifyIdentifier(concept.id)}.md)`;
}

export function renderProcessIndex(
  outDir: string,
  relationshipMetadata: DdlRelationshipMetadata | undefined,
  conceptRegistry?: ConceptRegistry
): RenderedSourcePage | undefined {
  if (!relationshipMetadata && !conceptRegistry) {
    return undefined;
  }
  const processPaths = collectProcessPaths(relationshipMetadata, conceptRegistry);
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# Processes');
  lines.push('');
  lines.push('| Process | Source |');
  lines.push('| --- | --- |');
  for (const processPath of processPaths) {
    const label = path.basename(processPath, path.extname(processPath));
    const link = `./${slugifyIdentifier(label)}.md`;
    lines.push(`| [${label}](${link}) | ${formatCodeCell(formatProcessSourcePath(processPath, relationshipMetadata, conceptRegistry))} |`);
  }
  lines.push('');
  return {
    path: path.join(outDir, 'processes', 'index.md'),
    content: lines.join('\n'),
  };
}

function collectProcessPaths(
  relationshipMetadata: DdlRelationshipMetadata | undefined,
  conceptRegistry: ConceptRegistry | undefined
): string[] {
  const processPaths = new Set<string>();
  if (relationshipMetadata) {
    for (const relationship of relationshipMetadata.relationships) {
      for (const process of relationship.processes) {
        processPaths.add(path.resolve(relationshipMetadata.baseDir, process.path));
      }
    }
  }
  if (conceptRegistry) {
    for (const process of conceptRegistry.relatedProcessMaps) {
      processPaths.add(path.resolve(conceptRegistry.baseDir, process.path));
    }
  }
  return Array.from(processPaths).sort();
}

function formatProcessSourcePath(
  processPath: string,
  relationshipMetadata: DdlRelationshipMetadata | undefined,
  conceptRegistry: ConceptRegistry | undefined
): string {
  if (relationshipMetadata) {
    const relative = path.relative(relationshipMetadata.baseDir, processPath).replace(/\\/g, '/');
    if (!relative.startsWith('..')) {
      return relative;
    }
  }
  if (conceptRegistry) {
    const relative = path.relative(conceptRegistry.baseDir, processPath).replace(/\\/g, '/');
    if (!relative.startsWith('..')) {
      return relative;
    }
  }
  return processPath.replace(/\\/g, '/');
}
