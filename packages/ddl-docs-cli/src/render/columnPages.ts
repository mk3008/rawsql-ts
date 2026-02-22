import path from 'node:path';
import type { FindingItem, ObservedColumnConcept, ObservedColumnDictionary } from '../types';
import { formatCodeCell, formatTableCell } from '../utils/markdown';

export interface RenderedPage {
  path: string;
  content: string;
}

/**
 * Renders schema and global column index/concept pages.
 */
export function renderColumnPages(
  outDir: string,
  observed: ObservedColumnDictionary,
  findings: FindingItem[]
): RenderedPage[] {
  const pages: RenderedPage[] = [];
  const grouped = groupConceptsBySchema(observed);
  const conceptSchemas = buildConceptSchemaMap(grouped);
  const alertConceptSet = new Set(
    findings.map((item) => item.scope.concept).filter((concept): concept is string => Boolean(concept))
  );
  const alertConcepts = collectAlertConcepts(observed, findings);

  pages.push({
    path: path.join(outDir, 'columns', 'index.md'),
    content: renderGlobalColumnsIndex(alertConcepts),
  });
  for (const concept of alertConcepts) {
    const conceptFindings = findings.filter((item) => item.scope.concept === concept.concept);
    pages.push({
      path: path.join(outDir, 'columns', `${concept.conceptSlug}.md`),
      content: renderConceptPage(concept, conceptFindings, {
        view: 'global',
        schemaSlug: null,
        conceptSchemas,
      }),
    });
  }

  for (const [schemaSlug, concepts] of grouped.entries()) {
    pages.push({
      path: path.join(outDir, schemaSlug, 'columns', 'index.md'),
      content: renderColumnsIndex(schemaSlug, concepts, alertConceptSet),
    });

    for (const concept of concepts) {
      const conceptFindings = findings.filter((item) => item.scope.concept === concept.concept);
      pages.push({
        path: path.join(outDir, schemaSlug, 'columns', `${concept.conceptSlug}.md`),
        content: renderConceptPage(concept, conceptFindings, {
          view: 'schema',
          schemaSlug,
          conceptSchemas,
        }),
      });
    }
  }

  return pages;
}

function renderGlobalColumnsIndex(concepts: ObservedColumnConcept[]): string {
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# Column Index (Alerts)');
  lines.push('');
  lines.push('[<- Table Index](../index.md)');
  lines.push('');
  lines.push('| Concept | Usages | Type Keys |');
  lines.push('| --- | --- | --- |');
  for (const concept of concepts) {
    const typeKeys = Object.keys(concept.typeDistribution).sort().join(', ');
    lines.push(`| [${concept.concept}](./${concept.conceptSlug}.md) | ${concept.usages.length} | ${formatTableCell(typeKeys)} |`);
  }
  if (concepts.length === 0) {
    lines.push('| - | 0 | - |');
  }
  lines.push('');
  return lines.join('\n');
}

function renderColumnsIndex(schemaSlug: string, concepts: ObservedColumnConcept[], alertConceptSet: Set<string>): string {
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  lines.push('# Column Index');
  lines.push('');
  lines.push('[<- Schema Tables](../index.md)');
  lines.push('');
  lines.push('| Concept | Usages | Type Keys | Comment | Alert |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const concept of concepts) {
    const typeKeys = Object.keys(concept.typeDistribution).sort().join(', ');
    const comments = concept.usages
      .map((usage) => usage.comment)
      .filter((comment) => comment.length > 0)
      .sort((a, b) => a.localeCompare(b));
    const topComment = comments[0] ?? '-';
    const alertMark = alertConceptSet.has(concept.concept) ? 'ALERT' : '';
    lines.push(
      `| [${concept.concept}](./${concept.conceptSlug}.md) | ${concept.usages.length} | ${formatTableCell(typeKeys)} | ${formatTableCell(topComment)} | ${alertMark} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderConceptPage(
  concept: ObservedColumnConcept,
  findings: FindingItem[],
  options: { view: 'schema' | 'global'; schemaSlug: string | null; conceptSchemas: Map<string, string[]> }
): string {
  const { view, schemaSlug, conceptSchemas } = options;
  const lines: string[] = [];
  lines.push('<!-- generated-by: @rawsql-ts/ddl-docs-cli -->');
  lines.push('');
  const schemaName = schemaSlug ? concept.usages.find((usage) => usage.schemaSlug === schemaSlug)?.schema ?? schemaSlug : null;
  lines.push(view === 'global' ? `# Global Column Concept (Alerts): ${concept.concept}` : `# ${schemaName} Column Concept: ${concept.concept}`);
  lines.push('');
  lines.push(view === 'global' ? '[<- Alert Index](./index.md)' : '[<- Column Index](./index.md)');
  lines.push('');
  lines.push(`- View: ${view === 'global' ? 'Global alert concept page' : 'Schema concept page'}`);
  lines.push('');
  lines.push('## Type Distribution');
  lines.push('');
  lines.push('| Type Key | Count | Comment |');
  lines.push('| --- | --- | --- |');
  for (const [typeKey, count] of Object.entries(concept.typeDistribution).sort(([a], [b]) => a.localeCompare(b))) {
    const comments = concept.usages
      .filter((usage) => usage.typeKey === typeKey && usage.comment.length > 0)
      .map((usage) => usage.comment)
      .sort((a, b) => a.localeCompare(b));
    const topComment = comments[0] ?? '-';
    lines.push(`| ${formatCodeCell(typeKey)} | ${count} | ${formatTableCell(topComment)} |`);
  }
  lines.push('');
  lines.push('## Usages');
  lines.push('');
  lines.push('| Location | Type Key | Nullable | Default | Comment |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const usage of concept.usages) {
    const tableLink = view === 'global' ? `../${usage.schemaSlug}/${usage.tableSlug}.md` : `../${usage.tableSlug}.md`;
    const location = `[${usage.schema}.${usage.table}.${usage.column}](${tableLink})`;
    lines.push(
      `| ${location} | ${formatCodeCell(usage.typeKey)} | ${usage.nullable ? 'YES' : 'NO'} | ${formatCodeCell(usage.defaultValue)} | ${usage.hasComment ? 'YES' : 'NO'} |`
    );
  }
  if (view === 'schema' && schemaSlug) {
    lines.push('');
    lines.push('## Other Schemas');
    lines.push('');
    const otherSchemas = (conceptSchemas.get(concept.concept) ?? []).filter((entry) => entry !== schemaSlug);
    if (otherSchemas.length === 0) {
      lines.push('- None');
    } else {
      for (const otherSchemaSlug of otherSchemas) {
        lines.push(`- [${otherSchemaSlug}.${concept.concept}](../../${otherSchemaSlug}/columns/${concept.conceptSlug}.md)`);
      }
    }
    lines.push('');
    lines.push('## Alert');
    lines.push('');
    if (findings.length === 0) {
      lines.push('- None');
    } else {
      lines.push(`- [Global Alert Page](../../columns/${concept.conceptSlug}.md)`);
    }
  } else {
    lines.push('');
    lines.push('## Findings');
    lines.push('');
    if (findings.length === 0) {
      lines.push('- None');
    } else {
      for (const finding of findings) {
        lines.push(`- [${finding.kind}] ${finding.message}`);
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}

function collectAlertConcepts(observed: ObservedColumnDictionary, findings: FindingItem[]): ObservedColumnConcept[] {
  const alertConcepts = new Set(findings.map((item) => item.scope.concept).filter((concept): concept is string => Boolean(concept)));
  return observed.concepts
    .filter((concept) => alertConcepts.has(concept.concept))
    .map((concept) => ({
      ...concept,
      usages: [...concept.usages].sort((a, b) =>
        `${a.schema}.${a.table}.${a.column}|${a.typeKey}`.localeCompare(`${b.schema}.${b.table}.${b.column}|${b.typeKey}`)
      ),
    }))
    .sort((a, b) => a.concept.localeCompare(b.concept));
}

function groupConceptsBySchema(observed: ObservedColumnDictionary): Map<string, ObservedColumnConcept[]> {
  const perSchema = new Map<string, Map<string, ObservedColumnConcept>>();

  for (const concept of observed.concepts) {
    for (const usage of concept.usages) {
      const schemaBucket = perSchema.get(usage.schemaSlug) ?? new Map<string, ObservedColumnConcept>();
      const existing =
        schemaBucket.get(concept.concept) ??
        ({
          concept: concept.concept,
          conceptSlug: concept.conceptSlug,
          typeDistribution: {},
          usages: [],
        } satisfies ObservedColumnConcept);

      existing.typeDistribution[usage.typeKey] = (existing.typeDistribution[usage.typeKey] ?? 0) + 1;
      existing.usages.push(usage);
      schemaBucket.set(concept.concept, existing);
      perSchema.set(usage.schemaSlug, schemaBucket);
    }
  }

  const result = new Map<string, ObservedColumnConcept[]>();
  for (const [schemaSlug, conceptMap] of perSchema.entries()) {
    const concepts = Array.from(conceptMap.values())
      .map((concept) => ({
        ...concept,
        usages: concept.usages.sort((a, b) =>
          `${a.schema}.${a.table}.${a.column}|${a.typeKey}`.localeCompare(`${b.schema}.${b.table}.${b.column}|${b.typeKey}`)
        ),
      }))
      .sort((a, b) => a.concept.localeCompare(b.concept));
    result.set(schemaSlug, concepts);
  }

  return new Map(Array.from(result.entries()).sort(([a], [b]) => a.localeCompare(b)));
}

function buildConceptSchemaMap(grouped: Map<string, ObservedColumnConcept[]>): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const [schemaSlug, concepts] of grouped.entries()) {
    for (const concept of concepts) {
      const bucket = map.get(concept.concept) ?? new Set<string>();
      bucket.add(schemaSlug);
      map.set(concept.concept, bucket);
    }
  }
  const finalized = new Map<string, string[]>();
  for (const [concept, schemaSet] of map.entries()) {
    finalized.set(concept, Array.from(schemaSet).sort((a, b) => a.localeCompare(b)));
  }
  return finalized;
}
