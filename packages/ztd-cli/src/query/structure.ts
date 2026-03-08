import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BinarySelectQuery,
  CTECollector,
  CTEDependencyAnalyzer,
  CTETableReferenceCollector,
  DeleteQuery,
  InsertQuery,
  SimpleSelectQuery,
  SqlParser,
  TableSource,
  TableSourceCollector,
  UpdateQuery,
  ValuesQuery,
  normalizeTableName
} from 'rawsql-ts';
import { FromClause, SourceExpression } from 'rawsql-ts';

type SupportedStatement = SimpleSelectQuery | BinarySelectQuery | ValuesQuery | InsertQuery | UpdateQuery | DeleteQuery;
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
export function buildQueryStructureReport(sqlFile: string): QueryStructureReport {
  const absolutePath = path.resolve(sqlFile);
  const sql = readFileSync(absolutePath, 'utf8');
  const parsed = SqlParser.parse(sql);
  const statement = assertSupportedStatement(parsed);
  const cteCollector = new CTECollector();
  const ctes = cteCollector.collect(statement);
  const cteNames = ctes.map((cte) => cte.aliasExpression.table.name);
  const dependencyMap = buildDependencyMap(statement, ctes);
  const rootDependencies = collectRootDependencies(statement, cteNames);
  const usedCtes = collectReachableCtes(rootDependencies, dependencyMap);
  const unusedCtes = cteNames.filter((name) => !usedCtes.has(name)).sort();
  const referencedTables = Array.from(
    new Set(new TableSourceCollector(false).collect(statement).map((source) => normalizeCollectedTableName(source)))
  ).sort();

  return {
    query_type: detectQueryType(statement),
    file: absolutePath,
    cte_count: ctes.length,
    ctes: cteNames.map((name) => ({
      name,
      depends_on: [...(dependencyMap.get(name) ?? [])].sort(),
      used_by_final_query: usedCtes.has(name),
      unused: !usedCtes.has(name)
    })),
    final_query: rootDependencies.length === 1 ? rootDependencies[0] : null,
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

  lines.push('', 'Final query target:', report.final_query ?? '(multiple or none)');
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
  const directRoots = new Set(report.final_query ? [report.final_query] : collectDirectRootNodes(report));

  for (const cte of report.ctes) {
    const attributes = cte.unused ? ' [style=dashed]' : '';
    lines.push(`  "${cte.name}"${attributes};`);
  }

  for (const cte of report.ctes) {
    for (const dependency of cte.depends_on) {
      lines.push(`  "${cte.name}" -> "${dependency}";`);
    }
    if (directRoots.has(cte.name)) {
      lines.push(`  "FINAL_QUERY" -> "${cte.name}";`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function collectDirectRootNodes(report: QueryStructureReport): string[] {
  const usedNames = new Set(report.ctes.filter((cte) => cte.used_by_final_query).map((cte) => cte.name));
  return report.ctes
    .filter((cte) => usedNames.has(cte.name))
    .filter((cte) => !report.ctes.some((candidate) => usedNames.has(candidate.name) && candidate.depends_on.includes(cte.name)))
    .map((cte) => cte.name)
    .sort();
}

function assertSupportedStatement(parsed: ReturnType<typeof SqlParser.parse>): SupportedStatement {
  if (
    parsed instanceof SimpleSelectQuery ||
    parsed instanceof BinarySelectQuery ||
    parsed instanceof ValuesQuery ||
    parsed instanceof InsertQuery ||
    parsed instanceof UpdateQuery ||
    parsed instanceof DeleteQuery
  ) {
    return parsed;
  }

  throw new Error('ztd query outline supports SELECT/INSERT/UPDATE/DELETE statements only.');
}

function detectQueryType(statement: SupportedStatement): QueryStructureReport['query_type'] {
  if (statement instanceof InsertQuery) {
    return 'INSERT';
  }
  if (statement instanceof UpdateQuery) {
    return 'UPDATE';
  }
  if (statement instanceof DeleteQuery) {
    return 'DELETE';
  }
  return 'SELECT';
}

function buildDependencyMap(
  statement: SupportedStatement,
  ctes: ReturnType<CTECollector['collect']>
): Map<string, string[]> {
  const cteNames = ctes.map((cte) => cte.aliasExpression.table.name);

  if (isSelectStatement(statement)) {
    const analyzer = new CTEDependencyAnalyzer();
    analyzer.analyzeDependencies(statement as SimpleSelectQuery);
    return new Map(cteNames.map((name) => [name, analyzer.getDependencies(name).filter((dependency) => cteNames.includes(dependency))]));
  }

  const collector = new CTETableReferenceCollector();
  const cteNameSet = new Set(cteNames);
  return new Map(
    ctes.map((cte) => {
      const references = collector.collect(cte.query).map((source) => source.table.name);
      const dependencies = Array.from(new Set(references.filter((reference) => cteNameSet.has(reference) && reference !== cte.aliasExpression.table.name)));
      return [cte.aliasExpression.table.name, dependencies];
    })
  );
}

function collectRootDependencies(statement: SupportedStatement, cteNames: string[]): string[] {
  const cteNameSet = new Set(cteNames);

  if (isSelectStatement(statement)) {
    const collector = new CTETableReferenceCollector();
    return Array.from(new Set(collector.collect(statement).map((source) => source.table.name).filter((name) => cteNameSet.has(name))));
  }

  if (statement instanceof InsertQuery && statement.selectQuery) {
    return collectRootDependencies(assertSupportedStatement(statement.selectQuery as ReturnType<typeof SqlParser.parse>), cteNames);
  }

  return Array.from(
    new Set(
      collectDirectSources(statement)
        .map((source) => source.datasource)
        .filter((source): source is TableSource => source instanceof TableSource)
        .map((source) => source.table.name)
        .filter((name) => cteNameSet.has(name))
    )
  );
}

function collectReachableCtes(rootDependencies: string[], dependencyMap: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const queue = [...rootDependencies];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const dependency of dependencyMap.get(current) ?? []) {
      if (!visited.has(dependency)) {
        queue.push(dependency);
      }
    }
  }

  return visited;
}

function collectDirectSources(statement: SupportedStatement): SourceExpression[] {
  if (isSelectStatement(statement)) {
    return collectSelectSources(statement);
  }
  if (statement instanceof InsertQuery) {
    return statement.selectQuery
      ? collectDirectSources(assertSupportedStatement(statement.selectQuery as ReturnType<typeof SqlParser.parse>))
      : [statement.insertClause.source];
  }
  if (statement instanceof UpdateQuery) {
    return [statement.updateClause.source, ...collectSourcesFromFromClause(statement.fromClause)];
  }
  return [statement.deleteClause.source, ...(statement.usingClause?.getSources() ?? [])];
}

function collectSelectSources(statement: SimpleSelectQuery | BinarySelectQuery | ValuesQuery): SourceExpression[] {
  if (statement instanceof BinarySelectQuery) {
    return [
      ...collectSelectSources(assertSelectStatement(statement.left)),
      ...collectSelectSources(assertSelectStatement(statement.right))
    ];
  }
  if (statement instanceof ValuesQuery) {
    return [];
  }
  return collectSourcesFromFromClause(statement.fromClause);
}

function assertSelectStatement(statement: unknown): SimpleSelectQuery | BinarySelectQuery | ValuesQuery {
  if (
    statement instanceof SimpleSelectQuery ||
    statement instanceof BinarySelectQuery ||
    statement instanceof ValuesQuery
  ) {
    return statement;
  }

  throw new Error('Expected a SELECT-compatible statement.');
}

function collectSourcesFromFromClause(fromClause: FromClause | null | undefined): SourceExpression[] {
  if (!fromClause) {
    return [];
  }
  return fromClause.getSources();
}

function normalizeCollectedTableName(source: TableSource): string {
  const namespaces = source.qualifiedName.namespaces?.map((namespace) => namespace.name) ?? [];
  return normalizeTableName([...namespaces, source.table.name].join('.'));
}

function isSelectStatement(statement: SupportedStatement): statement is SimpleSelectQuery | BinarySelectQuery | ValuesQuery {
  return statement instanceof SimpleSelectQuery || statement instanceof BinarySelectQuery || statement instanceof ValuesQuery;
}

