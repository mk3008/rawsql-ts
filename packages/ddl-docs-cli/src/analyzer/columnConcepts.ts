import type {
  ColumnDictionary,
  FindingItem,
  ObservedColumnConcept,
  ObservedColumnDictionary,
  ObservedColumnUsage,
  SuggestionItem,
  TableDocModel,
} from '../types';

interface AnalyzeOptions {
  locale: string;
  dictionary: ColumnDictionary | null;
}

export interface AnalyzeResult {
  observed: ObservedColumnDictionary;
  findings: FindingItem[];
  suggestions: SuggestionItem[];
}

const KNOWN_RAW_TYPES = new Set(['text', 'date']);
const FLEXIBLE_CANONICAL_TYPES = new Set(['date', 'text']);
const PG_INT_ALIASES: Record<string, string> = {
  int: 'integer',
  int2: 'smallint',
  int4: 'integer',
  int8: 'bigint',
};

export function analyzeColumns(tables: TableDocModel[], options: AnalyzeOptions): AnalyzeResult {
  const conceptMap = new Map<string, ObservedColumnConcept>();
  const findings: FindingItem[] = [];
  const suggestions: SuggestionItem[] = [];
  const commentCatalog = buildCommentCatalog(tables);

  for (const table of tables) {
    for (const column of table.columns) {
      const concept = column.concept;
      const conceptItem =
        conceptMap.get(concept) ??
        ({
          concept,
          conceptSlug: column.conceptSlug,
          typeDistribution: {},
          usages: [],
        } satisfies ObservedColumnConcept);

      conceptItem.typeDistribution[column.typeKey] = (conceptItem.typeDistribution[column.typeKey] ?? 0) + 1;
      conceptItem.usages.push({
        schema: table.schema,
        table: table.table,
        column: column.name,
        tableSlug: table.tableSlug,
        schemaSlug: table.schemaSlug,
        typeKey: column.typeKey,
        canonicalType: column.canonicalType,
        nullable: column.nullable,
        defaultValue: column.defaultValue,
        comment: column.comment.trim(),
        hasComment: Boolean(column.comment.trim()),
      } satisfies ObservedColumnUsage);
      conceptMap.set(concept, conceptItem);

      if (column.unknownType && !KNOWN_RAW_TYPES.has(column.typeName.toLowerCase())) {
        findings.push({
          kind: 'UNSUPPORTED_OR_UNKNOWN_TYPE',
          severity: 'info',
          message: `Unknown type treated as raw for ${table.schema}.${table.table}.${column.name}: ${column.typeName}`,
          scope: { schema: table.schema, table: table.table, column: column.name, concept },
        });
      }

      const suggestedComment = pickCommentSuggestion(commentCatalog, table.schema, concept);
      if (!column.comment.trim() && suggestedComment) {
        findings.push({
          kind: 'MISSING_COMMENT_SUGGESTED',
          severity: 'warning',
          message: `Missing comment for ${table.schema}.${table.table}.${column.name}.`,
          scope: { schema: table.schema, table: table.table, column: column.name, concept },
        });
        suggestions.push({
          kind: 'column_comment',
          schema: table.schema,
          table: table.table,
          column: column.name,
          sql: `COMMENT ON COLUMN ${quoteQualifiedColumn(table.schema, table.table, column.name)} IS '${escapeSqlLiteral(suggestedComment)}';`,
        });
      }

      const dictionaryEntry = options.dictionary?.columns?.[concept];
      if (!dictionaryEntry) {
        continue;
      }

      const dictionaryComment = buildSuggestedComment(dictionaryEntry, options.locale);
      if (column.comment.trim() && dictionaryComment && normalizeCompare(column.comment) !== normalizeCompare(dictionaryComment)) {
        findings.push({
          kind: 'COMMENT_VS_DICTIONARY_MISMATCH',
          severity: 'warning',
          message: `Comment differs from dictionary for ${table.schema}.${table.table}.${column.name}.`,
          scope: { schema: table.schema, table: table.table, column: column.name, concept },
        });
      }
    }
  }

  for (const conceptItem of conceptMap.values()) {
    const divergenceBases = new Set(
      conceptItem.usages
        .map((usage) => {
          const base = usage.canonicalType.replace(/\(.*\)/, '').replace(/\{serial\}/, '');
          const normalizedBase = base.toLowerCase();
          return PG_INT_ALIASES[normalizedBase] ?? normalizedBase;
        })
        .filter((base) => !FLEXIBLE_CANONICAL_TYPES.has(base.toLowerCase()))
    );
    if (divergenceBases.size > 1) {
      findings.push({
        kind: 'COLUMN_NAME_TYPE_DIVERGENCE',
        severity: 'info',
        message: `Type variation detected for concept "${conceptItem.concept}".`,
        scope: { concept: conceptItem.concept },
      });
    }
  }

  const concepts = Array.from(conceptMap.values())
    .map((concept) => ({
      ...concept,
      usages: concept.usages.sort((a, b) =>
        `${a.schema}.${a.table}.${a.column}|${a.typeKey}`.localeCompare(`${b.schema}.${b.table}.${b.column}|${b.typeKey}`)
      ),
    }))
    .sort((a, b) => a.concept.localeCompare(b.concept));

  return {
    observed: {
      version: 1,
      generatedAt: '1970-01-01T00:00:00.000Z',
      concepts,
    },
    findings: findings.sort((a, b) => `${a.kind}|${a.message}`.localeCompare(`${b.kind}|${b.message}`)),
    suggestions: suggestions.sort((a, b) => a.sql.localeCompare(b.sql)),
  };
}

function buildSuggestedComment(entry: NonNullable<ColumnDictionary['columns'][string]>, locale: string): string {
  const label = entry.labels?.[locale] ?? entry.labels?.en ?? Object.values(entry.labels ?? {})[0];
  const note = entry.notes?.[locale] ?? entry.notes?.en ?? Object.values(entry.notes ?? {})[0];
  if (label && note) {
    return `${label} - ${note}`;
  }
  return label ?? note ?? '';
}

function escapeSqlLiteral(input: string): string {
  return input.replace(/'/g, "''");
}

function normalizeCompare(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface ConceptCommentCatalog {
  sameSchema: Map<string, string[]>;
  global: Array<{ schema: string; comment: string }>;
}

function buildCommentCatalog(tables: TableDocModel[]): Map<string, ConceptCommentCatalog> {
  const catalog = new Map<string, ConceptCommentCatalog>();

  for (const table of tables) {
    for (const column of table.columns) {
      const comment = column.comment.trim();
      if (!comment) {
        continue;
      }
      const concept = column.concept;
      const entry =
        catalog.get(concept) ??
        ({
          sameSchema: new Map<string, string[]>(),
          global: [],
        } satisfies ConceptCommentCatalog);

      const schemaComments = entry.sameSchema.get(table.schema) ?? [];
      schemaComments.push(comment);
      entry.sameSchema.set(table.schema, schemaComments);
      entry.global.push({ schema: table.schema, comment });
      catalog.set(concept, entry);
    }
  }

  for (const entry of catalog.values()) {
    for (const [schema, comments] of entry.sameSchema.entries()) {
      entry.sameSchema.set(schema, Array.from(new Set(comments)).sort((a, b) => a.localeCompare(b)));
    }
    const deduped = new Map<string, { schema: string; comment: string }>();
    for (const item of entry.global) {
      deduped.set(`${item.schema}|${item.comment}`, item);
    }
    entry.global = Array.from(deduped.values()).sort(
      (a, b) => `${a.schema}|${a.comment}`.localeCompare(`${b.schema}|${b.comment}`)
    );
  }

  return catalog;
}

function pickCommentSuggestion(
  catalog: Map<string, ConceptCommentCatalog>,
  schema: string,
  concept: string
): string {
  const entry = catalog.get(concept);
  if (!entry) {
    return '';
  }

  const sameSchema = entry.sameSchema.get(schema) ?? [];
  if (sameSchema.length > 0) {
    return sameSchema[0] ?? '';
  }

  if (entry.global.length > 0) {
    return entry.global[0]?.comment ?? '';
  }

  return '';
}

function quoteQualifiedColumn(schema: string, table: string, column: string): string {
  return [schema, table, column].map(quoteIdentifier).join('.');
}

function quoteIdentifier(value: string): string {
  const normalized = value.replace(/^"|"$/g, '');
  return `"${normalized.replace(/"/g, '""')}"`;
}
