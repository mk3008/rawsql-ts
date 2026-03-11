import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SqlParser, TableSourceCollector, normalizeTableName } from 'rawsql-ts';
import { TableSource } from 'rawsql-ts';
import {
  analyzeStatement,
  assertSupportedStatement,
  collectDirectSources,
  collectReachableCtes,
  detectQueryType,
  type SupportedStatement,
  uniquePreservingOrder
} from './analysis';

export type QueryStructureFormat = 'text' | 'json' | 'dot';

export interface QueryStructureNode {
  name: string;
  depends_on: string[];
  used_by_final_query: boolean;
  unused: boolean;
}

export interface QueryStructureReport {
  query_type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  file: string;
  cte_count: number;
  ctes: QueryStructureNode[];
  final_query: string | null;
  referenced_tables: string[];
  unused_ctes: string[];
}

/**
 * Parse a SQL file and summarize its CTE graph and referenced base tables.
 */
export function buildQueryStructureReport(sqlFile: string, commandName: string = 'ztd query outline'): QueryStructureReport {
  const absolutePath = path.resolve(sqlFile);
  const sql = readFileSync(absolutePath, 'utf8');
  const parsed = SqlParser.parse(sql);
  const statement = assertSupportedStatement(parsed, commandName);
  const analysis = analyzeStatement(statement);
  const usedCtes = collectReachableCtes(analysis.rootDependencies, analysis.dependencyMap);
  const unusedCtes = analysis.cteNames.filter((name) => !usedCtes.has(name)).sort();
  const referencedTables = Array.from(
    new Set(new TableSourceCollector(false).collect(statement).map((source) => normalizeCollectedTableName(source)))
  ).sort();

  return {
    query_type: detectQueryType(statement),
    file: absolutePath,
    cte_count: analysis.ctes.length,
    ctes: analysis.cteNames.map((name) => ({
      name,
      depends_on: [...(analysis.dependencyMap.get(name) ?? [])].sort(),
      used_by_final_query: usedCtes.has(name),
      unused: !usedCtes.has(name)
    })),
    final_query: resolveFinalQuery(statement, analysis.cteNames, analysis.rootDependencies),
    referenced_tables: referencedTables,
    unused_ctes: unusedCtes
  };
}

/**
 * Render the query structure report in the requested output format.
 */
export function formatQueryStructureReport(report: QueryStructureReport, format: QueryStructureFormat): string {
  switch (format) {
    case 'json':
      return `${JSON.stringify(report, null, 2)}\n`;
    case 'dot':
      return `${formatQueryStructureDot(report)}\n`;
    case 'text':
    default:
      return `${formatQueryStructureText(report)}\n`;
  }
}

function formatQueryStructureText(report: QueryStructureReport): string {
  const lines = [
    `Query type: ${report.query_type}`,
    `CTE count: ${report.cte_count}`,
    '',
    'CTEs:'
  ];

  if (report.ctes.length === 0) {
    lines.push('(none)');
  } else {
    report.ctes.forEach((cte, index) => {
      const suffix = cte.unused ? ' [unused]' : '';
      lines.push(`${index + 1}. ${cte.name}${suffix}`);
      lines.push(`   depends_on: ${cte.depends_on.length > 0 ? cte.depends_on.join(', ') : '(none)'}`);
    });
  }

  lines.push('', 'Final query target:', report.final_query ?? '(none)');
  lines.push('', 'Referenced tables:');
  if (report.referenced_tables.length === 0) {
    lines.push('(none)');
  } else {
    lines.push(...report.referenced_tables);
  }

  lines.push('', 'Unused CTEs:');
  if (report.unused_ctes.length === 0) {
    lines.push('(none)');
  } else {
    lines.push(...report.unused_ctes);
  }

  return lines.join('\n');
}

function formatQueryStructureDot(report: QueryStructureReport): string {
  const lines = ['digraph query_structure {', '  rankdir=LR;', '  "FINAL_QUERY" [shape=box];'];
  const directRoots = report.final_query ? report.final_query.split(', ').filter(Boolean) : [];

  for (const cte of report.ctes) {
    const attributes = cte.unused ? ' [style=dashed]' : '';
    lines.push(`  "${cte.name}"${attributes};`);
  }

  for (const cte of report.ctes) {
    for (const dependency of cte.depends_on) {
      lines.push(`  "${cte.name}" -> "${dependency}";`);
    }
    if (directRoots.includes(cte.name)) {
      lines.push(`  "FINAL_QUERY" -> "${cte.name}";`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function resolveFinalQuery(statement: SupportedStatement, cteNames: string[], rootDependencies: string[]): string | null {
  if (rootDependencies.length > 0) {
    return rootDependencies.join(', ');
  }

  const cteNameSet = new Set(cteNames);
  const directSources = uniquePreservingOrder(
    collectDirectSources(statement)
      .map((source) => source.datasource)
      .filter((source): source is TableSource => source instanceof TableSource)
      .map((source) => normalizeFinalSourceName(source, cteNameSet))
  );

  if (directSources.length === 0) {
    return null;
  }

  return directSources.join(', ');
}

function normalizeCollectedTableName(source: TableSource): string {
  const namespaces = source.qualifiedName.namespaces?.map((namespace) => namespace.name) ?? [];
  return normalizeTableName([...namespaces, source.table.name].join('.'));
}

function normalizeFinalSourceName(source: TableSource, cteNameSet: Set<string>): string {
  if (cteNameSet.has(source.table.name)) {
    return source.table.name;
  }
  return normalizeCollectedTableName(source);
}
