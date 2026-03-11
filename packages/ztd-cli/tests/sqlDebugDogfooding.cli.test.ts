import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  SQL_DEBUG_RECOVERY_PARAMS,
  SQL_DEBUG_RECOVERY_PATCH,
  SQL_DEBUG_RECOVERY_QUERY,
} from './utils/sqlDebugRecoveryScenario';

const nodeExecutable = process.execPath;
const packageManagerExecutable = process.env.npm_execpath ?? (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
const cliRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const cliEntry = path.join(cliRoot, 'dist', 'index.js');
const tmpRoot = path.join(repoRoot, 'tmp');
let cliBuildPrepared = false;

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function ensureBuiltCli(): void {
  if (cliBuildPrepared) {
    return;
  }

  const buildCommand = process.platform === 'win32'
    ? 'cmd.exe'
    : packageManagerExecutable.endsWith('.js') || packageManagerExecutable.endsWith('.cjs')
      ? nodeExecutable
      : packageManagerExecutable;
  const buildArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'pnpm --filter @rawsql-ts/ztd-cli build']
    : buildCommand === nodeExecutable
      ? [packageManagerExecutable, '--filter', '@rawsql-ts/ztd-cli', 'build']
      : ['--filter', '@rawsql-ts/ztd-cli', 'build'];

  const buildResult = spawnSync(buildCommand, buildArgs, {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    encoding: 'utf8',
  });

  if (buildResult.error) {
    throw buildResult.error;
  }
  if (buildResult.status !== 0) {
    throw new Error(buildResult.stderr || buildResult.stdout || 'Failed to build ztd-cli before SQL debug dogfooding.');
  }

  cliBuildPrepared = true;
}

function runCli(args: string[], envOverrides: NodeJS.ProcessEnv = {}, cwd: string = repoRoot): SpawnSyncReturns<string> {
  ensureBuiltCli();

  return spawnSync(nodeExecutable, [cliEntry, ...args], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ...envOverrides,
    },
    encoding: 'utf8',
  });
}

function assertCliSuccess(result: SpawnSyncReturns<string>, label: string): void {
  expect(result.error).toBeUndefined();
  expect(result.status, `${label}: ${result.stderr || result.stdout}`).toBe(0);
}

test('sql debug recovery dogfood scenario preserves the shortest command loop artifact', () => {
  const workspace = createTempDir('sql-debug-recovery');
  const sqlFile = path.join(workspace, 'src', 'sql', 'reports', 'customer_health.sql');
  const paramsFile = path.join(workspace, 'perf', 'params.json');
  const sliceFile = path.join(workspace, 'tmp', 'suspicious_rollup.sql');
  const editedFile = path.join(workspace, 'tmp', 'suspicious_rollup.edited.sql');

  mkdirSync(path.dirname(sqlFile), { recursive: true });
  mkdirSync(path.dirname(paramsFile), { recursive: true });
  mkdirSync(path.dirname(sliceFile), { recursive: true });
  writeFileSync(sqlFile, SQL_DEBUG_RECOVERY_QUERY, 'utf8');
  writeFileSync(paramsFile, JSON.stringify(SQL_DEBUG_RECOVERY_PARAMS, null, 2), 'utf8');
  writeFileSync(editedFile, SQL_DEBUG_RECOVERY_PATCH, 'utf8');

  const outlineResult = runCli(['query', 'outline', sqlFile], {}, workspace);
  assertCliSuccess(outlineResult, 'query outline recovery');
  expect(outlineResult.stdout).toContain('suspicious_rollup');
  expect(outlineResult.stdout).toContain('unused_debug_cte [unused]');
  expect(outlineResult.stdout).toContain('Final query target:');

  const lintResult = runCli(['query', 'lint', sqlFile, '--format', 'json'], {}, workspace);
  assertCliSuccess(lintResult, 'query lint recovery');
  const lintParsed = JSON.parse(lintResult.stdout);
  expect(lintParsed).toMatchObject({
    issue_count: 1,
    issues: [
      expect.objectContaining({
        type: 'unused-cte',
        cte: 'unused_debug_cte',
      }),
    ],
  });

  const sliceResult = runCli(['query', 'slice', sqlFile, '--cte', 'suspicious_rollup', '--out', sliceFile], {}, workspace);
  assertCliSuccess(sliceResult, 'query slice recovery');
  const slicedSql = readFileSync(sliceFile, 'utf8');
  expect(slicedSql).toContain('from "customer_rollup"');
  expect(slicedSql).not.toContain('unused_debug_cte');

  const patchPreviewResult = runCli(
    ['query', 'patch', 'apply', sqlFile, '--cte', 'suspicious_rollup', '--from', editedFile, '--preview'],
    {},
    workspace,
  );
  assertCliSuccess(patchPreviewResult, 'query patch recovery');
  expect(patchPreviewResult.stdout).toContain('Index:');
  expect(patchPreviewResult.stdout).toContain('dense_rank()');

  const directResult = runCli(
    ['--output', 'json', 'perf', 'run', '--query', sqlFile, '--params', paramsFile, '--mode', 'latency', '--dry-run'],
    {},
    workspace,
  );
  assertCliSuccess(directResult, 'perf direct recovery');
  const directParsed = JSON.parse(directResult.stdout);
  expect(directParsed.data).toMatchObject({
    strategy: 'direct',
    pipeline_analysis: expect.objectContaining({
      should_consider_pipeline: true,
      candidate_ctes: [expect.objectContaining({ name: 'customer_rollup' })],
    }),
    executed_statements: [expect.objectContaining({ seq: 1, role: 'final-query', target: 'FINAL_QUERY' })],
  });
  expect(directParsed.data.executed_statements[0].resolved_sql_preview).toContain('where rollup_rank <= 5');

  const decomposedResult = runCli(
    [
      '--output',
      'json',
      'perf',
      'run',
      '--query',
      sqlFile,
      '--params',
      paramsFile,
      '--strategy',
      'decomposed',
      '--material',
      'customer_rollup',
      '--mode',
      'latency',
      '--dry-run',
    ],
    {},
    workspace,
  );
  assertCliSuccess(decomposedResult, 'perf decomposed recovery');
  const decomposedParsed = JSON.parse(decomposedResult.stdout);
  expect(decomposedParsed.data).toMatchObject({
    strategy: 'decomposed',
    strategy_metadata: {
      materialized_ctes: ['customer_rollup'],
      planned_steps: [
        expect.objectContaining({ step: 1, kind: 'materialize', target: 'customer_rollup' }),
        expect.objectContaining({ step: 2, kind: 'final-query', target: 'FINAL_QUERY' }),
      ],
    },
    executed_statements: [
      expect.objectContaining({ seq: 1, role: 'materialize', target: 'customer_rollup' }),
      expect.objectContaining({ seq: 2, role: 'final-query', target: 'FINAL_QUERY' }),
    ],
  });
});
