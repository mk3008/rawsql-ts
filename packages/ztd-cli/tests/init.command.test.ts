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

  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('This scaffold starts from `ztd init`.');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('This generated project is either:');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('local-source workspace output');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('If you see `file:` dependencies that point back to a monorepo checkout');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('keep starter-owned shared support under `tests/support/ztd/`');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('keep tool-managed fixture metadata under `.ztd/generated/`');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('src/features`, `src/adapters`, and `src/libraries` as the app-code roots');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('this generated workspace may not contain `docs/`');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('`ztd.config.json` controls generated metadata and runtime defaults while the feature-local tests stay next to the feature they cover');
  expect(existsSync(path.join(workspace, 'src', 'features', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'libraries', 'sql', 'sql-client.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'adapters', 'pg', 'sql-client.ts'))).toBe(true);
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
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('copy `.env.example` to `.env` and adjust `ZTD_DB_PORT` if needed before running the DB-backed suites');
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain('setupFiles');
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain(
    ".ztd/support/setup-env.ts"
  );
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain("'#features'");
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain("'#libraries'");
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain("'#adapters'");
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain("'#tests'");
  expect(readNormalizedFile(path.join(workspace, 'tsconfig.json'))).toContain('"#libraries/*"');
  expect(readNormalizedFile(path.join(workspace, 'tsconfig.json'))).toContain('"#adapters/*"');
  expect(readNormalizedFile(path.join(workspace, 'src', 'adapters', 'pg', 'sql-client.ts'))).toContain(
    "from '#libraries/sql/sql-client.js'"
  );
  expect(readNormalizedFile(path.join(workspace, '.ztd', 'support', 'setup-env.ts'))).toContain(
    'ZTD_DB_PORT'
  );
  expect(readNormalizedFile(path.join(workspace, '.env.example'))).toContain('ZTD_DB_PORT=5432');
  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    type?: string;
    devDependencies: Record<string, string>;
    imports?: Record<string, { types: string; default: string }>;
  };
  expect(packageJson.devDependencies).toHaveProperty('dotenv');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/sql-contract');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/testkit-core');
  expect(packageJson.imports?.['#features/*.js']).toEqual({
    types: './src/features/*.ts',
    default: './dist/features/*.js'
  });
  expect(packageJson.imports?.['#libraries/*.js']).toEqual({
    types: './src/libraries/*.ts',
    default: './dist/libraries/*.js'
  });
  expect(packageJson.imports?.['#adapters/*.js']).toEqual({
    types: './src/adapters/*.ts',
    default: './dist/adapters/*.js'
  });
  expect(packageJson.imports?.['#tests/*.js']).toEqual({
    types: './tests/*.ts',
    default: './tests/*.ts'
  });
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

  const ddlFiles = readdirSync(path.join(workspace, 'db', 'ddl')).filter((entry) => entry.endsWith('.sql'));
  expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'AGENTS_ztd.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'db', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.codex', 'config.toml'))).toBe(false);
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
    readNormalizedFile(path.join(workspace, 'db', 'ddl', ddlFiles[0]))
  ).toContain('create table users');
  expect(
    readNormalizedFile(path.join(workspace, 'db', 'ddl', ddlFiles[0]))
  ).toContain('Starter user directory for the first CRUD feature');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Starter Flow');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('starter-only sample feature');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Copy `.env.example` to `.env` and update `ZTD_DB_PORT` if 5432 is already in use.');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('ZTD_DB_PORT');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain(
    'derives `ZTD_DB_URL` from `ZTD_DB_PORT`'
  );
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('npx vitest run src/features/smoke/tests/smoke.boundary.test.ts src/features/smoke/tests/smoke.test.ts src/features/smoke/tests/smoke.validation.test.ts');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('pnpm ztd feature scaffold --table users --action insert');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('pnpm ztd ztd-config');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('@rawsql-ts/testkit-postgres');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('fixed app-level ZTD runner');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'README.md'))).toContain('starter-only sample feature');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'README.md'))).toContain('src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'README.md'))).toContain('setup-env.ts');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'README.md'))).toContain('tests/support/ztd/harness.ts');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'README.md'))).toContain('ZTD_DB_PORT');
  expect(existsSync(path.join(workspace, 'src', 'features', '_shared', 'featureQueryExecutor.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', '_shared', 'loadSqlResource.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'boundary.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'smoke.sql'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'boundary-ztd-types.ts'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'boundary-ztd-types.ts'))).toContain(
    "from '#tests/support/ztd/case-types.js'"
  );
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'cases', 'basic.case.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'generated', 'TEST_PLAN.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'generated', 'analysis.json'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'application'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'domain'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'persistence'))).toBe(false);
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'smoke.sql'))).toContain('where user_id = :user_id::integer');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'boundary.ts'))).toContain('executeSmokeQuerySpec');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'boundary.ts'))).toContain('loadSqlResource');
  expect(readNormalizedFile(path.join(workspace, '.ztd', 'support', 'setup-env.ts'))).toContain('ZTD_DB_PORT');
  expect(readNormalizedFile(path.join(workspace, '.ztd', 'support', 'setup-env.ts'))).toContain('ZTD_DB_URL');
  expect(readNormalizedFile(path.join(workspace, '.ztd', 'support', 'postgres-testkit.ts'))).toContain('createPostgresTestkitClient');
  expect(readNormalizedFile(path.join(workspace, '.ztd', 'support', 'postgres-testkit.ts'))).toContain('loadStarterPostgresDefaults');
  expect(readNormalizedFile(path.join(workspace, '.ztd', 'support', 'postgres-testkit.ts'))).toContain('ZTD_DB_URL');
  expect(readNormalizedFile(path.join(workspace, '.ztd', 'support', 'postgres-testkit.ts'))).toContain('throw new Error');
  expect(readNormalizedFile(path.join(workspace, 'ztd.config.json'))).toContain('"ztdRootDir": ".ztd"');
  expect(readNormalizedFile(path.join(workspace, 'ztd.config.json'))).toContain('"defaultSchema": "public"');
  expect(readNormalizedFile(path.join(workspace, 'ztd.config.json'))).toContain('"searchPath": [');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.test.ts'))).toContain('executeSmokeEntrySpec');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.boundary.test.ts'))).toContain('executeSmokeEntrySpec');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.validation.test.ts'))).toContain('Validation should reject before the query lane runs.');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'smoke.boundary.ztd.test.ts'))).toContain('runQuerySpecZtdCases');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'smoke.boundary.ztd.test.ts'))).toContain("entry.mode === 'ztd'");
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'smoke.boundary.ztd.test.ts'))).toContain('entry.physicalSetupUsed === false');
  expect(readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'smoke.boundary.ztd.test.ts'))).toContain(
    "from '#tests/support/ztd/harness.js'"
  );
  expect(existsSync(path.join(workspace, 'src', 'libraries', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'libraries', 'sql', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'libraries', 'telemetry', 'types.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'libraries', 'telemetry', 'repositoryTelemetry.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'adapters', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'adapters', 'console', 'repositoryTelemetry.ts'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'src', 'libraries', 'README.md'))).toContain('Shared runtime contracts and reusable helpers live here.');
  expect(readNormalizedFile(path.join(workspace, 'src', 'libraries', 'sql', 'README.md'))).toContain('Keep driver-neutral SQL contracts here.');
  expect(readNormalizedFile(path.join(workspace, 'src', 'adapters', 'README.md'))).toContain('Technology-specific bindings live here.');
  expect(readNormalizedFile(path.join(workspace, 'src', 'libraries', 'telemetry', 'repositoryTelemetry.ts'))).toContain('createNoopRepositoryTelemetry');
  expect(readNormalizedFile(path.join(workspace, 'src', 'libraries', 'telemetry', 'repositoryTelemetry.ts'))).toContain('defaultRepositoryTelemetry');
  expect(readNormalizedFile(path.join(workspace, 'src', 'libraries', 'telemetry', 'repositoryTelemetry.ts'))).not.toContain('sqlText');
  expect(readNormalizedFile(path.join(workspace, 'src', 'libraries', 'telemetry', 'types.ts'))).toContain('paramsShape');
  expect(readNormalizedFile(path.join(workspace, 'src', 'libraries', 'telemetry', 'types.ts'))).toContain('transformations');
  expect(readNormalizedFile(path.join(workspace, 'src', 'libraries', 'telemetry', 'types.ts'))).not.toContain('parameterValues');
  expect(readNormalizedFile(path.join(workspace, 'src', 'adapters', 'pg', 'sql-client.ts'))).toContain(
    "from '#libraries/sql/sql-client.js'"
  );
  expect(readNormalizedFile(path.join(workspace, 'src', 'adapters', 'console', 'repositoryTelemetry.ts'))).toContain(
    "from '#libraries/telemetry/types.js'"
  );
  expect(readNormalizedFile(path.join(workspace, 'src', 'adapters', 'console', 'repositoryTelemetry.ts'))).toContain('queryId');
  expect(readNormalizedFile(path.join(workspace, 'src', 'adapters', 'console', 'repositoryTelemetry.ts'))).not.toContain('sqlText');
  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    type?: string;
    devDependencies: Record<string, string>;
    imports?: Record<string, { types: string; default: string }>;
  };
  expect(packageJson.devDependencies).toHaveProperty('dotenv');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/sql-contract');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/testkit-core');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/testkit-postgres');
  expect(packageJson.devDependencies).toHaveProperty('pg');
  expect(packageJson.devDependencies).toHaveProperty('@types/pg');
  expect(packageJson.imports?.['#features/*.js']).toEqual({
    types: './src/features/*.ts',
    default: './dist/features/*.js'
  });
  expect(packageJson.imports?.['#libraries/*.js']).toEqual({
    types: './src/libraries/*.ts',
    default: './dist/libraries/*.js'
  });
  expect(packageJson.imports?.['#adapters/*.js']).toEqual({
    types: './src/adapters/*.ts',
    default: './dist/adapters/*.js'
  });
  expect(packageJson.imports?.['#tests/*.js']).toEqual({
    types: './tests/*.ts',
    default: './tests/*.ts'
  });
  expect(existsSync(path.join(workspace, '.ztd', 'support', 'testkit-client.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'queries', 'smoke', 'tests', 'smoke.boundary.ztd.test.ts'))).toBe(true);
  expect(result.summary).toContain('compose.yaml');
  expect(result.summary).toContain('.env.example');
  expect(result.summary).toContain('.ztd/support/setup-env.ts');
  expect(result.summary).toContain('.ztd/support/postgres-testkit.ts');
  expect(result.summary).toContain('src/features/smoke/tests/smoke.boundary.test.ts');
  expect(result.summary).toContain('src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts');
  expect(result.summary).toContain('starter-only sample feature');
  expect(result.summary).not.toContain('ztd agents init');
  expect(result.summary).toContain('Delete src/features/smoke/');
});

test('init dry-run plan matches starter outputs without AGENTS files', () => {
  const workspace = createTempDir('cli-init-dry-run-plan');
  const plan = buildInitDryRunPlan(workspace, {
    appShape: 'default',
    starter: true,
    postgresImage: 'postgres:17',
    workflow: 'demo',
    validator: 'zod',
    localSourceRoot: null
  });

  expect(plan.dryRun).toBe(true);
  expect(plan.files).toEqual(expect.arrayContaining([
    'compose.yaml',
    'src/features/_shared/featureQueryExecutor.ts',
    'src/features/_shared/loadSqlResource.ts',
    'src/features/smoke/boundary.ts',
    'src/features/smoke/tests/smoke.boundary.test.ts',
    'src/features/smoke/tests/smoke.test.ts',
    'src/libraries/sql/README.md',
    'src/adapters/README.md',
    'tests/support/ztd/README.md',
    'tests/support/ztd/case-types.ts',
    'tests/support/ztd/verifier.ts',
    'tests/support/ztd/harness.ts',
    'src/libraries/telemetry/types.ts',
    'src/adapters/console/repositoryTelemetry.ts',
    '.ztd/support/postgres-testkit.ts'
  ]));
  expect(plan.files).not.toEqual(expect.arrayContaining([
    'src/features/smoke/application/README.md',
    'src/features/smoke/domain/README.md',
    'src/features/smoke/persistence/README.md',
    'src/features/smoke/domain/smoke-policy.ts',
    'src/features/smoke/application/smoke-workflow.ts',
    'src/features/smoke/persistence/smoke.sql',
    'src/features/smoke/persistence/boundary.ts',
    'AGENTS.md',
    'db/AGENTS.md',
    'db/ddl/AGENTS.md',
    'src/AGENTS.md',
    'src/features/AGENTS.md'
  ]));
});

test('init dry-run plan for non-starter init excludes starter-only readmes', () => {
  const workspace = createTempDir('cli-init-dry-run-plan-default');
  const plan = buildInitDryRunPlan(workspace, {
    appShape: 'default',
    starter: false,
    workflow: 'empty',
    validator: 'zod',
    localSourceRoot: null
  });

  expect(plan.dryRun).toBe(true);
  expect(plan.files).toEqual(expect.arrayContaining([
    'src/libraries/sql/sql-client.ts',
    'src/adapters/pg/sql-client.ts'
  ]));
  expect(plan.files).not.toEqual(expect.arrayContaining([
    'src/libraries/README.md',
    'src/libraries/sql/README.md',
    'src/adapters/README.md',
    'compose.yaml',
    'src/features/smoke/README.md'
  ]));
});

test('default scaffold omits AI control files', async () => {
  const workspace = createTempDir('cli-init-then-bootstrap');
  const prompter = new TestPrompter([]);

  await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'empty',
    validator: 'zod'
  });

  expect(existsSync(path.join(workspace, '.codex', 'config.toml'))).toBe(false);
  expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'AGENTS_ztd.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'db', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'db', 'ddl', 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'CONTEXT.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'PROMPT_DOGFOOD.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'manifest.json'))).toBe(false);
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
    imports?: Record<string, { types: string; default: string }>;
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
  expect(packageJson.devDependencies['@rawsql-ts/testkit-postgres']).toBeUndefined();
  expect(packageJson.devDependencies['@rawsql-ts/ztd-cli']).toBe(
    `file:${path.relative(workspace, path.join(repoRoot, 'packages', 'ztd-cli')).replace(/\\/g, '/')}`
  );
  expect(packageJson.type).toBe('module');
  expect(packageJson.imports?.['#features/*.js']?.default).toBe('./dist/features/*.js');
  expect(packageJson.imports?.['#libraries/*.js']).toEqual({
    types: './src/libraries/*.ts',
    default: './dist/libraries/*.js'
  });
  expect(packageJson.imports?.['#adapters/*.js']).toEqual({
    types: './src/adapters/*.ts',
    default: './dist/adapters/*.js'
  });
  expect(packageJson.imports?.['#tests/*.js']).toEqual({
    types: './tests/*.ts',
    default: './tests/*.ts'
  });
});

test('init starter local-source mode keeps starter rawsql-ts packages on file dependencies', async () => {
  const workspace = createTempDir('cli-init-starter-local-source');
  const prompter = new TestPrompter([]);

  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    starter: true,
    forceOverwrite: true,
    nonInteractive: true,
    workflow: 'demo',
    validator: 'zod',
    localSourceRoot: repoRoot
  });

  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    type?: string;
    devDependencies: Record<string, string>;
    imports?: Record<string, { types: string; default: string }>;
  };

  expect(packageJson.devDependencies['@rawsql-ts/sql-contract']).toBe(
    `file:${path.relative(workspace, path.join(repoRoot, 'packages', 'sql-contract')).replace(/\\/g, '/')}`
  );
  expect(packageJson.devDependencies['@rawsql-ts/testkit-core']).toBe(
    `file:${path.relative(workspace, path.join(repoRoot, 'packages', 'testkit-core')).replace(/\\/g, '/')}`
  );
  expect(packageJson.devDependencies['@rawsql-ts/testkit-postgres']).toBe(
    `file:${path.relative(workspace, path.join(repoRoot, 'packages', 'testkit-postgres')).replace(/\\/g, '/')}`
  );
  expect(packageJson.devDependencies['@rawsql-ts/ztd-cli']).toBe(
    `file:${path.relative(workspace, path.join(repoRoot, 'packages', 'ztd-cli')).replace(/\\/g, '/')}`
  );
  expect(packageJson.type).toBe('module');
  expect(packageJson.imports?.['#features/*.js']?.default).toBe('./dist/features/*.js');
  expect(packageJson.imports?.['#libraries/*.js']).toEqual({
    types: './src/libraries/*.ts',
    default: './dist/libraries/*.js'
  });
  expect(packageJson.imports?.['#adapters/*.js']).toEqual({
    types: './src/adapters/*.ts',
    default: './dist/adapters/*.js'
  });
  expect(packageJson.imports?.['#tests/*.js']).toEqual({
    types: './tests/*.ts',
    default: './tests/*.ts'
  });
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('pnpm ztd ztd-config');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('pnpm ztd feature scaffold --table users --action insert');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('pnpm ztd feature tests scaffold --feature users-insert');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).not.toContain('pnpm exec ztd ztd-config');
  expect(result.summary).toContain('Run pnpm ztd ztd-config');
  expect(result.summary).toContain('`pnpm ztd feature scaffold --table users --action insert`');
  expect(result.summary).toContain('`pnpm ztd feature tests scaffold --feature users-insert`');
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
