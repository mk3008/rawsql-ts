import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import {
  buildInitDryRunPlan,
  runInitCommand,
  buildPackageManagerArgs,
  findAncestorPnpmWorkspaceRoot,
  resolveInitInstallStrategy,
  resolvePackageManagerShellExecutable,
  resolvePnpmWorkspaceGuard,
  type ZtdConfigWriterDependencies,
  type Prompter
} from '../src/commands/init';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function readNormalizedFile(filePath: string): string {
  const contents = readFileSync(filePath, 'utf8');
  return contents.replace(/\r\n/g, '\n');
}

class TestPrompter implements Prompter {
  private index = 0;
  constructor(private readonly responses: string[]) {}

  private nextResponse(): string {
    if (this.index >= this.responses.length) {
      throw new Error('Not enough responses supplied to TestPrompter');
    }
    return this.responses[this.index++];
  }

  async selectChoice(_question: string, _choices: string[]): Promise<number> {
    const value = this.nextResponse();
    const selected = Number(value);
    if (!Number.isFinite(selected)) {
      throw new Error(`Invalid choice "${value}" supplied to TestPrompter.`);
    }
    if (selected < 1 || selected > _choices.length) {
      throw new Error(`Choice "${value}" is outside the valid range.`);
    }
    return selected - 1;
  }

  async promptInput(_question: string, _example?: string): Promise<string> {
    return this.nextResponse();
  }

  async promptInputWithDefault(_question: string, defaultValue: string, _example?: string): Promise<string> {
    const value = this.nextResponse();
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : defaultValue;
  }

  async confirm(_question: string): Promise<boolean> {
    const answer = this.nextResponse().trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  }

  close(): void {
    // No resources to clean up in the mock prompter.
  }
}

test('init bootstraps a feature-first scaffold', { timeout: 60_000 }, async () => {
  const workspace = createTempDir('cli-init-feature-first');
  const prompter = new TestPrompter([]);

  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'empty',
    validator: 'zod'
  });

  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('src/features/<feature>');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('ztd init --starter');
  expect(existsSync(path.join(workspace, 'src', 'features', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke'))).toBe(false);
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain(
    "src/features/**/*.test.ts"
  );
  expect(existsSync(path.join(workspace, 'src', 'domain'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'application'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'presentation'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'infrastructure'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'jobs'))).toBe(false);
  expect(existsSync(path.join(workspace, 'compose.yaml'))).toBe(false);
  expect(existsSync(path.join(workspace, '.env.example'))).toBe(true);
  expect(existsSync(path.join(workspace, '.gitignore'))).toBe(true);
  const gitignore = readNormalizedFile(path.join(workspace, '.gitignore'));
  expect(gitignore).toMatch(/^\.env$/m);
  expect(gitignore).toMatch(/^\.env\.\*$/m);
  expect(gitignore).toMatch(/^!\.env\.example$/m);
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('copy `.env.example` to `.env`');
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain('setupFiles');
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain(
    "tests/support/setup-env.ts"
  );
  expect(readNormalizedFile(path.join(workspace, 'tests', 'support', 'setup-env.ts'))).toContain(
    'ZTD_DB_PORT'
  );
  expect(readNormalizedFile(path.join(workspace, '.env.example'))).toContain('ZTD_DB_PORT=5432');
  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    devDependencies: Record<string, string>;
  };
  expect(packageJson.devDependencies).toHaveProperty('dotenv');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/sql-contract');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/testkit-core');
  expect(result.summary).not.toContain('src/features/smoke/tests/smoke.test.ts');
  expect(result.summary).toContain('src/features/README.md');
  expect(result.summary).toContain('.env.example');
});

test('init starter bootstraps compose, starter DDL, and smoke tests without visible AGENTS', { timeout: 60_000 }, async () => {
  const workspace = createTempDir('cli-init-starter');
  const prompter = new TestPrompter([]);

  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'demo',
    validator: 'zod',
    starter: true,
    postgresImage: 'postgres:17'
  });

  const ddlFiles = readdirSync(path.join(workspace, 'ztd', 'ddl')).filter((entry) => entry.endsWith('.sql'));
  expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'AGENTS_ztd.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'tests', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'compose.yaml'))).toBe(true);
  expect(existsSync(path.join(workspace, '.env.example'))).toBe(true);
  expect(existsSync(path.join(workspace, '.gitignore'))).toBe(true);
  const starterGitignore = readNormalizedFile(path.join(workspace, '.gitignore'));
  expect(starterGitignore).toMatch(/^\.env$/m);
  expect(starterGitignore).toMatch(/^\.env\.\*$/m);
  expect(starterGitignore).toMatch(/^!\.env\.example$/m);
  expect(readNormalizedFile(path.join(workspace, 'compose.yaml'))).toContain('image: postgres:17');
  expect(readNormalizedFile(path.join(workspace, 'compose.yaml'))).toContain('ZTD_DB_PORT');
  expect(readNormalizedFile(path.join(workspace, 'compose.yaml'))).toContain(
    '${ZTD_DB_PORT:-5432}:5432'
  );
  expect(readNormalizedFile(path.join(workspace, '.env.example'))).toContain('ZTD_DB_PORT=5432');
  expect(ddlFiles.length).toBeGreaterThan(0);
  expect(
    readNormalizedFile(path.join(workspace, 'ztd', 'ddl', ddlFiles[0]))
  ).toContain('create table users');
  expect(
    readNormalizedFile(path.join(workspace, 'ztd', 'ddl', ddlFiles[0]))
  ).toContain('Starter user directory for the first CRUD feature');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Starter Flow');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('starter-only sample feature');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Copy `.env.example` to `.env`');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('ZTD_DB_PORT');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain(
    'derives `ZTD_TEST_DATABASE_URL` from `ZTD_DB_PORT`'
  );
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Docker Desktop or another Docker daemon is already running');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('npx vitest run src/features/smoke/tests/smoke.test.ts src/features/smoke/tests/smoke.validation.test.ts');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('If `5432` is already in use');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('change `ZTD_DB_PORT` in `.env`');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('delete `src/features/smoke/`');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('src/features/users');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('npx ztd ztd-config');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('npx ztd model-gen');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('@rawsql-ts/testkit-postgres');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('tests/support/postgres-testkit.ts');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('repository telemetry');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('queryId');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('paramsShape');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('transformations');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'README.md'))).toContain('starter-only sample feature');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'README.md'))).toContain('smoke.queryspec.test.ts');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'README.md'))).toContain('setup-env.ts');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'README.md'))).toContain('tests/support/postgres-testkit.ts');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'README.md'))).toContain('ZTD_DB_PORT');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'persistence', 'smoke.sql'))).toContain(':v1::integer + :v2::integer as result');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'persistence', 'smoke.spec.ts'))).toContain(
    "sqlFile: './smoke.sql'"
  );
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'persistence', 'smoke.spec.ts'))).toContain("shape: 'named'");
  expect(readNormalizedFile(path.join(workspace, 'tests', 'support', 'setup-env.ts'))).toContain('ZTD_DB_PORT');
  expect(readNormalizedFile(path.join(workspace, 'tests', 'support', 'setup-env.ts'))).toContain('ZTD_TEST_DATABASE_URL');
  expect(readNormalizedFile(path.join(workspace, 'tests', 'support', 'postgres-testkit.ts'))).toContain('createPostgresTestkitClient');
  expect(readNormalizedFile(path.join(workspace, 'tests', 'support', 'postgres-testkit.ts'))).toContain('loadStarterPostgresDefaults');
  expect(readNormalizedFile(path.join(workspace, 'tests', 'support', 'postgres-testkit.ts'))).toContain('ZTD_TEST_DATABASE_URL');
  expect(readNormalizedFile(path.join(workspace, 'tests', 'support', 'postgres-testkit.ts'))).toContain('throw new Error');
  expect(readNormalizedFile(path.join(workspace, 'ztd.config.json'))).toContain('"ztdRootDir": "."');
  expect(readNormalizedFile(path.join(workspace, 'ztd.config.json'))).toContain('"defaultSchema": "public"');
  expect(readNormalizedFile(path.join(workspace, 'ztd.config.json'))).toContain('"searchPath": [');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.test.ts'))).toContain('buildSmokeWorkflow');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.validation.test.ts'))).toContain('../domain/smoke-policy.js');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.queryspec.test.ts'))).toContain('createStarterPostgresTestkitClient');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.queryspec.test.ts'))).toContain('public.users');
  expect(existsSync(path.join(workspace, 'src', 'infrastructure', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'types.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'repositoryTelemetry.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'consoleRepositoryTelemetry.ts'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'README.md'))).toContain('default repository telemetry seam is no-op');
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'README.md'))).toContain('queryId');
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'repositoryTelemetry.ts'))).toContain('createNoopRepositoryTelemetry');
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'repositoryTelemetry.ts'))).toContain('defaultRepositoryTelemetry');
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'repositoryTelemetry.ts'))).not.toContain('sqlText');
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'types.ts'))).toContain('paramsShape');
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'types.ts'))).toContain('transformations');
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'types.ts'))).not.toContain('parameterValues');
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'consoleRepositoryTelemetry.ts'))).toContain('queryId');
  expect(readNormalizedFile(path.join(workspace, 'src', 'infrastructure', 'telemetry', 'consoleRepositoryTelemetry.ts'))).not.toContain('sqlText');
  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    devDependencies: Record<string, string>;
  };
  expect(packageJson.devDependencies).toHaveProperty('dotenv');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/sql-contract');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/testkit-core');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/testkit-postgres');
  expect(packageJson.devDependencies).toHaveProperty('pg');
  expect(packageJson.devDependencies).toHaveProperty('@types/pg');
  expect(existsSync(path.join(workspace, 'tests', 'support', 'testkit-client.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.queryspec.test.ts'))).toBe(true);
  expect(result.summary).toContain('compose.yaml');
  expect(result.summary).toContain('.env.example');
  expect(result.summary).toContain('tests/support/setup-env.ts');
  expect(result.summary).toContain('tests/support/postgres-testkit.ts');
  expect(result.summary).toContain('src/features/smoke/tests/smoke.queryspec.test.ts');
  expect(result.summary).toContain('starter-only sample feature');
  expect(result.summary).toContain('ztd agents init');
  expect(result.summary).toContain('Delete src/features/smoke/');
});

test('init dry-run plan matches starter outputs without AGENTS files', () => {
  const workspace = createTempDir('cli-init-dry-run-plan');
  const plan = buildInitDryRunPlan(workspace, {
    appShape: 'default',
    starter: true,
    postgresImage: 'postgres:17',
    withAiGuidance: false,
    withDogfooding: false,
    withAppInterface: false,
    workflow: 'demo',
    validator: 'zod',
    localSourceRoot: null
  });

  expect(plan.dryRun).toBe(true);
  expect(plan.files).toEqual(expect.arrayContaining([
    'compose.yaml',
    'src/features/smoke/tests/smoke.test.ts',
    'src/infrastructure/telemetry/types.ts',
    'tests/support/postgres-testkit.ts'
  ]));
  expect(plan.files).not.toEqual(expect.arrayContaining([
    'AGENTS.md',
    'ztd/AGENTS.md',
    'ztd/ddl/AGENTS.md',
    'src/AGENTS.md',
    'src/features/AGENTS.md',
    'tests/AGENTS.md'
  ]));
});

test('init starter keeps visible AGENTS out even when internal AI guidance is enabled', { timeout: 60_000 }, async () => {
  const workspace = createTempDir('cli-init-starter-ai-guidance');
  const prompter = new TestPrompter([]);

  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'demo',
    validator: 'zod',
    starter: true,
    withAiGuidance: true
  });

  expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'AGENTS_ztd.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'tests', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'manifest.json'))).toBe(true);
  expect(existsSync(path.join(workspace, 'CONTEXT.md'))).toBe(true);
  expect(result.summary).toContain('Internal guidance is managed under .ztd/agents/.');
  expect(result.summary).toContain('Visible AGENTS.md files are separate. Enable them with: ztd agents init');
  expect(result.summary).not.toContain('Visible AGENTS.md files are installed for the starter flow.');
});

test('init can opt into AI guidance files when explicitly requested', async () => {
  const workspace = createTempDir('cli-init-ai-guidance');
  const prompter = new TestPrompter([]);

  await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'empty',
    validator: 'zod',
    withAiGuidance: true
  });

  expect(existsSync(path.join(workspace, 'CONTEXT.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'PROMPT_DOGFOOD.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'src-features.md'))).toBe(true);
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'src-features-smoke.md'))).toBe(false);
  expect(readNormalizedFile(path.join(workspace, 'CONTEXT.md'))).toContain('Start with `ztd init --starter`');
  expect(readNormalizedFile(path.join(workspace, 'CONTEXT.md'))).toContain('src/features/smoke');
  expect(readNormalizedFile(path.join(workspace, 'CONTEXT.md'))).toContain('src/features/users');
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'src-features-application.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'src-features-domain.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'src-features-persistence.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'src-features-tests.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'src-sql.md'))).toBe(false);

  const manifest = JSON.parse(readNormalizedFile(path.join(workspace, '.ztd', 'agents', 'manifest.json'))) as {
    routing_rules: Array<{ paths: string[]; scope: string }>;
  };
  expect(manifest.routing_rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ scope: 'src-features' }),
      expect.objectContaining({ scope: 'src' }),
      expect.objectContaining({ scope: 'tests' }),
      expect.objectContaining({ scope: 'ztd' })
    ])
  );
});

test('init can opt into dogfooding prompt files when explicitly requested', async () => {
  const workspace = createTempDir('cli-init-dogfooding');
  const prompter = new TestPrompter([]);

  await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'empty',
    validator: 'zod',
    withDogfooding: true
  });

  expect(existsSync(path.join(workspace, 'CONTEXT.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'PROMPT_DOGFOOD.md'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'PROMPT_DOGFOOD.md'))).toContain('Add a users feature');
  expect(readNormalizedFile(path.join(workspace, 'PROMPT_DOGFOOD.md'))).toContain(
    'Do not apply migrations automatically.'
  );
});

test('with-app-interface appends to AGENTS.md when both root files exist', async () => {
  const workspace = createTempDir('cli-init-app-interface-both');
  writeFileSync(path.join(workspace, 'AGENTS.md'), '# root\n', 'utf8');
  writeFileSync(path.join(workspace, 'AGENTS_ztd.md'), '# ztd root\n', 'utf8');
  const prompter = new TestPrompter([]);

  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    withAppInterface: true,
    nonInteractive: true,
    forceOverwrite: true
  });

  expect(result.summary).toContain('AGENTS.md');
  expect(readNormalizedFile(path.join(workspace, 'AGENTS.md'))).toContain('## Application Interface Guidance');
  expect(readNormalizedFile(path.join(workspace, 'AGENTS_ztd.md'))).not.toContain('## Application Interface Guidance');
});

test('init local-source mode links rawsql-ts dependencies from the monorepo without exposing local-source shims to consumer code', async () => {
  const workspace = createTempDir('cli-init-local-source');
  const prompter = new TestPrompter([]);

  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    forceOverwrite: true,
    nonInteractive: true,
    workflow: 'empty',
    validator: 'zod',
    localSourceRoot: repoRoot
  });

  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    devDependencies: Record<string, string>;
  };
  const localSourceGuardPath = path.join(workspace, 'scripts', 'local-source-guard.mjs');

  expect(result.summary).toContain('Run pnpm ztd ztd-config');
  expect(result.summary).not.toContain('src/features/smoke/tests/smoke.test.ts');
  expect(existsSync(localSourceGuardPath)).toBe(true);
  expect(packageJson.devDependencies['@rawsql-ts/sql-contract']).toBe(
    `file:${path.relative(workspace, path.join(repoRoot, 'packages', 'sql-contract')).replace(/\\/g, '/')}`
  );
  expect(packageJson.devDependencies['@rawsql-ts/testkit-core']).toBe(
    `file:${path.relative(workspace, path.join(repoRoot, 'packages', 'testkit-core')).replace(/\\/g, '/')}`
  );
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/ztd-cli');
});

test('pnpm nested under a parent workspace uses --ignore-workspace for manual installs', () => {
  const workspace = createTempDir('cli-init-workspace-guard');

  expect(findAncestorPnpmWorkspaceRoot(workspace)).toBe(repoRoot);
  expect(resolvePnpmWorkspaceGuard(workspace, 'pnpm')).toEqual({
    workspaceRoot: repoRoot,
    shouldIgnoreWorkspace: true
  });
  expect(buildPackageManagerArgs('install', 'pnpm', [], workspace)).toEqual([
    'install',
    '--ignore-workspace'
  ]);
  expect(buildPackageManagerArgs('devDependencies', 'pnpm', ['vitest'], workspace)).toEqual([
    'add',
    '-D',
    'vitest',
    '--ignore-workspace'
  ]);
});

test('resolveInitInstallStrategy keeps manual add commands workspace-safe for Windows pnpm exec', () => {
  const workspace = path.join(repoRoot, 'tmp', 'init-install-strategy');

  expect(
    resolveInitInstallStrategy(workspace, 'pnpm', {
      platform: 'win32',
      npmCommand: 'exec'
    }).shouldDeferAutoInstall
  ).toBe(true);

  expect(buildPackageManagerArgs('devDependencies', 'pnpm', ['vitest', 'typescript'], workspace)).toEqual([
    'add',
    '-D',
    'vitest',
    'typescript',
    '--ignore-workspace'
  ]);
});

test('resolvePackageManagerShellExecutable strips Windows absolute shim paths before shell execution', () => {
  expect(
    resolvePackageManagerShellExecutable('C:\\Program Files\\nodejs\\npm.cmd', 'npm', 'win32')
  ).toBe('npm.cmd');
  expect(
    resolvePackageManagerShellExecutable('C:\\Program Files\\nodejs\\pnpm.cmd', 'pnpm', 'win32')
  ).toBe('pnpm.cmd');
  expect(resolvePackageManagerShellExecutable('/usr/local/bin/npm', 'npm', 'linux')).toBe('/usr/local/bin/npm');
});

test('TestPrompter.confirm maps yes and no variants', async () => {
  const prompter = new TestPrompter(['y', 'yes', 'n']);
  expect(await prompter.confirm('still there?')).toBe(true);
  expect(await prompter.confirm('again?')).toBe(true);
  expect(await prompter.confirm('final?')).toBe(false);
});

test('TestPrompter.selectChoice rejects invalid inputs', async () => {
  await expect(new TestPrompter(['foo']).selectChoice('option?', ['a', 'b'])).rejects.toThrow('Invalid choice');
  await expect(new TestPrompter(['99']).selectChoice('option?', ['only'])).rejects.toThrow('outside the valid range');
});
