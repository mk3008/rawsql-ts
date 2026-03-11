import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('../src/utils/modelProbe', () => ({
  buildProbeSql: vi.fn((sql: string) => `SELECT * FROM (${sql}) AS _ztd_type_probe LIMIT 0`),
  probeQueryColumns: vi.fn(async () => [
    { columnName: 'sales_id', typeName: 'int4', tsType: 'number' },
    { columnName: 'created_at', typeName: 'timestamptz', tsType: 'string' },
  ]),
}));

vi.mock('../src/utils/optionalDependencies', () => ({
  ensureAdapterNodePgModule: vi.fn(),
  ensurePgModule: vi.fn(async () => ({
    Client: class MockPgClient {
      async connect(): Promise<void> {
        return;
      }

      async end(): Promise<void> {
        return;
      }
    },
  })),
  ensureTestkitCoreModule: vi.fn(),
}));

vi.mock('../src/utils/pgDump', () => ({
  runPgDump: vi.fn(() => 'CREATE TABLE public.accounts (id bigint PRIMARY KEY);'),
}));

import { buildProgram } from '../src/index';
import { configureTelemetry } from '../src/utils/telemetry';

const originalProjectRoot = process.env.ZTD_PROJECT_ROOT;
const originalTelemetry = process.env.ZTD_CLI_TELEMETRY;
const originalTelemetryExport = process.env.ZTD_CLI_TELEMETRY_EXPORT;
const originalTelemetryFile = process.env.ZTD_CLI_TELEMETRY_FILE;

function createWorkspace(prefix: string): string {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  mkdirSync(tmpRoot, { recursive: true });
  return mkdtempSync(path.join(tmpRoot, prefix + '-'));
}

function captureTelemetry(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);

  return {
    lines,
    restore: () => stderrSpy.mockRestore(),
  };
}

function parseTelemetryPayloads(lines: string[]): Array<Record<string, unknown>> {
  return lines
    .join('')
    .split(/\r?\n/)
    .filter((line) => line.includes('"type":"telemetry"'))
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function summarizeTelemetryTimeline(payloads: Array<Record<string, unknown>>, rootSpanName: string): string[] {
  // Keep only the events that matter for dogfooding regressions so phase routing stays stable.
  return payloads.flatMap((payload) => {
    const kind = typeof payload.kind === 'string' ? payload.kind : null;
    const spanName = typeof payload.spanName === 'string' ? payload.spanName : null;
    const eventName = typeof payload.eventName === 'string' ? payload.eventName : null;
    const status = typeof payload.status === 'string' ? payload.status : null;

    if (kind === 'span-start' && spanName) {
      return [`start:${spanName}`];
    }
    if (kind === 'decision' && eventName && !eventName.startsWith('command.')) {
      return [`decision:${eventName}`];
    }
    if (kind === 'span-end' && spanName === rootSpanName && status) {
      return [`end:${spanName}:${status}`];
    }
    return [];
  });
}

afterEach(() => {
  if (originalProjectRoot === undefined) {
    delete process.env.ZTD_PROJECT_ROOT;
  } else {
    process.env.ZTD_PROJECT_ROOT = originalProjectRoot;
  }

  if (originalTelemetry === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY;
  } else {
    process.env.ZTD_CLI_TELEMETRY = originalTelemetry;
  }

  if (originalTelemetryExport === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY_EXPORT;
  } else {
    process.env.ZTD_CLI_TELEMETRY_EXPORT = originalTelemetryExport;
  }

  if (originalTelemetryFile === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY_FILE;
  } else {
    process.env.ZTD_CLI_TELEMETRY_FILE = originalTelemetryFile;
  }

  configureTelemetry({ enabled: false });
  vi.restoreAllMocks();
});

test('query uses emits stable phase spans through the real CLI path', async () => {
  const workspace = createWorkspace('query-telemetry');
  const specsDir = path.join(workspace, 'src', 'catalog', 'specs');
  const sqlDir = path.join(workspace, 'src', 'sql');
  mkdirSync(specsDir, { recursive: true });
  mkdirSync(sqlDir, { recursive: true });

  writeFileSync(
    path.join(specsDir, 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8',
  );
  writeFileSync(path.join(sqlDir, 'users.sql'), 'SELECT email FROM public.users;', 'utf8');

  process.env.ZTD_PROJECT_ROOT = workspace;
  process.env.ZTD_CLI_TELEMETRY = '1';

  const telemetry = captureTelemetry();
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(['node', 'ztd', 'query', 'uses', 'table', 'public.users', '--format', 'json'], { from: 'node' });

  telemetry.restore();
  logSpy.mockRestore();

  const payloads = parseTelemetryPayloads(telemetry.lines);
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'query uses table' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'resolve-query-options' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'build-query-usage-report' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'spec-discovery' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'impact-aggregation' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'render-query-usage-output' }),
      expect.objectContaining({ kind: 'span-end', spanName: 'query uses table', status: 'ok' }),
    ]),
  );
});

test('query uses can export telemetry to a CI-friendly artifact file through the real CLI path', async () => {
  const workspace = createWorkspace('query-telemetry-file');
  const specsDir = path.join(workspace, 'src', 'catalog', 'specs');
  const sqlDir = path.join(workspace, 'src', 'sql');
  const telemetryFile = path.join(workspace, 'artifacts', 'query-uses.telemetry.jsonl');
  mkdirSync(specsDir, { recursive: true });
  mkdirSync(sqlDir, { recursive: true });

  writeFileSync(
    path.join(specsDir, 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8',
  );
  writeFileSync(path.join(sqlDir, 'users.sql'), 'SELECT email FROM public.users;', 'utf8');

  process.env.ZTD_PROJECT_ROOT = workspace;
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(
    [
      'node',
      'ztd',
      '--telemetry',
      '--telemetry-export',
      'file',
      '--telemetry-file',
      telemetryFile,
      'query',
      'uses',
      'table',
      'public.users',
      '--format',
      'json',
    ],
    { from: 'node' },
  );

  logSpy.mockRestore();

  expect(existsSync(telemetryFile)).toBe(true);
  const payloads = readFileSync(telemetryFile, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'query uses table' }),
      expect.objectContaining({ kind: 'span-end', spanName: 'query uses table', status: 'ok' }),
    ]),
  );
});

test('query uses telemetry dogfood scenario preserves a stable impact-analysis timeline artifact', async () => {
  const workspace = createWorkspace('query-telemetry-dogfood');
  const specsDir = path.join(workspace, 'src', 'catalog', 'specs');
  const sqlDir = path.join(workspace, 'src', 'sql');
  const telemetryFile = path.join(workspace, 'artifacts', 'query-uses.timeline.jsonl');
  mkdirSync(specsDir, { recursive: true });
  mkdirSync(sqlDir, { recursive: true });

  writeFileSync(
    path.join(specsDir, 'users.spec.json'),
    JSON.stringify({ id: 'catalog.users', sqlFile: '../../sql/users.sql', params: { shape: 'named' } }, null, 2),
    'utf8',
  );
  writeFileSync(path.join(sqlDir, 'users.sql'), 'SELECT email FROM public.users WHERE email IS NOT NULL;', 'utf8');

  process.env.ZTD_PROJECT_ROOT = workspace;
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(
    [
      'node',
      'ztd',
      '--telemetry',
      '--telemetry-export',
      'file',
      '--telemetry-file',
      telemetryFile,
      'query',
      'uses',
      'column',
      'public.users.email',
      '--format',
      'json',
      '--exclude-generated',
    ],
    { from: 'node' },
  );

  logSpy.mockRestore();

  const payloads = readFileSync(telemetryFile, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(summarizeTelemetryTimeline(payloads, 'query uses column')).toEqual([
    'start:query uses column',
    'start:resolve-query-options',
    'start:build-query-usage-report',
    'start:spec-discovery',
    'start:impact-aggregation',
    'start:render-query-usage-output',
    'end:query uses column:ok'
  ]);
});
test('model-gen emits phase spans and probe decision events through the real CLI path', async () => {
  const workspace = createWorkspace('model-gen-telemetry');
  const sqlDir = path.join(workspace, 'src', 'sql', 'sales');
  const outDir = path.join(workspace, 'src', 'catalog', 'specs', 'generated');
  mkdirSync(sqlDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const sqlFile = path.join(sqlDir, 'get_sales.sql');
  const outFile = path.join(outDir, 'getSales.generated.ts');
  writeFileSync(sqlFile, 'select :sales_id::int4 as sales_id, now() as created_at;', 'utf8');

  const relativeSqlFile = path.relative(process.cwd(), sqlFile);
  const relativeSqlRoot = path.relative(process.cwd(), path.join(workspace, 'src', 'sql'));
  const relativeOutFile = path.relative(process.cwd(), outFile);

  const telemetry = captureTelemetry();
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    void chunk;
    return true;
  }) as typeof process.stdout.write);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(
    [
      'node',
      'ztd',
      '--telemetry',
      'model-gen',
      relativeSqlFile,
      '--sql-root',
      relativeSqlRoot,
      '--out',
      relativeOutFile,
      '--url',
      'postgres://demo:secret@localhost:5432/app',
    ],
    { from: 'node' },
  );

  telemetry.restore();
  stdoutSpy.mockRestore();

  expect(existsSync(outFile)).toBe(true);

  const payloads = parseTelemetryPayloads(telemetry.lines);
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'model-gen' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'resolve-model-gen-inputs' }),
      expect.objectContaining({ kind: 'decision', eventName: 'model-gen.probe-mode' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'placeholder-scan' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'probe-client-connect' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'probe-query-columns' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'type-inference' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'render-generated-output' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'file-emit' }),
      expect.objectContaining({ kind: 'span-end', spanName: 'model-gen', status: 'ok' }),
    ]),
  );
});

test('model-gen telemetry dogfood scenario preserves the probe diagnosis timeline', async () => {
  const workspace = createWorkspace('model-gen-telemetry-dogfood');
  const sqlDir = path.join(workspace, 'src', 'sql', 'sales');
  const outDir = path.join(workspace, 'src', 'catalog', 'specs', 'generated');
  mkdirSync(sqlDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const sqlFile = path.join(sqlDir, 'get_sales.sql');
  const outFile = path.join(outDir, 'getSales.generated.ts');
  writeFileSync(sqlFile, 'select :sales_id::int4 as sales_id, now() as created_at;', 'utf8');

  const relativeSqlFile = path.relative(process.cwd(), sqlFile);
  const relativeSqlRoot = path.relative(process.cwd(), path.join(workspace, 'src', 'sql'));
  const relativeOutFile = path.relative(process.cwd(), outFile);

  const telemetry = captureTelemetry();
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    void chunk;
    return true;
  }) as typeof process.stdout.write);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(
    [
      'node',
      'ztd',
      '--telemetry',
      'model-gen',
      relativeSqlFile,
      '--sql-root',
      relativeSqlRoot,
      '--out',
      relativeOutFile,
      '--url',
      'postgres://demo:secret@localhost:5432/app',
    ],
    { from: 'node' },
  );

  telemetry.restore();
  stdoutSpy.mockRestore();

  const payloads = parseTelemetryPayloads(telemetry.lines);
  expect(summarizeTelemetryTimeline(payloads, 'model-gen')).toEqual([
    'start:model-gen',
    'start:resolve-model-gen-inputs',
    'decision:model-gen.probe-mode',
    'start:placeholder-scan',
    'start:probe-client-connect',
    'start:probe-query-columns',
    'start:type-inference',
    'start:render-generated-output',
    'start:file-emit',
    'end:model-gen:ok'
  ]);
});
test('ddl diff emits stable phase spans through the real CLI path', async () => {
  const workspace = createWorkspace('ddl-diff-telemetry');
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  const outFile = path.join(workspace, 'tmp', 'plan.diff');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(path.join(ddlDir, 'public.sql'), 'CREATE TABLE public.users (id integer PRIMARY KEY);', 'utf8');

  const relativeDdlDir = path.relative(process.cwd(), ddlDir);
  const relativeOutFile = path.relative(process.cwd(), outFile);

  const telemetry = captureTelemetry();
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(
    ['node', 'ztd', '--telemetry', 'ddl', 'diff', '--ddl-dir', relativeDdlDir, '--out', relativeOutFile, '--url', 'postgres://demo:secret@localhost:5432/app'],
    { from: 'node' },
  );

  telemetry.restore();
  logSpy.mockRestore();

  const payloads = parseTelemetryPayloads(telemetry.lines);
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'ddl diff' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'collect-local-ddl' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'pull-remote-ddl' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'compute-diff-plan' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'emit-diff-plan' }),
      expect.objectContaining({ kind: 'span-end', spanName: 'ddl diff', status: 'ok' }),
    ]),
  );
});

test('perf run emits benchmark phase spans through the real CLI path', async () => {
  const workspace = createWorkspace('perf-run-telemetry');
  const sqlDir = path.join(workspace, 'src', 'sql');
  const perfDir = path.join(workspace, 'perf');
  mkdirSync(sqlDir, { recursive: true });
  mkdirSync(perfDir, { recursive: true });

  const sqlFile = path.join(sqlDir, 'sales.sql');
  const paramsFile = path.join(perfDir, 'params.yml');
  writeFileSync(
    sqlFile,
    [
      'select *',
      'from public.sales',
      'where region_id = :region_id'
    ].join('\n'),
    'utf8',
  );
  writeFileSync(paramsFile, ['params:', '  region_id: 77', ''].join('\n'), 'utf8');

  const telemetry = captureTelemetry();
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    void chunk;
    return true;
  }) as typeof process.stdout.write);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(
    [
      'node',
      'ztd',
      '--telemetry',
      'perf',
      'run',
      '--query',
      sqlFile,
      '--params',
      paramsFile,
      '--mode',
      'latency',
      '--dry-run',
    ],
    { from: 'node' },
  );

  telemetry.restore();
  stdoutSpy.mockRestore();

  const payloads = parseTelemetryPayloads(telemetry.lines);
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'perf run' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'resolve-perf-run-options' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'execute-perf-benchmark' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'render-perf-report' }),
      expect.objectContaining({ kind: 'span-end', spanName: 'perf run', status: 'ok' }),
    ]),
  );
});

test('perf run telemetry dogfood scenario preserves the benchmark investigation timeline', async () => {
  const workspace = createWorkspace('perf-run-telemetry-dogfood');
  const sqlDir = path.join(workspace, 'src', 'sql');
  const perfDir = path.join(workspace, 'perf');
  const telemetryFile = path.join(workspace, 'artifacts', 'perf-run.timeline.jsonl');
  mkdirSync(sqlDir, { recursive: true });
  mkdirSync(perfDir, { recursive: true });

  const sqlFile = path.join(sqlDir, 'sales.sql');
  const paramsFile = path.join(perfDir, 'params.yml');
  writeFileSync(
    sqlFile,
    [
      'with base_sales as (',
      '  select id, region_id',
      '  from public.sales',
      ')',
      'select *',
      'from base_sales',
      'where region_id = :region_id'
    ].join('\n'),
    'utf8',
  );
  writeFileSync(paramsFile, ['params:', '  region_id: 77', ''].join('\n'), 'utf8');

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    void chunk;
    return true;
  }) as typeof process.stdout.write);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(
    [
      'node',
      'ztd',
      '--telemetry',
      '--telemetry-export',
      'file',
      '--telemetry-file',
      telemetryFile,
      'perf',
      'run',
      '--query',
      sqlFile,
      '--params',
      paramsFile,
      '--mode',
      'latency',
      '--dry-run',
    ],
    { from: 'node' },
  );

  stdoutSpy.mockRestore();

  const payloads = readFileSync(telemetryFile, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(summarizeTelemetryTimeline(payloads, 'perf run')).toEqual([
    'start:perf run',
    'start:resolve-perf-run-options',
    'start:execute-perf-benchmark',
    'start:render-perf-report',
    'end:perf run:ok'
  ]);
});
