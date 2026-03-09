import { buildQueryStructureReport, type QueryStructureReport } from './structure';

export type QueryPipelinePlanFormat = 'text' | 'json';
export type QueryPipelineStepKind = 'materialize' | 'final-query';

export interface QueryPipelineMetadata {
  material?: string[];
  scalarFilterColumns?: string[];
}

export interface QueryPipelineStep {
  step: number;
  kind: QueryPipelineStepKind;
  target: string;
  depends_on: string[];
}

export interface QueryPipelinePlan {
  file: string;
  query_type: QueryStructureReport['query_type'];
  final_query: string | null;
  metadata: {
    material: string[];
    scalarFilterColumns: string[];
  };
  steps: QueryPipelineStep[];
}

/**
 * Build a deterministic execution plan from query structure and runtime metadata.
 */
export function buildQueryPipelinePlan(
  sqlFile: string,
  metadata: QueryPipelineMetadata = {}
): QueryPipelinePlan {
  const report = buildQueryStructureReport(sqlFile);
  const material = uniquePreservingOrder(metadata.material ?? []);
  const scalarFilterColumns = uniquePreservingOrder(metadata.scalarFilterColumns ?? []);
  const cteNameSet = new Set(report.ctes.map((cte) => cte.name));

  validateKnownCtes(material, cteNameSet, 'material');

  const orderedCtes = topologicallySortCtes(report);
  const plannedCtes = orderedCtes.filter((name) => material.includes(name));
  const cteMap = new Map(report.ctes.map((cte) => [cte.name, cte]));

  const steps: QueryPipelineStep[] = plannedCtes.map((name, index) => ({
    step: index + 1,
    kind: 'materialize',
    target: name,
    depends_on: [...(cteMap.get(name)?.depends_on ?? [])]
  }));

  steps.push({
    step: steps.length + 1,
    kind: 'final-query',
    target: 'FINAL_QUERY',
    depends_on: resolveFinalQueryDependencies(report, cteNameSet)
  });

  return {
    file: report.file,
    query_type: report.query_type,
    final_query: report.final_query,
    metadata: {
      material,
      scalarFilterColumns
    },
    steps
  };
}

/**
 * Render the pipeline plan for machine or human consumption.
 */
export function formatQueryPipelinePlan(plan: QueryPipelinePlan, format: QueryPipelinePlanFormat): string {
  if (format === 'json') {
    return `${JSON.stringify(plan, null, 2)}\n`;
  }
  return `${formatQueryPipelineText(plan)}\n`;
}

function formatQueryPipelineText(plan: QueryPipelinePlan): string {
  const lines = [
    `Query type: ${plan.query_type}`,
    `Material CTEs: ${plan.metadata.material.length > 0 ? plan.metadata.material.join(', ') : '(none)'}`,
    `Scalar filter columns: ${plan.metadata.scalarFilterColumns.length > 0 ? plan.metadata.scalarFilterColumns.join(', ') : '(none)'}`,
    '',
    'Planned steps:'
  ];

  for (const step of plan.steps) {
    lines.push(`${step.step}. ${describeStep(step)}`);
    lines.push(`   depends_on: ${step.depends_on.length > 0 ? step.depends_on.join(', ') : '(none)'}`);
  }

  return lines.join('\n');
}

function describeStep(step: QueryPipelineStep): string {
  switch (step.kind) {
    case 'materialize':
      return `materialize ${step.target}`;
    case 'final-query':
    default:
      return 'run final query';
  }
}

function validateKnownCtes(names: string[], cteNameSet: Set<string>, label: 'material'): void {
  for (const name of names) {
    if (!cteNameSet.has(name)) {
      throw new Error(`Unknown ${label} CTE: ${name}`);
    }
  }
}

function resolveFinalQueryDependencies(report: QueryStructureReport, cteNameSet: Set<string>): string[] {
  if (!report.final_query) {
    return [];
  }

  return report.final_query
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && cteNameSet.has(value));
}

function topologicallySortCtes(report: QueryStructureReport): string[] {
  const cteMap = new Map(report.ctes.map((cte) => [cte.name, cte]));
  const cteOrder = new Map(report.ctes.map((cte, index) => [cte.name, index]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: string[] = [];

  const visit = (name: string) => {
    if (visited.has(name)) {
      return;
    }
    if (visiting.has(name)) {
      throw new Error(`Circular CTE dependency detected while planning: ${name}`);
    }

    visiting.add(name);
    const dependencies = [...(cteMap.get(name)?.depends_on ?? [])].sort(
      (left, right) => (cteOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (cteOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
    );

    // Visit dependencies first so every emitted step is ready to execute.
    for (const dependency of dependencies) {
      visit(dependency);
    }

    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  };

  for (const cte of report.ctes) {
    visit(cte.name);
  }

  return ordered;
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
