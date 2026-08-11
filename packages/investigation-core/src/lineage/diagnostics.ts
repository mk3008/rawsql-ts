import type {
  LineageColumn,
  LineageColumnRef,
  LineageCondition,
  LineageDiagnostic,
  LineageExpressionInfluence,
  LineageExpressionTree,
  LineageImpact,
  LineageJoinInfluence,
  LineageModel,
  LineageNode,
  LineageSourceReference,
} from '../domain/lineage';
import type { SchemaFacts } from './schemaFacts';
import { populationSignalOrder, symptomEffectMap, type CheckDomain, type DiagnosticConcernEffect, type PopulationEffect, type PopulationMechanism, type PopulationSignal, type ProblemIntent } from './problemIntent';
import { isUniqueKey, resolveTableFacts } from './schemaFacts';

export { diagnosticProblemIntents, isDiagnosticProblemIntent, problemIntentLabels, problemIntentOptions, symptomEffectMap, symptomMechanismMap } from './problemIntent';
export type { CheckDomain, DiagnosticConcernEffect, DiagnosticProblemIntent, PopulationEffect, PopulationMechanism, PopulationSignal, ProblemIntent } from './problemIntent';

export interface ColumnTarget {
  columnName: string;
  nodeId: string;
  outputIndex?: number;
  selectItemId?: string;
  scopeId?: string;
}

export interface DiagnosticTarget {
  columnName: string;
  expressionSql?: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: LineageNode['type'];
  outputIndex?: number;
  selectItemId?: string;
  scopeId: string;
}

export interface DiagnosticSourceUsage {
  role: 'row_lineage' | 'column_lineage';
  scopeId: string;
  usageKind: string;
}

export interface DiagnosticSourceReference {
  columnName: string;
  definedInScopeId?: string;
  id?: string;
  nodeId: string;
  nodeLabel: string;
  provenance?: 'anchor' | 'related';
  roles: Array<DiagnosticSourceUsage['role']>;
  scopeId: string;
  usages: DiagnosticSourceUsage[];
  usedInScopeIds?: string[];
}

export interface DiagnosticValueColumn {
  columnName: string;
  comments?: string[];
  expressionSql?: string;
  id?: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: LineageNode['type'];
  outputIndex?: number;
  selectItemId?: string;
  scopeId: string;
}

export type ColumnLineageTreeNode =
  | {
      children: ColumnLineageTreeNode[];
      column: DiagnosticValueColumn;
      cycle?: boolean;
      kind: 'column';
      leaf: boolean;
    }
  | {
      caseLabel?: string;
      children: ColumnLineageTreeNode[];
      column: DiagnosticValueColumn;
      conditionReferences: DiagnosticSourceReference[];
      conditionSql?: string;
      expressionSql?: string;
      id: string;
      kind: 'case_rule';
      label: string;
      resultReferences: DiagnosticSourceReference[];
      resultSql?: string;
      scopeId: string;
    }
  | {
      children: ColumnLineageTreeNode[];
      expression: LineageExpressionTree;
      kind: 'expression';
      owner: DiagnosticValueColumn;
    };

export interface ColumnLineageSummary {
  caseRuleCount: number;
  expressionStepCount: number;
  intermediateReferenceCount: number;
  sourceLeafCount: number;
}

export type ValueExpressionKind =
  | 'aggregate'
  | 'case'
  | 'case_rule'
  | 'column_ref'
  | 'function_call'
  | 'literal'
  | 'operator'
  | 'unknown';

export type ValueExpressionSemanticKind =
  | 'aggregation'
  | 'arithmetic'
  | 'column_passthrough'
  | 'conditional_value'
  | 'literal_value'
  | 'null_replacement'
  | 'unknown';

export type ValueExpressionInput =
  | {
      kind: 'column_ref';
      refId: string;
    }
  | {
      expressionId: string;
      kind: 'expression_ref';
    }
  | {
      kind: 'literal';
      sql: string;
    };

export interface ValueExpression {
  id: string;
  inputs: ValueExpressionInput[];
  kind: ValueExpressionKind;
  operator?: string;
  ownerStepId: string;
  semanticKind: ValueExpressionSemanticKind;
  sql: string;
}

export interface ColumnLineageStep {
  columnName: string;
  comments?: string[];
  expressionId?: string;
  expressionSql?: string;
  id: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: LineageNode['type'];
  outputIndex?: number;
  selectItemId?: string;
  scopeId: string;
}

export interface ColumnLineageCaseRule {
  caseLabel?: string;
  columnName: string;
  conditionRefIds: string[];
  conditionSql?: string;
  expressionId?: string;
  expressionSql?: string;
  id: string;
  label: string;
  nodeId: string;
  resultRefIds: string[];
  resultSql?: string;
  scopeId: string;
}

export interface ColumnLineageAnalysis {
  caseRules: ColumnLineageCaseRule[];
  expressionChain: ColumnLineageStep[];
  expressions: ValueExpression[];
  references: DiagnosticSourceReference[];
  root: string;
  scopeChain: Array<{
    label?: string;
    nodeId: string;
    scopeId: string;
  }>;
  sourceLeaves: DiagnosticValueColumn[];
  summary: ColumnLineageSummary;
}

export interface ColumnDiagnosticPacketViews {
  columnLineageTree: {
    derivedFrom: 'columnLineage';
    tree: ColumnLineageTreeNode[];
  };
}

export interface PopulationInfluence {
  effects: PopulationEffect[];
  expressionSql?: string;
  id: string;
  kind: string;
  mechanism: PopulationMechanism;
  references: DiagnosticSourceReference[];
  signals: PopulationSignal[];
  scopeId: string;
  sourceNodeId?: string;
}

export interface PopulationNodeImpact {
  effects: PopulationEffect[];
  influenceIds: string[];
  nodeId: string;
  nodeLabel: string;
  nodeType: LineageNode['type'];
  role: 'population_and_value' | 'population_only';
  signals: PopulationSignal[];
}

export interface RowLineageAnalysis {
  influences: PopulationInfluence[];
  nodeImpacts: PopulationNodeImpact[];
  summary: string;
}

export interface CandidateConcern {
  checkDomains: CheckDomain[];
  confidence: 'high' | 'low' | 'medium' | 'possible' | 'unknown';
  effects: DiagnosticConcernEffect[];
  evidence: string[];
  impact: LineageImpact[];
  influenceIds: string[];
  kind: string;
  mechanisms: PopulationMechanism[];
  reason: string;
  signals: PopulationSignal[];
  scopeId: string;
  symptomMatch?: {
    matchedEffects: DiagnosticConcernEffect[];
    problemIntent: ProblemIntent;
    rank: number;
  };
}

export interface ColumnDiagnosticPacket {
  candidateConcerns: CandidateConcern[];
  diagnostics: LineageDiagnostic[];
  kind: 'column-diagnostic-packet';
  omittedContext: {
    message: string;
    omittedColumnCount: number;
    omittedInfluenceCount: number;
    omittedNodeCount: number;
  };
  rowLineage: RowLineageAnalysis;
  target: DiagnosticTarget;
  columnLineage: ColumnLineageAnalysis;
  version: 1;
  views: ColumnDiagnosticPacketViews;
}

export interface ColumnDiagnosticOptions {
  schemaFacts?: SchemaFacts;
  symptom?: ProblemIntent;
}

export function analyzeColumnLineage(model: LineageModel, target: ColumnTarget): ColumnLineageAnalysis {
  const context = resolveTarget(model, target);
  const visited = new Set<string>();
  const references: DiagnosticSourceReference[] = [];
  const expressionChain: ColumnLineageAnalysis['expressionChain'] = [];
  const expressions: ColumnLineageAnalysis['expressions'] = [];
  const caseRules: ColumnLineageAnalysis['caseRules'] = [];
  const scopeIds = new Set<string>();

  const visit = (nodeId: string, columnName: string): void => {
    const key = columnKey(nodeId, columnName);
    if (visited.has(key)) {
      return;
    }
    visited.add(key);

    const node = model.nodes.find((item) => item.id === nodeId);
    const column = node?.columns.find((item) => item.name === columnName);
    const scopeId = column?.scopeId ?? model.scopes.find((scope) => scope.nodeId === nodeId)?.id ?? context.target.scopeId;
    scopeIds.add(scopeId);

    const stepId = valueStepId(nodeId, columnName, column);
    if (node && node.type !== 'table' && column) {
      expressionChain.push({
        columnName,
        ...optionalComments(column.comments),
        expressionId: column.expressionSql ? valueExpressionId(stepId) : undefined,
        expressionSql: column.expressionSql,
        id: stepId,
        nodeId,
        nodeLabel: node.label,
        nodeType: node.type,
        outputIndex: column.outputIndex,
        selectItemId: column.selectItemId,
        scopeId,
      });
      if (column.expressionSql) {
        expressions.push(buildValueExpression(stepId, column));
      }
    }

    for (const rule of column?.caseRules ?? []) {
      const conditionReferences = rule.conditionUpstream.map((reference) =>
        createDiagnosticReference(
          model,
          columnRefToSourceReference(reference, scopeId),
          'column_lineage',
          'case_when_condition',
        ),
      );
      const resultReferences = rule.resultUpstream.map((reference) =>
        createDiagnosticReference(
          model,
          columnRefToSourceReference(reference, scopeId),
          'column_lineage',
          'case_when_result',
        ),
      );
      const expressionId = `expr:${rule.id}`;
      caseRules.push({
        caseLabel: rule.caseLabel,
        columnName,
        conditionRefIds: conditionReferences.map((reference) => reference.id ?? referenceKey(reference)),
        conditionSql: rule.conditionSql,
        expressionId,
        expressionSql: rule.expressionSql,
        id: rule.id,
        label: rule.label,
        nodeId,
        resultRefIds: resultReferences.map((reference) => reference.id ?? referenceKey(reference)),
        resultSql: rule.resultSql,
        scopeId,
      });
      references.push(...conditionReferences, ...resultReferences);
      expressions.push({
        id: expressionId,
        inputs: [
          ...conditionReferences.map((reference) => ({ kind: 'column_ref' as const, refId: reference.id ?? referenceKey(reference) })),
          ...resultReferences.map((reference) => ({ kind: 'column_ref' as const, refId: reference.id ?? referenceKey(reference) })),
        ],
        kind: 'case_rule',
        ownerStepId: stepId,
        semanticKind: 'conditional_value',
        sql: [rule.conditionSql, rule.resultSql].filter(Boolean).join(' -> ') || rule.expressionSql || rule.label,
      });
    }

    for (const upstream of column?.upstream ?? []) {
      const upstreamNode = model.nodes.find((item) => item.id === upstream.nodeId);
      const upstreamColumn = upstreamNode?.columns.find((item) => item.name === upstream.columnName);
      const upstreamScopeId = upstreamColumn?.scopeId ?? model.scopes.find((scope) => scope.nodeId === upstream.nodeId)?.id ?? scopeId;
      scopeIds.add(upstreamScopeId);
      references.push(createDiagnosticReference(model, {
        columnName: upstream.columnName,
        nodeId: upstream.nodeId,
        role: 'column_lineage',
        scopeId: upstreamScopeId,
      }, 'column_lineage', 'column_value'));
      visit(upstream.nodeId, upstream.columnName);
    }
  };

  visit(context.target.nodeId, context.target.columnName);

  const normalizedReferences = dedupeDiagnosticReferences(references);
  const scopeChain = [...scopeIds].map((scopeId) => {
    const scope = model.scopes.find((item) => item.id === scopeId);
    return {
      label: scope?.label,
      nodeId: scope?.nodeId ?? context.target.nodeId,
      scopeId,
    };
  });
  const tree = buildColumnLineageTree(model, context.target);
  const sourceLeaves = collectColumnLineageSourceLeaves(tree);

  return {
    caseRules,
    expressions: dedupeValueExpressions(expressions),
    expressionChain,
    references: normalizedReferences,
    root: valueStepId(context.target.nodeId, context.target.columnName, context.column),
    scopeChain,
    sourceLeaves,
    summary: {
      caseRuleCount: caseRules.length,
      expressionStepCount: expressionChain.filter((step) => step.expressionSql).length,
      intermediateReferenceCount: normalizedReferences.filter((reference) =>
        model.nodes.find((node) => node.id === reference.nodeId)?.type !== 'table'
      ).length,
      sourceLeafCount: sourceLeaves.length,
    },
  };
}

export function analyzeRowLineage(
  model: LineageModel,
  target: ColumnTarget,
  columnLineage: ColumnLineageAnalysis = analyzeColumnLineage(model, target),
): RowLineageAnalysis {
  const scopeIds = new Set(columnLineage.scopeChain.map((scope) => scope.scopeId));
  const context = resolveTarget(model, target);
  scopeIds.add(context.target.scopeId);
  const groupedUniqueKeys = inferGroupedUniqueKeys(model);

  const influences = model.scopes
    .filter((scope) => scopeIds.has(scope.id))
    .flatMap((scope) => [
      ...(scope.where ?? []).map((condition) => conditionToInfluence(model, condition)),
      ...(scope.having ?? []).map((condition) => conditionToInfluence(model, condition)),
      ...(scope.distinct ? [expressionToInfluence(model, scope.distinct)] : []),
      ...(scope.distinctOn ?? []).map((expression) => expressionToInfluence(model, expression)),
      ...(scope.groupBy ?? []).map((expression) => expressionToInfluence(model, expression)),
      ...(scope.orderBy ?? []).map((expression) => expressionToInfluence(model, expression)),
      ...(scope.limit ? [expressionToInfluence(model, scope.limit)] : []),
      ...(scope.offset ? [expressionToInfluence(model, scope.offset)] : []),
      ...(scope.joins ?? []).map((join) => joinToInfluence(model, join)),
    ])
    .map((influence) => refinePopulationInfluenceImpact(influence, groupedUniqueKeys, columnLineage))
    .filter((influence) => influence.effects.length > 0 && (influence.references.length > 0 || influence.expressionSql));

  return {
    influences,
    nodeImpacts: buildPopulationNodeImpacts(model, influences, columnLineage, context.target),
    summary: influences.length === 0
      ? 'No row lineage influences were found on the column lineage route.'
      : `${influences.length} row lineage influence(s) were found on the column lineage route.`,
  };
}

export function buildColumnDiagnosticPacket(model: LineageModel, target: ColumnTarget, options: ColumnDiagnosticOptions = {}): ColumnDiagnosticPacket {
  const context = resolveTarget(model, target);
  const columnLineage = analyzeColumnLineage(model, target);
  const rowLineage = analyzeRowLineage(model, target, columnLineage);
  const mergedReferences = classifyBothReferences([
    ...columnLineage.references,
    ...rowLineage.influences.flatMap((influence) => influence.references),
  ]);
  const referencesByKey = new Map(mergedReferences.map((reference) => [referenceKey(reference), reference]));
  const normalizedColumnLineage = {
    ...columnLineage,
    references: columnLineage.references.map((reference) => referencesByKey.get(referenceKey(reference)) ?? reference),
  };
  const normalizedRowLineage = {
    ...rowLineage,
  };
  const diagnostics: LineageDiagnostic[] = context.node.type === 'table'
    ? [{
        code: 'source_leaf_target',
        message: 'The target is a table column, so it is treated as a source leaf rather than a derived investigation target.',
        scopeId: context.target.scopeId,
        severity: 'info',
      }]
    : [];
  diagnostics.push({
    code: 'lineage_metadata_added',
    message: 'Lineage metadata such as scopeId, nodeId, upstream references, and diagnostic roles was added on top of rawsql-ts analysis.',
    scopeId: context.target.scopeId,
    severity: 'info',
  });
  if (options.schemaFacts) {
    diagnostics.push({
      code: 'schema_facts_used',
      message: 'Schema facts were used to enrich column diagnostics and adjust risk confidence where possible.',
      scopeId: context.target.scopeId,
      severity: 'info',
    });
  }

  return {
    candidateConcerns: buildCandidateConcerns(normalizedRowLineage.influences, normalizedColumnLineage, options.schemaFacts, options.symptom),
    diagnostics,
    kind: 'column-diagnostic-packet',
    omittedContext: buildOmittedContext(model, normalizedColumnLineage, normalizedRowLineage),
    rowLineage: normalizedRowLineage,
    target: context.target,
    columnLineage: normalizedColumnLineage,
    version: 1,
    views: {
      columnLineageTree: {
        derivedFrom: 'columnLineage',
        tree: buildColumnLineageTree(model, context.target),
      },
    },
  };
}

function resolveTarget(model: LineageModel, target: ColumnTarget): { column: LineageColumn; node: LineageNode; target: DiagnosticTarget } {
  const node = model.nodes.find((item) => item.id === target.nodeId);
  if (!node) {
    throw new Error(`Unknown target node: ${target.nodeId}`);
  }
  const column = resolveTargetColumn(node, target);
  if (!column) {
    throw new Error(`Unknown target column: ${target.nodeId}.${target.columnName}`);
  }
  const scopeId = target.scopeId
    ?? column.scopeId
    ?? model.scopes.find((scope) => scope.nodeId === node.id)?.id
    ?? (node.type === 'table' ? `scope_${node.id}_source_leaf` : 'unknown_scope');
  return {
    column,
    node,
    target: {
      columnName: column.name,
      expressionSql: column.expressionSql,
      nodeId: node.id,
      nodeLabel: node.label,
      nodeType: node.type,
      outputIndex: column.outputIndex,
      selectItemId: column.selectItemId,
      scopeId,
    },
  };
}

function resolveTargetColumn(node: LineageNode, target: ColumnTarget): LineageNode['columns'][number] | undefined {
  const candidates = node.columns.filter((item) => item.name === target.columnName);
  if (target.selectItemId) {
    return candidates.find((item) => item.selectItemId === target.selectItemId);
  }
  if (target.outputIndex !== undefined) {
    return candidates.find((item) => item.outputIndex === target.outputIndex);
  }
  return candidates[0];
}

function buildColumnLineageTree(model: LineageModel, target: DiagnosticTarget): ColumnLineageTreeNode[] {
  const root = buildColumnLineageColumnNode(model, target.nodeId, target.columnName, new Set(), {
    outputIndex: target.outputIndex,
    selectItemId: target.selectItemId,
  });
  return root ? [root] : [];
}

function buildColumnLineageColumnNode(
  model: LineageModel,
  nodeId: string,
  columnName: string,
  path: Set<string>,
  identity?: Pick<LineageColumn, 'outputIndex' | 'selectItemId'>,
): Extract<ColumnLineageTreeNode, { kind: 'column' }> | null {
  const resolved = resolveLineageColumn(model, nodeId, columnName, identity);
  if (!resolved) {
    return null;
  }
  const key = lineageColumnIdentityKey(resolved.node, resolved.column);
  const column = toDiagnosticValueColumn(model, resolved.node, resolved.column);
  if (path.has(key)) {
    return {
      children: [],
      column,
      cycle: true,
      kind: 'column',
      leaf: false,
    };
  }

  const nextPath = new Set(path);
  nextPath.add(key);
  const children = buildColumnLineageChildren(model, resolved.node, resolved.column, nextPath);
  return {
    children,
    column,
    kind: 'column',
    leaf: children.length === 0,
  };
}

function buildColumnLineageChildren(
  model: LineageModel,
  ownerNode: LineageNode,
  column: LineageColumn,
  path: Set<string>,
): ColumnLineageTreeNode[] {
  if (column.caseRules?.length) {
    const owner = toDiagnosticValueColumn(model, ownerNode, column);
    return column.caseRules.map((rule) => ({
      caseLabel: rule.caseLabel,
      children: buildColumnLineageColumnNodes(model, mergeColumnRefs(rule.conditionUpstream, rule.resultUpstream), path),
      column: owner,
      conditionReferences: rule.conditionUpstream.map((reference) =>
        createDiagnosticReference(
          model,
          columnRefToSourceReference(reference, column.scopeId ?? owner.scopeId),
          'column_lineage',
          'case_when_condition',
        ),
      ),
      conditionSql: rule.conditionSql,
      expressionSql: rule.expressionSql,
      id: rule.id,
      kind: 'case_rule' as const,
      label: rule.label,
      resultReferences: rule.resultUpstream.map((reference) =>
        createDiagnosticReference(
          model,
          columnRefToSourceReference(reference, column.scopeId ?? owner.scopeId),
          'column_lineage',
          'case_when_result',
        ),
      ),
      resultSql: rule.resultSql,
      scopeId: column.scopeId ?? owner.scopeId,
    }));
  }

  if (column.expressionTree) {
    return [buildColumnLineageExpressionNode(model, ownerNode, column, column.expressionTree, path)];
  }

  return buildColumnLineageColumnNodes(model, column.upstream ?? [], path);
}

function buildColumnLineageExpressionNode(
  model: LineageModel,
  ownerNode: LineageNode,
  ownerColumn: LineageColumn,
  expression: LineageExpressionTree,
  path: Set<string>,
): Extract<ColumnLineageTreeNode, { kind: 'expression' }> {
  const owner = toDiagnosticValueColumn(model, ownerNode, ownerColumn);
  if (expression.kind === 'column') {
    const child = buildColumnLineageColumnNode(model, expression.ref.nodeId, expression.ref.columnName, path);
    return {
      children: child ? [child] : [],
      expression,
      kind: 'expression',
      owner,
    };
  }

  return {
    children: buildColumnLineageExpressionChildren(model, ownerNode, ownerColumn, expression, path),
    expression,
    kind: 'expression',
    owner,
  };
}

function buildColumnLineageColumnNodes(
  model: LineageModel,
  refs: LineageColumnRef[],
  path: Set<string>,
): ColumnLineageTreeNode[] {
  const nodes: ColumnLineageTreeNode[] = [];
  for (const ref of refs) {
    const node = buildColumnLineageColumnNode(model, ref.nodeId, ref.columnName, path);
    if (node) {
      nodes.push(node);
    }
  }
  return nodes;
}

function buildColumnLineageExpressionChildren(
  model: LineageModel,
  ownerNode: LineageNode,
  ownerColumn: LineageColumn,
  expression: Exclude<LineageExpressionTree, { kind: 'column' }>,
  path: Set<string>,
): ColumnLineageTreeNode[] {
  const nodes: ColumnLineageTreeNode[] = [];
  if (expression.kind === 'operator') {
    for (const child of expression.children) {
      nodes.push(buildColumnLineageExpressionNode(model, ownerNode, ownerColumn, child, path));
    }
    return nodes;
  }
  for (const ref of expression.upstream) {
    const node = buildColumnLineageColumnNode(model, ref.nodeId, ref.columnName, path);
    if (node) {
      nodes.push(node);
    }
  }
  return nodes;
}

function resolveLineageColumn(
  model: LineageModel,
  nodeId: string,
  columnName: string,
  identity?: Pick<LineageColumn, 'outputIndex' | 'selectItemId'>,
): { column: LineageColumn; node: LineageNode } | null {
  const node = model.nodes.find((item) => item.id === nodeId);
  const candidates = node?.columns.filter((item) => item.name === columnName) ?? [];
  const column = identity?.selectItemId
    ? candidates.find((item) => item.selectItemId === identity.selectItemId)
    : identity?.outputIndex !== undefined
      ? candidates.find((item) => item.outputIndex === identity.outputIndex)
      : candidates[0];
  return node && column ? { column, node } : null;
}

function lineageColumnIdentityKey(node: LineageNode, column: LineageColumn): string {
  return `${node.id}.${column.name}.${column.outputIndex ?? ''}.${column.selectItemId ?? ''}`;
}

function toDiagnosticValueColumn(model: LineageModel, node: LineageNode, column: LineageColumn): DiagnosticValueColumn {
  const scopeId = column.scopeId ?? model.scopes.find((scope) => scope.nodeId === node.id)?.id ?? (node.type === 'table' ? `scope_${node.id}_source_leaf` : 'unknown_scope');
  return {
    columnName: column.name,
    ...optionalComments(column.comments),
    expressionSql: column.expressionSql,
    id: valueStepId(node.id, column.name, column),
    nodeId: node.id,
    nodeLabel: node.label,
    nodeType: node.type,
    outputIndex: column.outputIndex,
    selectItemId: column.selectItemId,
    scopeId,
  };
}

function collectColumnLineageSourceLeaves(tree: ColumnLineageTreeNode[]): DiagnosticValueColumn[] {
  const leaves = new Map<string, DiagnosticValueColumn>();
  const visit = (node: ColumnLineageTreeNode): void => {
    if (node.kind === 'column' && node.leaf && !node.cycle && node.column.nodeType === 'table') {
      leaves.set(`${node.column.nodeId}.${node.column.columnName}.${node.column.outputIndex ?? ''}.${node.column.selectItemId ?? ''}`, node.column);
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  for (const node of tree) {
    visit(node);
  }
  return [...leaves.values()];
}

function optionalComments(comments?: string[]): { comments?: string[] } {
  const normalized = comments?.filter((comment) => comment.trim().length > 0) ?? [];
  return normalized.length > 0 ? { comments: normalized } : {};
}

function valueStepId(nodeId: string, columnName: string, column?: Pick<LineageColumn, 'outputIndex' | 'selectItemId'>): string {
  return [
    'step',
    sanitizeId(nodeId),
    sanitizeId(columnName),
    column?.selectItemId ? sanitizeId(column.selectItemId) : undefined,
    column?.outputIndex !== undefined ? `out${column.outputIndex}` : undefined,
  ].filter(Boolean).join(':');
}

function valueExpressionId(stepId: string): string {
  return `expr:${stepId}`;
}

function referenceIdValue(nodeId: string, columnName: string): string {
  return `ref:${sanitizeId(nodeId)}:${sanitizeId(columnName)}`;
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_');
}

function buildValueExpression(stepId: string, column: LineageColumn): ValueExpression {
  const sql = column.expressionSql ?? column.expressionTree?.sql ?? column.name;
  const expressionTree = column.expressionTree;
  const expressionTreeUpstream = getExpressionTreeUpstream(expressionTree);
  const upstream = expressionTreeUpstream.length ? expressionTreeUpstream : column.upstream ?? [];
  const inputs: ValueExpressionInput[] = upstream.map((reference) => ({
    kind: 'column_ref',
    refId: referenceIdValue(reference.nodeId, reference.columnName),
  }));
  for (const literal of extractLiteralInputs(sql)) {
    inputs.push({ kind: 'literal', sql: literal });
  }

  const operator = expressionTree?.kind === 'operator' ? expressionTree.operator : undefined;
  const aggregate = sql.match(/\b(count|sum|avg|min|max)\s*\(/i)?.[1]?.toLowerCase();
  const functionName = sql.match(/\b([a-z_][a-z0-9_]*)\s*\(/i)?.[1]?.toLowerCase();
  const isCoalesce = functionName === 'coalesce';
  const isCase = (column.caseRules?.length ?? 0) > 0 || /^\s*case\b/i.test(sql);
  return {
    id: valueExpressionId(stepId),
    inputs: dedupeValueExpressionInputs(inputs),
    kind: isCase
      ? 'case'
      : aggregate
      ? 'aggregate'
      : isCoalesce
        ? 'function_call'
        : operator
          ? 'operator'
          : upstream.length === 1 && isColumnPassthroughSql(sql, upstream[0].columnName)
            ? 'column_ref'
            : 'unknown',
    operator: aggregate ?? functionName ?? operator,
    ownerStepId: stepId,
    semanticKind: isCase
      ? 'conditional_value'
      : aggregate
      ? 'aggregation'
      : isCoalesce
        ? 'null_replacement'
        : operator
          ? 'arithmetic'
          : upstream.length === 1
            ? 'column_passthrough'
            : 'unknown',
    sql,
  };
}

function getExpressionTreeUpstream(expressionTree?: LineageExpressionTree): LineageColumnRef[] {
  if (!expressionTree || expressionTree.kind === 'column') {
    return expressionTree?.kind === 'column' ? [expressionTree.ref] : [];
  }
  return expressionTree.upstream;
}

function isColumnPassthroughSql(sql: string, columnName: string): boolean {
  const normalizedSql = normalizeSql(sql);
  const normalizedColumn = normalizeSql(columnName);
  return normalizedSql === normalizedColumn || normalizedSql.endsWith(`.${normalizedColumn}`);
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractLiteralInputs(sql: string): string[] {
  const literals = new Set<string>();
  for (const match of sql.matchAll(/'(?:''|[^'])*'|\b\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b/gi)) {
    literals.add(match[0]);
  }
  return [...literals];
}

function dedupeValueExpressionInputs(inputs: ValueExpressionInput[]): ValueExpressionInput[] {
  const seen = new Set<string>();
  return inputs.filter((input) => {
    const key = input.kind === 'column_ref'
      ? `${input.kind}:${input.refId}`
      : input.kind === 'expression_ref'
        ? `${input.kind}:${input.expressionId}`
        : `${input.kind}:${input.sql}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeValueExpressions(expressions: ValueExpression[]): ValueExpression[] {
  const seen = new Set<string>();
  return expressions.filter((expression) => {
    if (seen.has(expression.id)) {
      return false;
    }
    seen.add(expression.id);
    return true;
  });
}

function mergeColumnRefs(left: LineageColumnRef[], right: LineageColumnRef[]): LineageColumnRef[] {
  const seen = new Set<string>();
  return [...left, ...right].filter((ref) => {
    const key = columnKey(ref.nodeId, ref.columnName);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function conditionToInfluence(model: LineageModel, condition: LineageCondition): PopulationInfluence {
  const effects = effectsFromImpacts(condition.impact);
  const mechanism = mechanismFromKind(condition.kind, condition.expressionSql, condition.existencePolarity);
  return {
    effects,
    expressionSql: condition.expressionSql,
    id: condition.id,
    kind: condition.kind,
    mechanism,
    references: condition.references.map((reference) => createDiagnosticReference(model, reference, 'row_lineage', condition.kind)),
    signals: signalsFromInfluence(condition.kind, mechanism, effects),
    scopeId: condition.scopeId,
  };
}

function expressionToInfluence(model: LineageModel, expression: LineageExpressionInfluence): PopulationInfluence {
  const effects = effectsFromImpacts(expression.impact);
  const mechanism = mechanismFromKind(expression.kind, expression.expressionSql);
  return {
    effects,
    expressionSql: expression.expressionSql,
    id: expression.id,
    kind: expression.kind,
    mechanism,
    references: expression.references.map((reference) => createDiagnosticReference(model, reference, 'row_lineage', expression.kind)),
    signals: signalsFromInfluence(expression.kind, mechanism, effects),
    scopeId: expression.scopeId,
  };
}

function joinToInfluence(model: LineageModel, join: LineageJoinInfluence): PopulationInfluence {
  const effects = effectsFromImpacts(join.impact);
  return {
    effects,
    expressionSql: join.condition?.expressionSql,
    id: join.id,
    kind: 'join_on',
    mechanism: 'join',
    references: join.references.map((reference) => createDiagnosticReference(model, reference, 'row_lineage', 'join_on')),
    signals: signalsFromInfluence('join_on', 'join', effects),
    scopeId: join.scopeId,
    sourceNodeId: join.sourceNodeId,
  };
}

function refinePopulationInfluenceImpact(
  influence: PopulationInfluence,
  uniqueKeysByNodeId: Map<string, string[][]>,
  columnLineage: ColumnLineageAnalysis,
): PopulationInfluence {
  if (influence.kind !== 'join_on' || !influence.sourceNodeId) {
    return influence;
  }
  let effects = [...influence.effects];
  if (effects.includes('null_extension') && !isValueRelevantNode(columnLineage, influence.sourceNodeId)) {
    effects = effects.filter((item) => item !== 'null_extension');
  }
  if (!effects.includes('row_multiplication')) {
    return { ...influence, effects, signals: signalsFromInfluence(influence.kind, influence.mechanism, effects) };
  }
  const sourceReferences = influence.references.filter((reference) => reference.nodeId === influence.sourceNodeId);
  const sourceColumns = sourceReferences.map((reference) => reference.columnName);
  const sourceUniqueKeys = uniqueKeysByNodeId.get(influence.sourceNodeId) ?? [];
  const sourceIsUnique = sourceUniqueKeys.some((uniqueKey) => sameColumnSet(uniqueKey, sourceColumns));
  if (!sourceIsUnique) {
    return { ...influence, effects, signals: signalsFromInfluence(influence.kind, influence.mechanism, effects) };
  }
  return {
    ...influence,
    effects: effects.filter((item) => item !== 'row_multiplication'),
    signals: signalsFromInfluence(influence.kind, influence.mechanism, effects.filter((item) => item !== 'row_multiplication')),
  };
}

function isValueRelevantNode(columnLineage: ColumnLineageAnalysis, nodeId: string): boolean {
  return columnLineage.expressionChain.some((expression) => expression.nodeId === nodeId)
    || columnLineage.references.some((reference) => reference.nodeId === nodeId)
    || columnLineage.scopeChain.some((scope) => scope.nodeId === nodeId)
    || columnLineage.sourceLeaves.some((source) => source.nodeId === nodeId);
}

function buildPopulationNodeImpacts(
  model: LineageModel,
  influences: PopulationInfluence[],
  columnLineage: ColumnLineageAnalysis,
  target: DiagnosticTarget,
): PopulationNodeImpact[] {
  const valueRelevantNodeIds = new Set([
    target.nodeId,
    ...columnLineage.expressionChain.map((expression) => expression.nodeId),
    ...columnLineage.references.map((reference) => reference.nodeId),
    ...columnLineage.scopeChain.map((scope) => scope.nodeId),
    ...columnLineage.sourceLeaves.map((source) => source.nodeId),
  ]);
  const nodeImpacts = new Map<string, PopulationNodeImpact>();

  for (const influence of influences) {
    const ownerNodeId = populationInfluenceOwnerNodeId(model, influence, target.nodeId);
    mergePopulationNodeImpact(nodeImpacts, model, ownerNodeId, influence, influence.effects, valueRelevantNodeIds);
  }

  return [...nodeImpacts.values()];
}

function populationInfluenceOwnerNodeId(
  model: LineageModel,
  influence: PopulationInfluence,
  fallbackNodeId: string,
): string {
  return model.scopes.find((scope) => scope.id === influence.scopeId)?.nodeId ?? fallbackNodeId;
}

function mergePopulationNodeImpact(
  nodeImpacts: Map<string, PopulationNodeImpact>,
  model: LineageModel,
  nodeId: string,
  influence: PopulationInfluence,
  effects: PopulationEffect[],
  valueRelevantNodeIds: Set<string>,
): void {
  const existing = nodeImpacts.get(nodeId);
  const signals = signalsFromInfluence(influence.kind, influence.mechanism, effects);
  if (existing) {
    existing.effects = dedupeEffects([...existing.effects, ...effects]);
    existing.influenceIds = dedupeStrings([...existing.influenceIds, influence.id]);
    existing.signals = dedupeSignals([...existing.signals, ...signals]);
    if (valueRelevantNodeIds.has(nodeId)) {
      existing.role = 'population_and_value';
    }
    return;
  }
  const node = model.nodes.find((item) => item.id === nodeId);
  nodeImpacts.set(nodeId, {
    effects,
    influenceIds: [influence.id],
    nodeId,
    nodeLabel: node?.label ?? nodeId,
    nodeType: node?.type ?? 'table',
    role: valueRelevantNodeIds.has(nodeId) ? 'population_and_value' : 'population_only',
    signals,
  });
}

function dedupeEffects(values: PopulationEffect[]): PopulationEffect[] {
  return [...new Set(values)];
}

function effectsFromImpacts(impacts: LineageImpact[]): PopulationEffect[] {
  return dedupeEffects(
    impacts
      .map(effectFromImpact)
      .filter((effect): effect is PopulationEffect => Boolean(effect)),
  );
}

function signalsFromInfluence(kind: string, mechanism: PopulationMechanism, effects: PopulationEffect[]): PopulationSignal[] {
  const signals: PopulationSignal[] = [];
  if ((kind === 'where' || mechanism === 'where' || mechanism === 'exists' || mechanism === 'not_exists') && effects.includes('row_filter')) {
    signals.push('where');
  }
  if (kind === 'having' && effects.includes('row_filter')) {
    signals.push('having');
  }
  if (kind === 'join_on' && (effects.includes('row_multiplication') || effects.includes('row_filter'))) {
    signals.push('join_xn');
  }
  if (kind === 'join_on' && effects.includes('null_extension')) {
    signals.push('outer_join');
  }
  if (kind === 'group_by' && effects.includes('grain_change')) {
    signals.push('group_by');
  }
  if ((kind === 'distinct' || mechanism === 'distinct') && effects.includes('row_deduplication')) {
    signals.push('distinct');
  }
  if ((kind === 'distinct_on' || mechanism === 'distinct_on') && effects.includes('row_deduplication')) {
    signals.push('distinct_on');
  }
  if ((kind === 'limit' || kind === 'offset' || mechanism === 'limit' || mechanism === 'offset') && effects.includes('output_cap')) {
    signals.push('limit');
  }
  if ((kind === 'order_by' || mechanism === 'order_by' || kind === 'distinct_on') && effects.includes('output_selection')) {
    signals.push('order_by');
  }
  return dedupeSignals(signals);
}

function effectFromImpact(impact: LineageImpact): PopulationEffect | null {
  switch (impact) {
    case 'may_filter_rows':
      return 'row_filter';
    case 'may_multiply_rows':
      return 'row_multiplication';
    case 'may_null_extend_rows':
      return 'null_extension';
    case 'may_change_grain':
      return 'grain_change';
    case 'may_change_order':
      return 'output_selection';
    case 'may_limit_rows':
      return 'output_cap';
    case 'may_deduplicate_rows':
      return 'row_deduplication';
    default:
      return null;
  }
}

function impactsFromEffects(effects: PopulationEffect[]): LineageImpact[] {
  return effects.map((effect) => {
    switch (effect) {
      case 'grain_change':
        return 'may_change_grain';
      case 'null_extension':
        return 'may_null_extend_rows';
      case 'output_cap':
        return 'may_limit_rows';
      case 'output_selection':
        return 'may_change_order';
      case 'row_deduplication':
        return 'may_deduplicate_rows';
      case 'row_filter':
        return 'may_filter_rows';
      case 'row_multiplication':
        return 'may_multiply_rows';
    }
  });
}

function mechanismFromKind(kind: string, _expressionSql?: string, existencePolarity?: 'exists' | 'not_exists'): PopulationMechanism {
  if (kind === 'where' && existencePolarity) {
    return existencePolarity;
  }
  switch (kind) {
    case 'aggregate_filter':
      return 'aggregate_filter';
    case 'case_when':
      return 'case_when';
    case 'group_by':
      return 'group_by';
    case 'distinct':
      return 'distinct';
    case 'distinct_on':
      return 'distinct_on';
    case 'having':
      return 'having';
    case 'join_on':
      return 'join';
    case 'limit':
      return 'limit';
    case 'offset':
      return 'offset';
    case 'order_by':
      return 'order_by';
    case 'where':
      return 'where';
    case 'window_order_by':
    case 'window_partition_by':
      return 'window';
    default:
      return 'where';
  }
}

function inferGroupedUniqueKeys(model: LineageModel): Map<string, string[][]> {
  const uniqueKeysByNodeId = new Map<string, string[][]>();
  for (const scope of model.scopes) {
    if (!scope.groupBy?.length) {
      continue;
    }
    const node = model.nodes.find((item) => item.id === scope.nodeId);
    if (!node) {
      continue;
    }
    const uniqueKey = inferGroupedUniqueKey(node, scope.groupBy);
    if (!uniqueKey?.length) {
      continue;
    }
    uniqueKeysByNodeId.set(node.id, [...(uniqueKeysByNodeId.get(node.id) ?? []), uniqueKey]);
  }
  return uniqueKeysByNodeId;
}

function inferGroupedUniqueKey(node: LineageNode, groupBy: LineageExpressionInfluence[]): string[] | undefined {
  const outputColumnNames: string[] = [];
  for (const expression of groupBy) {
    if (expression.references.length !== 1) {
      return undefined;
    }
    const reference = expression.references[0];
    const matchingColumns = node.columns.filter((column) =>
      column.upstream?.some((upstream) => upstream.nodeId === reference.nodeId && upstream.columnName === reference.columnName)
    );
    if (matchingColumns.length !== 1) {
      return undefined;
    }
    outputColumnNames.push(matchingColumns[0].name);
  }
  return dedupeStrings(outputColumnNames);
}

function sameColumnSet(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizeColumnSet(left);
  const normalizedRight = normalizeColumnSet(right);
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((column, index) => column === normalizedRight[index]);
}

function normalizeColumnSet(columns: string[]): string[] {
  return [...new Set(columns.map((column) => column.toLowerCase()))].sort();
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function createDiagnosticReference(
  model: LineageModel,
  reference: LineageSourceReference,
  role: DiagnosticSourceUsage['role'],
  usageKind: string,
): DiagnosticSourceReference {
  const node = model.nodes.find((item) => item.id === reference.nodeId);
  const column = node?.columns.find((item) => item.name === reference.columnName);
  const definedInScopeId = column?.scopeId ?? model.scopes.find((scope) => scope.nodeId === reference.nodeId)?.id;
  const result: DiagnosticSourceReference = {
    columnName: reference.columnName,
    definedInScopeId,
    id: referenceIdValue(reference.nodeId, reference.columnName),
    nodeId: reference.nodeId,
    nodeLabel: node?.label ?? reference.nodeId,
    roles: [role],
    scopeId: reference.scopeId,
    usages: [{
      role,
      scopeId: reference.scopeId,
      usageKind,
    }],
    usedInScopeIds: [reference.scopeId],
  };
  if (reference.provenance) {
    result.provenance = reference.provenance;
  }
  return result;
}

function columnRefToSourceReference(reference: LineageColumnRef, usageScopeId: string): LineageSourceReference {
  return {
    columnName: reference.columnName,
    nodeId: reference.nodeId,
    role: 'column_lineage',
    scopeId: usageScopeId,
  };
}

function classifyBothReferences(references: DiagnosticSourceReference[]): DiagnosticSourceReference[] {
  const merged = new Map<string, DiagnosticSourceReference>();
  for (const reference of references) {
    const key = referenceKey(reference);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, cloneDiagnosticReference(reference));
      continue;
    }
    existing.usages = dedupeUsages([...existing.usages, ...reference.usages]);
    existing.roles = rolesFromUsages(existing.usages);
    existing.usedInScopeIds = dedupeStrings([...(existing.usedInScopeIds ?? []), ...(reference.usedInScopeIds ?? [reference.scopeId])]);
  }
  return [...merged.values()].map((reference) => {
    const result: DiagnosticSourceReference = {
      ...reference,
      roles: rolesFromUsages(reference.usages),
      usedInScopeIds: dedupeStrings(reference.usages.map((usage) => usage.scopeId)),
    };
    if (reference.provenance) {
      result.provenance = reference.provenance;
    }
    return result;
  });
}

function cloneDiagnosticReference(reference: DiagnosticSourceReference): DiagnosticSourceReference {
  const clone: DiagnosticSourceReference = {
    ...reference,
    usages: reference.usages.map((usage) => ({ ...usage })),
  };
  if (reference.provenance) {
    clone.provenance = reference.provenance;
  }
  return clone;
}

function dedupeDiagnosticReferences(references: DiagnosticSourceReference[]): DiagnosticSourceReference[] {
  return classifyBothReferences(references);
}

function rolesFromUsages(usages: DiagnosticSourceUsage[]): Array<DiagnosticSourceUsage['role']> {
  const roles = new Set(usages.map((usage) => usage.role));
  return [
    ...(roles.has('column_lineage') ? ['column_lineage' as const] : []),
    ...(roles.has('row_lineage') ? ['row_lineage' as const] : []),
  ];
}

function dedupeUsages(usages: DiagnosticSourceUsage[]): DiagnosticSourceUsage[] {
  const seen = new Set<string>();
  return usages.filter((usage) => {
    const key = `${usage.scopeId}|${usage.usageKind}|${usage.role}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildCandidateConcerns(
  influences: PopulationInfluence[],
  columnLineage?: ColumnLineageAnalysis,
  schemaFacts?: SchemaFacts,
  symptom?: ProblemIntent,
): CandidateConcern[] {
  const populationConcerns = influences
    .filter((influence) => shouldPromotePopulationConcern(influence, columnLineage))
    .map((influence) => ({
      checkDomains: checkDomainsForInfluence(influence),
      confidence: concernConfidence(influence, schemaFacts),
      effects: concernEffectsFromInfluence(influence),
      evidence: influence.expressionSql ? [influence.expressionSql] : [],
      impact: impactsFromEffects(influence.effects),
      influenceIds: [influence.id],
      kind: concernKind(influence),
      mechanisms: concernMechanismsFromInfluence(influence),
      reason: concernReason(influence),
      scopeId: influence.scopeId,
      signals: [...influence.signals],
    }));
  const valueConcerns: CandidateConcern[] = [];
  const sourceDataConcern = buildSourceDataValueConcern(columnLineage);
  if (sourceDataConcern) {
    valueConcerns.push(sourceDataConcern);
  }

  if (columnLineage?.caseRules.length) {
    valueConcerns.push({
      checkDomains: ['program_logic', 'data_condition'],
      confidence: 'possible',
      effects: ['case_when', 'value_transform'],
      evidence: columnLineage.caseRules.map((rule) => [rule.conditionSql, rule.resultSql].filter(Boolean).join(' -> ')),
      impact: ['may_change_value'],
      influenceIds: [],
      kind: 'case_when',
      mechanisms: ['case_when'],
      reason: 'The CASE branch conditions or result expressions may change this column value.',
      scopeId: columnLineage.caseRules[0].scopeId,
      signals: [],
    });
  }

  for (const expression of columnLineage?.expressionChain ?? []) {
    if (isAggregateExpression(expression.expressionSql)) {
      valueConcerns.push({
        checkDomains: ['program_logic'],
        confidence: 'possible',
        effects: ['aggregate_expression', 'grain_change'],
        evidence: expression.expressionSql ? [expression.expressionSql] : [],
        impact: ['may_change_value', 'may_change_grain'],
        influenceIds: [],
        kind: 'aggregate_expression',
        mechanisms: ['aggregate'],
        reason: 'The aggregate expression may change the value and depends on the grouping grain.',
        scopeId: expression.scopeId,
        signals: [],
      });
    }
    if (isNullReplacementExpression(expression.expressionSql) && shouldPromoteNullReplacementConcern(influences, columnLineage, schemaFacts)) {
      valueConcerns.push({
        checkDomains: ['program_logic', 'data_condition', 'schema_assumption'],
        confidence: 'possible',
        effects: ['null_replacement'],
        evidence: [
          expression.expressionSql,
          ...nullableSourceEvidence(columnLineage, schemaFacts),
          ...outerJoinNullEvidence(influences, columnLineage),
        ].filter((item): item is string => Boolean(item)),
        impact: ['may_change_value'],
        influenceIds: influences
          .filter((influence) => influence.kind === 'join_on' && influence.effects.includes('null_extension'))
          .map((influence) => influence.id),
        kind: 'null_replacement_expression',
        mechanisms: ['coalesce', 'function_call'],
        reason: 'The expression may replace NULL values; review nullable source columns and outer joins on the column lineage route.',
        scopeId: expression.scopeId,
        signals: [],
      });
    }
  }

  return rankCandidateConcerns([...populationConcerns, ...valueConcerns], symptom);
}

function buildSourceDataValueConcern(columnLineage?: ColumnLineageAnalysis): CandidateConcern | null {
  if (!columnLineage?.sourceLeaves.length || !hasValueTransformForSourceDataConcern(columnLineage)) {
    return null;
  }

  const evidence = uniqueStrings(columnLineage.sourceLeaves.map((source) => `${source.nodeLabel}.${source.columnName}`));
  if (evidence.length === 0) {
    return null;
  }

  return {
    checkDomains: ['data_condition'],
    confidence: 'possible',
    effects: ['source_data_value'],
    evidence,
    impact: ['may_change_value'],
    influenceIds: [],
    kind: 'source_data_value',
    mechanisms: [],
    reason: 'Source leaf values may be incorrect and can affect the calculated value.',
    scopeId: columnLineage.sourceLeaves[0].scopeId,
    signals: [],
  };
}

function hasValueTransformForSourceDataConcern(columnLineage: ColumnLineageAnalysis): boolean {
  if (columnLineage.caseRules.length > 0) {
    return true;
  }
  return columnLineage.expressions.some((expression) =>
    expression.semanticKind !== 'column_passthrough' && expression.semanticKind !== 'literal_value',
  );
}

function concernEffectsFromInfluence(influence: PopulationInfluence): DiagnosticConcernEffect[] {
  const effects: DiagnosticConcernEffect[] = [...influence.effects];
  if (influence.kind === 'join_on' && influence.effects.includes('row_filter')) {
    effects.push('inner_join_filter');
  }
  if (influence.kind === 'join_on' && influence.effects.includes('null_extension')) {
    effects.push('left_join', 'missing_match');
  }
  if (influence.mechanism === 'exists') {
    effects.push('exists');
  }
  return dedupeConcernEffects(effects);
}

function concernMechanismsFromInfluence(influence: PopulationInfluence): PopulationMechanism[] {
  const mechanisms: PopulationMechanism[] = [influence.mechanism];
  if ((influence.kind === 'where' || influence.kind === 'having') && influence.mechanism !== influence.kind) {
    mechanisms.push(influence.kind);
  }
  return dedupePopulationMechanisms(mechanisms);
}

function checkDomainsForInfluence(influence: PopulationInfluence): CheckDomain[] {
  if (influence.kind === 'join_on') {
    return ['program_logic', 'data_condition', 'schema_assumption'];
  }
  if (influence.mechanism === 'exists' || influence.kind === 'where' || influence.kind === 'having') {
    return ['program_logic', 'data_condition'];
  }
  if (influence.kind === 'group_by') {
    return ['program_logic', 'schema_assumption'];
  }
  if (influence.kind === 'limit' || influence.kind === 'offset' || influence.kind === 'order_by' || influence.kind === 'distinct' || influence.kind === 'distinct_on') {
    return ['program_logic'];
  }
  return ['program_logic'];
}

function rankCandidateConcerns(concerns: CandidateConcern[], symptom?: ProblemIntent): CandidateConcern[] {
  const deduped = dedupeCandidateConcerns(concerns);
  if (!symptom) {
    return deduped;
  }

  const expectedEffects = symptomEffectMap[symptom];
  return deduped
    .map((concern, index) => {
      const matchedEffects = concern.effects.filter((effect) => expectedEffects.includes(effect));
      return {
        ...concern,
        symptomMatch: {
          matchedEffects,
          problemIntent: symptom,
          rank: matchedEffects.length > 0 ? 0 : 1,
        },
        __originalIndex: index,
      };
    })
    .sort((left, right) => {
      const rankDelta = left.symptomMatch.rank - right.symptomMatch.rank;
      if (rankDelta !== 0) {
        return rankDelta;
      }
      const matchedEffectDelta = right.symptomMatch.matchedEffects.length - left.symptomMatch.matchedEffects.length;
      if (matchedEffectDelta !== 0) {
        return matchedEffectDelta;
      }
      return left.__originalIndex - right.__originalIndex;
    })
    .slice(0, 5)
    .map(({ __originalIndex, ...concern }) => concern);
}

function dedupeCandidateConcerns(concerns: CandidateConcern[]): CandidateConcern[] {
  const seen = new Set<string>();
  return concerns.filter((concern) => {
    const key = `${concern.kind}|${concern.scopeId}|${concern.evidence.join('|')}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeConcernEffects(values: DiagnosticConcernEffect[]): DiagnosticConcernEffect[] {
  return [...new Set(values)];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function dedupePopulationMechanisms(values: PopulationMechanism[]): PopulationMechanism[] {
  return [...new Set(values)];
}

function dedupeSignals(values: PopulationSignal[]): PopulationSignal[] {
  const unique = new Set(values);
  return populationSignalOrder.filter((signal) => unique.has(signal));
}

function isAggregateExpression(expressionSql?: string): boolean {
  return /\b(count|sum|avg|min|max)\s*\(/i.test(expressionSql ?? '');
}

function isNullReplacementExpression(expressionSql?: string): boolean {
  return /\bcoalesce\s*\(/i.test(expressionSql ?? '');
}

function shouldPromoteNullReplacementConcern(
  influences: PopulationInfluence[],
  columnLineage?: ColumnLineageAnalysis,
  schemaFacts?: SchemaFacts,
): boolean {
  return nullableSourceEvidence(columnLineage, schemaFacts).length > 0
    || outerJoinNullEvidence(influences, columnLineage).length > 0;
}

function nullableSourceEvidence(columnLineage?: ColumnLineageAnalysis, schemaFacts?: SchemaFacts): string[] {
  if (!columnLineage || !schemaFacts) {
    return [];
  }
  return columnLineage.sourceLeaves.flatMap((source) => {
    const table = resolveTableFacts(schemaFacts, source.nodeLabel);
    const column = table?.columns[source.columnName];
    return column?.nullable ? [`${source.nodeLabel}.${source.columnName} is nullable by schema facts`] : [];
  });
}

function outerJoinNullEvidence(influences: PopulationInfluence[], columnLineage?: ColumnLineageAnalysis): string[] {
  const sourceNodeIds = new Set(columnLineage?.references.map((reference) => reference.nodeId) ?? []);
  return influences
    .filter((influence) => influence.kind === 'join_on' && influence.effects.includes('null_extension'))
    .filter((influence) => influence.references.some((reference) => sourceNodeIds.has(reference.nodeId)))
    .map((influence) => influence.expressionSql)
    .filter((expressionSql): expressionSql is string => Boolean(expressionSql));
}

function shouldPromotePopulationConcern(influence: PopulationInfluence, columnLineage?: ColumnLineageAnalysis): boolean {
  if (influence.kind !== 'join_on' || !influence.effects.includes('null_extension')) {
    return true;
  }

  const sourceNodeIds = new Set(columnLineage?.references.map((reference) => reference.nodeId) ?? []);
  return influence.references.some((reference) => sourceNodeIds.has(reference.nodeId));
}

function concernKind(influence: PopulationInfluence): string {
  if (influence.kind === 'where' && influence.expressionSql?.trim().toLowerCase().startsWith('exists')) {
    return 'where_exists';
  }
  if (influence.kind === 'where' && influence.expressionSql?.trim().toLowerCase().startsWith('not exists')) {
    return 'where_not_exists';
  }
  return influence.kind;
}

function concernConfidence(influence: PopulationInfluence, schemaFacts?: SchemaFacts): CandidateConcern['confidence'] {
  if (influence.kind === 'join_on' && schemaFacts && hasUniqueJoinSide(influence, schemaFacts)) {
    return 'low';
  }
  if (influence.kind === 'join_on' && influence.effects.includes('null_extension')) {
    return 'low';
  }
  return 'possible';
}

function hasUniqueJoinSide(influence: PopulationInfluence, schemaFacts: SchemaFacts): boolean {
  if (!influence.sourceNodeId) {
    return false;
  }
  const columnsByNodeLabel = new Map<string, string[]>();
  for (const reference of influence.references) {
    if (reference.nodeId !== influence.sourceNodeId) {
      continue;
    }
    columnsByNodeLabel.set(reference.nodeLabel, [...(columnsByNodeLabel.get(reference.nodeLabel) ?? []), reference.columnName]);
  }
  return [...columnsByNodeLabel.entries()].some(([nodeLabel, columns]) => isUniqueKey(schemaFacts, nodeLabel, columns));
}

function concernReason(influence: PopulationInfluence): string {
  const kind = concernKind(influence);
  if (kind === 'where_exists') {
    return 'The EXISTS predicate may filter rows to those with a matching related record.';
  }
  if (kind === 'where_not_exists') {
    return 'The NOT EXISTS predicate may filter rows to those without a matching related record.';
  }
  if (influence.kind === 'join_on' && influence.effects.includes('null_extension')) {
    return 'The outer join should preserve left-side rows, but it may null-extend or multiply rows depending on matches.';
  }
  if (influence.kind === 'order_by') {
    return 'The ORDER BY expression may change which rows are returned when combined with LIMIT/OFFSET.';
  }
  if (influence.kind === 'distinct') {
    return 'SELECT output rows are deduplicated by the whole output tuple.';
  }
  if (influence.kind === 'distinct_on') {
    return 'This expression is a DISTINCT ON key; for each key, the first row by ORDER BY is selected.';
  }
  if (influence.kind === 'limit') {
    return 'The LIMIT clause restricts how many rows are returned.';
  }
  if (influence.kind === 'offset') {
    return 'The OFFSET clause skips rows from the ordered result.';
  }
  if (influence.kind === 'group_by') {
    return 'The GROUP BY expression may change the aggregation grain.';
  }
  return `${influence.kind} may influence the row population used to compute this column.`;
}

function buildOmittedContext(
  model: LineageModel,
  columnLineage: ColumnLineageAnalysis,
  rowLineage: RowLineageAnalysis,
): ColumnDiagnosticPacket['omittedContext'] {
  const includedNodeIds = new Set([
    ...columnLineage.sourceLeaves.map((source) => source.nodeId),
    ...columnLineage.scopeChain.map((scope) => scope.nodeId),
    ...rowLineage.influences.flatMap((influence) => influence.references.map((reference) => reference.nodeId)),
  ]);
  const totalInfluenceCount = model.scopes.reduce(
    (count, scope) =>
      count
      + (scope.where?.length ?? 0)
      + (scope.having?.length ?? 0)
      + (scope.distinct ? 1 : 0)
      + (scope.distinctOn?.length ?? 0)
      + (scope.groupBy?.length ?? 0)
      + (scope.orderBy?.length ?? 0)
      + (scope.limit ? 1 : 0)
      + (scope.offset ? 1 : 0)
      + (scope.joins?.length ?? 0),
    0,
  );
  return {
    message: 'Unrelated nodes and expressions were omitted.',
    omittedColumnCount: model.nodes
      .filter((node) => !includedNodeIds.has(node.id))
      .reduce((count, node) => count + node.columns.length, 0),
    omittedInfluenceCount: Math.max(0, totalInfluenceCount - rowLineage.influences.length),
    omittedNodeCount: model.nodes.filter((node) => !includedNodeIds.has(node.id)).length,
  };
}

function referenceKey(reference: Pick<DiagnosticSourceReference, 'columnName' | 'nodeId'>): string {
  return columnKey(reference.nodeId, reference.columnName);
}

function columnKey(nodeId: string, columnName: string): string {
  return `${nodeId}.${columnName}`;
}
