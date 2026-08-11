import { DistinctOn, InlineQuery, ParenExpression, SimpleSelectQuery, UnaryExpression } from 'rawsql-ts';
import type { JoinClause } from 'rawsql-ts';
import type {
  LineageColumn,
  LineageColumnRef,
  LineageCondition,
  LineageExpressionInfluence,
  LineageJoinInfluence,
  LineageNode,
  LineageScope,
  LineageSourceReference,
} from '../../domain/lineage';
import { mergeColumnRefs } from '../source-references/mergeColumnRefs';
import { collectColumnReferences, resolveColumnReferences } from '../source-references/resolveColumnReferences';
import type { SourceReferenceTarget } from '../source-references/sourceReferences.types';

export interface PopulationOriginSource {
  aliases: readonly string[];
  node: Pick<LineageNode, 'columns' | 'id' | 'type'>;
}

export interface PopulationOriginDeps {
  collectNestedQueryReferences: (value: unknown) => LineageColumnRef[];
  formatExpressionSql: (value: unknown) => string | undefined;
  formatScopeQuerySql: (query: SimpleSelectQuery) => string | undefined;
  getInlineQueryShadowedAliases?: (inlineQuery: InlineQuery) => ReadonlySet<string>;
}

export interface CollectPopulationScopeInput {
  deps: PopulationOriginDeps;
  joins: JoinClause[];
  outputColumns: LineageColumn[];
  parentScopeId?: string;
  query: SimpleSelectQuery;
  scopeId: string;
  sources: PopulationOriginSource[];
  targetId: string;
  targetLabel: string;
}

export function collectPopulationScope(input: CollectPopulationScopeInput): LineageScope {
  const { deps, joins, outputColumns, parentScopeId, query, scopeId, sources, targetId, targetLabel } = input;
  const where = collectConditionInfluences(query.whereClause?.condition, 'where', scopeId, sources, ['may_filter_rows'], deps);
  const having = collectConditionInfluences(query.havingClause?.condition, 'having', scopeId, sources, ['may_filter_rows'], deps);
  const { distinct, distinctOn } = collectDistinctInfluences(query.selectClause.distinct, scopeId, sources, deps);
  const groupBy = collectExpressionInfluences(query.groupByClause?.grouping ?? [], 'group_by', scopeId, sources, ['may_change_grain'], deps);
  const orderBy = collectOrderByInfluences(query.orderByClause?.order ?? [], scopeId, sources, targetId, outputColumns, deps);
  const limit = collectLimitInfluence(query.limitClause, 'limit', scopeId, deps);
  const offset = collectLimitInfluence(query.offsetClause, 'offset', scopeId, deps);
  const joinInfluences = joins
    .map((join, index) => createJoinInfluence(join, sources[index + 1], index, scopeId, sources, deps))
    .filter((join): join is LineageJoinInfluence => join !== null);

  return {
    distinct,
    distinctOn,
    groupBy,
    having,
    id: scopeId,
    joins: joinInfluences,
    kind: nodeIdToScopeKind(targetId),
    label: `${nodeIdToScopeKind(targetId)}:${targetLabel}`,
    limit,
    nodeId: targetId,
    offset,
    orderBy,
    parentScopeId,
    querySql: deps.formatScopeQuerySql(query),
    where,
  };
}

function collectDistinctInfluences(
  distinct: SimpleSelectQuery['selectClause']['distinct'],
  scopeId: string,
  sources: PopulationOriginSource[],
  deps: PopulationOriginDeps,
): { distinct?: LineageExpressionInfluence; distinctOn?: LineageExpressionInfluence[] } {
  if (!distinct) {
    return {};
  }

  if (distinct instanceof DistinctOn) {
    const distinctOn = collectExpressionInfluences(
      [distinct.value],
      'distinct_on',
      scopeId,
      sources,
      ['may_deduplicate_rows', 'may_change_order'],
      deps,
    );
    return { distinctOn };
  }

  return {
    distinct: {
      expressionSql: 'select distinct',
      id: `${scopeId}_distinct_1`,
      impact: ['may_deduplicate_rows'],
      kind: 'distinct',
      references: [],
      scopeId,
    },
  };
}

function nodeIdToScopeKind(nodeId: string): LineageScope['kind'] {
  if (nodeId === 'main_output') {
    return 'select';
  }
  if (nodeId.startsWith('cte_')) {
    return 'cte';
  }
  if (nodeId.startsWith('derived_')) {
    return 'derived';
  }
  if (nodeId.startsWith('scalar_subquery_')) {
    return 'scalar_subquery';
  }
  return 'select';
}

function collectConditionInfluences(
  condition: unknown,
  kind: LineageCondition['kind'],
  scopeId: string,
  sources: PopulationOriginSource[],
  impact: LineageCondition['impact'],
  deps: PopulationOriginDeps,
): LineageCondition[] {
  if (!condition) {
    return [];
  }

  const conditions = kind === 'where' || kind === 'having' ? splitAndConditions(condition) : [condition];
  const splitStrategy: LineageCondition['splitStrategy'] = conditions.length > 1 ? 'top_level_and' : 'whole_expression';
  return conditions.flatMap((item, index) => {
    const expressionSql = deps.formatExpressionSql(item);
    const anchorReferences = toSourceReferences(resolveColumnReferences(item, toSourceReferenceTargets(sources), {
      getInlineQueryShadowedAliases: deps.getInlineQueryShadowedAliases,
      skipUnqualifiedInInlineQueries: true,
    }), scopeId, 'row_lineage', 'anchor');
    const relatedReferences = toSourceReferences(deps.collectNestedQueryReferences(item), scopeId, 'row_lineage', 'related');
    const references = [...anchorReferences, ...relatedReferences].filter((reference, index, all) =>
      all.findIndex((candidate) => candidate.nodeId === reference.nodeId && candidate.columnName === reference.columnName && candidate.provenance === reference.provenance) === index,
    );
    if (!expressionSql && references.length === 0) {
      return [];
    }
    const result: LineageCondition = {
      expressionSql: expressionSql ?? 'unknown expression',
      id: `${scopeId}_${kind}_${index + 1}`,
      impact,
      kind,
      references,
      scopeId,
      splitStrategy,
    };
    const existencePolarity = classifyExistencePredicate(item);
    if (existencePolarity) {
      result.existencePolarity = existencePolarity;
    }
    return [result];
  });
}

function classifyExistencePredicate(value: unknown): LineageCondition['existencePolarity'] {
  const expression = unwrapParenthesized(value);
  if (!isUnaryExpressionLike(expression)) {
    return undefined;
  }
  const operator = expression.operator.value.toLowerCase();
  if (operator === 'exists' && isInlineQueryLike(expression.expression)) {
    return 'exists';
  }
  if (operator === 'not exists' && isInlineQueryLike(expression.expression)) {
    return 'not_exists';
  }
  if (operator === 'not') {
    const nested = classifyExistencePredicate(expression.expression);
    return nested === 'exists' ? 'not_exists' : nested === 'not_exists' ? 'exists' : undefined;
  }
  return undefined;
}

function unwrapParenthesized(value: unknown): unknown {
  let current = value;
  while (isParenExpressionLike(current)) {
    current = current.expression;
  }
  return current;
}

function isParenExpressionLike(value: unknown): value is ParenExpression {
  return value instanceof ParenExpression;
}

function isUnaryExpressionLike(value: unknown): value is UnaryExpression {
  return value instanceof UnaryExpression;
}

function isInlineQueryLike(value: unknown): boolean {
  return value instanceof InlineQuery;
}

function collectOrderByInfluences(
  orderItems: unknown[],
  scopeId: string,
  sources: PopulationOriginSource[],
  targetId: string,
  outputColumns: LineageColumn[],
  deps: PopulationOriginDeps,
): LineageExpressionInfluence[] {
  return orderItems.flatMap((orderItem, index) => {
    const expression = orderItem && typeof orderItem === 'object' && 'value' in orderItem ? (orderItem as { value?: unknown }).value : orderItem;
    const expressionSql = deps.formatExpressionSql(orderItem) ?? deps.formatExpressionSql(expression);
    const outputRefs = resolveOutputColumnReferences(expression, targetId, outputColumns);
    const sourceRefs = outputRefs.length > 0 ? [] : resolveColumnReferences(expression, toSourceReferenceTargets(sources));
    const references = toSourceReferences(mergeColumnRefs(sourceRefs, outputRefs), scopeId, 'row_lineage');
    if (!expressionSql && references.length === 0) {
      return [];
    }
    return [{
      expressionSql: expressionSql ?? 'unknown order expression',
      id: `${scopeId}_order_by_${index + 1}`,
      impact: ['may_change_order'],
      kind: 'order_by',
      references,
      scopeId,
    }];
  });
}

function collectLimitInfluence(
  clause: unknown,
  kind: 'limit' | 'offset',
  scopeId: string,
  deps: PopulationOriginDeps,
): LineageExpressionInfluence | undefined {
  if (!clause) {
    return undefined;
  }
  const expressionSql = deps.formatExpressionSql(clause);
  return {
    expressionSql: expressionSql ?? kind,
    id: `${scopeId}_${kind}_1`,
    impact: ['may_limit_rows'],
    kind,
    references: [],
    scopeId,
  };
}

function resolveOutputColumnReferences(value: unknown, targetId: string, outputColumns: LineageColumn[]): LineageColumnRef[] {
  const outputColumnNames = new Set(outputColumns.map((column) => column.name));
  const refs: LineageColumnRef[] = [];
  const seen = new Set<string>();
  for (const reference of collectColumnReferences(value)) {
    const columnName = reference.column.name;
    if (reference.getNamespace() || !outputColumnNames.has(columnName)) {
      continue;
    }
    const key = `${targetId}.${columnName}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ columnName, nodeId: targetId });
    }
  }
  return refs;
}

function collectExpressionInfluences(
  expressions: unknown[],
  kind: LineageExpressionInfluence['kind'],
  scopeId: string,
  sources: PopulationOriginSource[],
  impact: LineageExpressionInfluence['impact'],
  deps: PopulationOriginDeps,
): LineageExpressionInfluence[] {
  return expressions.flatMap((expression, index) => {
    const expressionSql = deps.formatExpressionSql(expression);
    const references = toSourceReferences(resolveColumnReferences(expression, toSourceReferenceTargets(sources)), scopeId, 'row_lineage');
    if (!expressionSql && references.length === 0) {
      return [];
    }
    return [{
      expressionSql: expressionSql ?? 'unknown expression',
      id: `${scopeId}_${kind}_${index + 1}`,
      impact,
      kind,
      references,
      scopeId,
    }];
  });
}

function createJoinInfluence(
  join: JoinClause,
  joinedSource: PopulationOriginSource | undefined,
  index: number,
  scopeId: string,
  sources: PopulationOriginSource[],
  deps: PopulationOriginDeps,
): LineageJoinInfluence | null {
  const joinType = normalizePopulationJoinType(join);
  const condition = collectConditionInfluences(join.condition, 'join_on', scopeId, sources, joinType === 'inner' ? ['may_filter_rows'] : ['may_null_extend_rows'], deps)[0];
  return {
    condition,
    id: `${scopeId}_join_${index + 1}`,
    impact: joinType === 'inner' ? ['may_filter_rows', 'may_multiply_rows'] : ['may_null_extend_rows', 'may_multiply_rows'],
    joinType,
    references: condition?.references ?? [],
    scopeId,
    sourceNodeId: joinedSource?.node.id ?? 'unknown',
  };
}

function toSourceReferences(
  refs: LineageColumnRef[],
  scopeId: string,
  role: LineageSourceReference['role'],
  provenance?: LineageSourceReference['provenance'],
): LineageSourceReference[] {
  return refs.map((ref) => {
    const result: LineageSourceReference = { columnName: ref.columnName, nodeId: ref.nodeId, role, scopeId };
    if (provenance) {
      result.provenance = provenance;
    }
    return result;
  });
}

function toSourceReferenceTargets(sources: PopulationOriginSource[]): SourceReferenceTarget[] {
  return sources.map((source) => ({
    aliases: source.aliases,
    columnNames: source.node.columns.map((column) => column.name),
    nodeId: source.node.id,
    nodeType: source.node.type,
  }));
}

function normalizePopulationJoinType(join: JoinClause): 'inner' | 'left' | 'right' | 'full' | 'unknown' {
  const normalized = join.joinType.value.toLowerCase();
  if (normalized.includes('left')) {
    return 'left';
  }
  if (normalized.includes('right')) {
    return 'right';
  }
  if (normalized.includes('full')) {
    return 'full';
  }
  if (normalized.includes('join')) {
    return 'inner';
  }
  return 'unknown';
}

function splitAndConditions(condition: unknown): unknown[] {
  if (isAndExpressionLike(condition)) {
    return [...splitAndConditions(condition.left), ...splitAndConditions(condition.right)];
  }
  return condition ? [condition] : [];
}

function isAndExpressionLike(value: unknown): value is { left: unknown; operator: { value: string }; right: unknown } {
  return (
    value != null &&
    typeof value === 'object' &&
    'left' in value &&
    'right' in value &&
    'operator' in value &&
    typeof (value as { operator?: { value?: unknown } }).operator?.value === 'string' &&
    (value as { operator: { value: string } }).operator.value.toLowerCase() === 'and'
  );
}
