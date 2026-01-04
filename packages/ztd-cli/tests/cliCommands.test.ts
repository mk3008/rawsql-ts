import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { expect, test } from 'vitest';

const nodeExecutable = process.execPath;
const tsNodeRegister = require.resolve('ts-node/register');
const tsConfigPathsRegister = require.resolve('tsconfig-paths/register');
const cliRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const cliEntry = path.join(cliRoot, 'src', 'index.ts');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  // Ensure the shared tmp directory exists before deriving per-test folders.
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

const pgDumpCommand = process.env.PG_DUMP_BIN ?? 'pg_dump';

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
    TS_NODE_PROJECT: path.join(cliRoot, 'tsconfig.test.json'),
    ...overrides,
  };
}

function runCli(args: string[], envOverrides: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> {
  // Invoke the CLI entry point through ts-node so the test avoids a prior build.
  return spawnSync(nodeExecutable, ['-r', tsNodeRegister, '-r', tsConfigPathsRegister, cliEntry, ...args], {
    cwd: repoRoot,
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

test('ztd-config CLI produces the expected ztd-row-map.generated.ts snapshot', () => {
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
});
