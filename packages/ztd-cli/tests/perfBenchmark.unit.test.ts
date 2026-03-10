import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  buildPerfPipelineAnalysis,
  diffPerfBenchmarkReports,
  formatPerfBenchmarkReport,
  formatPerfDiffReport,
  runPerfBenchmark,
  type PerfBenchmarkReport
} from '../src/perf/benchmark';

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

test('diffPerfBenchmarkReports compares saved latency runs by p95', () => {
  const workspace = createTempDir('perf-benchmark-diff');
  const baselineDir = path.join(workspace, 'run_001');
  const candidateDir = path.join(workspace, 'run_002');
  mkdirSync(baselineDir, { recursive: true });
  mkdirSync(candidateDir, { recursive: true });

  const baseline: PerfBenchmarkReport = {
    schema_version: 1,
    command: 'perf run',
    run_id: 'run_001',
    query_file: 'baseline.sql',
    query_type: 'SELECT',
    params_shape: 'none',
    ordered_param_names: [],
    source_sql_file: 'baseline.sql',
    source_sql: 'select 1',
    bound_sql: 'select 1',
    bindings: undefined,
    strategy: 'direct',
    requested_mode: 'latency',
    selected_mode: 'latency',
    selection_reason: 'forced',
    classify_threshold_ms: 60000,
    timeout_ms: 300000,
    database_version: '16.2',
    dry_run: false,
    saved: true,
    total_elapsed_ms: 330,
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
    pipeline_analysis: {
      query_type: 'SELECT',
      cte_count: 0,
      should_consider_pipeline: false,
      candidate_ctes: [],
      notes: []
    }
  };

  const candidate: PerfBenchmarkReport = {
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
  };

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
  writeFileSync(paramsFile, ['params: [unterminated', ''].join('\\n'), 'utf8');
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
      notes: []
    }
  };

  const text = formatPerfBenchmarkReport(report, 'text');
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
      notes: []
    }
  };
  const text = formatPerfBenchmarkReport(report, 'text');
  expect(text).toContain('inspect-join-strategy');
  expect(text).toContain('Inner Nested Loop present in the captured plan');
});


