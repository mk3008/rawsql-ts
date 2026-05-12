import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  ConceptRegistry,
  ConceptRegistryEntry,
  DfdRegistry,
  DdlRelationshipMetadata,
} from '../relationshipMetadata';
import { conceptPagePath, dfdPagePath, processPagePath } from '../relationshipMetadata';
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
  if (conceptRegistry.relatedProcessMaps.length > 0) {
    lines.push('');
    lines.push('## Related Process Maps');
    lines.push('');
    lines.push('Process review views linked from concept metadata; process meaning stays in the source process documents.');
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

export function renderDfdPages(outDir: string, dfdRegistry: DfdRegistry | undefined): RenderedSourcePage[] {
  if (!dfdRegistry) {
    return [];
  }
  const pages: RenderedSourcePage[] = [];
  for (const dfd of dfdRegistry.dfds) {
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
    pages.push({
      path: dfdPagePath(outDir, sourcePath),
      content: lines.join('\n'),
    });
  }
  return pages;
}

export function renderDfdIndex(outDir: string, dfdRegistry: DfdRegistry | undefined): RenderedSourcePage | undefined {
  if (!dfdRegistry) {
    return undefined;
  }
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# DFDs');
  lines.push('');
  lines.push('Generated from DFD relationship metadata.');
  lines.push('');
  lines.push('| DFD | Source |');
  lines.push('| --- | --- |');
  for (const dfd of [...dfdRegistry.dfds].sort((left, right) => left.id.localeCompare(right.id))) {
    const label = dfd.displayName ?? dfd.id;
    const link = `./${slugifyIdentifier(path.basename(dfd.path, path.extname(dfd.path)))}.md`;
    lines.push(`| [${formatTableCell(label)}](${link}) | ${formatCodeCell(dfd.path)} |`);
  }
  if (dfdRegistry.dfds.length === 0) {
    lines.push('| - | - |');
  }
  lines.push('');
  return {
    path: path.join(outDir, 'dfd', 'index.md'),
    content: lines.join('\n'),
  };
}

interface DfdRoleEntry {
  dfdId: string;
  dfdDisplayName: string;
  dfdPath: string;
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
    lines.push('| Business | Event / When | DFD |');
    lines.push('| --- | --- | --- |');
    for (const role of entries) {
      const link = `../dfd/${slugifyIdentifier(path.basename(role.dfdPath, path.extname(role.dfdPath)))}.md`;
      lines.push(
        `| ${formatTableCell(role.businessName)} | ${formatTableCell(role.eventWhen)} | [${formatTableCell(role.dfdDisplayName)}](${link}) |`
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
