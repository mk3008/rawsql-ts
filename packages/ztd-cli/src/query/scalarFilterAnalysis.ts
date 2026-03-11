import { readFileSync } from 'node:fs';
import {
  BinaryExpression,
  BinarySelectQuery,
  ColumnReference,
  CommonTable,
  DeleteQuery,
  IdentifierString,
  InlineQuery,
  ParenExpression,
  InsertQuery,
  RawString,
  SimpleSelectQuery,
  SqlParser,
  TableSource,
  UpdateQuery,
  ValuesQuery,
} from 'rawsql-ts';
import { assertSupportedStatement, type SupportedStatement } from './analysis';

const SUPPORTED_COMPARISON_OPERATORS = new Set(['=', '!=', '<>', '>', '>=', '<', '<=']);

/**
 * Detect non-correlated WHERE scalar subqueries that are good scalar-filter binding candidates.
 */
export function findScalarFilterCandidates(sqlFile: string): string[] {
  const statement = assertSupportedStatement(SqlParser.parse(readFileSync(sqlFile, 'utf8')), 'findScalarFilterCandidates');
  return findScalarFilterCandidatesInStatement(statement);
}

export function findScalarFilterCandidatesInStatement(statement: SupportedStatement): string[] {
  const candidates: string[] = [];
  collectScalarFilterCandidatesFromStatement(statement, candidates);
  return uniquePreservingOrder(candidates);
}

function collectScalarFilterCandidatesFromStatement(statement: SupportedStatement, candidates: string[]): void {
  if (statement instanceof SimpleSelectQuery) {
    collectScalarFilterCandidatesFromSimpleSelect(statement, candidates);
    return;
  }

  if (statement instanceof BinarySelectQuery) {
    collectScalarFilterCandidatesFromSelectNode(statement, candidates);
    return;
  }

  if (statement instanceof ValuesQuery) {
    return;
  }

  if (statement instanceof InsertQuery) {
    if (statement.selectQuery) {
      collectScalarFilterCandidatesFromSelectNode(assertSelectQuery(statement.selectQuery), candidates);
    }
    return;
  }

  if (statement instanceof UpdateQuery || statement instanceof DeleteQuery) {
    return;
  }
}

function collectScalarFilterCandidatesFromSelectNode(
  statement: SimpleSelectQuery | BinarySelectQuery | ValuesQuery,
  candidates: string[]
): void {
  if (statement instanceof SimpleSelectQuery) {
    collectScalarFilterCandidatesFromSimpleSelect(statement, candidates);
    return;
  }

  if (statement instanceof BinarySelectQuery) {
    collectScalarFilterCandidatesFromSelectNode(assertSelectQuery(statement.left), candidates);
    collectScalarFilterCandidatesFromSelectNode(assertSelectQuery(statement.right), candidates);
  }
}

function collectScalarFilterCandidatesFromSimpleSelect(statement: SimpleSelectQuery, candidates: string[]): void {
  for (const cte of getWithClauseTables(statement.withClause)) {
    collectScalarFilterCandidatesFromCte(cte, candidates);
  }

  if (!statement.whereClause) {
    return;
  }

  collectScalarFilterCandidatesFromExpression(statement.whereClause.condition, candidates);
}

function collectScalarFilterCandidatesFromCte(cte: CommonTable, candidates: string[]): void {
  collectScalarFilterCandidatesFromSelectNode(assertSelectQuery(cte.query), candidates);
}

function collectScalarFilterCandidatesFromExpression(expression: unknown, candidates: string[]): void {
  if (!(expression instanceof BinaryExpression)) {
    return;
  }

  const operator = extractOperator(expression.operator);
  if (!SUPPORTED_COMPARISON_OPERATORS.has(operator)) {
    collectScalarFilterCandidatesFromExpression(expression.left, candidates);
    collectScalarFilterCandidatesFromExpression(expression.right, candidates);
    return;
  }

  const leftInline = unwrapInlineQuery(expression.left);
  const rightInline = unwrapInlineQuery(expression.right);

  if (leftInline && isEligibleScalarSubquery(leftInline)) {
    candidates.push(...collectColumnNames(expression.right));
  }

  if (rightInline && isEligibleScalarSubquery(rightInline)) {
    candidates.push(...collectColumnNames(expression.left));
  }

  collectScalarFilterCandidatesFromExpression(expression.left, candidates);
  collectScalarFilterCandidatesFromExpression(expression.right, candidates);
}

function isEligibleScalarSubquery(inlineQuery: InlineQuery): boolean {
  const selectQuery = inlineQuery.selectQuery;
  if (!(selectQuery instanceof SimpleSelectQuery)) {
    return false;
  }

  if (!hasExactlyOneProjectedColumn(selectQuery)) {
    return false;
  }

  return !isCorrelatedScalarSubquery(selectQuery);
}

function hasExactlyOneProjectedColumn(selectQuery: SimpleSelectQuery): boolean {
  if (selectQuery.selectClause.items.length !== 1) {
    return false;
  }

  const [item] = selectQuery.selectClause.items;
  return !(item?.value instanceof RawString && item.value.value.trim() === '*');
}

function isCorrelatedScalarSubquery(selectQuery: SimpleSelectQuery): boolean {
  const localNames = collectLocalRelationNames(selectQuery);
  const columnReferences = collectColumnReferences(selectQuery);

  return columnReferences.some((reference) => {
    const qualifierParts = reference.qualifiedName.namespaces?.map((namespace) => namespace.name) ?? [];
    if (qualifierParts.length === 0) {
      return false;
    }

    const qualifier = qualifierParts[qualifierParts.length - 1];
    return !localNames.has(qualifier);
  });
}

function collectLocalRelationNames(selectQuery: SimpleSelectQuery): Set<string> {
  const localNames = new Set<string>();
  const sources = selectQuery.fromClause?.getSources() ?? [];

  for (const source of sources) {
    const aliasName = source.aliasExpression?.table?.name;
    if (aliasName) {
      localNames.add(aliasName);
    }

    if (source.datasource instanceof TableSource) {
      localNames.add(extractQualifiedNameLeaf(source.datasource.qualifiedName.name));
    }
  }

  return localNames;
}

function collectColumnNames(node: unknown): string[] {
  const columnNames: string[] = [];
  walkAst(node, (current) => {
    if (!(current instanceof ColumnReference)) {
      return;
    }

    columnNames.push(extractQualifiedNameLeaf(current.qualifiedName.name));
  });
  return uniquePreservingOrder(columnNames);
}

function collectColumnReferences(node: unknown): ColumnReference[] {
  const matches: ColumnReference[] = [];
  walkAst(node, (current) => {
    if (current instanceof ColumnReference) {
      matches.push(current);
    }
  });
  return matches;
}

function walkAst(node: unknown, visit: (current: unknown) => void): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  visit(node);

  for (const value of Object.values(node as Record<string, unknown>)) {
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walkAst(item, visit);
      }
      continue;
    }

    if (typeof value === 'object') {
      walkAst(value, visit);
    }
  }
}

function unwrapInlineQuery(expression: unknown): InlineQuery | null {
  if (expression instanceof InlineQuery) {
    return expression;
  }

  if (expression instanceof ParenExpression) {
    return unwrapInlineQuery(expression.expression);
  }

  return null;
}

function extractOperator(operator: RawString | unknown): string {
  if (operator instanceof RawString) {
    return operator.value.trim();
  }
  return '';
}

function extractQualifiedNameLeaf(name: RawString | IdentifierString): string {
  return name instanceof RawString ? name.value : name.name;
}

function assertSelectQuery(statement: unknown): SimpleSelectQuery | BinarySelectQuery | ValuesQuery {
  if (
    statement instanceof SimpleSelectQuery ||
    statement instanceof BinarySelectQuery ||
    statement instanceof ValuesQuery
  ) {
    return statement;
  }

  throw new Error('Expected a SELECT-compatible statement for scalar filter analysis.');
}

function getWithClauseTables(withClause: SimpleSelectQuery['withClause']): CommonTable[] {
  return withClause ? ((withClause as unknown as { tables?: CommonTable[]; commonTables?: CommonTable[] }).tables ?? (withClause as unknown as { commonTables?: CommonTable[] }).commonTables ?? []) : [];
}

function uniquePreservingOrder(values: string[]): string[] {
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








