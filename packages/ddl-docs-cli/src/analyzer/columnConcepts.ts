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

export function analyzeColumns(tables: TableDocModel[], options: AnalyzeOptions): AnalyzeResult {
  const conceptMap = new Map<string, ObservedColumnConcept>();
  const findings: FindingItem[] = [];
  const suggestions: SuggestionItem[] = [];

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

      if (column.unknownType) {
        findings.push({
          kind: 'UNSUPPORTED_OR_UNKNOWN_TYPE',
          severity: 'info',
          message: `Unknown type treated as raw for ${table.schema}.${table.table}.${column.name}: ${column.typeName}`,
          scope: { schema: table.schema, table: table.table, column: column.name, concept },
        });
      }

      const dictionaryEntry = options.dictionary?.columns?.[concept];
      if (!dictionaryEntry) {
        continue;
      }

      const suggestedComment = buildSuggestedComment(dictionaryEntry, options.locale);
      if (!column.comment.trim() && suggestedComment) {
        findings.push({
          kind: 'MISSING_COMMENT_SUGGESTED',
          severity: 'warning',
          message: `Missing comment for ${table.schema}.${table.table}.${column.name}.`,
          scope: { schema: table.schema, table: table.table, column: column.name, concept },
        });
        suggestions.push({
          schema: table.schema,
          table: table.table,
          column: column.name,
          sql: `COMMENT ON COLUMN ${table.schema}.${table.table}.${column.name} IS '${escapeSqlLiteral(suggestedComment)}';`,
        });
      }

      if (column.comment.trim() && suggestedComment && normalizeCompare(column.comment) !== normalizeCompare(suggestedComment)) {
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
      conceptItem.usages.map((usage) => usage.canonicalType.replace(/\(.*\)/, '').replace(/\{serial\}/, ''))
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
