import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  ConceptRegistry,
  ConceptRegistryEntry,
  DfdRegistry,
  DfdRegistryBusinessOperationEntry,
  DfdRegistryConceptGroupEntry,
  DfdRegistrySubsystemEntry,
  DfdRegistryTermRef,
  DdlRelationshipMetadata,
} from '../relationshipMetadata';
import { conceptPagePath, dfdBusinessPagePath, dfdBusinessProcessPagePath, dfdPagePath, dfdSubsystemPagePath, processPagePath } from '../relationshipMetadata';
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
    const source = normalizeMermaidFences(readFileSync(sourcePath, 'utf8'));
    const lines: string[] = [];
    lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
    lines.push('');
    lines.push(source.trimEnd());
    lines.push('');
    lines.push('## Generated Review Metadata');
    lines.push('');
    lines.push('This section is generated for human review. Edit the source Concept Spec and relationship metadata instead.');
    lines.push('');
    lines.push(`- Concept ID: ${formatCodeCell(concept.id)}`);
    lines.push(`- Source: ${formatCodeCell(concept.path)}`);
    if (concept.status) {
      lines.push(`- Status: ${formatCodeCell(concept.status)}`);
    }
    if (concept.summary) {
      lines.push(`- Summary: ${formatTableCell(concept.summary)}`);
    }
    lines.push('');
    appendConceptRelationshipSection(lines, concept, conceptRegistry);
    appendConceptGlossarySection(lines, concept, conceptRegistry);
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
    const source = normalizeMermaidFences(readFileSync(processPath, 'utf8'));
    const lines: string[] = [];
    lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
    lines.push('');
    lines.push(source.trimEnd());
    lines.push('');
    lines.push('## Generated Review Metadata');
    lines.push('');
    lines.push('This section is generated for human review. Edit the source Process Map and relationship metadata instead.');
    lines.push('');
    lines.push(`- Source: ${formatCodeCell(formatProcessSourcePath(processPath, relationshipMetadata, conceptRegistry))}`);
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
  lines.push('Authoritative Concept Specs with approved source documents.');
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
    lines.push('Index terms used across Concept Specs; meanings here are review aids, not authoritative prose.');
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
    lines.push('Non-authoritative entries such as aliases, variants, candidates, or future concepts without their own approved Concept Spec.');
    lines.push('');
    lines.push('| Concept ID | Display Name | Status | Summary | Notes |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const concept of nonAuthoritativeConcepts) {
      lines.push(`| ${formatCodeCell(concept.id)} | ${formatTableCell(concept.displayName ?? '')} | ${formatCodeCell(concept.status ?? '')} | ${formatTableCell(concept.summary)} | ${formatTableCell(concept.note)} |`);
    }
  }
  if (conceptRegistry.relationships.length > 0) {
    lines.push('');
    lines.push('## Relationships');
    lines.push('');
    lines.push('Static concept relationships from metadata; reasons are review aids, not a replacement for the owning specs.');
    lines.push('');
    lines.push('| From | Kind | To | Reason |');
    lines.push('| --- | --- | --- | --- |');
    const relationships = [...conceptRegistry.relationships].sort((left, right) =>
      `${left.from}|${left.kind ?? ''}|${left.to}`.localeCompare(`${right.from}|${right.kind ?? ''}|${right.to}`)
    );
    for (const relationship of relationships) {
      lines.push(`| ${formatConceptReference(relationship.from, conceptRegistry)} | ${formatCodeCell(relationship.kind ?? '')} | ${formatConceptReference(relationship.to, conceptRegistry)} | ${formatTableCell(relationship.reason)} |`);
    }
  }
  lines.push('');
  return {
    path: path.join(outDir, 'concepts', 'index.md'),
    content: lines.join('\n'),
  };
}

function appendConceptRelationshipSection(
  lines: string[],
  concept: ConceptRegistryEntry,
  conceptRegistry: ConceptRegistry
): void {
  const relationships = conceptRegistry.relationships
    .filter((relationship) => relationship.from === concept.id || relationship.to === concept.id)
    .sort((left, right) =>
      `${left.from === concept.id ? 'outgoing' : 'incoming'}|${left.kind ?? ''}|${left.from}|${left.to}`.localeCompare(
        `${right.from === concept.id ? 'outgoing' : 'incoming'}|${right.kind ?? ''}|${right.from}|${right.to}`
      )
    );
  lines.push('## Related Concepts');
  lines.push('');
  if (relationships.length === 0) {
    lines.push('- None recorded in relationship metadata.');
    lines.push('');
    return;
  }
  lines.push('| Direction | Kind | Concept | Reason |');
  lines.push('| --- | --- | --- | --- |');
  for (const relationship of relationships) {
    const direction = relationship.from === concept.id ? 'outgoing' : 'incoming';
    const relatedId = relationship.from === concept.id ? relationship.to : relationship.from;
    lines.push(
      `| ${direction} | ${formatCodeCell(relationship.kind ?? '')} | ${formatConceptReference(relatedId, conceptRegistry)} | ${formatTableCell(relationship.reason)} |`
    );
  }
  lines.push('');
}

function appendConceptGlossarySection(
  lines: string[],
  concept: ConceptRegistryEntry,
  conceptRegistry: ConceptRegistry
): void {
  if (!concept.path) {
    return;
  }
  const terms = conceptRegistry.glossaryTerms
    .filter((term) => term.definedIn.includes(concept.path as string))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (terms.length === 0) {
    return;
  }
  lines.push('## Glossary Terms Defined Here');
  lines.push('');
  lines.push('| Term ID | Display Term | Meaning | Notes |');
  lines.push('| --- | --- | --- | --- |');
  for (const term of terms) {
    lines.push(
      `| ${formatCodeCell(term.id)} | ${formatTableCell(term.displayTerm)} | ${formatTableCell(term.meaning)} | ${formatTableCell(term.note)} |`
    );
  }
  lines.push('');
}

function formatConceptReference(conceptId: string, conceptRegistry: ConceptRegistry): string {
  const concept = conceptRegistry.concepts.find((entry) => entry.id === conceptId);
  if (!concept?.path) {
    return formatCodeCell(conceptId);
  }
  return `[${formatTableCell(conceptId)}](./${slugifyIdentifier(conceptId)}.md)`;
}

function formatConceptSourceLink(sourcePath: string, conceptRegistry: ConceptRegistry): string {
  const concept = conceptRegistry.concepts.find((entry) => entry.path === sourcePath);
  if (!concept) {
    return formatCodeCell(sourcePath);
  }
  return `[${formatTableCell(sourcePath)}](./${slugifyIdentifier(concept.id)}.md)`;
}

function normalizeMermaidFences(source: string): string {
  return source.replace(/```mermaid\n([\s\S]*?)```/g, (_match, body: string) => {
    return `\`\`\`mermaid\n${normalizeMermaid(body).trimEnd()}\n\`\`\``;
  });
}

function normalizeMermaid(source: string): string {
  return source
    .replace(/\{\{\s*"([^"]+)"\s*\}\}/g, (_match, label: string) => `{{${normalizeMermaidLabel(label)}}}`)
    .replace(/\[\/\s*"([^"]+)"\s*\"?\/\]/g, (_match, label: string) => `[/${normalizeMermaidLabel(label)}/]`)
    .replace(/\|\s*"([^"]+)"\s*\|/g, (_match, label: string) => `|${normalizeMermaidLabel(label)}|`)
    .replace(/\|\s*([^|\n]+)\s*\|/g, (_match, label: string) => `|${normalizeMermaidLabel(label)}|`)
    .replace(/([-.=]+)\s+"([^"]+)"\s+([-.=]+>)/g, (_match, left: string, label: string, right: string) =>
      `${left} ${normalizeMermaidLabel(label)} ${right}`
    );
}

function normalizeMermaidLabel(value: string): string {
  return value.replace(/[<>\-]/g, ' ').replace(/\s+/g, ' ').trim();
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

export function renderDfdPages(
  outDir: string,
  dfdRegistry: DfdRegistry | undefined,
  conceptRegistry?: ConceptRegistry
): RenderedSourcePage[] {
  if (!dfdRegistry) {
    return [];
  }
  const pages: RenderedSourcePage[] = [];
  for (const dfd of dfdRegistry.dfds) {
    const subsystem = resolveDfdSubsystem(dfdRegistry, dfd);
    const sourcePath = path.resolve(dfdRegistry.baseDir, dfd.path);
    if (!existsSync(sourcePath)) {
      continue;
    }
    const source = normalizeMermaidFences(readFileSync(sourcePath, 'utf8'));
    const lines: string[] = [];
    lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
    lines.push('');
    lines.push(source.trimEnd());
    lines.push('');
    lines.push('## Generated Review Metadata');
    lines.push('');
    lines.push('This section is generated for human review. Edit the source DFD and relationship metadata instead.');
    lines.push('');
    lines.push(`- DFD ID: ${formatCodeCell(dfd.id)}`);
    lines.push(`- Source: ${formatCodeCell(dfd.path)}`);
    lines.push('');
    appendDfdConceptSection(lines, source, conceptRegistry, dfdRegistry);
    pages.push({
      path: dfdPagePath(outDir, sourcePath),
      content: lines.join('\n'),
    });
  }
  return pages;
}

function appendDfdConceptSection(
  lines: string[],
  source: string,
  conceptRegistry: ConceptRegistry | undefined,
  dfdRegistry: DfdRegistry
): void {
  lines.push('## Related Concepts');
  lines.push('');
  lines.push('Generated from Mermaid labels in this DFD. Concept group labels are expanded through DFD relationship metadata.');
  lines.push('');
  const terms = collectDfdRelatedTermsFromMermaid(source, conceptRegistry, dfdRegistry);
  if (terms.groups.length === 0 && terms.concepts.length === 0) {
    lines.push('- None found in Mermaid diagrams.');
    lines.push('');
    return;
  }
  if (terms.groups.length > 0) {
    lines.push('### Concept Groups');
    lines.push('');
    for (const group of terms.groups) {
      lines.push(`#### ${formatTableCell(group.displayName ?? group.id)} ${formatCodeCell(group.id)}`);
      lines.push('');
      if (group.summary) {
        lines.push(group.summary);
        lines.push('');
      }
      lines.push('| Member Kind | Member | Summary |');
      lines.push('| --- | --- | --- |');
      for (const member of group.members) {
        lines.push(`| ${formatTableCell(formatDfdTermKind(member.type))} | ${formatDfdTermReference(member, conceptRegistry, dfdRegistry)} | ${formatTableCell(formatDfdTermSummary(member, conceptRegistry))} |`);
      }
      lines.push('');
    }
  }
  if (terms.concepts.length > 0) {
    lines.push('### Direct Concepts');
    lines.push('');
    lines.push('| Concept | Summary |');
    lines.push('| --- | --- |');
    for (const concept of terms.concepts) {
      lines.push(`| ${formatDfdConceptReference(concept.id, conceptRegistry)} | ${formatTableCell(concept.summary)} |`);
    }
    lines.push('');
  }
}

interface DfdRelatedTerms {
  groups: DfdRegistryConceptGroupEntry[];
  concepts: ConceptRegistryEntry[];
}

function collectDfdRelatedTermsFromMermaid(
  source: string,
  conceptRegistry: ConceptRegistry | undefined,
  dfdRegistry: DfdRegistry
): DfdRelatedTerms {
  const labels = extractMermaidLabels(source);
  const groups = new Map<string, DfdRegistryConceptGroupEntry>();
  const concepts = new Map<string, ConceptRegistryEntry>();
  for (const concept of conceptRegistry?.concepts ?? []) {
    const names = [concept.id, concept.displayName].filter((value): value is string => typeof value === 'string');
    if (names.some((name) => labels.has(normalizeTermName(name)))) {
      concepts.set(concept.id, concept);
    }
  }
  for (const group of dfdRegistry.conceptGroups) {
    const names = [group.id, group.displayName].filter((value): value is string => typeof value === 'string');
    if (names.some((name) => labels.has(normalizeTermName(name)))) {
      groups.set(group.id, group);
    }
  }
  return {
    groups: Array.from(groups.values()).sort((left, right) => left.id.localeCompare(right.id)),
    concepts: Array.from(concepts.values()).sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function extractMermaidLabels(source: string): Set<string> {
  const labels = new Set<string>();
  const mermaidBlockPattern = /```mermaid\n([\s\S]*?)```/g;
  let mermaidMatch: RegExpExecArray | null;
  while ((mermaidMatch = mermaidBlockPattern.exec(source)) !== null) {
    const body = mermaidMatch[1] ?? '';
    for (const label of [
      ...extractPatternGroupValues(body, /"([^"]+)"/g),
      ...extractPatternGroupValues(body, /\|\s*([^|\n]+?)\s*\|/g),
      ...extractPatternGroupValues(body, /\[\[\s*"?([^"\]\n]+?)"?\s*\]\]/g),
      ...extractPatternGroupValues(body, /\[\(\s*"?([^"\]\)\n]+?)"?\s*\)\]/g),
      ...extractPatternGroupValues(body, /\[\s*"?([^"\]\n]+?)"?\s*\]/g),
      ...extractPatternGroupValues(body, /\(\(\s*"?([^"\)\n]+?)"?\s*\)\)/g),
      ...extractPatternGroupValues(body, /\{\{\s*"?([^"\}\n]+?)"?\s*\}\}/g),
      ...extractPatternGroupValues(body, /\[\/\s*"?([^"\/\]\n]+?)"?\s*\/\]/g),
    ]) {
      const normalized = normalizeTermName(label);
      if (normalized) {
        labels.add(normalized);
      }
    }
  }
  return labels;
}

function extractPatternGroupValues(source: string, pattern: RegExp): string[] {
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    if (match[1]) {
      values.push(match[1]);
    }
  }
  return values;
}

function normalizeTermName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function formatDfdConceptReference(conceptId: string, conceptRegistry: ConceptRegistry | undefined): string {
  const concept = conceptRegistry?.concepts.find((entry) => entry.id === conceptId);
  if (!concept?.path) {
    return formatCodeCell(conceptId);
  }
  return `[${formatTableCell(concept.displayName ?? concept.id)}](../concepts/${slugifyIdentifier(concept.id)}.md)`;
}

function formatDfdTermKind(type: string): string {
  if (type === 'concept') {
    return 'Concept';
  }
  if (type === 'concept-group') {
    return 'Concept Group';
  }
  if (type === 'external-store') {
    return 'External Store';
  }
  return type;
}

function formatDfdTermReference(
  ref: DfdRegistryTermRef,
  conceptRegistry: ConceptRegistry | undefined,
  dfdRegistry: DfdRegistry
): string {
  if (ref.type === 'concept') {
    return formatDfdConceptReference(ref.id, conceptRegistry);
  }
  if (ref.type === 'external-store') {
    const store = dfdRegistry.externalStores.find((entry) => entry.id === ref.id);
    if (store?.displayName) {
      return `${formatTableCell(store.displayName)} ${formatCodeCell(ref.id)}`;
    }
  }
  return formatCodeCell(ref.id);
}

function formatDfdTermSummary(ref: DfdRegistryTermRef, conceptRegistry: ConceptRegistry | undefined): string | undefined {
  if (ref.type !== 'concept') {
    return undefined;
  }
  return conceptRegistry?.concepts.find((entry) => entry.id === ref.id)?.summary;
}

export function renderDfdBusinessPages(
  outDir: string,
  dfdRegistry: DfdRegistry | undefined,
  conceptRegistry?: ConceptRegistry
): RenderedSourcePage[] {
  if (!dfdRegistry) {
    return [];
  }
  const pages: RenderedSourcePage[] = [];
  for (const dfd of dfdRegistry.dfds) {
    const subsystem = resolveDfdSubsystem(dfdRegistry, dfd);
    const sourcePath = path.resolve(dfdRegistry.baseDir, dfd.path);
    if (!existsSync(sourcePath)) {
      continue;
    }
    const source = normalizeMermaidFences(readFileSync(sourcePath, 'utf8'));
    for (const operation of dfd.businessOperations ?? []) {
      const operationName = operation.displayName ?? operation.id;
      const operationSection = extractOperationSectionBody(source, operationName).trim();
      const lines: string[] = [];
      lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
      lines.push('');
      if (operationSection) {
        lines.push(operationSection);
      } else {
        lines.push(`# ${operationName}`);
      }
      lines.push('');
      lines.push('## Generated Review Metadata');
      lines.push('');
      lines.push('This section is generated for human review. Edit the source DFD and relationship metadata instead.');
      lines.push('');
      lines.push(`- Business ID: ${formatCodeCell(operation.id)}`);
      lines.push(`- Parent Subsystem: [${formatTableCell(subsystem.displayName ?? subsystem.id)}](../)`);
      lines.push(`- Parent DFD: ${formatTableCell(dfd.displayName ?? dfd.id)}`);
      lines.push(`- Source: ${formatCodeCell(dfd.path)}`);
      if (operation.summary) {
        lines.push(`- Summary: ${formatTableCell(operation.summary)}`);
      }
      lines.push('');
      appendDfdBusinessIoSection(lines, operation, conceptRegistry, dfdRegistry, '../../../concepts');
      appendDfdRelatedProcessSection(lines, operation);
      pages.push({
        path: dfdBusinessPagePath(outDir, subsystem.id, operation.id),
        content: lines.join('\n'),
      });
    }
  }
  return pages;
}

export function renderDfdBusinessProcessPages(outDir: string, dfdRegistry: DfdRegistry | undefined): RenderedSourcePage[] {
  if (!dfdRegistry) {
    return [];
  }
  const pages: RenderedSourcePage[] = [];
  for (const dfd of dfdRegistry.dfds) {
    const subsystem = resolveDfdSubsystem(dfdRegistry, dfd);
    for (const operation of dfd.businessOperations ?? []) {
      const relatedProcesses = operation.relatedProcesses ?? [];
      if (relatedProcesses.length === 0) {
        continue;
      }
      const indexLines: string[] = [];
      indexLines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
      indexLines.push('');
      indexLines.push(`# ${operation.displayName ?? operation.id} Processes`);
      indexLines.push('');
      indexLines.push('Generated from DFD relationship metadata. Process pages are business-owned views.');
      indexLines.push('');
      indexLines.push('| Process | Reason |');
      indexLines.push('| --- | --- |');
      for (const relatedProcess of relatedProcesses) {
        const processSlug = slugifyIdentifier(path.basename(relatedProcess.path, path.extname(relatedProcess.path)));
        indexLines.push(`| [${formatTableCell(relatedProcess.id)}](./${processSlug}.md) | ${formatTableCell(relatedProcess.reason)} |`);
        const processSourcePath = path.resolve(dfdRegistry.baseDir, relatedProcess.path);
        if (!existsSync(processSourcePath)) {
          continue;
        }
        const source = normalizeMermaidFences(readFileSync(processSourcePath, 'utf8'));
        const lines: string[] = [];
        lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
        lines.push('');
        lines.push(source.trimEnd());
        lines.push('');
        lines.push('## Generated Review Metadata');
        lines.push('');
        lines.push('This section is generated for human review. Edit the source Process Map and DFD relationship metadata instead.');
        lines.push('');
        lines.push(`- Business ID: ${formatCodeCell(operation.id)}`);
        lines.push(`- Parent Business: [${formatTableCell(operation.displayName ?? operation.id)}](../../${slugifyIdentifier(operation.id)}.md)`);
        lines.push(`- Parent DFD: ${formatTableCell(dfd.displayName ?? dfd.id)}`);
        lines.push(`- Source: ${formatCodeCell(relatedProcess.path)}`);
        if (relatedProcess.reason) {
          lines.push(`- Reason: ${formatTableCell(relatedProcess.reason)}`);
        }
        lines.push('');
        pages.push({
          path: dfdBusinessProcessPagePath(outDir, subsystem.id, operation.id, relatedProcess.path),
          content: lines.join('\n'),
        });
      }
      indexLines.push('');
      pages.push({
        path: path.join(outDir, 'dfd', slugifyIdentifier(subsystem.id), 'business', slugifyIdentifier(operation.id), 'process', 'index.md'),
        content: indexLines.join('\n'),
      });
    }
  }
  return pages;
}

export function renderDfdIndex(outDir: string, dfdRegistry: DfdRegistry | undefined): RenderedSourcePage | undefined {
  if (!dfdRegistry) {
    return undefined;
  }
  const operations = collectDfdBusinessOperations(dfdRegistry);
  const subsystems = collectDfdSubsystems(dfdRegistry);
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# DFDs');
  lines.push('');
  lines.push('Generated from DFD relationship metadata.');
  lines.push('');
  lines.push('Summaries are review aids from DFD relationship metadata, not a replacement for the source DFD.');
  lines.push('');
  lines.push('## Subsystem Correlation');
  lines.push('');
  lines.push('Generated from cross-subsystem business operation inputs and outputs. Business operation nodes are shown on each subsystem page.');
  lines.push('');
  const subsystemEdges = collectDfdSubsystemEdges(operations, dfdRegistry);
  appendDfdSubsystemCorrelationDiagram(lines, subsystems, subsystemEdges);
  lines.push('');
  lines.push('## Boundary Notes');
  lines.push('');
  lines.push('Subsystem edges mean the downstream subsystem reads or uses outputs from the upstream subsystem. They do not grant cross-subsystem create, update, or delete ownership.');
  lines.push('');
  lines.push('| From | To | Allowed Meaning |');
  lines.push('| --- | --- | --- |');
  for (const edge of subsystemEdges) {
    lines.push(`| ${formatTableCell(edge.from.displayName ?? edge.from.id)} | ${formatTableCell(edge.to.displayName ?? edge.to.id)} | R / 参照 |`);
  }
  if (subsystemEdges.length === 0) {
    lines.push('| - | - | - |');
  }
  lines.push('');
  lines.push('## Subsystems');
  lines.push('');
  lines.push('| Subsystem | Summary | Business Count |');
  lines.push('| --- | --- | --- |');
  for (const subsystem of subsystems) {
    const subsystemOperations = operations.filter(({ dfd }) => resolveDfdSubsystem(dfdRegistry, dfd).id === subsystem.id);
    lines.push(`| [${formatTableCell(subsystem.displayName ?? subsystem.id)}](./${slugifyIdentifier(subsystem.id)}/) | ${formatTableCell(subsystem.summary)} | ${subsystemOperations.length} |`);
  }
  if (subsystems.length === 0) {
    lines.push('| - | - | - |');
  }
  lines.push('');
  return {
    path: path.join(outDir, 'dfd', 'index.md'),
    content: lines.join('\n'),
  };
}

export function renderDfdSubsystemPages(outDir: string, dfdRegistry: DfdRegistry | undefined): RenderedSourcePage[] {
  if (!dfdRegistry) {
    return [];
  }
  const pages: RenderedSourcePage[] = [];
  const operations = collectDfdBusinessOperations(dfdRegistry);
  for (const subsystem of collectDfdSubsystems(dfdRegistry)) {
    const subsystemDfds = dfdRegistry.dfds.filter((dfd) => resolveDfdSubsystem(dfdRegistry, dfd).id === subsystem.id);
    const subsystemOperations = operations.filter(({ dfd }) => resolveDfdSubsystem(dfdRegistry, dfd).id === subsystem.id);
    const lines: string[] = [];
    lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
    lines.push('');
    lines.push(`# ${subsystem.displayName ?? subsystem.id}`);
    lines.push('');
    if (subsystem.summary) {
      lines.push(subsystem.summary);
      lines.push('');
    }
    lines.push('## Business Correlation');
    lines.push('');
    appendDfdBusinessCorrelationDiagram(lines, subsystemOperations, dfdRegistry, { groupBySubsystem: false });
    lines.push('');
    lines.push('## Business Operations');
    lines.push('');
    lines.push('| Business | Summary | Related Processes | Source |');
    lines.push('| --- | --- | --- | --- |');
    for (const { dfd, operation } of subsystemOperations) {
      const operationLabel = operation.displayName ?? operation.id;
      const operationLink = `./business/${slugifyIdentifier(operation.id)}.md`;
      lines.push(`| [${formatTableCell(operationLabel)}](${operationLink}) | ${formatTableCell(operation.summary)} | ${formatTableCell(formatDfdRelatedProcesses(operation, `./business/${slugifyIdentifier(operation.id)}/process`))} | ${formatCodeCell(dfd.path)} |`);
    }
    if (subsystemOperations.length === 0) {
      lines.push('| - | - | - | - |');
    }
    lines.push('');
    pages.push({
      path: dfdSubsystemPagePath(outDir, subsystem.id),
      content: lines.join('\n'),
    });
  }
  return pages;
}

interface DfdBusinessOperationWithParent {
  dfd: DfdRegistry['dfds'][number];
  operation: DfdRegistryBusinessOperationEntry;
}

function collectDfdSubsystems(dfdRegistry: DfdRegistry): DfdRegistrySubsystemEntry[] {
  const byId = new Map<string, DfdRegistrySubsystemEntry>();
  for (const subsystem of dfdRegistry.subsystems) {
    byId.set(subsystem.id, subsystem);
  }
  for (const dfd of dfdRegistry.dfds) {
    const subsystemId = dfd.subsystem ?? 'default';
    if (!byId.has(subsystemId)) {
      byId.set(subsystemId, {
        id: subsystemId,
        displayName: subsystemId === 'default' ? 'Default' : undefined,
      });
    }
  }
  return Array.from(byId.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function resolveDfdSubsystem(dfdRegistry: DfdRegistry, dfd: DfdRegistry['dfds'][number]): DfdRegistrySubsystemEntry {
  const subsystemId = dfd.subsystem ?? 'default';
  return collectDfdSubsystems(dfdRegistry).find((entry) => entry.id === subsystemId) ?? { id: subsystemId };
}

function collectDfdBusinessOperations(dfdRegistry: DfdRegistry): DfdBusinessOperationWithParent[] {
  const operations: DfdBusinessOperationWithParent[] = [];
  for (const dfd of dfdRegistry.dfds) {
    for (const operation of dfd.businessOperations ?? []) {
      operations.push({ dfd, operation });
    }
  }
  return operations.sort((left, right) => left.operation.id.localeCompare(right.operation.id));
}

function appendDfdBusinessCorrelationDiagram(
  lines: string[],
  operations: DfdBusinessOperationWithParent[],
  dfdRegistry: DfdRegistry,
  options: { groupBySubsystem?: boolean } = {}
): void {
  if (operations.length === 0) {
    lines.push('- No business operations recorded.');
    return;
  }
  const edges = collectDfdBusinessEdges(operations, dfdRegistry);
  lines.push('```mermaid');
  lines.push('flowchart TD');
  if (options.groupBySubsystem ?? true) {
    for (const subsystem of collectDfdSubsystemsForOperations(operations, dfdRegistry)) {
      const subsystemOperations = operations.filter(({ dfd }) => resolveDfdSubsystem(dfdRegistry, dfd).id === subsystem.id);
      lines.push(`  subgraph ${subsystemNodeId(subsystem.id)}["${escapeMermaidLabel(subsystem.displayName ?? subsystem.id)}"]`);
      for (const { operation } of subsystemOperations) {
        lines.push(`    ${businessNodeId(operation.id)}((" ${escapeMermaidLabel(operation.displayName ?? operation.id)} "))`);
      }
      lines.push('  end');
    }
  } else {
    for (const { operation } of operations) {
      lines.push(`    ${businessNodeId(operation.id)}((" ${escapeMermaidLabel(operation.displayName ?? operation.id)} "))`);
    }
  }
  for (const edge of edges) {
    lines.push(`  ${businessNodeId(edge.from.operation.id)} --> ${businessNodeId(edge.to.operation.id)}`);
  }
  lines.push('```');
}

interface DfdSubsystemEdge {
  from: DfdRegistrySubsystemEntry;
  to: DfdRegistrySubsystemEntry;
}

function appendDfdSubsystemCorrelationDiagram(
  lines: string[],
  subsystems: DfdRegistrySubsystemEntry[],
  edges: DfdSubsystemEdge[]
): void {
  if (subsystems.length === 0) {
    lines.push('- No subsystems recorded.');
    return;
  }
  lines.push('```mermaid');
  lines.push('flowchart LR');
  for (const subsystem of subsystems) {
    lines.push(`  ${subsystemNodeId(subsystem.id)}((" ${escapeMermaidLabel(subsystem.displayName ?? subsystem.id)} "))`);
  }
  for (const edge of edges) {
    lines.push(`  ${subsystemNodeId(edge.from.id)} -->|"参照"| ${subsystemNodeId(edge.to.id)}`);
  }
  lines.push('```');
}

function collectDfdSubsystemEdges(
  operations: DfdBusinessOperationWithParent[],
  dfdRegistry: DfdRegistry
): DfdSubsystemEdge[] {
  const subsystemById = new Map(collectDfdSubsystems(dfdRegistry).map((subsystem) => [subsystem.id, subsystem]));
  const edgesByKey = new Map<string, DfdSubsystemEdge>();
  for (const edge of collectDfdBusinessEdges(operations, dfdRegistry)) {
    const fromId = resolveDfdSubsystem(dfdRegistry, edge.from.dfd).id;
    const toId = resolveDfdSubsystem(dfdRegistry, edge.to.dfd).id;
    if (fromId === toId) {
      continue;
    }
    const from = subsystemById.get(fromId) ?? { id: fromId };
    const to = subsystemById.get(toId) ?? { id: toId };
    edgesByKey.set(`${from.id}|${to.id}`, { from, to });
  }
  return Array.from(edgesByKey.values()).sort((left, right) =>
    `${left.from.id}|${left.to.id}`.localeCompare(`${right.from.id}|${right.to.id}`)
  );
}

function collectDfdSubsystemsForOperations(
  operations: DfdBusinessOperationWithParent[],
  dfdRegistry: DfdRegistry
): DfdRegistrySubsystemEntry[] {
  const subsystemIds = new Set(operations.map(({ dfd }) => resolveDfdSubsystem(dfdRegistry, dfd).id));
  return collectDfdSubsystems(dfdRegistry).filter((subsystem) => subsystemIds.has(subsystem.id));
}

interface DfdBusinessEdge {
  from: DfdBusinessOperationWithParent;
  to: DfdBusinessOperationWithParent;
}

function collectDfdBusinessEdges(
  operations: DfdBusinessOperationWithParent[],
  dfdRegistry: DfdRegistry
): DfdBusinessEdge[] {
  const edges: DfdBusinessEdge[] = [];
  for (const from of operations) {
    const outputs = new Set((from.operation.outputs ?? []).map(formatDfdTermRefKey));
    const available = new Set(
      [...(from.operation.inputs ?? []), ...(from.operation.uses ?? []), ...(from.operation.outputs ?? [])].map(formatDfdTermRefKey)
    );
    if (outputs.size === 0) {
      continue;
    }
    for (const to of operations) {
      if (from.operation.id === to.operation.id) {
        continue;
      }
      const inputs = [...(to.operation.inputs ?? []), ...(to.operation.uses ?? [])];
      if (inputs.some((input) => isDfdBusinessInputSatisfied(input, outputs, available, dfdRegistry))) {
        edges.push({ from, to });
      }
    }
  }
  return edges.sort((left, right) =>
    `${left.from.operation.id}|${left.to.operation.id}`.localeCompare(`${right.from.operation.id}|${right.to.operation.id}`)
  );
}

function isDfdBusinessInputSatisfied(
  input: DfdRegistryTermRef,
  outputs: Set<string>,
  available: Set<string>,
  dfdRegistry: DfdRegistry
): boolean {
  if (input.type !== 'concept-group') {
    return outputs.has(formatDfdTermRefKey(input));
  }
  const group = dfdRegistry.conceptGroups.find((entry) => entry.id === input.id);
  if (!group) {
    return outputs.has(formatDfdTermRefKey(input));
  }
  return group.members.every((member) => available.has(formatDfdTermRefKey(member)));
}

function formatDfdTermRefKey(ref: DfdRegistryTermRef): string {
  return `${ref.type}:${ref.id}`;
}

function businessNodeId(value: string): string {
  return `B_${slugifyIdentifier(value).replace(/-/g, '_')}`;
}

function subsystemNodeId(value: string): string {
  return `S_${slugifyIdentifier(value).replace(/-/g, '_')}`;
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}

function appendDfdBusinessIoSection(
  lines: string[],
  operation: DfdRegistryBusinessOperationEntry,
  conceptRegistry: ConceptRegistry | undefined,
  dfdRegistry: DfdRegistry,
  conceptHrefPrefix: string
): void {
  lines.push('## Business I/O Metadata');
  lines.push('');
  lines.push('| Direction | Terms |');
  lines.push('| --- | --- |');
  lines.push(`| Inputs | ${formatDfdTermRefs(operation.inputs, conceptRegistry, dfdRegistry, conceptHrefPrefix)} |`);
  lines.push(`| Uses | ${formatDfdTermRefs(operation.uses, conceptRegistry, dfdRegistry, conceptHrefPrefix)} |`);
  lines.push(`| Outputs | ${formatDfdTermRefs(operation.outputs, conceptRegistry, dfdRegistry, conceptHrefPrefix)} |`);
  lines.push('');
}

function appendDfdRelatedProcessSection(lines: string[], operation: DfdRegistryBusinessOperationEntry): void {
  lines.push('## Related Processes');
  lines.push('');
  if (!operation.relatedProcesses || operation.relatedProcesses.length === 0) {
    lines.push('- None recorded in DFD relationship metadata.');
    lines.push('');
    return;
  }
  lines.push('| Process | Reason |');
  lines.push('| --- | --- |');
  for (const relatedProcess of operation.relatedProcesses) {
    const link = `./${slugifyIdentifier(operation.id)}/process/${slugifyIdentifier(path.basename(relatedProcess.path, path.extname(relatedProcess.path)))}.md`;
    lines.push(`| [${formatTableCell(relatedProcess.id)}](${link}) | ${formatTableCell(relatedProcess.reason)} |`);
  }
  lines.push('');
}

function formatDfdTermRefs(
  refs: DfdRegistryBusinessOperationEntry['uses'],
  conceptRegistry: ConceptRegistry | undefined,
  dfdRegistry: DfdRegistry,
  conceptHrefPrefix: string
): string {
  if (!refs || refs.length === 0) {
    return '-';
  }
  return refs.map((ref) => formatDfdBusinessIoTermRef(ref, conceptRegistry, dfdRegistry, conceptHrefPrefix)).join(', ');
}

function formatDfdBusinessIoTermRef(
  ref: DfdRegistryTermRef,
  conceptRegistry: ConceptRegistry | undefined,
  dfdRegistry: DfdRegistry,
  conceptHrefPrefix: string
): string {
  const prefix = `${ref.type}:`;
  if (ref.type === 'concept') {
    const concept = conceptRegistry?.concepts.find((entry) => entry.id === ref.id);
    if (concept?.path) {
      return `${formatCodeCell(prefix)}[${formatTableCell(ref.id)}](${conceptHrefPrefix}/${slugifyIdentifier(ref.id)}.md)`;
    }
  }
  if (ref.type === 'external-store') {
    const store = dfdRegistry.externalStores.find((entry) => entry.id === ref.id);
    if (store?.displayName) {
      return `${formatCodeCell(prefix)}${formatTableCell(store.displayName)} ${formatCodeCell(ref.id)}`;
    }
  }
  return formatCodeCell(`${ref.type}:${ref.id}`);
}

function formatDfdRelatedProcesses(operation: DfdRegistryBusinessOperationEntry, processHrefPrefix: string): string {
  if (!operation.relatedProcesses || operation.relatedProcesses.length === 0) {
    return '-';
  }
  return operation.relatedProcesses
    .map((relatedProcess) => `[${relatedProcess.id}](${processHrefPrefix}/${slugifyIdentifier(path.basename(relatedProcess.path, path.extname(relatedProcess.path)))}.md)`)
    .join(', ');
}

interface DfdRoleEntry {
  dfdId: string;
  dfdDisplayName: string;
  dfdPath: string;
  subsystemId: string;
  businessId: string;
  businessName: string;
  role: string;
  eventWhen: string;
}

export function renderDfdRoleIndex(outDir: string, dfdRegistry: DfdRegistry | undefined): RenderedSourcePage | undefined {
  if (!dfdRegistry) {
    return undefined;
  }
  const roles = collectDfdRoles(dfdRegistry);
  const rolesByName = new Map<string, DfdRoleEntry[]>();
  for (const role of roles) {
    const entries = rolesByName.get(role.role) ?? [];
    entries.push(role);
    rolesByName.set(role.role, entries);
  }
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# Roles');
  lines.push('');
  lines.push('Generated from DFD Mermaid diagrams. Roles are extracted from `Who:` nodes.');
  lines.push('');
  lines.push('## Role List');
  lines.push('');
  lines.push('| Role / Who | Business Count |');
  lines.push('| --- | --- |');
  for (const [roleName, entries] of Array.from(rolesByName.entries()).sort((left, right) => left[0].localeCompare(right[0]))) {
    lines.push(`| [${formatTableCell(roleName)}](#${roleAnchorId(roleName)}) | ${entries.length} |`);
  }
  if (roles.length === 0) {
    lines.push('| - | - |');
  }
  for (const [roleName, entries] of Array.from(rolesByName.entries()).sort((left, right) => left[0].localeCompare(right[0]))) {
    lines.push('');
    lines.push(`<a id="${roleAnchorId(roleName)}"></a>`);
    lines.push('');
    lines.push(`## ${roleName}`);
    lines.push('');
    lines.push('| Business | Event / When | Business Page |');
    lines.push('| --- | --- | --- |');
    for (const role of entries) {
      const link = `../dfd/${slugifyIdentifier(role.subsystemId)}/business/${slugifyIdentifier(role.businessId)}.md`;
      lines.push(
        `| ${formatTableCell(role.businessName)} | ${formatTableCell(role.eventWhen)} | [${formatTableCell(role.businessName)}](${link}) |`
      );
    }
  }
  lines.push('');
  return {
    path: path.join(outDir, 'roles', 'index.md'),
    content: lines.join('\n'),
  };
}

function roleAnchorId(roleName: string): string {
  return `role-${createHashCode(roleName)}`;
}

function createHashCode(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function collectDfdRoles(dfdRegistry: DfdRegistry): DfdRoleEntry[] {
  const roles: DfdRoleEntry[] = [];
  for (const dfd of dfdRegistry.dfds) {
    const subsystem = resolveDfdSubsystem(dfdRegistry, dfd);
    const sourcePath = path.resolve(dfdRegistry.baseDir, dfd.path);
    if (!existsSync(sourcePath)) {
      continue;
    }
    const source = readFileSync(sourcePath, 'utf8');
    for (const operation of dfd.businessOperations ?? []) {
      const operationName = operation.displayName ?? operation.id;
      const section = extractOperationSectionBody(source, operationName);
      const roleNames = extractMermaidPrefixedLabels(section, 'Who:');
      const eventWhen = extractMermaidPrefixedLabels(section, 'When:').join(', ') || '-';
      for (const roleName of roleNames) {
        roles.push({
          dfdId: dfd.id,
          dfdDisplayName: dfd.displayName ?? dfd.id,
          dfdPath: dfd.path,
          subsystemId: subsystem.id,
          businessId: operation.id,
          businessName: operationName,
          role: roleName,
          eventWhen,
        });
      }
    }
  }
  return roles.sort((left, right) =>
    `${left.role}|${left.businessName}|${left.dfdId}`.localeCompare(`${right.role}|${right.businessName}|${right.dfdId}`)
  );
}

function extractOperationSectionBody(source: string, operationName: string): string {
  const lines = source.split(/\r?\n/);
  let inSection = false;
  const sectionLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) {
        break;
      }
      inSection = line.toLowerCase().includes(operationName.toLowerCase());
      if (inSection) {
        sectionLines.push(line);
      }
      continue;
    }
    if (inSection) {
      sectionLines.push(line);
    }
  }
  return sectionLines.join('\n');
}

function extractMarkdownSection(source: string, heading: string): string {
  const lines = source.split(/\r?\n/);
  let inSection = false;
  const sectionLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) {
        break;
      }
      inSection = line.replace(/^##\s+/, '').trim().toLowerCase() === heading.toLowerCase();
      continue;
    }
    if (inSection) {
      sectionLines.push(line);
    }
  }
  return sectionLines.join('\n');
}

function extractMermaidPrefixedLabels(source: string, prefix: string): string[] {
  const labels: string[] = [];
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedPrefix}\\s*([^"\\]}]+)`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const label = match[1]?.trim();
    if (label) {
      labels.push(label);
    }
  }
  return labels;
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
