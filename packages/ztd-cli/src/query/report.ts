import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  loadSqlCatalogSpecsFromFile,
  walkSqlCatalogSpecFiles
} from '../utils/sqlCatalogDiscovery';
import { buildCatalogStatements } from '../utils/sqlCatalogStatements';
import { analyzeColumnUsage } from './analyzeColumnUsage';
import { analyzeTableUsage } from './analyzeTableUsage';
import { sortQueryUsageMatches, sortQueryUsageWarnings } from './format';
import { clearStatementCache, locateUsageText } from './location';
import { parseQueryTarget } from './targets';
import type {
  QueryUsageConfidence,
  QueryUsageMatch,
  QueryUsageMatchDetail,
  QueryUsageMatchImpact,
  QueryUsageReport,
  QueryUsageTarget,
  QueryUsageTargetKind,
  QueryUsageView
} from './types';

/**
 * Build a deterministic impact or detail investigation report from catalog specs.
 */
export function buildQueryUsageReport(params: {
  kind: QueryUsageTargetKind;
  rawTarget: string;
  rootDir?: string;
  specsDir?: string;
  anySchema?: boolean;
  anyTable?: boolean;
  view?: QueryUsageView;
}): QueryUsageReport {
  const rootDir = path.resolve(params.rootDir ?? process.cwd());
  const specsDir = params.specsDir ? path.resolve(rootDir, params.specsDir) : path.resolve(rootDir, 'src', 'catalog', 'specs');
  const view = params.view ?? 'impact';
  const parsedTarget = parseQueryTarget({
    kind: params.kind,
    raw: params.rawTarget,
    anySchema: params.anySchema,
    anyTable: params.anyTable
  });

  const specFiles = existsSync(specsDir) ? walkSqlCatalogSpecFiles(specsDir) : [];
  const warnings: QueryUsageReport['warnings'] = [];
  const loadedSpecs = specFiles.flatMap((filePath) => {
    try {
      return loadSqlCatalogSpecsFromFile(filePath, (message) => new Error(message));
    } catch (error) {
      warnings.push({
        sql_file: normalizePath(path.relative(rootDir, filePath)),
        code: 'spec-load-failed',
        message: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  });
  const detailMatches: QueryUsageMatchDetail[] = [];
  let statementsScanned = 0;
  let unresolvedSqlFiles = 0;
  let parseWarnings = 0;
  let fallbackMatches = 0;

  if (loadedSpecs.length === 0) {
    warnings.push({
      code: 'no-catalog-specs-found',
      message: `No catalog specs found under ${normalizePath(path.relative(rootDir, specsDir) || '.')}.\nHint: run "ztd init" or pass "--specs-dir".`
    });
  }

  // Bound location cache lifetime to this batch so repeated runs do not accumulate statement entries.
  clearStatementCache();

  for (const loaded of loadedSpecs) {
    const catalogId = typeof loaded.spec.id === 'string' && loaded.spec.id.trim().length > 0
      ? loaded.spec.id.trim()
      : `<missing-id:${path.basename(loaded.filePath)}>`;
    const sqlFile = typeof loaded.spec.sqlFile === 'string' && loaded.spec.sqlFile.trim().length > 0
      ? loaded.spec.sqlFile.trim()
      : null;
    if (!sqlFile) {
      unresolvedSqlFiles += 1;
      warnings.push({
        catalog_id: catalogId,
        sql_file: normalizePath(path.relative(rootDir, loaded.filePath)),
        code: 'unresolved-sql-file',
        message: 'spec.sqlFile must be a non-empty string.'
      });
      continue;
    }

    const resolvedSqlFile = path.resolve(path.dirname(loaded.filePath), sqlFile);
    const normalizedSqlFile = normalizePath(path.relative(rootDir, resolvedSqlFile));
    if (!existsSync(resolvedSqlFile)) {
      unresolvedSqlFiles += 1;
      warnings.push({
        catalog_id: catalogId,
        sql_file: normalizedSqlFile,
        code: 'unresolved-sql-file',
        message: `SQL file does not exist: ${sqlFile}`
      });
      continue;
    }

    const sqlText = readFileSync(resolvedSqlFile, 'utf8');
    const statements = buildCatalogStatements({
      catalogId,
      sqlFile: normalizedSqlFile,
      sqlText
    });
    statementsScanned += statements.length;

    for (const statement of statements) {
      const result = params.kind === 'table'
        ? analyzeTableUsage({ statement, target: parsedTarget.target, mode: parsedTarget.mode })
        : analyzeColumnUsage({ statement, target: parsedTarget.target, mode: parsedTarget.mode });
      detailMatches.push(...result.matches);
      warnings.push(...result.warnings);

      const statementParseWarnings = result.warnings.filter((warning) => warning.code === 'parse-failed').length;
      parseWarnings += statementParseWarnings;

      if (params.kind === 'table' && statementParseWarnings > 0) {
        const fallback = buildTableFallbackMatch(statement, parsedTarget.target, parsedTarget.mode);
        if (fallback) {
          detailMatches.push(fallback);
          fallbackMatches += 1;
        }
      }
    }
  }

  const matches: QueryUsageMatch[] = view === 'detail'
    ? detailMatches
    : aggregateImpactMatches(detailMatches);

  return {
    schemaVersion: 2,
    mode: parsedTarget.mode,
    view,
    target: parsedTarget.target,
    summary: {
      catalogsScanned: loadedSpecs.length,
      statementsScanned,
      matches: matches.length,
      fallbackMatches,
      unresolvedSqlFiles,
      parseWarnings
    },
    matches: sortQueryUsageMatches(matches),
    warnings: sortQueryUsageWarnings(warnings)
  };
}

/**
 * Write report output when an explicit output path is requested.
 */
export function writeQueryUsageOutput(outPath: string, contents: string): void {
  const absolute = path.resolve(process.cwd(), outPath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents, 'utf8');
}

function aggregateImpactMatches(matches: QueryUsageMatchDetail[]): QueryUsageMatchImpact[] {
  const grouped = new Map<string, QueryUsageMatchDetail[]>();
  for (const match of matches) {
    const key = `${match.catalog_id}\u0000${match.query_id}\u0000${match.statement_fingerprint}`;
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(match);
    } else {
      grouped.set(key, [match]);
    }
  }

  return Array.from(grouped.values()).map((group) => {
    const [first] = group;
    const usageKindCounts: Record<string, number> = {};
    const noteSet = new Set<string>();
    const representatives = new Map<string, QueryUsageMatchDetail>();

    for (const match of group) {
      usageKindCounts[match.usage_kind] = (usageKindCounts[match.usage_kind] ?? 0) + 1;
      for (const note of summarizeImpactNotes(match.notes)) {
        noteSet.add(note);
      }
      const current = representatives.get(match.usage_kind);
      if (!current || compareConfidence(match.confidence, current.confidence) < 0) {
        representatives.set(match.usage_kind, match);
      }
    }

    return {
      kind: 'impact',
      catalog_id: first.catalog_id,
      query_id: first.query_id,
      statement_fingerprint: first.statement_fingerprint,
      sql_file: first.sql_file,
      usageKindCounts: sortUsageKindCounts(usageKindCounts),
      confidence: aggregateConfidence(group.map((match) => match.confidence)),
      notes: Array.from(noteSet).sort(),
      source: group.some((match) => match.source === 'ast') ? 'ast' : 'fallback',
      representatives: Array.from(representatives.values())
        .filter((match) => match.usage_kind !== 'select')
        .sort((left, right) =>
          left.usage_kind.localeCompare(right.usage_kind) ||
          compareConfidence(left.confidence, right.confidence) ||
          compareNullableNumber(left.location?.fileOffsetStart, right.location?.fileOffsetStart)
        )
        .map((match) => ({
          usage_kind: match.usage_kind,
          location: match.location,
          snippet: match.snippet,
          exprHints: match.exprHints,
          confidence: match.confidence,
          notes: match.notes
        }))
    };
  });
}

function aggregateConfidence(confidences: QueryUsageConfidence[]): QueryUsageConfidence {
  if (confidences.includes('high')) {
    return 'high';
  }
  if (confidences.includes('medium')) {
    return 'medium';
  }
  return 'low';
}

function summarizeImpactNotes(notes: string[]): string[] {
  const summarized = new Set<string>();
  for (const note of notes) {
    switch (note) {
      case 'ambiguous-multiple-occurrences':
        summarized.add('statement-has-ambiguous-occurrences');
        break;
      case 'unqualified-column':
        summarized.add('statement-has-unqualified-column');
        break;
      case 'join-using-column':
        summarized.add('statement-has-join-using');
        break;
      case 'wildcard-select':
        summarized.add('statement-has-wildcard');
        break;
      default:
        summarized.add(note);
        break;
    }
  }
  return Array.from(summarized).sort();
}

function buildTableFallbackMatch(
  statement: Parameters<typeof analyzeTableUsage>[0]['statement'],
  target: QueryUsageTarget,
  mode: QueryUsageReport['mode']
): QueryUsageMatchDetail | null {
  const usageKind = inferTableFallbackUsageKind(statement.statementText, target);
  if (!usageKind) {
    return null;
  }

  const searchTerms = [target.schema && target.table ? `${target.schema}.${target.table}` : '', target.table ?? target.raw]
    .filter(Boolean);
  const located = locateUsageText({
    statementText: statement.statementText,
    statementStartOffsetInFile: statement.statementStartOffsetInFile,
    candidates: searchTerms,
    clauseAnchor: resolveFallbackClauseAnchor(usageKind)
  });
  const notes = ['parser-fallback'];
  if (mode !== 'exact') {
    notes.push('relaxed-match-any-schema');
  }
  if (located.ambiguous) {
    notes.push('ambiguous-multiple-occurrences');
  }

  return {
    kind: 'detail',
    catalog_id: statement.catalogId,
    query_id: statement.queryId,
    statement_fingerprint: statement.statementFingerprint,
    sql_file: statement.sqlFile,
    usage_kind: usageKind,
    location: located.location,
    snippet: located.snippet,
    confidence: 'low',
    notes: notes.sort(),
    source: 'fallback'
  };
}

function resolveFallbackClauseAnchor(usageKind: string): { kind: string; tokens: string[] } {
  switch (usageKind) {
    case 'update-target':
      return { kind: usageKind, tokens: ['UPDATE'] };
    case 'delete-target':
      return { kind: usageKind, tokens: ['DELETE', 'FROM'] };
    case 'insert-target':
      return { kind: usageKind, tokens: ['INSERT', 'INTO'] };
    case 'join':
      return { kind: usageKind, tokens: ['JOIN'] };
    case 'using':
      return { kind: usageKind, tokens: ['USING'] };
    case 'from':
    default:
      return { kind: usageKind, tokens: ['FROM'] };
  }
}

function inferTableFallbackUsageKind(sql: string, target: QueryUsageTarget): string | null {
  const tablePattern = target.schema && target.table ? `${escapeRegex(target.schema)}\\s*\\.\\s*${escapeRegex(target.table)}` : target.table ? escapeRegex(target.table) : '';
  if (!tablePattern) {
    return null;
  }

  const candidates: Array<[string, RegExp]> = [
    ['update-target', new RegExp(`\\bupdate\\s+${tablePattern}\\b`, 'i')],
    ['delete-target', new RegExp(`\\bdelete\\s+from\\s+${tablePattern}\\b`, 'i')],
    ['insert-target', new RegExp(`\\binsert\\s+into\\s+${tablePattern}\\b`, 'i')],
    ['join', new RegExp(`\\bjoin\\s+${tablePattern}\\b`, 'i')],
    ['using', new RegExp(`\\busing\\s+${tablePattern}\\b`, 'i')],
    ['from', new RegExp(`\\bfrom\\s+${tablePattern}\\b`, 'i')]
  ];
  for (const [kind, pattern] of candidates) {
    if (pattern.test(sql)) {
      return kind;
    }
  }
  return null;
}

function sortUsageKindCounts(value: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(value).sort((left, right) => left[0].localeCompare(right[0])));
}

function compareConfidence(left: QueryUsageConfidence, right: QueryUsageConfidence): number {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return rank[left] - rank[right];
}

function compareNullableNumber(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }
  return left - right;
}

function normalizePath(input: string): string {
  return input.split(path.sep).join('/');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
