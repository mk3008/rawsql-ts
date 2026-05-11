import type { ConceptRegistry } from '../relationshipMetadata';
import { formatCodeCell, formatTableCell } from '../utils/markdown';

export function renderConceptMapMarkdown(conceptRegistry: ConceptRegistry): string {
  const concepts = [...conceptRegistry.concepts].sort((left, right) => left.id.localeCompare(right.id));
  const definedConcepts = concepts.filter((concept) => concept.status === 'defined' && concept.path);
  const nonAuthoritativeConcepts = concepts.filter((concept) => concept.status !== 'defined' || !concept.path);
  const lines: string[] = [];

  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# Transfer Concept Map');
  lines.push('');
  lines.push('> Generated from `concept-relationship.json`.');
  lines.push('> This Markdown is a human review index. Do not edit concept graph facts here by hand.');
  lines.push('');
  lines.push('## Purpose');
  lines.push('');
  lines.push('This document indexes Concept Specs, glossary terms, lifecycle status, and static concept relationships for human review.');
  lines.push('Concept meanings, responsibilities, non-responsibilities, and invariants stay in each Concept Spec.');
  lines.push('Relationship facts stay in `concept-relationship.json`.');
  lines.push('');

  lines.push('## Defined Concepts');
  lines.push('');
  lines.push('| Concept ID | Display Name | Spec |');
  lines.push('| --- | --- | --- |');
  for (const concept of definedConcepts) {
    lines.push(`| ${formatCodeCell(concept.id)} | ${formatTableCell(concept.displayName ?? '')} | ${formatConceptPath(concept.path)} |`);
  }
  if (definedConcepts.length === 0) {
    lines.push('| - | - | - |');
  }

  if (conceptRegistry.glossaryTerms.length > 0) {
    lines.push('');
    lines.push('## Glossary Terms');
    lines.push('');
    lines.push('| Term ID | Display Term | Defined In |');
    lines.push('| --- | --- | --- |');
    for (const term of [...conceptRegistry.glossaryTerms].sort((left, right) => left.id.localeCompare(right.id))) {
      const definedIn = term.definedIn.map(formatConceptPath).join(', ');
      lines.push(`| ${formatCodeCell(term.id)} | ${formatTableCell(term.displayTerm)} | ${definedIn || '-'} |`);
    }
  }

  if (nonAuthoritativeConcepts.length > 0) {
    lines.push('');
    lines.push('## Non-Authoritative Concept Entries');
    lines.push('');
    lines.push('| Concept ID | Display Name | Status |');
    lines.push('| --- | --- | --- |');
    for (const concept of nonAuthoritativeConcepts) {
      lines.push(`| ${formatCodeCell(concept.id)} | ${formatTableCell(concept.displayName ?? '')} | ${formatCodeCell(concept.status ?? '')} |`);
    }
  }

  if (conceptRegistry.relatedProcessMaps.length > 0) {
    lines.push('');
    lines.push('## Related Process Maps');
    lines.push('');
    lines.push('| Process Map | Source |');
    lines.push('| --- | --- |');
    for (const process of [...conceptRegistry.relatedProcessMaps].sort((left, right) => left.id.localeCompare(right.id))) {
      const label = process.displayName ?? process.id;
      lines.push(`| ${formatTableCell(label)} | ${formatConceptPath(process.path)} |`);
    }
  }

  if (conceptRegistry.relationships.length > 0) {
    lines.push('');
    lines.push('## Concept Relationships');
    lines.push('');
    lines.push('| From | Kind | To |');
    lines.push('| --- | --- | --- |');
    const relationships = [...conceptRegistry.relationships].sort((left, right) =>
      `${left.from}|${left.kind ?? ''}|${left.to}`.localeCompare(`${right.from}|${right.kind ?? ''}|${right.to}`)
    );
    for (const relationship of relationships) {
      lines.push(`| ${formatCodeCell(relationship.from)} | ${formatCodeCell(relationship.kind ?? '')} | ${formatCodeCell(relationship.to)} |`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function formatConceptPath(sourcePath: string | null | undefined): string {
  if (!sourcePath) {
    return '-';
  }
  const normalizedPath = sourcePath.replace(/\\/g, '/');
  return `[${formatTableCell(normalizedPath)}](${normalizedPath})`;
}
