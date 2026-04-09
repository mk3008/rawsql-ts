import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  discoverProjectSqlCatalogSpecFiles,
  loadSqlCatalogSpecsFromFile,
  walkSqlCatalogSpecFiles,
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
  QueryUsageView,
} from './types';

export const QUERY_USES_REPORT_SPANS = {
  specDiscovery: 'spec-discovery',
  reportBuild: 'build-query-usage-report',
  impactAggregation: 'impact-aggregation',
} as const;

export interface QueryUsageSpanRunner {
  <T>(name: string, run: () => T, attrs?: Record<string, unknown>): T;
}

export interface BuildQueryUsageReportParams {
  kind: QueryUsageTargetKind;
  rawTarget: string;
  rootDir?: string;
  specsDir?: string;
  sqlRoot?: string;
  excludeGenerated?: boolean;
  anySchema?: boolean;
  anyTable?: boolean;
  view?: QueryUsageView;
  withSpanSync?: QueryUsageSpanRunner;
}

function runSpan<T>(withSpanSync: QueryUsageSpanRunner | undefined, name: string, run: () => T, attrs?: Record<string, unknown>): T {
  if (!withSpanSync) {
    return run();
  }

  return withSpanSync(name, run, attrs);
}

/**
 * Build a deterministic impact or detail investigation report from discovered QuerySpec entries.
 */
export function buildQueryUsageReport(params: BuildQueryUsageReportParams): QueryUsageReport {
  const rootDir = path.resolve(params.rootDir ?? process.cwd());
  const specsDir = params.specsDir ? path.resolve(rootDir, params.specsDir) : rootDir;
  const sqlRoot = params.sqlRoot ? path.resolve(rootDir, params.sqlRoot) : null;
  const legacySqlRoot = path.resolve(rootDir, 'src', 'sql');
  const normalizedSqlRoot = sqlRoot ? normalizePath(path.relative(rootDir, sqlRoot) || '.') : null;
  const normalizedLegacySqlRoot = normalizePath(path.relative(rootDir, legacySqlRoot) || '.');
  const view = params.view ?? 'impact';
  const parsedTarget = parseQueryTarget({
    kind: params.kind,
    raw: params.rawTarget,
    anySchema: params.anySchema,
    anyTable: params.anyTable,
  });

  return runSpan(params.withSpanSync, QUERY_USES_REPORT_SPANS.reportBuild, () => {
    const warnings: QueryUsageReport['warnings'] = [];
    const discovery = runSpan(params.withSpanSync, QUERY_USES_REPORT_SPANS.specDiscovery, () => {
      const specFiles = existsSync(specsDir)
        ? params.specsDir
          ? walkSqlCatalogSpecFiles(specsDir, {
            excludeGenerated: params.excludeGenerated,
            excludeTestFiles: true,
          })
          : discoverProjectSqlCatalogSpecFiles(rootDir, {
            excludeGenerated: params.excludeGenerated,
            excludeTestFiles: true,
          })
        : [];
      const loadedSpecs = specFiles.flatMap((filePath) => {
        try {
          return loadSqlCatalogSpecsFromFile(filePath, (message) => new Error(message));
        } catch (error) {
          warnings.push({
            sql_file: normalizePath(path.relative(rootDir, filePath)),
            code: 'spec-load-failed',
            message: error instanceof Error ? error.message : String(error),
          });
          return [];
        }
      });

      return { loadedSpecs };
    }, {
      excludeGenerated: Boolean(params.excludeGenerated),
      kind: params.kind,
    });

    const detailMatches: QueryUsageMatchDetail[] = [];
    let statementsScanned = 0;
    let unresolvedSqlFiles = 0;
    let parseWarnings = 0;
    let fallbackMatches = 0;

    if (discovery.loadedSpecs.length === 0) {
      const activeScope = params.specsDir
        ? normalizePath(path.relative(rootDir, specsDir) || '.')
        : '.';
      warnings.push({
        code: 'no-catalog-specs-found',
        message: params.specsDir
          ? `No QuerySpec entries found under ${activeScope}.
Hint: pass a narrower --scope-dir only when you need to limit the active scan.`
          : `No QuerySpec entries were discovered under ${activeScope}.
Hint: run "ztd init" or place feature-local specs under your project tree. Use --scope-dir only when you need to narrow the scan.`,
      });
    }

    // Bound location cache lifetime to this batch so repeated runs do not accumulate statement entries.
    clearStatementCache();

    for (const loaded of discovery.loadedSpecs) {
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
          message: 'spec.sqlFile must be a non-empty string.',
        });
        continue;
      }

      const resolvedSqlFile = resolveCatalogSqlFile({
        rootDir,
        sqlRoot,
        legacySqlRoot,
        specFilePath: loaded.filePath,
        sqlFile,
      });
      if (!resolvedSqlFile) {
        unresolvedSqlFiles += 1;
        const specRelativeCandidate = normalizePath(path.relative(rootDir, path.resolve(path.dirname(loaded.filePath), sqlFile)));
        const projectRelativeCandidate = normalizePath(path.relative(rootDir, path.resolve(rootDir, sqlFile)));
        const sqlRootCandidate = sqlRoot
          ? normalizePath(path.relative(rootDir, path.resolve(sqlRoot, sqlFile)))
          : null;
        const legacySqlRootCandidate = normalizePath(path.relative(rootDir, path.resolve(legacySqlRoot, sqlFile)));
        warnings.push({
          catalog_id: catalogId,
          sql_file: specRelativeCandidate,
          code: 'unresolved-sql-file',
          message: [
            `SQL file does not exist: ${sqlFile}`,
            `Tried spec-relative path: ${specRelativeCandidate}`,
            `Tried project-relative path: ${projectRelativeCandidate}`,
            ...(sqlRootCandidate && normalizedSqlRoot
              ? [`Tried --sql-root (${normalizedSqlRoot}): ${sqlRootCandidate}`]
              : []),
            `Tried legacy shared root (${normalizedLegacySqlRoot}): ${legacySqlRootCandidate}`,
            `Hint: prefer feature-local spec-relative sqlFile values. Use --sql-root only when your specs intentionally point into a shared SQL root.`,
          ].join('\n'),
        });
        continue;
      }

      const normalizedSqlFile = normalizePath(path.relative(rootDir, resolvedSqlFile));
      const sqlText = readFileSync(resolvedSqlFile, 'utf8');
      const statements = buildCatalogStatements({
        catalogId,
        sqlFile: normalizedSqlFile,
        sqlText,
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
      : runSpan(params.withSpanSync, QUERY_USES_REPORT_SPANS.impactAggregation, () => aggregateImpactMatches(detailMatches), {
        detailMatchCount: detailMatches.length,
      });

    return {
      schemaVersion: 2,
      mode: parsedTarget.mode,
      view,
      target: parsedTarget.target,
      summary: {
        catalogsScanned: discovery.loadedSpecs.length,
        statementsScanned,
        matches: matches.length,
        fallbackMatches,
        unresolvedSqlFiles,
        parseWarnings,
      },
      matches: sortQueryUsageMatches(matches),
      warnings: sortQueryUsageWarnings(warnings),
    };
  }, {
    kind: params.kind,
    view,
  });
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
          compareNullableNumber(left.location?.fileOffsetStart, right.location?.fileOffsetStart),
        )
        .map((match) => ({
          usage_kind: match.usage_kind,
          location: match.location,
          snippet: match.snippet,
          exprHints: match.exprHints,
          confidence: match.confidence,
          notes: match.notes,
        })),
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
  mode: QueryUsageReport['mode'],
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
    clauseAnchor: resolveFallbackClauseAnchor(usageKind),
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
    source: 'fallback',
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
    ['from', new RegExp(`\\bfrom\\s+${tablePattern}\\b`, 'i')],
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

function resolveCatalogSqlFile(params: {
  rootDir: string;
  sqlRoot: string | null;
  legacySqlRoot: string;
  specFilePath: string;
  sqlFile: string;
}): string | null {
  // Prefer spec-local ownership so feature-first projects do not need one shared SQL root.
  const specRelativeCandidate = path.resolve(path.dirname(params.specFilePath), params.sqlFile);
  if (existsSync(specRelativeCandidate)) {
    return specRelativeCandidate;
  }

  // Allow project-relative sqlFile values for repos that keep specs and SQL in separate trees.
  const projectRelativeCandidate = path.resolve(params.rootDir, params.sqlFile);
  if (existsSync(projectRelativeCandidate)) {
    return projectRelativeCandidate;
  }

  // Preserve the older shared-root escape hatch when callers opt into --sql-root explicitly.
  if (params.sqlRoot) {
    const sharedRootCandidate = path.resolve(params.sqlRoot, params.sqlFile);
    if (existsSync(sharedRootCandidate)) {
      return sharedRootCandidate;
    }
  }

  // Keep older src/sql-based projects working while spec-relative layouts become the preferred contract.
  const legacySharedRootCandidate = path.resolve(params.legacySqlRoot, params.sqlFile);
  if (existsSync(legacySharedRootCandidate)) {
    return legacySharedRootCandidate;
  }

  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
