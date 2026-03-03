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
import { locateUsageText } from './location';
import { parseQueryTarget } from './targets';
import type { QueryUsageMatch, QueryUsageReport, QueryUsageTarget, QueryUsageTargetKind } from './types';

/**
 * Build a deterministic impact investigation report from catalog specs.
 */
export function buildQueryUsageReport(params: {
  kind: QueryUsageTargetKind;
  rawTarget: string;
  rootDir?: string;
  specsDir?: string;
  anySchema?: boolean;
  anyTable?: boolean;
}): QueryUsageReport {
  const rootDir = path.resolve(params.rootDir ?? process.cwd());
  const specsDir = params.specsDir ? path.resolve(rootDir, params.specsDir) : path.resolve(rootDir, 'src', 'catalog', 'specs');
  const parsedTarget = parseQueryTarget({
    kind: params.kind,
    raw: params.rawTarget,
    anySchema: params.anySchema,
    anyTable: params.anyTable
  });

  const specFiles = existsSync(specsDir) ? walkSqlCatalogSpecFiles(specsDir) : [];
  const loadedSpecs = specFiles.flatMap((filePath) => loadSqlCatalogSpecsFromFile(filePath, (message) => new Error(message)));

  const warnings: QueryUsageReport['warnings'] = [];
  const matches: QueryUsageReport['matches'] = [];
  let statementsScanned = 0;
  let unresolvedSqlFiles = 0;
  let parseWarnings = 0;
  let fallbackMatches = 0;

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
      matches.push(...result.matches);
      warnings.push(...result.warnings);
      parseWarnings += result.warnings.filter((warning) => warning.code === 'parse-failed').length;
      if (params.kind === 'table' && result.warnings.some((warning) => warning.code === 'parse-failed')) {
        const fallback = buildTableFallbackMatch(statement, parsedTarget.target, parsedTarget.mode);
        if (fallback) {
          matches.push(fallback);
          fallbackMatches += 1;
        }
      }
      fallbackMatches += result.matches.filter((match) => match.source === 'fallback').length;
    }
  }

  return {
    schemaVersion: 1,
    mode: parsedTarget.mode,
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

function normalizePath(input: string): string {
  return input.split(path.sep).join('/');
}

function buildTableFallbackMatch(
  statement: Parameters<typeof analyzeTableUsage>[0]['statement'],
  target: QueryUsageTarget,
  mode: QueryUsageReport['mode']
): QueryUsageMatch | null {
  const usageKind = inferTableFallbackUsageKind(statement.statementText, target);
  if (!usageKind) {
    return null;
  }
  const searchTerms = [target.schema && target.table ? `${target.schema}.${target.table}` : '', target.table ?? target.raw]
    .filter(Boolean);
  const located = locateUsageText({
    statementText: statement.statementText,
    statementStartOffsetInFile: statement.statementStartOffsetInFile,
    candidates: searchTerms
  });
  const notes = ['parser-fallback'];
  if (mode !== 'exact') {
    notes.push('relaxed-match-any-schema');
  }
  if (located.ambiguous) {
    notes.push('ambiguous-multiple-occurrences');
  }
  return {
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
