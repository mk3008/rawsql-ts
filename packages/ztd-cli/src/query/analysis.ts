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
  UpdateQuery,
  ValuesQuery
} from 'rawsql-ts';
import { FromClause, SourceExpression } from 'rawsql-ts';

export type SupportedStatement = SimpleSelectQuery | BinarySelectQuery | ValuesQuery | InsertQuery | UpdateQuery | DeleteQuery;

export interface QueryAnalysis {
  statement: SupportedStatement;
  ctes: ReturnType<CTECollector['collect']>;
  cteNames: string[];
  dependencyMap: Map<string, string[]>;
  rootDependencies: string[];
}

export function assertSupportedStatement(parsed: ReturnType<typeof SqlParser.parse>, commandName: string): SupportedStatement {
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

  throw new Error(`${commandName} supports SELECT/INSERT/UPDATE/DELETE statements only.`);
}

export function analyzeStatement(statement: SupportedStatement): QueryAnalysis {
  const cteCollector = new CTECollector();
  const ctes = cteCollector.collect(statement);
  const cteNames = ctes.map((cte) => cte.aliasExpression.table.name);
  const dependencyMap = buildDependencyMap(statement, ctes);
  const rootDependencies = collectRootDependencies(statement, cteNames);

  return {
    statement,
    ctes,
    cteNames,
    dependencyMap,
    rootDependencies
  };
}

export function detectQueryType(statement: SupportedStatement): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' {
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

export function buildDependencyMap(
  statement: SupportedStatement,
  ctes: ReturnType<CTECollector['collect']>
): Map<string, string[]> {
  const cteNames = ctes.map((cte) => cte.aliasExpression.table.name);

  if (statement instanceof SimpleSelectQuery) {
    const analyzer = new CTEDependencyAnalyzer();
    analyzer.analyzeDependencies(statement);
    return new Map(
      cteNames.map((name) => [name, analyzer.getDependencies(name).filter((dependency) => cteNames.includes(dependency))])
    );
  }

  const collector = new CTETableReferenceCollector();
  const cteNameSet = new Set(cteNames);
  return new Map(
    ctes.map((cte) => {
      const references = collector.collect(cte.query).map((source) => source.table.name);
      const dependencies = Array.from(
        new Set(references.filter((reference) => cteNameSet.has(reference) && reference !== cte.aliasExpression.table.name))
      );
      return [cte.aliasExpression.table.name, dependencies];
    })
  );
}

export function collectRootDependencies(statement: SupportedStatement, cteNames: string[]): string[] {
  const cteNameSet = new Set(cteNames);

  if (isSelectStatement(statement)) {
    const collector = new CTETableReferenceCollector();
    return uniquePreservingOrder(
      collector.collect(statement).map((source) => source.table.name).filter((name) => cteNameSet.has(name))
    );
  }

  if (statement instanceof InsertQuery && statement.selectQuery) {
    return collectRootDependencies(assertSelectStatement(statement.selectQuery), cteNames);
  }

  return uniquePreservingOrder(
    collectDirectSources(statement)
      .map((source) => source.datasource)
      .filter((source): source is TableSource => source instanceof TableSource)
      .map((source) => source.table.name)
      .filter((name) => cteNameSet.has(name))
  );
}

export function collectReachableCtes(rootDependencies: string[], dependencyMap: Map<string, string[]>): Set<string> {
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

export function collectDependencyClosure(targetName: string, dependencyMap: Map<string, string[]>): string[] {
  const ordered: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name) || visiting.has(name)) {
      return;
    }

    visiting.add(name);
    for (const dependency of dependencyMap.get(name) ?? []) {
      visit(dependency);
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  }

  visit(targetName);
  return ordered;
}

export function collectDirectSources(statement: SupportedStatement): SourceExpression[] {
  if (isSelectStatement(statement)) {
    return collectSelectSources(statement);
  }
  if (statement instanceof InsertQuery) {
    return statement.selectQuery
      ? collectDirectSources(assertSelectStatement(statement.selectQuery))
      : [statement.insertClause.source];
  }
  if (statement instanceof UpdateQuery) {
    return [statement.updateClause.source, ...collectSourcesFromFromClause(statement.fromClause)];
  }
  return [statement.deleteClause.source, ...(statement.usingClause?.getSources() ?? [])];
}

export function isSelectStatement(statement: SupportedStatement): statement is SimpleSelectQuery | BinarySelectQuery | ValuesQuery {
  return statement instanceof SimpleSelectQuery || statement instanceof BinarySelectQuery || statement instanceof ValuesQuery;
}

export function uniquePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
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
