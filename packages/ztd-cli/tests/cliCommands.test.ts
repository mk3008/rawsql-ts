import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { expect, test } from 'vitest';
import { TAX_ALLOCATION_QUERY } from './utils/taxAllocationScenario';

const nodeExecutable = process.execPath;
const packageManagerExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const cliRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const cliEntry = path.join(cliRoot, 'dist', 'index.js');
let cliBuildPrepared = false;
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  // Ensure the shared tmp directory exists before deriving per-test folders.
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

const pgDumpCommand = process.env.PG_DUMP_BIN ?? 'pg_dump';

function ensureBuiltCli(): void {
  if (cliBuildPrepared) {
    return;
  }

  // Run the built CLI in tests so dogfooding follows the packaged command path and avoids ts-node path drift.
  const buildResult = spawnSync(packageManagerExecutable, ['--filter', '@rawsql-ts/ztd-cli', 'build'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (buildResult.error) {
    throw buildResult.error;
  }
  if (buildResult.status !== 0) {
    throw new Error(buildResult.stderr || buildResult.stdout || 'Failed to build ztd-cli before running CLI tests.');
  }

  cliBuildPrepared = true;
}

function commandExists(command: string): boolean {
  // Run --version to confirm the binary is callable before enabling DB tests.
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0 && !result.error;
}

function buildCliEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    // Copy the current environment so per-test mutations (e.g. DATABASE_URL) propagate to the CLI.
    ...process.env,
    NODE_ENV: 'test',
    ...overrides,
  };
}

function runCli(args: string[], envOverrides: NodeJS.ProcessEnv = {}, cwd: string = repoRoot): SpawnSyncReturns<string> {
  ensureBuiltCli();

  // Invoke the built CLI so the command path matches real dogfooding usage and stays stable across TypeScript upgrades.
  return spawnSync(nodeExecutable, [cliEntry, ...args], {
    cwd,
    env: buildCliEnv(envOverrides),
    encoding: 'utf8',

  });
}

function readNormalizedFile(filePath: string): string {
  const contents = readFileSync(filePath, 'utf8');
  // Normalize line endings so snapshots are stable across platforms.
  return contents.replace(/\r\n/g, '\n');
}

function normalizeSchemaDump(contents: string): string {
  // Normalize casing and strip quotes so pg_dump identifier quoting stays stable across versions.
  return contents.toLowerCase().replace(/"/g, '');
}

function assertCliSuccess(result: SpawnSyncReturns<string>, label?: string) {
  expect(result.error).toBeUndefined();
  const context = label ? `${label}: ` : '';
  expect(result.status, `${context}${result.stderr || result.stdout}`).toBe(0);
}

function assertCliFailure(result: SpawnSyncReturns<string>, label?: string) {
  expect(result.error).toBeUndefined();
  const context = label ? `${label}: ` : '';
  expect(result.status, `${context}${result.stderr || result.stdout}`).not.toBe(0);
}

function createSqlWorkspace(prefix: string, sqlRelativePath: string = path.join('src', 'sql', 'query.sql')): {
  rootDir: string;
  sqlRoot: string;
  sqlFile: string;
} {
  const rootDir = createTempDir(prefix);
  const sqlFile = path.join(rootDir, sqlRelativePath);
  const sqlRoot = path.join(rootDir, 'src', 'sql');
  mkdirSync(path.dirname(sqlFile), { recursive: true });
  return { rootDir, sqlRoot, sqlFile };
}

async function resetPublicSchema(client: Client) {
  // Recreate the public schema so pg_dump sees a predictable set of objects.
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

async function seedProductsTable(client: Client) {
  // Create a simple products table that the CLI pull command should capture.
  await client.query(`
    CREATE TABLE public.products (
      id serial PRIMARY KEY,
      name text NOT NULL,
      price decimal
    );
  `);
}

test(
  'ztd-config CLI produces the expected ztd-row-map.generated.ts snapshot',
  () => {
  const ddlDir = createTempDir('cli-gen-ddl');
  writeFileSync(
    path.join(ddlDir, 'tables.sql'),
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY,
        email text NOT NULL,
        score numeric
      );

      CREATE TABLE public.sessions (
        id bigint PRIMARY KEY,
        user_id int NOT NULL REFERENCES public.users(id),
        expires_at timestamptz NOT NULL
      );
    `,
    'utf8'
  );

  const outDir = createTempDir('cli-gen-out');
  const outputFile = path.join(outDir, 'ztd-row-map.generated.ts');

  const result = runCli(['ztd-config', '--ddl-dir', ddlDir, '--extensions', '.sql', '--out', outputFile]);
  assertCliSuccess(result, 'ztd-config');

  const content = readNormalizedFile(outputFile);
  expect(content).toMatchSnapshot();
  },
  60000,
);

test(
  'ztd-config CLI accepts --json payload and emits a JSON envelope in global json mode',
  () => {
  const ddlDir = createTempDir('cli-gen-ddl-json');
  writeFileSync(
    path.join(ddlDir, 'tables.sql'),
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY,
        email text NOT NULL
      );
    `,
    'utf8'
  );

  const outDir = createTempDir('cli-gen-out-json');
  const outputFile = path.join(outDir, 'ztd-row-map.generated.ts');
  const result = runCli([
    '--output',
    'json',
    'ztd-config',
    '--json',
    JSON.stringify({
      ddlDir,
      extensions: '.sql',
      out: outputFile,
      dryRun: true
    })
  ]);

  assertCliSuccess(result, 'ztd-config json');
  const parsed = JSON.parse(result.stdout);
  expect(parsed).toMatchObject({
    command: 'ztd-config',
    ok: true,
    data: {
      dryRun: true,
      outputs: expect.arrayContaining([
        expect.objectContaining({ path: outputFile, written: false })
      ])
    }
  });
  expect(existsSync(outputFile)).toBe(false);
  },
  60000,
);

test(
  'top-level help exposes model-gen as a first-class command',
  () => {
    const result = runCli(['--help']);
    assertCliSuccess(result, '--help');
    expect(result.stdout).toContain('model-gen [options] <sql-file>');
  },
  60000,
);

test(
  'describe command returns machine-readable metadata with global json output',
  () => {
    const result = runCli(['--output', 'json', 'describe', 'command', 'model-gen']);
    assertCliSuccess(result, 'describe command');
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      command: 'describe command',
      ok: true
    });
  },
  60000,
);

test(
  'check contract honors global json output without a local --format override',
  () => {
    const workspace = createTempDir('check-contract-global-json');
    mkdirSync(path.join(workspace, 'src', 'catalog', 'specs'), { recursive: true });
    mkdirSync(path.join(workspace, 'src', 'sql'), { recursive: true });
    writeFileSync(
      path.join(workspace, 'src', 'catalog', 'specs', 'ok.spec.json'),
      JSON.stringify({
        id: 'users.list',
        sqlFile: '../../sql/users.list.sql',
        params: { shape: 'named', example: { status: 'active' } }
      }, null, 2),
      'utf8'
    );
    writeFileSync(
      path.join(workspace, 'src', 'sql', 'users.list.sql'),
      'select user_id from users where status = :status',
      'utf8'
    );

    const result = runCli(['--output', 'json', 'check', 'contract'], { ZTD_PROJECT_ROOT: workspace }, workspace);

    assertCliSuccess(result, 'check contract global json');
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.violations).toEqual([]);
  },
  60000,
);

test(
  'lint CLI accepts --json payload and emits a JSON envelope in global json mode',
  () => {
    const workspace = createSqlWorkspace('lint-json-cli');
    writeFileSync(workspace.sqlFile, 'select 1 as value', 'utf8');
    writeFileSync(
      path.join(workspace.rootDir, 'ztd.config.json'),
      JSON.stringify({
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        ddl: {
          defaultSchema: 'public',
          searchPath: ['public']
        },
        ddlLint: 'strict'
      }, null, 2),
      'utf8'
    );
    mkdirSync(path.join(workspace.rootDir, 'ztd', 'ddl'), { recursive: true });
    writeFileSync(
      path.join(workspace.rootDir, 'ztd', 'ddl', 'public.sql'),
      'CREATE TABLE public.users (id integer PRIMARY KEY);',
      'utf8'
    );

    const result = runCli(
      ['--output', 'json', 'lint', '--json', JSON.stringify({ path: workspace.sqlFile })],
      {
        ZTD_LINT_DATABASE_URL: 'postgres://127.0.0.1:1/invalid',
        DATABASE_URL: ''
      },
      workspace.rootDir
    );

    assertCliFailure(result, 'lint json');
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      command: 'lint',
      ok: false,
      data: {
        filesChecked: 0,
        error: expect.stringContaining('Failed to connect to PostgreSQL for ztd lint.')
      }
    });
    expect(result.stderr).toContain('Failed to connect to PostgreSQL for ztd lint.');
  },
  60000,
);

test('init dry-run emits scaffold plan without writing files', { timeout: 60_000 }, () => {
  const workspace = createTempDir('init-dry-run');
  const result = runCli(['--output', 'json', 'init', '--dry-run', '--workflow', 'demo', '--validator', 'zod'], {}, workspace);
  assertCliSuccess(result, 'init dry-run');
  const parsed = JSON.parse(result.stdout);
  expect(parsed.data).toMatchObject({
    dryRun: true,
    workflow: 'demo',
    validator: 'zod'
  });
  expect(existsSync(path.join(workspace, 'ztd.config.json'))).toBe(false);
});

test('init CLI writes internal agent guidance by default and no visible AGENTS files', { timeout: 60_000 }, () => {
  const workspace = createTempDir('init-default-internal-agents');
  const result = runCli(['init', '--yes', '--workflow', 'empty', '--validator', 'zod'], {}, workspace);

    assertCliSuccess(result, 'init default agents');
    expect(result.stdout).toContain('Internal guidance is managed under .ztd/agents/.');
    expect(result.stdout).toContain('Enable with: ztd agents install');
    expect(existsSync(path.join(workspace, '.ztd', 'agents', 'manifest.json'))).toBe(true);
    expect(existsSync(path.join(workspace, '.ztd', 'agents', 'root.md'))).toBe(true);
    expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(false);
    expect(existsSync(path.join(workspace, 'AGENTS_ztd.md'))).toBe(false);
    expect(existsSync(path.join(workspace, 'ztd', 'AGENTS.md'))).toBe(false);
  },
  60000,
);

test('agents install emits the visible AGENTS plan and materializes the files', { timeout: 60_000 }, () => {
  const workspace = createTempDir('agents-install');
  assertCliSuccess(runCli(['init', '--yes', '--workflow', 'empty', '--validator', 'zod'], {}, workspace), 'init before install');

  const result = runCli(['agents', 'install'], {}, workspace);
  assertCliSuccess(result, 'agents install');
  expect(result.stdout).toContain('About to create:');
  expect(result.stdout).toContain('No files will be overwritten.');
  expect(result.stdout).toContain('Disable with: skip `ztd agents install`');
  expect(result.stdout).toContain('AGENTS.md');
  expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'AGENTS.md'))).toBe(true);
});

test('agents install preserves an existing root AGENTS.md and falls back to AGENTS_ztd.md', { timeout: 60_000 }, () => {
  const workspace = createTempDir('agents-install-root-fallback');
  assertCliSuccess(runCli(['init', '--yes', '--workflow', 'empty', '--validator', 'zod'], {}, workspace), 'init before fallback install');
  writeFileSync(path.join(workspace, 'AGENTS.md'), '# existing root\n', 'utf8');

  const result = runCli(['agents', 'install'], {}, workspace);
  assertCliSuccess(result, 'agents install fallback');
  expect(result.stdout).toContain('AGENTS_ztd.md');
  expect(readNormalizedFile(path.join(workspace, 'AGENTS.md'))).toBe('# existing root\n');
  expect(existsSync(path.join(workspace, 'AGENTS_ztd.md'))).toBe(true);
});

test('agents status reports internal files and visible install recommendation before install', { timeout: 60_000 }, () => {
  const workspace = createTempDir('agents-status');
  assertCliSuccess(runCli(['init', '--yes', '--workflow', 'empty', '--validator', 'zod'], {}, workspace), 'init before status');

  const result = runCli(['--output', 'json', 'agents', 'status'], {}, workspace);
  assertCliSuccess(result, 'agents status');
  const parsed = JSON.parse(result.stdout);
  expect(parsed.data).toMatchObject({
    recommended_actions: expect.arrayContaining(['install-visible-agents']),
    targets: expect.arrayContaining([
      expect.objectContaining({
        path: '.ztd/agents/manifest.json',
        installed: true,
        managed: true,
        drift: 'none'
      }),
      expect.objectContaining({
        path: 'AGENTS.md',
        installed: false,
        managed: false,
        drift: 'none'
      })
    ])
  });
});




test('top-level help exposes perf init as an opt-in sandbox workflow', () => {
  const result = runCli(['--help']);

  assertCliSuccess(result, '--help perf');
  expect(result.stdout).toContain('perf init');
  expect(result.stdout).toContain('opt-in perf sandbox');
});

test('describe command reports perf init metadata in global json mode', () => {
  const result = runCli(['--output', 'json', 'describe', 'command', 'perf init']);

  assertCliSuccess(result, 'describe perf init');
  const parsed = JSON.parse(result.stdout);
  expect(parsed).toMatchObject({
    command: 'describe command',
    ok: true,
    data: {
      command: {
        name: 'perf init',
        supportsDryRun: true,
        supportsJsonPayload: true,
        writesFiles: true
      }
    }
  });
});
test('perf init dry-run emits the planned sandbox scaffold in global json mode', () => {
  const workspace = createTempDir('perf-init-dry-run');
  const result = runCli(['--output', 'json', 'perf', 'init', '--dry-run'], {}, workspace);

  assertCliSuccess(result, 'perf init dry-run');
  const parsed = JSON.parse(result.stdout);
  expect(parsed).toMatchObject({
    command: 'perf init',
    ok: true,
    data: {
      dryRun: true,
      files: expect.arrayContaining([
        'perf/sandbox.json',
        'perf/seed.yml',
        'perf/docker-compose.yml'
      ])
    }
  });
  expect(existsSync(path.join(workspace, 'perf', 'sandbox.json'))).toBe(false);
});

test('perf init writes the sandbox scaffold files', () => {
  const workspace = createTempDir('perf-init-write');
  const result = runCli(['perf', 'init'], {}, workspace);

  assertCliSuccess(result, 'perf init');
  expect(result.stdout).toContain('Perf sandbox initialized.');
  expect(existsSync(path.join(workspace, 'perf', 'sandbox.json'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'perf', 'seed.yml'))).toContain('seed: 496');
  expect(readNormalizedFile(path.join(workspace, 'perf', 'docker-compose.yml'))).toContain('perf-db');
});

test('perf db reset dry-run lists DDL files without touching Docker', () => {
  const workspace = createTempDir('perf-reset-dry-run');
  mkdirSync(path.join(workspace, 'ztd', 'ddl'), { recursive: true });
  writeFileSync(
    path.join(workspace, 'ztd.config.json'),
    JSON.stringify({
      dialect: 'postgres',
      ddlDir: 'ztd/ddl',
      testsDir: 'tests',
      ddl: { defaultSchema: 'public', searchPath: ['public'] },
      ddlLint: 'strict'
    }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(workspace, 'ztd', 'ddl', 'public.sql'), 'create table public.users (id integer primary key);', 'utf8');

  const result = runCli(['--output', 'json', 'perf', 'db', 'reset', '--dry-run'], {}, workspace);

  assertCliSuccess(result, 'perf db reset dry-run');
  const parsed = JSON.parse(result.stdout);
  expect(parsed.data).toMatchObject({
    dryRun: true,
    ddl_file_count: 1,
    ddl_files: ['ztd/ddl/public.sql']
  });
});



test('perf seed output redacts connection credentials in global json mode', () => {
  const workspace = createTempDir('perf-seed-redact');
  mkdirSync(path.join(workspace, 'ztd', 'ddl'), { recursive: true });
  mkdirSync(path.join(workspace, 'perf'), { recursive: true });
  writeFileSync(
    path.join(workspace, 'ztd.config.json'),
    JSON.stringify({
      dialect: 'postgres',
      ddlDir: 'ztd/ddl',
      testsDir: 'tests',
      ddl: { defaultSchema: 'public', searchPath: ['public'] },
      ddlLint: 'strict'
    }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(workspace, 'ztd', 'ddl', 'public.sql'), 'create table public.users (id integer primary key);', 'utf8');
  writeFileSync(path.join(workspace, 'perf', 'seed.yml'), [
    'seed: 999',
    'tables:',
    '  users:',
    '    rows: 1',
    'columns:',
    ''
  ].join('\n'), 'utf8');

  const result = runCli(
    ['--output', 'json', 'perf', 'seed'],
    { ZTD_PERF_DATABASE_URL: 'postgres://perf_user:perf_pass@127.0.0.1:1/ztd_perf' },
    workspace
  );

  assertCliFailure(result, 'perf seed redaction');
  expect(result.stderr).not.toContain('perf_pass');
});
test('perf db reset refuses implicit DATABASE_URL without explicit perf opt-in', () => {
  const workspace = createTempDir('perf-reset-safety');
  mkdirSync(path.join(workspace, 'ztd', 'ddl'), { recursive: true });
  writeFileSync(
    path.join(workspace, 'ztd.config.json'),
    JSON.stringify({
      dialect: 'postgres',
      ddlDir: 'ztd/ddl',
      testsDir: 'tests',
      ddl: { defaultSchema: 'public', searchPath: ['public'] },
      ddlLint: 'strict'
    }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(workspace, 'ztd', 'ddl', 'public.sql'), 'create table public.users (id integer primary key);', 'utf8');

  const result = runCli(
    ['perf', 'db', 'reset'],
    { DATABASE_URL: 'postgres://app.example/db', ZTD_PERF_DATABASE_URL: '' },
    workspace
  );

  assertCliFailure(result, 'perf db reset safety');
  expect(result.stderr).toContain('Perf sandbox ignores DATABASE_URL');
  expect(result.stderr).toContain('ZTD_PERF_DATABASE_URL');
});

test('perf seed dry-run rejects unknown tables from perf seed config', () => {
  const workspace = createTempDir('perf-seed-invalid-table');
  mkdirSync(path.join(workspace, 'ztd', 'ddl'), { recursive: true });
  mkdirSync(path.join(workspace, 'perf'), { recursive: true });
  writeFileSync(
    path.join(workspace, 'ztd.config.json'),
    JSON.stringify({
      dialect: 'postgres',
      ddlDir: 'ztd/ddl',
      testsDir: 'tests',
      ddl: { defaultSchema: 'public', searchPath: ['public'] },
      ddlLint: 'strict'
    }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(workspace, 'ztd', 'ddl', 'public.sql'), 'create table public.users (id integer primary key);', 'utf8');
  writeFileSync(path.join(workspace, 'perf', 'seed.yml'), [
    'seed: 999',
    'tables:',
    '  missing_table:',
    '    rows: 3',
    'columns:',
    ''
  ].join('\n'), 'utf8');

  const result = runCli(['perf', 'seed', '--dry-run'], {}, workspace);

  assertCliFailure(result, 'perf seed dry-run invalid table');
  expect(result.stderr).toContain('No table definition found for perf seed table: missing_table');
});
test('perf seed dry-run reports deterministic row counts from perf seed config', () => {
  const workspace = createTempDir('perf-seed-dry-run');
  mkdirSync(path.join(workspace, 'ztd', 'ddl'), { recursive: true });
  mkdirSync(path.join(workspace, 'perf'), { recursive: true });
  writeFileSync(
    path.join(workspace, 'ztd.config.json'),
    JSON.stringify({
      dialect: 'postgres',
      ddlDir: 'ztd/ddl',
      testsDir: 'tests',
      ddl: { defaultSchema: 'public', searchPath: ['public'] },
      ddlLint: 'strict'
    }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(workspace, 'ztd', 'ddl', 'public.sql'), [
    'create table public.users (',
    '  id integer primary key,',
    '  status text not null,',
    '  score numeric',
    ');'
  ].join('\n'), 'utf8');
  writeFileSync(path.join(workspace, 'perf', 'seed.yml'), [
    'seed: 999',
    'tables:',
    '  users:',
    '    rows: 3',
    'columns:',
    '  public.users.status:',
    '    values: [active, inactive]',
    '    skew: 0.8',
    ''
  ].join('\n'), 'utf8');

  const result = runCli(['--output', 'json', 'perf', 'seed', '--dry-run'], {}, workspace);

  assertCliSuccess(result, 'perf seed dry-run');
  const parsed = JSON.parse(result.stdout);
  expect(parsed.data).toMatchObject({
    dryRun: true,
    seed: 999,
    tables: {
      'public.users': 3
    }
  });
});
test('query outline summarizes CTE dependencies and unused CTEs', () => {
  const workspace = createSqlWorkspace('query-outline', path.join('src', 'sql', 'reports', 'ranked_users.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with users_base as (
        select id, region_id from public.users
      ),
      filtered_users as (
        select id from users_base where region_id in (
          select id from public.regions where active = true
        )
      ),
      purchase_summary as (
        select o.user_id, count(*) as order_count
        from public.orders o
        join filtered_users fu on fu.id = o.user_id
        group by o.user_id
      ),
      ranked_users as (
        select ps.user_id, ps.order_count
        from purchase_summary ps
      ),
      unused_cte as (
        select * from public.audit_log
      )
      select * from ranked_users
    `,
    'utf8'
  );

  const result = runCli(['query', 'outline', workspace.sqlFile], {}, workspace.rootDir);
  assertCliSuccess(result, 'query outline');
  expect(result.stdout).toContain('Query type: SELECT');
  expect(result.stdout).toContain('CTE count: 5');
  expect(result.stdout).toContain('4. ranked_users');
  expect(result.stdout).toContain('5. unused_cte [unused]');
  expect(result.stdout).toContain('depends_on: purchase_summary');
  expect(result.stdout).toContain('Final query target:');
  expect(result.stdout).toContain('ranked_users');
  expect(result.stdout).toContain('public.audit_log');
  expect(result.stdout).toContain('Unused CTEs:');
  expect(result.stdout).toContain('unused_cte');
});

test('query graph defaults to text output', () => {
  const workspace = createSqlWorkspace('query-graph-text', path.join('src', 'sql', 'graph.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with base_data as (
        select id from public.users
      ),
      final_data as (
        select id from base_data
      )
      select * from final_data
    `,
    'utf8'
  );

  const result = runCli(['query', 'graph', workspace.sqlFile], {}, workspace.rootDir);
  assertCliSuccess(result, 'query graph text');
  expect(result.stdout).toContain('Query type: SELECT');
  expect(result.stdout).toContain('Final query target:');
  expect(result.stdout).toContain('final_data');
});

test('query graph emits machine-readable JSON when requested', () => {
  const workspace = createSqlWorkspace('query-graph-json', path.join('src', 'sql', 'graph.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with base_data as (
        select id from public.users
      ),
      filtered_data as (
        select id from base_data
      ),
      unused_data as (
        select id from public.audit_log
      )
      select * from filtered_data
    `,
    'utf8'
  );

  const result = runCli(['query', 'graph', workspace.sqlFile, '--format', 'json'], {}, workspace.rootDir);
  assertCliSuccess(result, 'query graph json');
  const payload = JSON.parse(result.stdout);
  expect(payload.query_type).toBe('SELECT');
  expect(payload.final_query).toBe('filtered_data');
  expect(payload.unused_ctes).toEqual(['unused_data']);
  expect(payload.ctes).toEqual([
    {
      name: 'base_data',
      depends_on: [],
      used_by_final_query: true,
      unused: false
    },
    {
      name: 'filtered_data',
      depends_on: ['base_data'],
      used_by_final_query: true,
      unused: false
    },
    {
      name: 'unused_data',
      depends_on: [],
      used_by_final_query: false,
      unused: true
    }
  ]);
});

test('query graph preserves multiple direct roots in final_query', () => {
  const workspace = createSqlWorkspace('query-graph-multi-root', path.join('src', 'sql', 'graph.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with left_data as (
        select id from public.users
      ),
      right_data as (
        select id from public.orders
      )
      select ld.id, rd.id
      from left_data ld
      join right_data rd on rd.id = ld.id
    `,
    'utf8'
  );

  const result = runCli(['query', 'graph', workspace.sqlFile, '--format', 'json'], {}, workspace.rootDir);
  assertCliSuccess(result, 'query graph multi-root');
  const payload = JSON.parse(result.stdout);
  expect(payload.final_query).toBe('left_data, right_data');
});


test('query plan emits deterministic text steps from material and scalar filter metadata', () => {
  const workspace = createSqlWorkspace('query-plan-text', path.join('src', 'sql', 'plan.sql'));
  writeFileSync(
    workspace.sqlFile,
    [
      'with base_users as (',
      '  select id, region_id from public.users',
      '),',
      'filtered_users as (',
      '  select id from base_users where region_id is not null',
      '),',
      'ranked_users as (',
      '  select id from filtered_users',
      ')',
      'select * from ranked_users',
      'where sale_date > (',
      '  select p.closed_year_month from public.parameters p',
      ')'
    ].join('\n'),
    'utf8'
  );

  const result = runCli([
    'query',
    'plan',
    workspace.sqlFile,
    '--material',
    'ranked_users,filtered_users',
    '--scalar-filter-column',
    'sale_date'
  ], {}, workspace.rootDir);
  assertCliSuccess(result, 'query plan text');
  expect(result.stdout).toContain('Query type: SELECT');
  expect(result.stdout).toContain('Material CTEs: ranked_users, filtered_users');
  expect(result.stdout).toContain('Scalar filter columns: sale_date');
  expect(result.stdout).toContain('1. materialize filtered_users');
  expect(result.stdout).toContain('2. materialize ranked_users');
  expect(result.stdout).toContain('3. run final query');
});

test('query plan accepts JSON metadata and emits machine-readable JSON', () => {
  const workspace = createSqlWorkspace('query-plan-json', path.join('src', 'sql', 'plan.sql'));
  writeFileSync(
    workspace.sqlFile,
    [
      'with base_users as (',
      '  select id from public.users',
      '),',
      'filtered_users as (',
      '  select id from base_users',
      ')',
      'select * from filtered_users'
    ].join('\n'),
    'utf8'
  );

  const result = runCli([
    'query',
    'plan',
    workspace.sqlFile,
    '--json',
    JSON.stringify({
      format: 'json',
      material: ['filtered_users'],
      scalarFilterColumns: ['sale_date']
    })
  ], {}, workspace.rootDir);
  assertCliSuccess(result, 'query plan json');
  const payload = JSON.parse(result.stdout);
  expect(payload.query_type).toBe('SELECT');
  expect(payload.metadata).toEqual({
    material: ['filtered_users'],
    scalarFilterColumns: ['sale_date']
  });
  expect(payload.steps).toEqual([
    {
      step: 1,
      kind: 'materialize',
      target: 'filtered_users',
      depends_on: ['base_users']
    },
    {
      step: 2,
      kind: 'final-query',
      target: 'FINAL_QUERY',
      depends_on: ['filtered_users']
    }
  ]);
});
test('query plan exposes the tax allocation dogfood pipeline in text mode', () => {
  const workspace = createSqlWorkspace('query-plan-tax-allocation', path.join('src', 'sql', 'reports', 'tax_allocation.sql'));
  writeFileSync(workspace.sqlFile, TAX_ALLOCATION_QUERY, 'utf8');

  const result = runCli([
    'query',
    'plan',
    workspace.sqlFile,
    '--material',
    'input_lines,floored_allocations,ranked_allocations',
    '--scalar-filter-column',
    'allocation_rank'
  ], {}, workspace.rootDir);

  assertCliSuccess(result, 'query plan tax allocation');
  expect(result.stdout).toContain('Material CTEs: input_lines, floored_allocations, ranked_allocations');
  expect(result.stdout).toContain('Scalar filter columns: allocation_rank');
  expect(result.stdout).toContain('1. materialize input_lines');
  expect(result.stdout).toContain('2. materialize floored_allocations');
  expect(result.stdout).toContain('3. materialize ranked_allocations');
  expect(result.stdout).toContain('4. run final query');
});

test('query outline supports DML statements with CTE analysis', () => {
  const workspace = createSqlWorkspace('query-outline-insert', path.join('src', 'sql', 'insert_report.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with source_rows as (
        select id from public.users
      ),
      unused_rows as (
        select id from public.audit_log
      )
      insert into public.user_report (user_id)
      select id from source_rows
    `,
    'utf8'
  );

  const result = runCli(['query', 'outline', workspace.sqlFile], {}, workspace.rootDir);
  assertCliSuccess(result, 'query outline insert');
  expect(result.stdout).toContain('Query type: INSERT');
  expect(result.stdout).toContain('CTE count: 2');
  expect(result.stdout).toContain('1. source_rows');
  expect(result.stdout).toContain('2. unused_rows [unused]');
  expect(result.stdout).toContain('Final query target:');
  expect(result.stdout).toContain('source_rows');
  expect(result.stdout).toContain('public.audit_log');
  expect(result.stdout).toContain('unused_rows');
});

test('model-gen rejects positional placeholders by default and recommends named params', () => {
  const workspace = createSqlWorkspace('model-gen-positional-error');
  writeFileSync(workspace.sqlFile, 'select * from users where id = $1', 'utf8');

  const result = runCli(['model-gen', workspace.sqlFile, '--sql-root', workspace.sqlRoot], {}, workspace.rootDir);
  assertCliFailure(result, 'model-gen positional');
  expect(result.stderr).toContain('Detected positional placeholders ($1, $2, ...)');
  expect(result.stderr).toContain('must use named parameters (:name) by policy');
  expect(result.stderr).toContain('--allow-positional');
});

test('model-gen describe-output emits contract metadata without probing', () => {
  const workspace = createSqlWorkspace('model-gen-describe-output');
  writeFileSync(workspace.sqlFile, 'select 1 as value', 'utf8');

  const result = runCli(
    ['--output', 'json', 'model-gen', workspace.sqlFile, '--sql-root', workspace.sqlRoot, '--describe-output'],
    {},
    workspace.rootDir
  );
  assertCliSuccess(result, 'model-gen describe-output');
  const parsed = JSON.parse(result.stdout);
  expect(parsed.data).toMatchObject({
    command: 'model-gen',
    outputs: {
      spec: 'TypeScript QuerySpec scaffold'
    }
  });
});

test('model-gen rejects sql files outside the configured sql root', () => {
  const workspace = createSqlWorkspace('model-gen-root-error');
  const externalSql = path.join(workspace.rootDir, 'outside.sql');
  writeFileSync(externalSql, 'select 1 as value', 'utf8');

  const result = runCli(['model-gen', externalSql, '--sql-root', workspace.sqlRoot], {}, workspace.rootDir);
  assertCliFailure(result, 'model-gen root');
  expect(result.stderr).toContain('outside the configured sql root');
  expect(result.stderr).toContain('--sql-root');
});

test('model-gen rejects spec id collisions before probing the database', () => {
  const workspace = createSqlWorkspace('model-gen-spec-id-collision');
  writeFileSync(workspace.sqlFile, 'select 1 as value', 'utf8');
  const specsDir = path.join(workspace.rootDir, 'src', 'catalog', 'specs');
  mkdirSync(specsDir, { recursive: true });
  const collisionFile = path.join(specsDir, 'query.spec.ts');
  writeFileSync(collisionFile, "export const existing = { id: 'query' };\n", 'utf8');

  const result = runCli(['model-gen', workspace.sqlFile, '--sql-root', workspace.sqlRoot], {}, workspace.rootDir);
  assertCliFailure(result, 'model-gen collision');
  expect(result.stderr).toContain('conflicts with an existing spec');
  expect(result.stderr).toContain('does not auto-rename collisions');
});

const hasPgDump = commandExists(pgDumpCommand);
const hasConnection = Boolean(process.env.TEST_PG_URI);
const shouldRunDbTests = hasPgDump && hasConnection;
const skipReasons: string[] = [];
if (!hasPgDump) {
  skipReasons.push(`${pgDumpCommand} is missing from PATH`);
}
if (!hasConnection) {
  skipReasons.push('TEST_PG_URI is not set');
}
if (!shouldRunDbTests) {
  console.warn(`Skipping DB-dependent CLI tests: ${skipReasons.join('; ')}.`);
}
const pullTest = shouldRunDbTests ? test.sequential : test.skip;

pullTest('pull CLI emits schema from Postgres via pg_dump', async () => {
  // TEST_PG_URI must point to a disposable Postgres instance because the test drops public schema.
  const connectionString = process.env.TEST_PG_URI!;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await resetPublicSchema(client);
    await seedProductsTable(client);

    const outDir = createTempDir('cli-pull');
    const result = runCli(['ddl', 'pull', '--out', outDir], { DATABASE_URL: connectionString });
    assertCliSuccess(result, 'ddl pull');
    const schemaFile = path.join(outDir, 'public.sql');
    expect(existsSync(schemaFile)).toBe(true);
    const schema = readNormalizedFile(schemaFile);
    expect(existsSync(path.join(outDir, 'schemas'))).toBe(false);
    const normalizedSchema = normalizeSchemaDump(schema);
    expect(normalizedSchema).toContain('create schema public;');
    expect(normalizedSchema).toContain('create table public.products');
    // Ensure pg_dump SET statements are removed without blocking ALTER ... SET DEFAULT.
    expect(normalizedSchema).not.toMatch(/(^|\n)set\s+/);
    expect(existsSync(path.join(outDir, 'schema.sql'))).toBe(false);
  } finally {
    await resetPublicSchema(client);
    await client.end();
  }
}, 60_000);

pullTest('pull CLI dry-run validates dump without writing files', async () => {
  const connectionString = process.env.TEST_PG_URI!;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await resetPublicSchema(client);
    await seedProductsTable(client);

    const outDir = createTempDir('cli-pull-dry-run');
    const result = runCli(['--output', 'json', 'ddl', 'pull', '--out', outDir, '--dry-run'], { DATABASE_URL: connectionString });
    assertCliSuccess(result, 'ddl pull dry-run');
    const parsed = JSON.parse(result.stdout);
    expect(parsed.data).toMatchObject({
      dryRun: true,
      files: [expect.objectContaining({ schema: 'public' })]
    });
    expect(existsSync(path.join(outDir, 'public.sql'))).toBe(false);
  } finally {
    await resetPublicSchema(client);
    await client.end();
  }
}, 60_000);

pullTest('model-gen emits a names-first spec scaffold from live Postgres metadata', async () => {
  const connectionString = process.env.TEST_PG_URI!;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await resetPublicSchema(client);
    await client.query(`
      CREATE TABLE public.products (
        id serial PRIMARY KEY,
        name text NOT NULL,
        price numeric NOT NULL
      );
    `);

    const workspace = createSqlWorkspace('model-gen-named', path.join('src', 'sql', 'sales', 'get_sales_header.sql'));
    writeFileSync(
      workspace.sqlFile,
      `
        select
          p.id as product_id,
          p.name as product_name,
          p.price as list_price
        from public.products p
        where p.id = :product_id
      `,
      'utf8'
    );
    const outFile = path.join(workspace.rootDir, 'product.spec.ts');
    const result = runCli(
      ['model-gen', workspace.sqlFile, '--sql-root', workspace.sqlRoot, '--out', outFile, '--debug-probe'],
      { DATABASE_URL: connectionString },
      workspace.rootDir
    );

    assertCliSuccess(result, 'model-gen named');
    const content = readNormalizedFile(outFile);
    expect(content).toContain('export interface GetSalesHeaderRow');
    expect(content).toContain("productId: 'product_id'");
    expect(content).toContain("listPrice: 'list_price'");
    expect(content).toContain("params: { shape: 'named', example: { product_id: null } }");
    expect(result.stderr).toContain('[model-gen] probe debug');
    expect(result.stderr).toContain('orderedParamNames: ["product_id"]');
    expect(result.stderr).toContain('probeSql: SELECT * FROM (');
    expect(result.stdout).toBe('');
  } finally {
    await resetPublicSchema(client);
    await client.end();
  }
}, 60_000);

pullTest('model-gen emits a spec scaffold from ZTD DDL metadata without physical tables', async () => {
  const connectionString = process.env.TEST_PG_URI!;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await resetPublicSchema(client);
    const existsBefore = await client.query<{ name: string | null }>(
      "select to_regclass('public.products') as name"
    );
    expect(existsBefore.rows[0]?.name).toBeNull();

    const workspace = createSqlWorkspace('model-gen-ztd', path.join('src', 'sql', 'sales', 'get_sales_header.sql'));
    const ddlDir = path.join(workspace.rootDir, 'ztd', 'ddl');
    mkdirSync(ddlDir, { recursive: true });
    writeFileSync(
      path.join(ddlDir, 'public.sql'),
      `
        CREATE TABLE public.products (
          id serial PRIMARY KEY,
          name text NOT NULL,
          price numeric NOT NULL
        );
      `,
      'utf8'
    );
    writeFileSync(
      path.join(workspace.rootDir, 'ztd.config.json'),
      JSON.stringify({
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        ddl: {
          defaultSchema: 'public',
          searchPath: ['public']
        },
        ddlLint: 'strict'
      }, null, 2),
      'utf8'
    );
    writeFileSync(
      workspace.sqlFile,
      `
        select
          p.id as product_id,
          p.name as product_name,
          p.price as list_price
        from public.products p
        where p.id = :product_id
      `,
      'utf8'
    );
    const outFile = path.join(workspace.rootDir, 'product-ztd.spec.ts');
    const result = runCli(
      ['model-gen', workspace.sqlFile, '--sql-root', workspace.sqlRoot, '--probe-mode', 'ztd', '--out', outFile, '--debug-probe'],
      { DATABASE_URL: connectionString },
      workspace.rootDir
    );

    assertCliSuccess(result, 'model-gen ztd');
    const content = readNormalizedFile(outFile);
    expect(content).toContain('export interface GetSalesHeaderRow');
    expect(content).toContain("productId: 'product_id'");
    expect(content).toContain("params: { shape: 'named', example: { product_id: null } }");
    expect(result.stderr).toContain('probeMode: ztd');
    expect(result.stderr).toContain('ddlDir: ztd/ddl');

    const existsAfter = await client.query<{ name: string | null }>(
      "select to_regclass('public.products') as name"
    );
    expect(existsAfter.rows[0]?.name).toBeNull();
  } finally {
    await resetPublicSchema(client);
    await client.end();
  }
}, 60_000);

pullTest('model-gen ztd resolves unqualified table names through defaultSchema/searchPath', async () => {
  const connectionString = process.env.TEST_PG_URI!;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await resetPublicSchema(client);

    const workspace = createSqlWorkspace('model-gen-ztd-unqualified', path.join('src', 'sql', 'users', 'list_users.sql'));
    const ddlDir = path.join(workspace.rootDir, 'ztd', 'ddl');
    mkdirSync(ddlDir, { recursive: true });
    writeFileSync(
      path.join(ddlDir, 'public.sql'),
      `
        CREATE TABLE public.users (
          user_id integer PRIMARY KEY,
          email text NOT NULL
        );
      `,
      'utf8'
    );
    writeFileSync(
      path.join(workspace.rootDir, 'ztd.config.json'),
      JSON.stringify({
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        ddl: {
          defaultSchema: 'public',
          searchPath: ['public']
        },
        ddlLint: 'strict'
      }, null, 2),
      'utf8'
    );
    writeFileSync(
      workspace.sqlFile,
      `
        select
          user_id,
          email
        from users
        where user_id = :user_id
      `,
      'utf8'
    );
    const outFile = path.join(workspace.rootDir, 'users-ztd.spec.ts');
    const result = runCli(
      ['model-gen', workspace.sqlFile, '--sql-root', workspace.sqlRoot, '--probe-mode', 'ztd', '--out', outFile, '--debug-probe'],
      { DATABASE_URL: connectionString },
      workspace.rootDir
    );

    assertCliSuccess(result, 'model-gen ztd unqualified');
    const content = readNormalizedFile(outFile);
    expect(content).toContain('export interface ListUsersRow');
    expect(content).toContain("userId: 'user_id'");
    expect(content).toContain("email: 'email'");
    expect(result.stderr).toContain('searchPath: ["public"]');
  } finally {
    await resetPublicSchema(client);
    await client.end();
  }
}, 60_000);

pullTest('model-gen ztd honors searchPath precedence for unqualified table names', async () => {
  const connectionString = process.env.TEST_PG_URI!;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await resetPublicSchema(client);

    const workspace = createSqlWorkspace('model-gen-ztd-search-path', path.join('src', 'sql', 'users', 'current_users.sql'));
    const ddlDir = path.join(workspace.rootDir, 'ztd', 'ddl');
    mkdirSync(ddlDir, { recursive: true });
    writeFileSync(
      path.join(ddlDir, 'schemas.sql'),
      `
        CREATE SCHEMA app;

        CREATE TABLE app.users (
          account_id integer PRIMARY KEY,
          handle text NOT NULL
        );

        CREATE TABLE public.users (
          user_id integer PRIMARY KEY,
          email text NOT NULL
        );
      `,
      'utf8'
    );
    writeFileSync(
      path.join(workspace.rootDir, 'ztd.config.json'),
      JSON.stringify({
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        ddl: {
          defaultSchema: 'app',
          searchPath: ['app', 'public']
        },
        ddlLint: 'strict'
      }, null, 2),
      'utf8'
    );
    writeFileSync(
      workspace.sqlFile,
      `
        select
          account_id,
          handle
        from users
        where account_id = :account_id
      `,
      'utf8'
    );
    const outFile = path.join(workspace.rootDir, 'current-users-ztd.spec.ts');
    const result = runCli(
      ['model-gen', workspace.sqlFile, '--sql-root', workspace.sqlRoot, '--probe-mode', 'ztd', '--out', outFile, '--debug-probe'],
      { DATABASE_URL: connectionString },
      workspace.rootDir
    );

    assertCliSuccess(result, 'model-gen ztd search-path');
    const content = readNormalizedFile(outFile);
    expect(content).toContain("accountId: 'account_id'");
    expect(content).toContain("handle: 'handle'");
    expect(content).toContain('export interface CurrentUsersRow');
    expect(result.stderr).toContain('defaultSchema: app');
    expect(result.stderr).toContain('searchPath: ["app","public"]');
  } finally {
    await resetPublicSchema(client);
    await client.end();
  }
}, 60_000);

pullTest('model-gen allows legacy positional placeholders only behind --allow-positional', async () => {
  const connectionString = process.env.TEST_PG_URI!;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await resetPublicSchema(client);
    await client.query(`
      CREATE TABLE public.products (
        id serial PRIMARY KEY,
        name text NOT NULL
      );
    `);

    const workspace = createSqlWorkspace('model-gen-positional');
    writeFileSync(
      workspace.sqlFile,
      `
        select
          p.id as product_id,
          p.name as product_name
        from public.products p
        where p.id = $1
      `,
      'utf8'
    );
    const outFile = path.join(workspace.rootDir, 'product-positional.spec.ts');
    const result = runCli(
      ['model-gen', workspace.sqlFile, '--sql-root', workspace.sqlRoot, '--allow-positional', '--out', outFile],
      { DATABASE_URL: connectionString },
      workspace.rootDir
    );

    assertCliSuccess(result, 'model-gen positional');
    const content = readNormalizedFile(outFile);
    expect(content).toContain('Legacy warning');
    expect(content).toContain("params: { shape: 'positional', example: [null] }");
  } finally {
    await resetPublicSchema(client);
    await client.end();
  }
}, 60_000);

test('query patch apply previews a targeted CTE replacement without writing', () => {
  const workspace = createSqlWorkspace('query-patch-preview', path.join('src', 'sql', 'reports', 'sales.sql'));
  const editedFile = path.join(workspace.rootDir, 'edited.sql');
  writeFileSync(
    workspace.sqlFile,
    `
      with users_base as (
        select id, region_id from public.users
      ),
      purchase_summary as (
        select id from users_base
      )
      select * from purchase_summary
    `,
    'utf8'
  );
  writeFileSync(
    editedFile,
    `
      with users_base as (
        select id, region_id from public.users
      ),
      purchase_summary as (
        select id from users_base where region_id = 1
      )
      select * from purchase_summary
    `,
    'utf8'
  );
  const before = readNormalizedFile(workspace.sqlFile);

  const result = runCli(
    ['query', 'patch', 'apply', workspace.sqlFile, '--cte', 'purchase_summary', '--from', editedFile, '--preview'],
    {},
    workspace.rootDir
  );

  assertCliSuccess(result, 'query patch preview');
  expect(result.stdout).toContain('--- ');
  expect(result.stdout).toContain('+++ ');
  expect(result.stdout).toContain('"region_id" = 1');
  expect(readNormalizedFile(workspace.sqlFile)).toBe(before);
});

test('query patch apply writes the patched SQL to --out and supports global json output', () => {
  const workspace = createSqlWorkspace('query-patch-json', path.join('src', 'sql', 'reports', 'sales.sql'));
  const editedFile = path.join(workspace.rootDir, 'edited.sql');
  const outputFile = path.join(workspace.rootDir, 'patched.sql');
  writeFileSync(
    workspace.sqlFile,
    `
      with purchase_summary as (
        select id from public.users
      )
      select * from purchase_summary
    `,
    'utf8'
  );
  writeFileSync(
    editedFile,
    'purchase_summary (user_id) as materialized (select id as user_id from public.users)',
    'utf8'
  );

  const result = runCli(
    ['--output', 'json', 'query', 'patch', 'apply', workspace.sqlFile, '--cte', 'purchase_summary', '--from', editedFile, '--out', outputFile],
    {},
    workspace.rootDir
  );

  assertCliSuccess(result, 'query patch json');
  const payload = JSON.parse(result.stdout);
  expect(payload).toMatchObject({
    command: 'query patch apply',
    ok: true,
    data: {
      file: workspace.sqlFile,
      edited_file: editedFile,
      target_cte: 'purchase_summary',
      written: true,
      output_file: outputFile,
      changed: true
    }
  });
  const patched = readNormalizedFile(outputFile);
  expect(patched).toContain('"purchase_summary"("user_id") as materialized');
  expect(patched).toContain('from "public"."users"');
});


test('query lint reports structural maintainability issues in text mode', () => {
  const workspace = createSqlWorkspace('query-lint-text', path.join('src', 'sql', 'reports', 'maintainability.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with base_users as (
        select u.id
        from public.users u
        join public.regions r on r.id = u.id
      ),
      duplicate_users as (
        select u.id
        from public.users u
        join public.regions r on r.id = u.id
      ),
      unused_stage as (
        select id from public.audit_log
      )
      select format('select %s from users', id)
      from duplicate_users
    `,
    'utf8'
  );

  const result = runCli(['query', 'lint', workspace.sqlFile], {}, workspace.rootDir);
  assertCliSuccess(result, 'query lint text');
  expect(result.stdout).toContain('WARN  unused-cte: unused_stage is defined but never used');
  expect(result.stdout).toContain('WARN  duplicate-join-block:');
  expect(result.stdout).toContain('WARN  analysis-risk:');
});

test('query lint emits machine-readable JSON when requested', () => {
  const workspace = createSqlWorkspace('query-lint-json', path.join('src', 'sql', 'reports', 'cycle.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with a as (
        select * from b
      ),
      b as (
        select * from a
      )
      select * from a
    `,
    'utf8'
  );

  const result = runCli(['query', 'lint', workspace.sqlFile, '--format', 'json'], {}, workspace.rootDir);
  assertCliSuccess(result, 'query lint json');
  const payload = JSON.parse(result.stdout);
  expect(payload.query_type).toBe('SELECT');
  expect(payload.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'dependency-cycle',
      severity: 'error',
      cycle: ['a', 'b', 'a']
    })
  ]));
});










test('top-level help exposes perf run for benchmark loops', () => {
  const result = runCli(['--help']);

  assertCliSuccess(result, '--help perf run');
  expect(result.stdout).toContain('perf run --query src/sql/report.sql --dry-run');
});

test('describe command reports perf run metadata in global json mode', () => {
  const result = runCli(['--output', 'json', 'describe', 'command', 'perf run']);

  assertCliSuccess(result, 'describe perf run');
  const parsed = JSON.parse(result.stdout);
  expect(parsed).toMatchObject({
    command: 'describe command',
    ok: true,
    data: {
      command: {
        name: 'perf run',
        supportsDryRun: true,
        supportsJsonPayload: true,
        writesFiles: true,
        flags: expect.arrayContaining([
          expect.objectContaining({ name: '--repeat' }),
          expect.objectContaining({ name: '--warmup' }),
          expect.objectContaining({ name: '--classify-threshold-seconds' }),
          expect.objectContaining({ name: '--timeout-minutes' }),
          expect.objectContaining({ name: '--label' }),
          expect.objectContaining({
            name: '--params',
            description: 'JSON or YAML file with named or positional parameters.'
          })
        ])
      }
    }
  });
});

test('perf run dry-run emits benchmark evidence metadata in global json mode', () => {
  const workspace = createSqlWorkspace('perf-run-dry-run', path.join('src', 'sql', 'reports', 'sales.sql'));
  const paramsFile = path.join(workspace.rootDir, 'perf', 'params.yml');
  mkdirSync(path.dirname(paramsFile), { recursive: true });
  writeFileSync(
    workspace.sqlFile,
    `
      select *
      from public.sales
      where region_id = :region_id
    `,
    'utf8'
  );
  writeFileSync(paramsFile, ['params:', '  region_id: 99', ''].join('\n'), 'utf8');

  const result = runCli(
    ['--output', 'json', 'perf', 'run', '--query', workspace.sqlFile, '--params', paramsFile, '--mode', 'latency', '--dry-run'],
    {},
    workspace.rootDir
  );

  assertCliSuccess(result, 'perf run dry-run');
  const parsed = JSON.parse(result.stdout);
  expect(parsed).toMatchObject({
    command: 'perf run',
    ok: true,
    data: {
      dry_run: true,
      requested_mode: 'latency',
      selected_mode: 'latency',
      params_shape: 'named',
      ordered_param_names: ['region_id'],
      executed_statements: [
        expect.objectContaining({
          role: 'final-query',
          sql: expect.stringContaining('$1')
        })
      ]
    }
  });
});

test('perf run dry-run highlights tax allocation pipeline recommendations in global json mode', () => {
  const workspace = createSqlWorkspace('perf-run-tax-allocation', path.join('src', 'sql', 'reports', 'tax_allocation.sql'));
  const paramsFile = path.join(workspace.rootDir, 'perf', 'params.json');
  mkdirSync(path.dirname(paramsFile), { recursive: true });
  writeFileSync(workspace.sqlFile, TAX_ALLOCATION_QUERY, 'utf8');
  writeFileSync(paramsFile, JSON.stringify([2], null, 2), 'utf8');

  const result = runCli(
    ['--output', 'json', 'perf', 'run', '--query', workspace.sqlFile, '--params', paramsFile, '--mode', 'latency', '--dry-run'],
    {},
    workspace.rootDir
  );

  assertCliSuccess(result, 'perf run tax allocation');
  const parsed = JSON.parse(result.stdout);
  expect(parsed.data).toMatchObject({
    dry_run: true,
    params_shape: 'positional',
    pipeline_analysis: expect.objectContaining({
      should_consider_pipeline: true,
      scalar_filter_candidates: ['allocation_rank']
    })
  });
  expect(parsed.data.recommended_actions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ action: 'consider-pipeline-materialization' }),
      expect.objectContaining({ action: 'consider-scalar-filter-binding' })
    ])
  );
});

test('perf run accepts --json payload for query resolution in global json mode', () => {
  const workspace = createSqlWorkspace('perf-run-json-payload', path.join('src', 'sql', 'reports', 'sales.sql'));
  const paramsFile = path.join(workspace.rootDir, 'perf', 'params.yml');
  mkdirSync(path.dirname(paramsFile), { recursive: true });
  writeFileSync(
    workspace.sqlFile,
    [
      'select *',
      'from public.sales',
      'where region_id = :region_id'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(paramsFile, ['params:', '  region_id: 77', ''].join('\n'), 'utf8');

  const result = runCli(
    [
      '--output',
      'json',
      'perf',
      'run',
      '--json',
      JSON.stringify({
        query: workspace.sqlFile,
        params: paramsFile,
        mode: 'latency',
        dryRun: true
      })
    ],
    {},
    workspace.rootDir
  );

  assertCliSuccess(result, 'perf run json payload');
  const parsed = JSON.parse(result.stdout);
  expect(parsed.data).toMatchObject({
    dry_run: true,
    requested_mode: 'latency',
    selected_mode: 'latency',
    ordered_param_names: ['region_id'],
    bindings: [77]
  });
});

test('perf report diff emits machine-readable JSON from saved evidence summaries', () => {
  const workspace = createTempDir('perf-report-diff');
  const baselineDir = path.join(workspace, 'perf', 'evidence', 'run_001');
  const candidateDir = path.join(workspace, 'perf', 'evidence', 'run_002');
  mkdirSync(baselineDir, { recursive: true });
  mkdirSync(candidateDir, { recursive: true });

  writeFileSync(
    path.join(baselineDir, 'summary.json'),
    JSON.stringify({
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
      strategy: 'direct',
      requested_mode: 'latency',
      selected_mode: 'latency',
      selection_reason: 'forced',
      classify_threshold_ms: 60000,
      timeout_ms: 300000,
      database_version: '16.2',
      dry_run: false,
      saved: true,
      total_elapsed_ms: 300,
      latency_metrics: {
        measured_runs: 3,
        warmup_runs: 1,
        min_ms: 90,
        max_ms: 120,
        avg_ms: 100,
        median_ms: 95,
        p95_ms: 120
      },
      executed_statements: [{ seq: 1, role: 'final-query', sql: 'select 1', plan_summary: { node_type: 'Seq Scan' } }],
      plan_observations: ['Seq Scan on public.users'],
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
  writeFileSync(
    path.join(candidateDir, 'summary.json'),
    JSON.stringify({
      schema_version: 1,
      command: 'perf run',
      run_id: 'run_002',
      query_file: 'candidate.sql',
      query_type: 'SELECT',
      params_shape: 'none',
      ordered_param_names: [],
      source_sql_file: 'candidate.sql',
      source_sql: 'select 1',
      bound_sql: 'select 1',
      strategy: 'direct',
      requested_mode: 'latency',
      selected_mode: 'latency',
      selection_reason: 'forced',
      classify_threshold_ms: 60000,
      timeout_ms: 300000,
      database_version: '16.3',
      dry_run: false,
      saved: true,
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
      executed_statements: [{ seq: 1, role: 'final-query', sql: 'select 1', plan_summary: { node_type: 'Nested Loop', join_type: 'Inner' } }],
      plan_observations: ['Inner Nested Loop present in the captured plan'],
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

  const result = runCli(['--output', 'json', 'perf', 'report', 'diff', baselineDir, candidateDir], {}, workspace);

  assertCliSuccess(result, 'perf report diff');
  const parsed = JSON.parse(result.stdout);
  expect(parsed).toMatchObject({
    command: 'perf report diff',
    ok: true,
    data: {
      primary_metric: {
        name: 'p95_ms',
        baseline: 120,
        candidate: 90
      },
      plan_deltas: [
        expect.objectContaining({
          statement_id: '1:final-query'
        })
      ]
    }
  });
});


test('perf run dry-run exposes decomposed multi-statement strategy metadata in global json mode', () => {
  const workspace = createSqlWorkspace('perf-run-decomposed', path.join('src', 'sql', 'reports', 'sales.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with base_sales as (
        select id, region_id from public.sales
      ),
      filtered_sales as (
        select id from base_sales where region_id = 99
      ),
      final_sales as (
        select id from filtered_sales
      )
      select * from final_sales
    `,
    'utf8'
  );

  const result = runCli(
    [
      '--output',
      'json',
      'perf',
      'run',
      '--query',
      workspace.sqlFile,
      '--strategy',
      'decomposed',
      '--material',
      'base_sales,filtered_sales',
      '--mode',
      'latency',
      '--dry-run'
    ],
    {},
    workspace.rootDir
  );

  assertCliSuccess(result, 'perf run decomposed dry-run');
  const parsed = JSON.parse(result.stdout);
  expect(parsed.data).toMatchObject({
    strategy: 'decomposed',
    strategy_metadata: {
      materialized_ctes: ['base_sales', 'filtered_sales'],
      planned_steps: [
        expect.objectContaining({ step: 1, kind: 'materialize', target: 'base_sales' }),
        expect.objectContaining({ step: 2, kind: 'materialize', target: 'filtered_sales' }),
        expect.objectContaining({ step: 3, kind: 'final-query', target: 'FINAL_QUERY' }),
      ]
    },
    executed_statements: [
      expect.objectContaining({ seq: 1, role: 'materialize', target: 'base_sales' }),
      expect.objectContaining({ seq: 2, role: 'materialize', target: 'filtered_sales' }),
      expect.objectContaining({ seq: 3, role: 'final-query', target: 'FINAL_QUERY' }),
    ]
  });
});

test('perf run accepts material arrays in --json payloads', () => {
  const workspace = createSqlWorkspace('perf-run-json-material-array', path.join('src', 'sql', 'reports', 'sales.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with base_sales as (
        select id, region_id from public.sales
      ),
      filtered_sales as (
        select id from base_sales where region_id = 99
      )
      select * from filtered_sales
    `,
    'utf8'
  );

  const result = runCli(
    [
      '--output',
      'json',
      'perf',
      'run',
      '--json',
      JSON.stringify({
        query: workspace.sqlFile,
        strategy: 'decomposed',
        material: ['base_sales'],
        mode: 'latency',
        dryRun: true
      })
    ],
    {},
    workspace.rootDir
  );

  assertCliSuccess(result, 'perf run json material array');
  const parsed = JSON.parse(result.stdout);
  expect(parsed.data).toMatchObject({
    strategy: 'decomposed',
    strategy_metadata: {
      materialized_ctes: ['base_sales']
    },
    executed_statements: [
      expect.objectContaining({ seq: 1, role: 'materialize', target: 'base_sales' }),
      expect.objectContaining({ seq: 2, role: 'final-query', target: 'FINAL_QUERY' })
    ]
  });
});
