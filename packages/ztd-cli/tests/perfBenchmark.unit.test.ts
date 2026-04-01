import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  buildPerfPipelineAnalysis,
  buildPerfTuningGuidance,
  buildPerfTuningSummary,
  diffPerfBenchmarkReports,
  formatPerfBenchmarkReport,
  formatPerfDiffReport,
  loadPerfBenchmarkReport,
  mapPipelineStatements,
  runPerfBenchmark,
  summarizePerfDdlInventory,
  toPerfPlannedSteps,
  type PerfBenchmarkReport
} from '../src/perf/benchmark';
import { TAX_ALLOCATION_QUERY } from './utils/taxAllocationScenario';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function createSqlWorkspace(prefix: string, sqlRelativePath: string = path.join('src', 'sql', 'query.sql')): {
  rootDir: string;
  sqlFile: string;
} {
  const rootDir = createTempDir(prefix);
  const sqlFile = path.join(rootDir, sqlRelativePath);
  mkdirSync(path.dirname(sqlFile), { recursive: true });
  return { rootDir, sqlFile };
}

function makePerfReport(overrides: Partial<PerfBenchmarkReport> = {}): PerfBenchmarkReport {
  return {
    schema_version: 1,
    command: 'perf run',
    run_id: 'run_001',
    query_file: 'candidate.sql',
    query_type: 'SELECT',
    params_shape: 'none',
    ordered_param_names: [],
    source_sql_file: 'candidate.sql',
    source_sql: 'select 1',
    bound_sql: 'select 1',
    bindings: undefined,
    strategy: 'direct',
    requested_mode: 'completion',
    selected_mode: 'completion',
    selection_reason: 'forced',
    classify_threshold_ms: 60000,
    timeout_ms: 300000,
    dry_run: false,
    saved: true,
    total_elapsed_ms: 500,
    completion_metrics: {
      completed: true,
      timed_out: false,
      wall_time_ms: 500
    },
    executed_statements: [],
    plan_observations: [],
    recommended_actions: [],
    pipeline_analysis: {
      query_type: 'SELECT',
      cte_count: 0,
      should_consider_pipeline: false,
      candidate_ctes: [],
      scalar_filter_candidates: [],
      notes: []
    },
    ...overrides
  };
}

test('runPerfBenchmark dry-run binds named YAML params and surfaces pipeline analysis', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-dry-run', path.join('src', 'sql', 'reports', 'sales.sql'));
  const paramsFile = path.join(workspace.rootDir, 'perf', 'params.yml');
  mkdirSync(path.dirname(paramsFile), { recursive: true });
  writeFileSync(
    workspace.sqlFile,
    `
      with scoped_sales as (
        select id, region_id
        from public.sales
        where region_id = :region_id
      ),
      final_sales as (
        select id from scoped_sales
      )
      select * from final_sales
    `,
    'utf8'
  );
  writeFileSync(paramsFile, ['# named params for perf runs', 'params:', '  region_id: 10', ''].join('\n'), 'utf8');

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    paramsFile,
    mode: 'latency',
    repeat: 5,
    warmup: 1,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  });

  expect(report.dry_run).toBe(true);
  expect(report.params_shape).toBe('named');
  expect(report.ordered_param_names).toEqual(['region_id']);
  expect(report.bindings).toEqual([10]);
  expect(report.executed_statements).toEqual([
    expect.objectContaining({
      seq: 1,
      role: 'final-query',
      sql: expect.stringContaining('$1')
    })
  ]);
  expect(report.executed_statements[0]?.resolved_sql_preview).toContain('region_id = 10');
  expect(report.plan_observations).toEqual([]);
  expect(report.recommended_actions).toEqual([]);
  expect(report.pipeline_analysis.should_consider_pipeline).toBe(false);
  expect(report.params_file).toBe(path.resolve(paramsFile));
  expect(report.strategy).toBe('direct');
  expect(report.strategy_metadata).toBeUndefined();

  const text = formatPerfBenchmarkReport(report, 'text');
  expect(text).toContain('Mode: latency');
  expect(text).toContain('Executed statements:');
  expect(text).toContain('resolved_sql_preview:');
});

test('buildPerfPipelineAnalysis flags reusable fan-out CTEs as pipeline candidates', () => {
  const workspace = createSqlWorkspace('perf-pipeline-analysis', path.join('src', 'sql', 'reports', 'pipeline_candidate.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with base_sales as (
        select id, region_id, closed_month from public.sales
      ),
      regional_sales as (
        select id, region_id from base_sales
      ),
      month_sales as (
        select id, closed_month from base_sales
      ),
      final_sales as (
        select rs.id
        from regional_sales rs
        join month_sales ms on ms.id = rs.id
      )
      select * from final_sales
    `,
    'utf8'
  );

  const analysis = buildPerfPipelineAnalysis(workspace.sqlFile);

  expect(analysis.should_consider_pipeline).toBe(true);
  expect(analysis.candidate_ctes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'base_sales',
        downstream_references: 2,
        reasons: expect.arrayContaining(['referenced by multiple downstream consumers'])
      })
    ])
  );
});


test('buildPerfPipelineAnalysis surfaces tax allocation scalar filter candidates for dogfooding', () => {
  const workspace = createSqlWorkspace('perf-tax-allocation-analysis', path.join('src', 'sql', 'reports', 'tax_allocation.sql'));
  writeFileSync(workspace.sqlFile, TAX_ALLOCATION_QUERY, 'utf8');

  const analysis = buildPerfPipelineAnalysis(workspace.sqlFile);

  expect(analysis.should_consider_pipeline).toBe(true);
  expect(analysis.candidate_ctes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'input_lines' }),
      expect.objectContaining({ name: 'floored_allocations' }),
      expect.objectContaining({ name: 'ranked_allocations' })
    ])
  );
  expect(analysis.scalar_filter_candidates).toEqual(['allocation_rank']);
  expect(analysis.notes).toContain('Optimizer-sensitive scalar predicates detected on columns: allocation_rank');

  const report: PerfBenchmarkReport = {
    schema_version: 1,
    command: 'perf run',
    query_file: workspace.sqlFile,
    query_type: 'SELECT',
    params_shape: 'none',
    ordered_param_names: [],
    source_sql_file: workspace.sqlFile,
    source_sql: TAX_ALLOCATION_QUERY,
    bound_sql: TAX_ALLOCATION_QUERY,
    bindings: undefined,
    strategy: 'direct',
    requested_mode: 'latency',
    selected_mode: 'latency',
    selection_reason: 'forced',
    classify_threshold_ms: 60000,
    timeout_ms: 300000,
    dry_run: true,
    saved: false,
    executed_statements: [],
    plan_observations: [],
    recommended_actions: [
      {
        action: 'consider-pipeline-materialization',
        priority: 'medium',
        rationale: 'Pipeline candidates detected: input_lines, floored_allocations, ranked_allocations.'
      },
      {
        action: 'consider-scalar-filter-binding',
        priority: 'medium',
        rationale: 'Scalar filter candidates detected: allocation_rank.'
      }
    ],
    pipeline_analysis: analysis,
  };

  const text = formatPerfBenchmarkReport(report, 'text');
  expect(text).toContain('scalar_filter_candidates: allocation_rank');
  expect(text).toContain('consider-scalar-filter-binding');
  expect(text).toContain('consider-pipeline-materialization');
  expect(text).toContain('allocation_rank');
});
test('diffPerfBenchmarkReports compares saved latency runs by p95', () => {
  const workspace = createTempDir('perf-benchmark-diff');
  const baselineDir = path.join(workspace, 'run_001');
  const candidateDir = path.join(workspace, 'run_002');
  mkdirSync(baselineDir, { recursive: true });
  mkdirSync(candidateDir, { recursive: true });

  const baseline = makePerfReport({
    run_id: 'run_001',
    query_file: 'baseline.sql',
    source_sql_file: 'baseline.sql',
    selected_mode: 'latency',
    requested_mode: 'latency',
    total_elapsed_ms: 360,
    latency_metrics: {
      measured_runs: 3,
      warmup_runs: 1,
      min_ms: 100,
      max_ms: 120,
      avg_ms: 110,
      median_ms: 110,
      p95_ms: 120
    },
    executed_statements: [{ seq: 1, role: 'final-query', sql: 'select 1', bindings: undefined, elapsed_ms: 110, plan_summary: { node_type: 'Seq Scan' } }],
    plan_observations: ['Seq Scan on public.users'],
    recommended_actions: [],
    pipeline_analysis: {
      query_type: 'SELECT',
      cte_count: 0,
      should_consider_pipeline: false,
      candidate_ctes: [],
      scalar_filter_candidates: [],
      notes: []
    },
    database_version: '16.2'
  });

  const candidate = makePerfReport({
    ...baseline,
    run_id: 'run_002',
    database_version: '16.3',
    total_elapsed_ms: 240,
    latency_metrics: {
      measured_runs: 3,
      warmup_runs: 1,
      min_ms: 70,
      max_ms: 90,
      avg_ms: 80,
      median_ms: 80,
      p95_ms: 90
    },
    executed_statements: [{ seq: 1, role: 'final-query', sql: 'select 1', bindings: undefined, elapsed_ms: 80, plan_summary: { node_type: 'Nested Loop', join_type: 'Inner' } }],
    plan_observations: ['Inner Nested Loop present in the captured plan']
  });

  writeFileSync(path.join(baselineDir, 'summary.json'), JSON.stringify(baseline, null, 2), 'utf8');
  writeFileSync(path.join(candidateDir, 'summary.json'), JSON.stringify(candidate, null, 2), 'utf8');

  const diff = diffPerfBenchmarkReports(baselineDir, candidateDir);

  expect(diff.primary_metric.name).toBe('p95_ms');
  expect(diff.primary_metric.baseline).toBe(120);
  expect(diff.primary_metric.candidate).toBe(90);
  expect(diff.primary_metric.improvement_percent).toBeCloseTo(25, 3);
  expect(diff.plan_deltas).toEqual([
    expect.objectContaining({ statement_id: '1:final-query', changed: true })
  ]);
  expect(diff.notes).toContain('Database version changed from 16.2 to 16.3.');
});

test('runPerfBenchmark rejects invalid perf options before touching the sandbox', async () => {
  await expect(runPerfBenchmark({
    rootDir: repoRoot,
    queryFile: 'missing.sql',
    mode: 'latency',
    repeat: 0,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  })).rejects.toThrow('invalid perf options: repeat must be a positive integer');
});

test('runPerfBenchmark wraps YAML parse failures with the absolute params path', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-yaml-invalid', path.join('src', 'sql', 'reports', 'broken.yml.sql'));
  const paramsFile = path.join(workspace.rootDir, 'perf', 'params.yml');
  mkdirSync(path.dirname(paramsFile), { recursive: true });
  writeFileSync(workspace.sqlFile, 'select * from public.sales where status = :status', 'utf8');
  writeFileSync(paramsFile, ['params: [unterminated', ''].join('\n'), 'utf8');
  await expect(runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    paramsFile,
    mode: 'latency',
    repeat: 1,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  })).rejects.toThrow(`Failed to parse perf params file ${path.resolve(paramsFile)}`);
});
test('runPerfBenchmark rejects positional params that do not cover the highest placeholder index', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-positional-arity', path.join('src', 'sql', 'reports', 'positional.sql'));
  const paramsFile = path.join(workspace.rootDir, 'perf', 'params.json');
  mkdirSync(path.dirname(paramsFile), { recursive: true });
  writeFileSync(workspace.sqlFile, 'select * from public.sales where region_id = $3', 'utf8');
  writeFileSync(paramsFile, JSON.stringify([10, 20], null, 2), 'utf8');

  await expect(runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    paramsFile,
    mode: 'latency',
    repeat: 1,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  })).rejects.toThrow('Positional SQL placeholders require at least 3 parameters for $3.');
});
test('runPerfBenchmark dry-run preserves quoted YAML string params', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-yaml-quoted', path.join('src', 'sql', 'reports', 'status.sql'));
  const paramsFile = path.join(workspace.rootDir, 'perf', 'params.yml');
  mkdirSync(path.dirname(paramsFile), { recursive: true });
  writeFileSync(workspace.sqlFile, 'select * from public.sales where status = :status', 'utf8');
  writeFileSync(paramsFile, ['params:', '  status: "value # still data"', ''].join('\n'), 'utf8');

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    paramsFile,
    mode: 'latency',
    repeat: 1,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  });

  expect(report.bindings).toEqual(['value # still data']);
});

test('runPerfBenchmark dry-run in auto mode defers live classification without touching PostgreSQL', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-dry-run-auto', path.join('src', 'sql', 'reports', 'auto.sql'));
  writeFileSync(
    workspace.sqlFile,
    'select * from public.sales where region_id = 1',
    'utf8'
  );

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    mode: 'auto',
    repeat: 5,
    warmup: 1,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  });

  expect(report.selected_mode).toBe('completion');
  expect(report.selection_reason).toContain('dry-run skips live auto classification');
});


test('loadPerfBenchmarkReport rejects malformed summary payloads', () => {
  const workspace = createTempDir('perf-benchmark-invalid-summary');
  writeFileSync(
    path.join(workspace, 'summary.json'),
    JSON.stringify({
      schema_version: 1,
      command: 'perf run',
      query_file: 'broken.sql',
      query_type: 'SELECT',
      ordered_param_names: [],
      source_sql_file: 'broken.sql',
      source_sql: 'select 1',
      bound_sql: 'select 1',
      strategy: 'direct',
      requested_mode: 'latency',
      selected_mode: 'latency',
      selection_reason: 'forced',
      classify_threshold_ms: 60000,
      timeout_ms: 300000,
      dry_run: false,
      saved: true,
      executed_statements: [{}],
      plan_observations: ['ok'],
      recommended_actions: [],
      pipeline_analysis: {
        query_type: 'SELECT',
        cte_count: 0,
        should_consider_pipeline: false,
        candidate_ctes: [],
        notes: []
      }
    }, null, 2),
    'utf8'
  );

  expect(() => loadPerfBenchmarkReport(workspace)).toThrow(`Invalid perf benchmark summary: ${path.join(workspace, 'summary.json')}`);
});
test('formatPerfDiffReport surfaces structural plan deltas for AI review', () => {
  const diff = {
    schema_version: 1,
    command: 'perf report diff' as const,
    baseline_mode: 'latency' as const,
    candidate_mode: 'latency' as const,
    baseline_strategy: 'direct' as const,
    candidate_strategy: 'direct' as const,
    primary_metric: {
      name: 'p95_ms' as const,
      baseline: 120,
      candidate: 90,
      improvement_percent: 25
    },
    mode_changed: false,
    statements_delta: 0,
    plan_deltas: [
      {
        statement_id: '1:final-query',
        baseline_plan: 'Seq Scan',
        candidate_plan: 'Inner Nested Loop',
        changed: true
      }
    ],
    notes: ['Compared latency-mode p95 because both runs are repeat benchmarks.']
  };
  const text = formatPerfDiffReport(diff, 'text');
  expect(text).toContain('Plan deltas:');
  expect(text).toContain('1:final-query: Seq Scan -> Inner Nested Loop');
  const json = formatPerfDiffReport(diff, 'json');
  expect(JSON.parse(json).plan_deltas).toEqual(diff.plan_deltas);
});
test('formatPerfBenchmarkReport surfaces recommended actions for AI follow-up', () => {
  const report: PerfBenchmarkReport = {
    schema_version: 1,
    command: 'perf run',
    query_file: 'candidate.sql',
    query_type: 'SELECT',
    params_shape: 'none',
    ordered_param_names: [],
    source_sql_file: 'candidate.sql',
    source_sql: 'select * from users',
    bound_sql: 'select * from users',
    bindings: undefined,
    strategy: 'direct',
    requested_mode: 'completion',
    selected_mode: 'completion',
    selection_reason: 'classification probe exceeded 60000 ms',
    classify_threshold_ms: 60000,
    timeout_ms: 300000,
    dry_run: false,
    saved: false,
    total_elapsed_ms: 300000,
    completion_metrics: {
      completed: false,
      timed_out: true,
      wall_time_ms: 300000
    },
    classification_probe: {
      elapsed_ms: 60000,
      timed_out: true
    },
    executed_statements: [
      {
        seq: 1,
        role: 'final-query',
        sql: 'select * from users',
        bindings: undefined,
        elapsed_ms: 300000,
        timed_out: true,
        sql_file: 'executed-sql/001-final-query.bound.sql',
        resolved_sql_preview_file: 'executed-sql/001-final-query.resolved-preview.sql'
      }
    ],
    plan_summary: {
      node_type: 'Seq Scan'
    },
    plan_observations: ['Seq Scan on users'],
    recommended_actions: [
      {
        action: 'stabilize-completion-run',
        priority: 'high',
        rationale: 'timeout first'
      },
      {
        action: 'review-index-coverage',
        priority: 'medium',
        rationale: 'seq scan present'
      }
    ],
    pipeline_analysis: {
      query_type: 'SELECT',
      cte_count: 0,
      should_consider_pipeline: false,
      candidate_ctes: [],
      scalar_filter_candidates: [],
      notes: []
    }
  };

  const text = formatPerfBenchmarkReport(report, 'text');
  expect(text).toContain('Classification probe: 60000.00 ms (timed out)');
  expect(text).toContain('Recommended actions:');
  expect(text).toContain('[high] stabilize-completion-run: timeout first');
  expect(text).toContain('Plan observations:');
  expect(text).toContain('Seq Scan on users');
  expect(text).toContain('sql_file: executed-sql/001-final-query.bound.sql');
  expect(text).toContain('resolved_sql_preview_file: executed-sql/001-final-query.resolved-preview.sql');
});

test('formatPerfBenchmarkReport recommends join review for nested loop plans', () => {
  const report: PerfBenchmarkReport = {
    schema_version: 1,
    command: 'perf run',
    query_file: 'nested-loop.sql',
    query_type: 'SELECT',
    params_shape: 'none',
    ordered_param_names: [],
    source_sql_file: 'nested-loop.sql',
    source_sql: 'select 1',
    bound_sql: 'select 1',
    bindings: undefined,
    strategy: 'direct',
    requested_mode: 'latency',
    selected_mode: 'latency',
    selection_reason: 'forced',
    classify_threshold_ms: 60000,
    timeout_ms: 300000,
    dry_run: false,
    saved: false,
    total_elapsed_ms: 10,
    latency_metrics: {
      measured_runs: 3,
      warmup_runs: 1,
      min_ms: 3,
      max_ms: 4,
      avg_ms: 3.5,
      median_ms: 3.5,
      p95_ms: 4
    },
    executed_statements: [
      {
        seq: 1,
        role: 'final-query',
        sql: 'select 1',
        bindings: undefined,
        elapsed_ms: 4,
        plan_summary: { node_type: 'Nested Loop', join_type: 'Inner' }
      }
    ],
    plan_summary: {
      node_type: 'Nested Loop',
      join_type: 'Inner'
    },
    plan_observations: ['Inner Nested Loop present in the captured plan'],
    recommended_actions: [
      {
        action: 'inspect-join-strategy',
        priority: 'medium',
        rationale: 'The captured plan includes a join operator, so rewriting join shape or supporting it with indexes may help.'
      }
    ],
    pipeline_analysis: {
      query_type: 'SELECT',
      cte_count: 0,
      should_consider_pipeline: false,
      candidate_ctes: [],
      scalar_filter_candidates: [],
      notes: []
    }
  };
  const text = formatPerfBenchmarkReport(report, 'text');
  expect(text).toContain('inspect-join-strategy');
  expect(text).toContain('Inner Nested Loop present in the captured plan');
});




test('runPerfBenchmark dry-run exposes decomposed multi-statement evidence and strategy metadata', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-decomposed', path.join('src', 'sql', 'reports', 'decomposed.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with base_sales as (
        select id, region_id from public.sales
      ),
      filtered_sales as (
        select id from base_sales where region_id = 10
      ),
      final_sales as (
        select id from filtered_sales
      )
      select * from final_sales
    `,
    'utf8'
  );

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    strategy: 'decomposed',
    material: ['base_sales', 'filtered_sales'],
    mode: 'latency',
    repeat: 2,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  });

  expect(report.strategy).toBe('decomposed');
  expect(report.strategy_metadata).toMatchObject({
    materialized_ctes: ['base_sales', 'filtered_sales'],
    planned_steps: [
      expect.objectContaining({ step: 1, kind: 'materialize', target: 'base_sales' }),
      expect.objectContaining({ step: 2, kind: 'materialize', target: 'filtered_sales' }),
      expect.objectContaining({ step: 3, kind: 'final-query', target: 'FINAL_QUERY' }),
    ]
  });
  expect(report.executed_statements).toEqual([
    expect.objectContaining({ seq: 1, role: 'materialize', target: 'base_sales' }),
    expect.objectContaining({ seq: 2, role: 'materialize', target: 'filtered_sales' }),
    expect.objectContaining({ seq: 3, role: 'final-query', target: 'FINAL_QUERY' }),
  ]);
});

test('loadPerfBenchmarkReport accepts decomposed summaries with strategy metadata', () => {
  const workspace = createTempDir('perf-benchmark-decomposed-summary');
  const summary = makePerfReport({
    run_id: 'run_100',
    strategy: 'decomposed',
    strategy_metadata: {
      materialized_ctes: ['base_sales'],
      scalar_filter_columns: [],
      planned_steps: [
        { step: 1, kind: 'materialize', target: 'base_sales', depends_on: [] },
        { step: 2, kind: 'final-query', target: 'FINAL_QUERY', depends_on: ['base_sales'] },
      ]
    },
    total_elapsed_ms: 400,
    completion_metrics: {
      completed: true,
      timed_out: false,
      wall_time_ms: 400
    },
    executed_statements: [
      { seq: 1, role: 'materialize', target: 'base_sales', sql: 'create temp table "base_sales" as select 1', bindings: undefined, elapsed_ms: 120 },
      { seq: 2, role: 'final-query', target: 'FINAL_QUERY', sql: 'select * from "base_sales"', bindings: undefined, elapsed_ms: 280 },
    ],
    pipeline_analysis: {
      query_type: 'SELECT',
      cte_count: 1,
      should_consider_pipeline: false,
      candidate_ctes: [],
      scalar_filter_candidates: [],
      notes: []
    }
  });

  writeFileSync(path.join(workspace, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  const loaded = loadPerfBenchmarkReport(workspace);
  expect(loaded.strategy).toBe('decomposed');
  expect(loaded.strategy_metadata?.planned_steps).toHaveLength(2);
  expect(loaded.executed_statements[0]).toMatchObject({ role: 'materialize', target: 'base_sales' });
});

test('loadPerfBenchmarkReport accepts legacy summaries without scalar filter candidates', () => {
  const workspace = createTempDir('perf-benchmark-legacy-summary');
  const summary = makePerfReport({
    run_id: 'run_legacy',
    pipeline_analysis: {
      query_type: 'SELECT',
      cte_count: 1,
      should_consider_pipeline: true,
      candidate_ctes: [
        {
          name: 'base_sales',
          downstream_references: 2,
          reasons: ['referenced by multiple downstream consumers']
        }
      ],
      notes: ['legacy summary fixture']
    } as PerfBenchmarkReport['pipeline_analysis']
  });

  writeFileSync(path.join(workspace, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  const loaded = loadPerfBenchmarkReport(workspace);

  expect(loaded.run_id).toBe('run_legacy');
  expect(loaded.pipeline_analysis.candidate_ctes).toHaveLength(1);
  expect(loaded.pipeline_analysis.notes).toEqual(['legacy summary fixture']);
});

test('diffPerfBenchmarkReports emits statement deltas for decomposed multi-statement runs', () => {
  const workspace = createTempDir('perf-benchmark-decomposed-diff');
  const baselineDir = path.join(workspace, 'run_001');
  const candidateDir = path.join(workspace, 'run_002');
  mkdirSync(baselineDir, { recursive: true });
  mkdirSync(candidateDir, { recursive: true });

  const baseline = makePerfReport({
    run_id: 'run_001',
    query_file: 'baseline.sql',
    source_sql_file: 'baseline.sql',
    strategy: 'decomposed',
    strategy_metadata: {
      materialized_ctes: ['base_sales'],
      scalar_filter_columns: [],
      planned_steps: [
        { step: 1, kind: 'materialize', target: 'base_sales', depends_on: [] },
        { step: 2, kind: 'final-query', target: 'FINAL_QUERY', depends_on: ['base_sales'] },
      ]
    },
    total_elapsed_ms: 500,
    completion_metrics: { completed: true, timed_out: false, wall_time_ms: 500 },
    executed_statements: [
      { seq: 1, role: 'materialize', target: 'base_sales', sql: 'create temp table "base_sales" as select 1', bindings: undefined, elapsed_ms: 220 },
      { seq: 2, role: 'final-query', target: 'FINAL_QUERY', sql: 'select * from "base_sales"', bindings: undefined, elapsed_ms: 280, plan_summary: { node_type: 'Seq Scan' } },
    ],
    plan_observations: ['Seq Scan on base_sales'],
    pipeline_analysis: {
      query_type: 'SELECT',
      cte_count: 1,
      should_consider_pipeline: false,
      candidate_ctes: [],
      scalar_filter_candidates: [],
      notes: []
    }
  });

  const candidate = {
    ...baseline,
    run_id: 'run_002',
    total_elapsed_ms: 410,
    completion_metrics: { completed: true, timed_out: false, wall_time_ms: 410 },
    executed_statements: [
      { seq: 1, role: 'materialize', target: 'base_sales', sql: 'create temp table "base_sales" as select 1', bindings: undefined, elapsed_ms: 150 },
      { seq: 2, role: 'final-query', target: 'FINAL_QUERY', sql: 'select * from "base_sales"', bindings: undefined, elapsed_ms: 260, plan_summary: { node_type: 'Index Scan' } },
    ],
    plan_observations: ['Index Scan on base_sales'],
  };

  writeFileSync(path.join(baselineDir, 'summary.json'), JSON.stringify(baseline, null, 2), 'utf8');
  writeFileSync(path.join(candidateDir, 'summary.json'), JSON.stringify(candidate, null, 2), 'utf8');

  const diff = diffPerfBenchmarkReports(baselineDir, candidateDir);
  expect(diff.statement_deltas).toEqual(expect.arrayContaining([
    expect.objectContaining({ statement_id: '1:materialize:base_sales', elapsed_delta_ms: -70 }),
    expect.objectContaining({ statement_id: '2:final-query:FINAL_QUERY', elapsed_delta_ms: -20 }),
  ]));
  const text = formatPerfDiffReport(diff, 'text');
  expect(text).toContain('Statement deltas:');
  expect(text).toContain('1:materialize:base_sales');
});

test('diffPerfBenchmarkReports aligns final-query deltas across direct and decomposed runs', () => {
  const workspace = createTempDir('perf-benchmark-strategy-diff');
  const baselineDir = path.join(workspace, 'run_001');
  const candidateDir = path.join(workspace, 'run_002');
  mkdirSync(baselineDir, { recursive: true });
  mkdirSync(candidateDir, { recursive: true });

  const baseline = makePerfReport({
    run_id: 'run_001',
    query_file: 'baseline.sql',
    source_sql_file: 'baseline.sql',
    strategy: 'direct',
    total_elapsed_ms: 500,
    completion_metrics: { completed: true, timed_out: false, wall_time_ms: 500 },
    executed_statements: [
      { seq: 1, role: 'final-query', target: 'FINAL_QUERY', sql: 'select * from base_sales', bindings: undefined, elapsed_ms: 500, plan_summary: { node_type: 'Nested Loop' } },
    ],
    plan_observations: ['Nested Loop on base_sales'],
    pipeline_analysis: {
      query_type: 'SELECT',
      cte_count: 1,
      should_consider_pipeline: false,
      candidate_ctes: [],
      scalar_filter_candidates: [],
      notes: []
    }
  });

  const candidate = makePerfReport({
    ...baseline,
    run_id: 'run_002',
    strategy: 'decomposed',
    strategy_metadata: {
      materialized_ctes: ['base_sales'],
      scalar_filter_columns: [],
      planned_steps: [
        { step: 1, kind: 'materialize', target: 'base_sales', depends_on: [] },
        { step: 2, kind: 'final-query', target: 'FINAL_QUERY', depends_on: ['base_sales'] },
      ]
    },
    total_elapsed_ms: 410,
    completion_metrics: { completed: true, timed_out: false, wall_time_ms: 410 },
    executed_statements: [
      { seq: 1, role: 'materialize', target: 'base_sales', sql: 'create temp table "base_sales" as select 1', bindings: undefined, elapsed_ms: 150, plan_summary: { node_type: 'Seq Scan' } },
      { seq: 2, role: 'final-query', target: 'FINAL_QUERY', sql: 'select * from "base_sales"', bindings: undefined, elapsed_ms: 260, plan_summary: { node_type: 'Index Scan' } },
    ],
    plan_observations: ['Seq Scan on base_sales', 'Index Scan on base_sales'],
  });

  writeFileSync(path.join(baselineDir, 'summary.json'), JSON.stringify(baseline, null, 2), 'utf8');
  writeFileSync(path.join(candidateDir, 'summary.json'), JSON.stringify(candidate, null, 2), 'utf8');

  const diff = diffPerfBenchmarkReports(baselineDir, candidateDir);
  expect(diff.statement_deltas).toEqual(expect.arrayContaining([
    expect.objectContaining({ statement_id: '2:final-query:FINAL_QUERY', baseline_elapsed_ms: 500, candidate_elapsed_ms: 260, elapsed_delta_ms: -240 }),
    expect.objectContaining({ statement_id: '1:materialize:base_sales', baseline_elapsed_ms: undefined, candidate_elapsed_ms: 150 }),
  ]));
  expect(diff.plan_deltas).toEqual(expect.arrayContaining([
    expect.objectContaining({ statement_id: '2:final-query:FINAL_QUERY', changed: true }),
    expect.objectContaining({ statement_id: '1:materialize:base_sales', baseline_plan: '(missing statement)' }),
  ]));
});


test('mapPipelineStatements keeps materialize roles for captured timeout steps before the final query', () => {
  const mapped = mapPipelineStatements(
    [
      {
        sql: 'create temp table "base_sales" as select 1',
        bindings: undefined,
        elapsedMs: 300000,
        timedOut: true,
      }
    ],
    toPerfPlannedSteps([
      { kind: 'materialize', target: 'base_sales' }
    ])
  );

  expect(mapped).toEqual([
    expect.objectContaining({
      role: 'materialize',
      target: 'base_sales',
      timedOut: true,
    })
  ]);
});

test('toPerfPlannedSteps drops scalar-filter pseudo-steps before mapping executed statements', () => {
  const mapped = mapPipelineStatements(
    [
      {
        sql: 'create temp table "base_sales" as select 1',
        bindings: undefined,
        elapsedMs: 20,
        timedOut: false,
      },
      {
        sql: 'select * from "base_sales" where id = $1',
        bindings: [1],
        elapsedMs: 30,
        timedOut: false,
      }
    ],
    toPerfPlannedSteps([
      { kind: 'scalar-filter-bind', target: 'SCALAR_FILTER' },
      { kind: 'materialize', target: 'base_sales' },
      { kind: 'final-query', target: 'FINAL_QUERY' }
    ])
  );

  expect(mapped).toEqual([
    expect.objectContaining({ role: 'materialize', target: 'base_sales' }),
    expect.objectContaining({ role: 'final-query', target: 'FINAL_QUERY' })
  ]);
});

test('runPerfBenchmark dry-run discovers QuerySpec perf guidance from sql-root relative sqlFile', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-query-spec', path.join('src', 'sql', 'reports', 'sales.sql'));
  const specFile = path.join(workspace.rootDir, 'src', 'catalog', 'specs', 'sales.spec.ts');
  mkdirSync(path.dirname(specFile), { recursive: true });
  writeFileSync(
    workspace.sqlFile,
    `
      select id
      from public.sales
    `,
    'utf8'
  );
  writeFileSync(
    specFile,
    `
      export const salesSpec = {
        id: 'reports.sales',
        sqlFile: 'reports/sales.sql',
        params: { shape: 'named', example: {} },
        output: { example: { id: 1 } },
        metadata: {
          perf: {
            expectedScale: 'large',
            expectedInputRows: 50000,
            expectedOutputRows: 200
          }
        }
      };
    `,
    'utf8'
  );

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    strategy: 'direct',
    material: [],
    mode: 'completion',
    repeat: 3,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  });

  expect(report.spec_guidance).toMatchObject({
    spec_id: 'reports.sales',
    expected_scale: 'large',
    expected_input_rows: 50000,
    expected_output_rows: 200,
    review_policy: 'strongly-recommended',
    evidence_status: 'missing',
  });
  expect(report.recommended_actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ action: 'capture-perf-evidence', priority: 'high' })
  ]));

  const text = formatPerfBenchmarkReport(report, 'text');
  expect(text).toContain('Query spec guidance:');
  expect(text).toContain('expected_scale: large');
  expect(text).toContain('evidence_status: missing');
});

test('runPerfBenchmark dry-run warns when perf seed rows undershoot QuerySpec expected input rows', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-query-spec-seed', path.join('src', 'sql', 'reports', 'orders.sql'));
  const specFile = path.join(workspace.rootDir, 'src', 'catalog', 'specs', 'orders.spec.ts');
  const seedFile = path.join(workspace.rootDir, 'perf', 'seed.yml');
  mkdirSync(path.dirname(specFile), { recursive: true });
  mkdirSync(path.dirname(seedFile), { recursive: true });
  writeFileSync(
    workspace.sqlFile,
    `
      select id
      from public.orders
    `,
    'utf8'
  );
  writeFileSync(
    specFile,
    `
      export const ordersSpec = {
        id: 'reports.orders',
        sqlFile: 'src/sql/reports/orders.sql',
        params: { shape: 'named', example: {} },
        output: { example: { id: 1 } },
        metadata: {
          perf: {
            expectedScale: 'medium',
            expectedInputRows: 1000
          }
        }
      };
    `,
    'utf8'
  );
  writeFileSync(
    seedFile,
    [
      'seed: 123',
      'tables:',
      '  orders:',
      '    rows: 12',
      'columns: {}',
      ''
    ].join('\n'),
    'utf8'
  );

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    strategy: 'direct',
    material: [],
    mode: 'completion',
    repeat: 3,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  });

  expect(report.spec_guidance).toMatchObject({
    spec_id: 'reports.orders',
    expected_scale: 'medium',
    expected_input_rows: 1000,
    review_policy: 'recommended',
    fixture_rows_available: 12,
    fixture_rows_status: 'undersized',
  });
  expect(report.recommended_actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ action: 'increase-perf-fixture-scale' })
  ]));
});

test('runPerfBenchmark dry-run with save still requests missing perf evidence', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-query-spec-dry-save', path.join('src', 'sql', 'reports', 'sales.sql'));
  const specFile = path.join(workspace.rootDir, 'src', 'catalog', 'specs', 'sales.spec.ts');
  mkdirSync(path.dirname(specFile), { recursive: true });
  writeFileSync(
    workspace.sqlFile,
    `
      select id
      from public.sales
    `,
    'utf8'
  );
  writeFileSync(
    specFile,
    `
      export const salesSpec = {
        id: 'reports.sales',
        sqlFile: 'reports/sales.sql',
        params: { shape: 'named', example: {} },
        output: { example: { id: 1 } },
        metadata: {
          perf: {
            expectedScale: 'medium',
            expectedInputRows: 100000
          }
        }
      };
    `,
    'utf8'
  );

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    strategy: 'direct',
    material: [],
    mode: 'completion',
    repeat: 3,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: true,
    dryRun: true,
  });

  expect(report.saved).toBe(false);
  expect(report.spec_guidance).toMatchObject({
    expected_scale: 'medium',
    expected_input_rows: 100000,
    review_policy: 'strongly-recommended',
    evidence_status: 'missing',
  });
  expect(report.recommended_actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ action: 'capture-perf-evidence', priority: 'high' })
  ]));
});

test('runPerfBenchmark dry-run ignores unrelated perf seed tables when checking fixture scale', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-query-spec-related-seed', path.join('src', 'sql', 'reports', 'orders.sql'));
  const specFile = path.join(workspace.rootDir, 'src', 'catalog', 'specs', 'orders.spec.ts');
  const seedFile = path.join(workspace.rootDir, 'perf', 'seed.yml');
  mkdirSync(path.dirname(specFile), { recursive: true });
  mkdirSync(path.dirname(seedFile), { recursive: true });
  writeFileSync(
    workspace.sqlFile,
    `
      select id
      from public.orders
    `,
    'utf8'
  );
  writeFileSync(
    specFile,
    `
      export const ordersSpec = {
        id: 'reports.orders',
        sqlFile: 'reports/orders.sql',
        params: { shape: 'named', example: {} },
        output: { example: { id: 1 } },
        metadata: {
          perf: {
            expectedScale: 'medium',
            expectedInputRows: 1000
          }
        }
      };
    `,
    'utf8'
  );
  writeFileSync(
    seedFile,
    [
      'seed: 123',
      'tables:',
      '  orders:',
      '    rows: 12',
      '  users:',
      '    rows: 5000',
      'columns: {}',
      ''
    ].join('\n'),
    'utf8'
  );

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    strategy: 'direct',
    material: [],
    mode: 'completion',
    repeat: 3,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  });

  expect(report.spec_guidance).toMatchObject({
    fixture_rows_available: 12,
    fixture_rows_status: 'undersized',
  });
});

test('runPerfBenchmark dry-run does not match QuerySpec guidance by basename only', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-query-spec-basename', path.join('src', 'sql', 'admin', 'sales.sql'));
  const specFile = path.join(workspace.rootDir, 'src', 'catalog', 'specs', 'sales.spec.ts');
  mkdirSync(path.dirname(specFile), { recursive: true });
  writeFileSync(
    workspace.sqlFile,
    `
      select id
      from public.sales
    `,
    'utf8'
  );
  writeFileSync(
    specFile,
    `
      export const salesSpec = {
        id: 'reports.sales',
        sqlFile: 'reports/sales.sql',
        params: { shape: 'named', example: {} },
        output: { example: { id: 1 } },
        metadata: {
          perf: {
            expectedScale: 'large'
          }
        }
      };
    `,
    'utf8'
  );

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    strategy: 'direct',
    material: [],
    mode: 'completion',
    repeat: 3,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  });

  expect(report.spec_guidance).toBeUndefined();
});

test('runPerfBenchmark dry-run rejects ambiguous QuerySpec perf guidance matches', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-query-spec-ambiguous', path.join('src', 'sql', 'reports', 'sales.sql'));
  const firstSpecFile = path.join(workspace.rootDir, 'src', 'catalog', 'specs', 'sales-a.spec.ts');
  const secondSpecFile = path.join(workspace.rootDir, 'src', 'catalog', 'specs', 'sales-b.spec.ts');
  mkdirSync(path.dirname(firstSpecFile), { recursive: true });
  writeFileSync(
    workspace.sqlFile,
    `
      select id
      from public.sales
    `,
    'utf8'
  );
  writeFileSync(
    firstSpecFile,
    `
      export const salesSpecA = {
        id: 'reports.sales.a',
        sqlFile: 'reports/sales.sql',
        params: { shape: 'named', example: {} },
        output: { example: { id: 1 } },
        metadata: {
          perf: {
            expectedScale: 'medium'
          }
        }
      };
    `,
    'utf8'
  );
  writeFileSync(
    secondSpecFile,
    `
      export const salesSpecB = {
        id: 'reports.sales.b',
        sqlFile: 'src/sql/reports/sales.sql',
        params: { shape: 'named', example: {} },
        output: { example: { id: 1 } },
        metadata: {
          perf: {
            expectedScale: 'large'
          }
        }
      };
    `,
    'utf8'
  );

  await expect(runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    strategy: 'direct',
    material: [],
    mode: 'completion',
    repeat: 3,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  })).rejects.toThrow(/Multiple QuerySpecs matched/);
});

test('runPerfBenchmark dry-run reports ddl inventory and pipeline-first tuning guidance for scale dogfooding', async () => {
  const workspace = createSqlWorkspace('perf-benchmark-scale-dogfood', path.join('src', 'sql', 'reports', 'sales_pipeline.sql'));
  const specFile = path.join(workspace.rootDir, 'src', 'catalog', 'specs', 'sales-pipeline.spec.ts');
  const ddlFile = path.join(workspace.rootDir, 'ztd', 'ddl', 'public.sql');
  mkdirSync(path.dirname(specFile), { recursive: true });
  mkdirSync(path.dirname(ddlFile), { recursive: true });
  writeFileSync(path.join(workspace.rootDir, 'ztd.config.json'), JSON.stringify({
    dialect: 'postgres',
    ddlDir: 'db/ddl',
    testsDir: 'tests',
    defaultSchema: 'public',
    searchPath: ['public'],
    ddlLint: 'strict'
  }, null, 2), 'utf8');
  writeFileSync(ddlFile, [
    'create table public.sales (id integer primary key, region_id integer not null, closed_month date not null);',
    'create index sales_region_closed_month_idx on public.sales(region_id, closed_month);',
    ''
  ].join('\n'), 'utf8');
  writeFileSync(workspace.sqlFile, [
    'with base_sales as (',
    '  select id, region_id, closed_month',
    '  from public.sales',
    '),',
    'regional_sales as (',
    '  select id, region_id from base_sales',
    '),',
    'month_sales as (',
    '  select id, closed_month from base_sales',
    ')',
    'select rs.id',
    'from regional_sales rs',
    'join month_sales ms on ms.id = rs.id',
    ''
  ].join('\n'), 'utf8');
  writeFileSync(specFile, [
    'export const salesPipelineSpec = {',
    "  id: 'reports.sales-pipeline',",
    "  sqlFile: 'reports/sales_pipeline.sql',",
    "  params: { shape: 'named', example: {} },",
    "  output: { example: { id: 1 } },",
    '  metadata: {',
    '    perf: {',
    "      expectedScale: 'large',",
    '      expectedInputRows: 50000,',
    '      expectedOutputRows: 500',
    '    }',
    '  }',
    '};',
    ''
  ].join('\n'), 'utf8');

  const report = await runPerfBenchmark({
    rootDir: workspace.rootDir,
    queryFile: workspace.sqlFile,
    strategy: 'direct',
    material: [],
    mode: 'completion',
    repeat: 1,
    warmup: 0,
    classifyThresholdSeconds: 60,
    timeoutMinutes: 5,
    save: false,
    dryRun: true,
  });

  expect(report.ddl_inventory).toMatchObject({
    ddl_files: 1,
    ddl_statement_count: 2,
    table_count: 1,
    index_count: 1,
    index_names: ['sales_region_closed_month_idx']
  });
  expect(report.tuning_guidance).toMatchObject({
    primary_path: 'pipeline',
    requires_captured_plan: true,
    pipeline_branch: expect.objectContaining({ recommended: true }),
    index_branch: expect.objectContaining({ recommended: false })
  });
  expect(report.tuning_summary).toMatchObject({
    headline: 'Start with pipeline tuning.'
  });

  const textReport = formatPerfBenchmarkReport(report, 'text');
  const jsonReport = JSON.parse(formatPerfBenchmarkReport(report, 'json')) as PerfBenchmarkReport;
  expect(textReport).toContain('Decision summary: Start with pipeline tuning.');
  expect(textReport).toContain('DDL inventory:');
  expect(textReport).toContain('index_count: 1');
  expect(textReport).toContain('Tuning guidance:');
  expect(jsonReport.tuning_summary?.headline).toBe('Start with pipeline tuning.');
  expect(textReport).toContain('primary_path: pipeline');
  expect(textReport).toContain('Run `ztd perf db reset` so the perf sandbox recreates both tables and indexes from local DDL.');
});

test('buildPerfTuningGuidance prefers index remediation when the captured plan shows a sequential scan without pipeline signals', () => {
  const guidance = buildPerfTuningGuidance({
    query_type: 'SELECT',
    cte_count: 0,
    should_consider_pipeline: false,
    candidate_ctes: [],
    scalar_filter_candidates: [],
    notes: []
  }, {
    observations: ['Seq Scan on public.sales'],
    statement_summary: 'Seq Scan',
    hasCapturedPlan: true,
    hasSequentialScan: true,
    hasJoin: false
  }, {
    spec_id: 'reports.sales',
    spec_file: 'src/catalog/specs/sales.spec.ts',
    expected_scale: 'large',
    review_policy: 'strongly-recommended',
    evidence_status: 'missing',
    fixture_rows_status: 'unknown'
  });

  expect(guidance.primary_path).toBe('index');
  expect(guidance.index_branch.recommended).toBe(true);
  expect(guidance.pipeline_branch.recommended).toBe(false);
  expect(guidance.index_branch.next_steps).toContain('Append CREATE INDEX statements to db/ddl/*.sql instead of making ad-hoc sandbox-only changes.');
  expect(buildPerfTuningSummary(guidance)).toMatchObject({
    headline: 'Start with index tuning.'
  });
});
test('buildPerfTuningGuidance does not require another capture when a non-signal plan already exists', () => {
  const guidance = buildPerfTuningGuidance({
    query_type: 'SELECT',
    cte_count: 0,
    should_consider_pipeline: false,
    candidate_ctes: [],
    scalar_filter_candidates: [],
    notes: []
  }, {
    observations: [],
    statement_summary: 'Index Only Scan on public.sales',
    hasCapturedPlan: true,
    hasSequentialScan: false,
    hasJoin: false
  });

  expect(guidance.primary_path).toBe('capture-plan');
  expect(guidance.requires_captured_plan).toBe(false);
  expect(buildPerfTuningSummary(guidance)).toMatchObject({
    headline: 'A representative plan is already available; compare index and pipeline evidence next.',
    evidence: ['A captured plan exists, but it does not yet isolate scans, joins, or pipeline hotspots.'],
    next_step: 'Capture or review EXPLAIN (ANALYZE, BUFFERS) before changing the physical design.'
  });
});

test('summarizePerfDdlInventory keeps index counts visible in saved perf guidance', () => {
  const summary = summarizePerfDdlInventory({
    files: ['db/ddl/public.sql'],
    statements: [],
    ddlStatementCount: 4,
    tableCount: 2,
    indexCount: 2,
    indexNames: ['sales_region_idx', 'sales_closed_month_idx']
  });

  expect(summary).toEqual({
    ddl_files: 1,
    ddl_statement_count: 4,
    table_count: 2,
    index_count: 2,
    index_names: ['sales_region_idx', 'sales_closed_month_idx']
  });
});
