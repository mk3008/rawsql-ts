import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, vi } from 'vitest';

import { DEFAULT_ZTD_CONFIG } from '../src/utils/ztdProjectConfig';
import {
  runInitCommand,
  buildPackageManagerArgs,
  findAncestorPnpmWorkspaceRoot,
  normalizeSchemaName,
  resolveInitInstallStrategy,
  resolvePackageManagerShellExecutable,
  resolvePnpmWorkspaceGuard,
  sanitizeSchemaFileName,
  type ZtdConfigWriterDependencies,
  type Prompter
} from '../src/commands/init';
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

const defaultSchemaName = DEFAULT_ZTD_CONFIG.ddl.defaultSchema;

function schemaFileName(schemaName: string): string {
  return `${sanitizeSchemaFileName(normalizeSchemaName(schemaName))}.sql`;
}

const schemaFilePath = (workspace: string, schemaName: string = defaultSchemaName): string =>
  path.join(workspace, DEFAULT_ZTD_CONFIG.ddlDir, schemaFileName(schemaName));

function readNormalizedFile(filePath: string): string {
  const contents = readFileSync(filePath, 'utf8');
  return contents.replace(/\r\n/g, '\n');
}

function runPnpmCommand(cwd: string, args: string[]) {
  return spawnSync(pnpmCommand, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
}

function runNpmCommand(cwd: string, args: string[]) {
  return spawnSync(npmCommand, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
}

function installScaffoldDependencies(cwd: string) {
  return runPnpmCommand(cwd, ['install', '--ignore-workspace']);
}

const requiredDirectories = [
  'ztd',
  'ztd/ddl',
  'src',
  'src/catalog',
  'src/catalog/runtime',
  'src/catalog/specs',
  'src/sql',
  'src/repositories',
  'src/repositories/tables',
  'src/repositories/views',
  'src/jobs',
  'tests',
  'tests/support'
];

const requiredWebapiDirectories = [
  'ztd',
  'ztd/ddl',
  'src',
  'src/domain',
  'src/application',
  'src/presentation',
  'src/presentation/http',
  'src/infrastructure',
  'src/infrastructure/persistence',
  'src/infrastructure/persistence/repositories',
  'src/infrastructure/persistence/repositories/views',
  'src/infrastructure/persistence/repositories/tables',
  'src/sql',
  'src/catalog',
  'src/catalog/runtime',
  'src/catalog/specs',
  'tests',
  'tests/support'
];

const requiredInternalAgents = [
  '.ztd/agents/manifest.json',
  '.ztd/agents/root.md',
  '.ztd/agents/src.md',
  '.ztd/agents/tests.md',
  '.ztd/agents/ztd.md'
];

const requiredInvariantFiles = [
  'src/catalog/specs/_smoke.spec.ts',
  'src/catalog/runtime/_coercions.ts',
  'src/catalog/runtime/_smoke.runtime.ts',
  'tests/smoke.validation.test.ts'
];

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

test('init wizard bootstraps an empty scaffold', async () => {
  const workspace = createTempDir('cli-init-empty');
  const prompter = new TestPrompter(['2', '1']);

  const result = await runInitCommand(prompter, { rootDir: workspace });

  const testkitClientPath = path.join(workspace, 'tests', 'support', 'testkit-client.ts');
  const schemaPath = schemaFilePath(workspace);

  expect(result.summary).toMatchSnapshot();
  expect(existsSync(schemaPath)).toBe(true);
  expect(readNormalizedFile(schemaPath)).toContain('-- DDL for schema');
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-layout.generated.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'tests', 'smoke.test.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'support', 'global-setup.ts'))).toBe(true);
  expect(existsSync(testkitClientPath)).toBe(true);
  expect(existsSync(path.join(workspace, 'vitest.config.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'package.json'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd.config.json'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'sql', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'repositories', 'views', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'repositories', 'tables', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'jobs', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'sql', 'user_account', 'list_user_profiles.sql'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'repositories', 'views', 'user-profiles.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'repositories', 'tables', 'user-accounts.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'jobs', 'refresh-user-accounts.ts'))).toBe(false);
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Zero Table Dependency');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('ZTD_TEST_DATABASE_URL');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('outside the ownership of `ztd-cli`');
  expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'AGENTS_ztd.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'CONTEXT.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd'))).toBe(false);
  expect(existsSync(path.join(workspace, 'ztd', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'ddl'))).toBe(true);
  expect(readdirSync(path.join(workspace, 'ztd', 'ddl'))).toEqual(
    expect.arrayContaining([schemaFileName(defaultSchemaName)]),
  );

  for (const dir of requiredDirectories) {
    expect(existsSync(path.join(workspace, dir))).toBe(true);
  }

  for (const invariantFile of requiredInvariantFiles) {
    expect(existsSync(path.join(workspace, invariantFile))).toBe(true);
  }
  expect(existsSync(path.join(workspace, 'src', 'sql', 'example-user', 'select_example_user_by_id.sql'))).toBe(
    false
  );

  const config = JSON.parse(readNormalizedFile(path.join(workspace, 'ztd.config.json'))) as {
    ddl: { defaultSchema: string; searchPath: string[] };
  };
  expect(config.ddl.defaultSchema).toBe(defaultSchemaName);
  expect(config.ddl.searchPath).toEqual([defaultSchemaName]);

  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  expect(packageJson.scripts.test).toBe('vitest run');
  expect(packageJson.scripts.typecheck).toBe('tsc --noEmit');
  expect(packageJson.devDependencies.vitest).toBeDefined();
  expect(packageJson.devDependencies.typescript).toBeDefined();
  expect(packageJson.devDependencies['@types/node']).toBeDefined();
  expect(packageJson.devDependencies['@rawsql-ts/ztd-cli']).toBeDefined();
  expect(packageJson.devDependencies.zod).toBeDefined();
  expect(packageJson.devDependencies).not.toHaveProperty('@rawsql-ts/adapter-node-pg');
  expect(packageJson.devDependencies).not.toHaveProperty('@rawsql-ts/testkit-postgres');

  expect(readNormalizedFile(path.join(workspace, 'src', 'catalog', 'specs', '_smoke.spec.ts'))).toContain(
    "from 'zod'",
  );
  expect(readNormalizedFile(path.join(workspace, 'src', 'catalog', 'runtime', '_smoke.runtime.ts'))).toContain(
    'parseSmokeOutput',
  );
  expect(readNormalizedFile(path.join(workspace, 'src', 'catalog', 'runtime', '_smoke.runtime.ts'))).toContain(
    "normalizeTimestamp(value.createdAt, 'createdAt')",
  );
  expect(readNormalizedFile(path.join(workspace, 'src', 'catalog', 'runtime', '_coercions.ts'))).toContain(
    'export function normalizeTimestamp',
  );
  expect(readNormalizedFile(path.join(workspace, 'tests', 'smoke.validation.test.ts'))).toContain(
    'normalizes valid timestamp strings',
  );
  expect(readNormalizedFile(path.join(workspace, 'tests', 'smoke.test.ts'))).toContain(
    'runtime contract wiring is usable before SQL-backed tests exist',
  );
  expect(readNormalizedFile(path.join(workspace, 'tests', 'smoke.test.ts'))).toContain(
    'SqlClient seam is either wired or fails with an actionable message',
  );
  expect(readNormalizedFile(path.join(workspace, 'tests', 'support', 'global-setup.ts'))).toContain(
    'ZTD_TEST_DATABASE_URL'
  );

  // Ensure the generated testkit client can safely log params with circular references.
  expect(readNormalizedFile(testkitClientPath)).toContain(
    'Provide a SqlClient implementation here',
  );
  expect(readNormalizedFile(testkitClientPath)).toContain(
    '@rawsql-ts/adapter-node-pg',
  );
});

test('init wizard bootstraps a scaffold with demo DDL', async () => {
  const workspace = createTempDir('cli-init-demo');
  const prompter = new TestPrompter(['3', '1']);

  const result = await runInitCommand(prompter, { rootDir: workspace });

  const schemaPath = schemaFilePath(workspace);

  expect(result.summary).toMatchSnapshot();
  expect(existsSync(schemaPath)).toBe(true);
  expect(readNormalizedFile(schemaPath)).toContain('create table "user" (');
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-layout.generated.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'tests', 'smoke.test.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'smoke.validation.test.ts'))).toBe(true);

  const config = JSON.parse(readNormalizedFile(path.join(workspace, 'ztd.config.json'))) as {
    ddl: { defaultSchema: string; searchPath: string[] };
  };
  expect(config.ddl.defaultSchema).toBe(defaultSchemaName);
  expect(config.ddl.searchPath).toEqual([defaultSchemaName]);
});

test('init webapi scaffold localizes ZTD guidance to persistence-oriented paths', async () => {
  const workspace = createTempDir('cli-init-webapi');
  const prompter = new TestPrompter([]);

  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'empty',
    validator: 'zod',
    appShape: 'webapi'
  });

  for (const dir of requiredWebapiDirectories) {
    expect(existsSync(path.join(workspace, dir))).toBe(true);
  }

  expect(existsSync(path.join(workspace, 'src', 'repositories'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'jobs'))).toBe(false);
  expect(existsSync(path.join(workspace, 'PROMPT_DOGFOOD.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'CONTEXT.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'domain', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'application', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'presentation', 'http', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'infrastructure', 'persistence', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'infrastructure', 'persistence', 'repositories', 'views', 'README.md'))).toBe(
    true
  );
  expect(existsSync(path.join(workspace, 'src', 'infrastructure', 'db', 'sql-client.ts'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'tests', 'support', 'testkit-client.ts'))).toContain(
    "../../src/infrastructure/db/sql-client"
  );
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('src/domain');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('pnpm exec ztd ztd-config');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('does not read it automatically');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('explicit target inspection');
  expect(readNormalizedFile(path.join(workspace, 'src', 'domain', 'README.md'))).not.toContain('ztd');
  expect(result.summary).toContain('src/domain/README.md');
  expect(result.summary).toContain('src/infrastructure/persistence/repositories/views/README.md');
  expect(result.summary).toContain('Run pnpm exec ztd ztd-config');
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
    appShape: 'webapi',
    withAiGuidance: true
  });

  expect(existsSync(path.join(workspace, 'CONTEXT.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'PROMPT_DOGFOOD.md'))).toBe(true);

  for (const agentPath of requiredInternalAgents) {
    expect(existsSync(path.join(workspace, agentPath))).toBe(true);
  }

  expect(readNormalizedFile(path.join(workspace, 'CONTEXT.md'))).toContain('src/domain');
  expect(readNormalizedFile(path.join(workspace, 'PROMPT_DOGFOOD.md'))).toContain('Convert to WebAPI');

  const manifest = JSON.parse(readNormalizedFile(path.join(workspace, '.ztd', 'agents', 'manifest.json'))) as {
    routing_rules: Array<{ paths: string[]; scope: string }>;
  };
  expect(manifest.routing_rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ scope: 'src-domain' }),
      expect.objectContaining({ scope: 'src-application' }),
      expect.objectContaining({ scope: 'src-presentation' }),
      expect.objectContaining({ scope: 'src-infrastructure-persistence' })
    ])
  );
});

test('init wizard leaves existing ztd/ddl directory untouched', async () => {
  const workspace = createTempDir('cli-init-existing-ztd-ddl');
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  mkdirSync(ddlDir, { recursive: true });

  const prompter = new TestPrompter(['2', '1']);
  await runInitCommand(prompter, { rootDir: workspace });

  expect(existsSync(ddlDir)).toBe(true);
  expect(readdirSync(ddlDir)).toEqual(expect.arrayContaining([schemaFileName(defaultSchemaName)]));
});

test('init requires --force before overwriting an existing DDL file in non-interactive mode', async () => {
  const workspace = createTempDir('cli-init-overwrite-safety');
  const existingSchemaPath = schemaFilePath(workspace);
  mkdirSync(path.dirname(existingSchemaPath), { recursive: true });
  writeFileSync(existingSchemaPath, '-- keep me\n', 'utf8');
  const prompter = new TestPrompter([]);

  await expect(
    runInitCommand(prompter, {
      rootDir: workspace,
      nonInteractive: true,
      workflow: 'demo',
      validator: 'zod'
    })
  ).rejects.toThrow('Re-run with --force to overwrite');

  expect(readNormalizedFile(existingSchemaPath)).toBe('-- keep me\n');
});

test('init with force can overwrite an existing DDL file in non-interactive mode', async () => {
  const workspace = createTempDir('cli-init-overwrite-force');
  const existingSchemaPath = schemaFilePath(workspace);
  mkdirSync(path.dirname(existingSchemaPath), { recursive: true });
  writeFileSync(existingSchemaPath, '-- keep me\n', 'utf8');
  const prompter = new TestPrompter([]);

  await runInitCommand(prompter, {
    rootDir: workspace,
    forceOverwrite: true,
    nonInteractive: true,
    workflow: 'demo',
    validator: 'zod'
  });

  expect(readNormalizedFile(existingSchemaPath)).toContain('create table "user" (');
});

test('init wizard can scaffold the optional SqlClient seam', async () => {
  const workspace = createTempDir('cli-init-sqlclient');
  const prompter = new TestPrompter(['2', '1']);

  const result = await runInitCommand(prompter, { rootDir: workspace, withSqlClient: true });

  const sqlClientPath = path.join(workspace, 'src', 'db', 'sql-client.ts');
  const repositoryTelemetryPath = path.join(
    workspace,
    'src',
    'infrastructure',
    'telemetry',
    'repositoryTelemetry.ts'
  );

  expect(existsSync(sqlClientPath)).toBe(true);
  expect(existsSync(repositoryTelemetryPath)).toBe(true);
  expect(readNormalizedFile(sqlClientPath)).toContain('export type SqlClient');
  expect(readNormalizedFile(repositoryTelemetryPath)).toContain('defaultRepositoryTelemetry');
  expect(result.summary).toContain('src/db/sql-client.ts');
  expect(result.summary).toContain('src/infrastructure/telemetry/repositoryTelemetry.ts');
});

test('init wizard preserves existing SqlClient files when opted in', async () => {
  const workspace = createTempDir('cli-init-sqlclient-existing');
  const sqlClientPath = path.join(workspace, 'src', 'db', 'sql-client.ts');
  const repositoryTelemetryPath = path.join(
    workspace,
    'src',
    'infrastructure',
    'telemetry',
    'repositoryTelemetry.ts'
  );
  mkdirSync(path.dirname(sqlClientPath), { recursive: true });
  mkdirSync(path.dirname(repositoryTelemetryPath), { recursive: true });
  writeFileSync(sqlClientPath, '// existing\n', 'utf8');
  writeFileSync(repositoryTelemetryPath, '// existing telemetry\n', 'utf8');

  const prompter = new TestPrompter(['2', '1']);
  const logs: string[] = [];
  const dependencies: Partial<ZtdConfigWriterDependencies> = {
    log: (message) => logs.push(message),
  };

  await runInitCommand(prompter, { rootDir: workspace, withSqlClient: true, dependencies });

  expect(readNormalizedFile(sqlClientPath)).toBe('// existing\n');
  expect(readNormalizedFile(repositoryTelemetryPath)).toBe('// existing telemetry\n');
  expect(logs.some((message) => message.includes('Skipping src/db/sql-client.ts because the file already exists.'))).toBe(
    true
  );
  expect(
    logs.some((message) =>
      message.includes('Skipping src/infrastructure/telemetry/repositoryTelemetry.ts because the file already exists.')
    )
  ).toBe(true);
});

test('repository telemetry scaffold dogfood scenario keeps the default hook replaceable and conservative', async () => {
  const workspace = createTempDir('cli-init-telemetry-dogfood');
  const prompter = new TestPrompter(['2', '1']);
  await runInitCommand(prompter, { rootDir: workspace, withSqlClient: true });

  const repositoryFile = path.join(workspace, 'src', 'repositories', 'views', 'ordersRepository.ts');
  writeFileSync(
    repositoryFile,
    [
      "import { resolveRepositoryTelemetry, type RepositoryTelemetry } from '../../infrastructure/telemetry/repositoryTelemetry';",
      '',
      'export class OrdersRepository {',
      '  private readonly telemetry: RepositoryTelemetry;',
      '',
      '  constructor(telemetry?: RepositoryTelemetry) {',
      '    this.telemetry = resolveRepositoryTelemetry(telemetry);',
      '  }',
      '',
      '  async listRecentOrders(): Promise<number> {',
      '    await this.telemetry.emit({',
      "      kind: 'query.execute.start',",
      "      timestamp: '2026-03-13T00:00:00.000Z',",
      "      repositoryName: 'OrdersRepository',",
      "      methodName: 'listRecentOrders',",
      "      queryName: 'orders.listRecent',",
      "      sqlText: 'select * from public.orders order by created_at desc limit 3',",
      '    });',
      '    await this.telemetry.emit({',
      "      kind: 'query.execute.success',",
      "      timestamp: '2026-03-13T00:00:00.012Z',",
      "      repositoryName: 'OrdersRepository',",
      "      methodName: 'listRecentOrders',",
      "      queryName: 'orders.listRecent',",
      '      durationMs: 12,',
      '      rowCount: 3,',
      "      sqlText: 'select * from public.orders order by created_at desc limit 3',",
      '    });',
      '    return 3;',
      '  }',
      '',
      '  async failRecentOrders(): Promise<void> {',
      '    await this.telemetry.emit({',
      "      kind: 'query.execute.error',",
      "      timestamp: '2026-03-13T00:00:00.099Z',",
      "      repositoryName: 'OrdersRepository',",
      "      methodName: 'failRecentOrders',",
      "      queryName: 'orders.listRecent',",
      '      durationMs: 99,',
      "      errorName: 'TimeoutError',",
      "      errorMessage: 'statement timed out',",
      "      sqlText: 'select * from public.orders order by created_at desc limit 3',",
      '    });',
      '  }',
      '}',
      '',
      'export function createSpyTelemetry(events: unknown[]): RepositoryTelemetry {',
      '  return {',
      '    emit(event): void {',
      '      events.push(event);',
      '    },',
      '  };',
      '}',
      '',
    ].join('\n'),
    'utf8'
  );

  const { OrdersRepository, createSpyTelemetry } = await import(pathToFileURL(repositoryFile).href) as {
    OrdersRepository: new (telemetry?: { emit(event: unknown): void }) => {
      listRecentOrders(): Promise<number>;
      failRecentOrders(): Promise<void>;
    };
    createSpyTelemetry(events: unknown[]): { emit(event: unknown): void };
  };

  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  try {
    const defaultRepository = new OrdersRepository();
    await defaultRepository.listRecentOrders();
    await defaultRepository.failRecentOrders();

    const infoPayloads = infoSpy.mock.calls.map((call) => call[1] as Record<string, unknown>);
    const errorPayloads = errorSpy.mock.calls.map((call) => call[1] as Record<string, unknown>);

    expect(infoPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'query.execute.start',
          repositoryName: 'OrdersRepository',
          methodName: 'listRecentOrders',
          queryName: 'orders.listRecent',
        }),
        expect.objectContaining({
          kind: 'query.execute.success',
          repositoryName: 'OrdersRepository',
          methodName: 'listRecentOrders',
          rowCount: 3,
          durationMs: 12,
        }),
      ])
    );
    expect(errorPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'query.execute.error',
          repositoryName: 'OrdersRepository',
          methodName: 'failRecentOrders',
          errorName: 'TimeoutError',
          errorMessage: 'statement timed out',
        }),
      ])
    );
    expect(infoPayloads.some((payload) => Object.hasOwn(payload, 'sqlText'))).toBe(false);
    expect(errorPayloads.some((payload) => Object.hasOwn(payload, 'sqlText'))).toBe(false);

    infoSpy.mockClear();
    errorSpy.mockClear();

    const customEvents: unknown[] = [];
    const customRepository = new OrdersRepository(createSpyTelemetry(customEvents));
    await customRepository.listRecentOrders();

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(customEvents).toEqual([
      expect.objectContaining({
        kind: 'query.execute.start',
        repositoryName: 'OrdersRepository',
        methodName: 'listRecentOrders',
        sqlText: 'select * from public.orders order by created_at desc limit 3',
      }),
      expect.objectContaining({
        kind: 'query.execute.success',
        repositoryName: 'OrdersRepository',
        methodName: 'listRecentOrders',
        rowCount: 3,
        sqlText: 'select * from public.orders order by created_at desc limit 3',
      }),
    ]);
  } finally {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  }
});

test('webapi telemetry dogfood scenario keeps repository guidance inside infrastructure persistence', async () => {
  const workspace = createTempDir('cli-init-telemetry-dogfood-webapi');
  const prompter = new TestPrompter([]);
  await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'empty',
    validator: 'zod',
    appShape: 'webapi'
  });

  const repositoryFile = path.join(
    workspace,
    'src',
    'infrastructure',
    'persistence',
    'repositories',
    'views',
    'ordersRepository.ts'
  );
  writeFileSync(
    repositoryFile,
    [
      "import { resolveRepositoryTelemetry, type RepositoryTelemetry } from '../../../telemetry/repositoryTelemetry';",
      '',
      'export class OrdersRepository {',
      '  private readonly telemetry: RepositoryTelemetry;',
      '',
      '  constructor(telemetry?: RepositoryTelemetry) {',
      '    this.telemetry = resolveRepositoryTelemetry(telemetry);',
      '  }',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );

  expect(readNormalizedFile(repositoryFile)).toContain('../../../telemetry/repositoryTelemetry');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('src/infrastructure/persistence');
  expect(existsSync(path.join(workspace, 'CONTEXT.md'))).toBe(false);
});

test('registry webapi scaffold exposes ztd via pnpm exec for dogfooding', async () => {
  const workspace = createTempDir('cli-init-webapi-ztd-registry');
  const prompter = new TestPrompter([]);

  await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'demo',
    validator: 'zod',
    appShape: 'webapi'
  });

  const installResult = installScaffoldDependencies(workspace);
  expect(installResult.status).toBe(0);

  const commandResult = runPnpmCommand(workspace, ['exec', 'ztd', 'ztd-config']);

  expect(commandResult.status).toBe(0);
  expect(commandResult.stdout).toContain('Generated 3 ZTD test rows');
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts'))).toBe(true);
});

test('generated scaffold compiles with Node16 ESM settings', async () => {
  const workspace = createTempDir('cli-init-node16-compile');
  const prompter = new TestPrompter([]);

  await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'empty',
    validator: 'zod'
  });

  const packageJsonPath = path.join(workspace, 'package.json');
  const packageJson = JSON.parse(readNormalizedFile(packageJsonPath)) as Record<string, unknown>;
  writeFileSync(
    packageJsonPath,
    `${JSON.stringify({ ...packageJson, type: 'module' }, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    path.join(workspace, 'tsconfig.node16.json'),
    `${JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: {
        module: 'Node16',
        moduleResolution: 'Node16',
        noEmit: true
      }
    }, null, 2)}\n`,
    'utf8'
  );

  const installResult = runNpmCommand(workspace, ['install']);
  expect(installResult.status).toBe(0);

  const typecheckResult = runNpmCommand(workspace, ['exec', '--', 'tsc', '-p', 'tsconfig.node16.json']);
  expect(typecheckResult.status).toBe(0);
});

test('init runs install when package.json is created from scratch', async () => {
  const workspace = createTempDir('cli-init-deps-created');
  const prompter = new TestPrompter(['2', '1']);
  const installs: Array<{ kind: string; packages: string[]; packageManager: string }> = [];
  const dependencies: Partial<ZtdConfigWriterDependencies> = {
    log: () => undefined,
    installPackages: ({ kind, packages, packageManager }) => {
      installs.push({ kind, packages, packageManager });
    }
  };

  await runInitCommand(prompter, { rootDir: workspace, dependencies });

  expect(installs.length).toBe(1);
  expect(installs[0].kind).toBe('install');
  expect(installs[0].packageManager).toBe('pnpm');
  expect(installs[0].packages).toEqual([]);
});


test('init runs install when package.json is updated', async () => {
  const workspace = createTempDir('cli-init-deps');
  writeFileSync(
    path.join(workspace, 'package.json'),
    JSON.stringify({ name: 'ztd-project', version: '0.0.0' }, null, 2),
    'utf8'
  );

  const prompter = new TestPrompter(['2', '1']);
  const installs: Array<{ kind: string; packages: string[]; packageManager: string }> = [];
  const dependencies: Partial<ZtdConfigWriterDependencies> = {
    log: () => undefined,
    installPackages: ({ kind, packages, packageManager }) => {
      installs.push({ kind, packages, packageManager });
    }
  };

  await runInitCommand(prompter, { rootDir: workspace, dependencies });

  expect(installs.length).toBe(1);
  expect(installs[0].kind).toBe('install');
  expect(installs[0].packageManager).toBe('pnpm');
  expect(installs[0].packages).toEqual([]);

  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  expect(packageJson.scripts.test).toBe('vitest run');
  expect(packageJson.scripts.typecheck).toBe('tsc --noEmit');
  expect(packageJson.devDependencies.vitest).toBeDefined();
  expect(packageJson.devDependencies.typescript).toBeDefined();
  expect(packageJson.devDependencies['@types/node']).toBeDefined();
});

test('pnpm nested under a parent workspace uses --ignore-workspace for manual installs', () => {
  const workspace = createTempDir('cli-init-workspace-guard');

  expect(findAncestorPnpmWorkspaceRoot(workspace)).toBe(repoRoot);
  expect(resolvePnpmWorkspaceGuard(workspace, 'pnpm')).toEqual({
    workspaceRoot: repoRoot,
    shouldIgnoreWorkspace: true,
  });
  expect(buildPackageManagerArgs('install', 'pnpm', [], workspace)).toEqual([
    'install',
    '--ignore-workspace',
  ]);
  expect(buildPackageManagerArgs('devDependencies', 'pnpm', ['vitest'], workspace)).toEqual([
    'add',
    '-D',
    'vitest',
    '--ignore-workspace',
  ]);
});

test('resolveInitInstallStrategy defers auto-install for Windows pnpm exec', () => {
  const workspace = path.join(repoRoot, 'tmp', 'init-install-strategy');

  expect(
    resolveInitInstallStrategy(workspace, 'pnpm', {
      platform: 'win32',
      npmCommand: 'exec'
    })
  ).toMatchObject({
    installCommand: 'pnpm install --ignore-workspace',
    shouldDeferAutoInstall: true,
    workspaceGuard: {
      workspaceRoot: repoRoot,
      shouldIgnoreWorkspace: true,
    },
  });

  expect(
    resolveInitInstallStrategy(workspace, 'pnpm', {
      platform: 'win32',
      npmCommand: 'install'
    }).shouldDeferAutoInstall
  ).toBe(false);
});

test('resolveInitInstallStrategy keeps manual add commands workspace-safe for Windows pnpm exec', () => {
  const workspace = path.join(repoRoot, 'tmp', 'init-install-strategy');

  expect(buildPackageManagerArgs('devDependencies', 'pnpm', ['vitest', 'typescript'], workspace)).toEqual([
    'add',
    '-D',
    'vitest',
    'typescript',
    '--ignore-workspace',
  ]);

  expect(
    resolveInitInstallStrategy(workspace, 'pnpm', {
      platform: 'win32',
      npmCommand: 'exec'
    }).shouldDeferAutoInstall
  ).toBe(true);
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

test('init generates ArkType spec when ArkType backend is selected', async () => {
  const workspace = createTempDir('cli-init-arktype');
  const prompter = new TestPrompter(['2', '2']);

  await runInitCommand(prompter, { rootDir: workspace });

  const specFile = readNormalizedFile(
    path.join(workspace, 'src', 'catalog', 'specs', '_smoke.spec.ts'),
  );
  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    devDependencies: Record<string, string>;
  };

  expect(specFile).toContain("from 'arktype'");
  expect(specFile).toContain("createdAt: 'Date'");
  expect(packageJson.devDependencies.arktype).toBeDefined();
  expect(packageJson.devDependencies.zod).toBeUndefined();
});

test('init wizard pulls schema if pg_dump is available', async () => {
  const workspace = createTempDir('cli-init-db');
  const pulledSchema = `
    CREATE TABLE public.migrated (
      id serial PRIMARY KEY,
      payload text
    );
  `;
  let pullCount = 0;

  const prompter = new TestPrompter(['1', 'postgres://user@host/db', '1']);
  const dependencies: Partial<ZtdConfigWriterDependencies> = {
    checkPgDump: () => true,
    runPullSchema: async (options) => {
      pullCount += 1;
      expect(options.schemas).toEqual([defaultSchemaName]);
      mkdirSync(options.out, { recursive: true });
      writeFileSync(path.join(options.out, schemaFileName(defaultSchemaName)), pulledSchema, 'utf8');
    }
  };

  const result = await runInitCommand(prompter, { rootDir: workspace, dependencies });

  const testkitClientPath = path.join(workspace, 'tests', 'support', 'testkit-client.ts');

  expect(pullCount).toBe(1);
  expect(result.summary).toMatchSnapshot();
  expect(readNormalizedFile(schemaFilePath(workspace, defaultSchemaName))).toContain('CREATE TABLE public.migrated');
  expect(existsSync(path.join(workspace, 'README.md'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Zero Table Dependency');
  expect(existsSync(path.join(workspace, 'ztd.config.json'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-layout.generated.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'tests', 'smoke.test.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'smoke.validation.test.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'support', 'global-setup.ts'))).toBe(true);
  expect(existsSync(testkitClientPath)).toBe(true);
  expect(existsSync(path.join(workspace, 'vitest.config.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(false);
  expect(existsSync(path.join(workspace, 'AGENTS_ztd.md'))).toBe(false);
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'manifest.json'))).toBe(false);
  expect(existsSync(path.join(workspace, 'ztd', 'README.md'))).toBe(true);
  expect(readdirSync(path.join(workspace, 'ztd', 'ddl'))).toEqual(
    expect.arrayContaining([schemaFileName(defaultSchemaName)]),
  );

  const config = JSON.parse(readNormalizedFile(path.join(workspace, 'ztd.config.json'))) as {
    ddl: { defaultSchema: string; searchPath: string[] };
  };
  expect(config.ddl.defaultSchema).toBe(defaultSchemaName);
  expect(config.ddl.searchPath).toEqual([defaultSchemaName]);

  // Ensure the generated testkit client can safely log params with circular references.
  expect(readNormalizedFile(testkitClientPath)).toContain(
    'Provide a SqlClient implementation here',
  );
});

test('init wizard rejects when pg_dump is missing', async () => {
  const workspace = createTempDir('cli-init-pg-missing');
  const prompter = new TestPrompter(['1', '']);

  await expect(
    runInitCommand(prompter, {
      rootDir: workspace,
      dependencies: {
        checkPgDump: () => false,
      },
    }),
  ).rejects.toThrow('Unable to find pg_dump');
  expect(existsSync(path.join(workspace, 'ztd'))).toBe(false);
  expect(existsSync(path.join(workspace, 'tests'))).toBe(false);
  expect(existsSync(path.join(workspace, 'README.md'))).toBe(false);
});

test('init resolves defaults non-interactively without explicit workflow/validator', async () => {
  const workspace = createTempDir('cli-init-noninteractive');
  // Prompter should never be called — pass one with no responses to detect stray prompts.
  const prompter = new TestPrompter([]);

  // Omit workflow and validator to verify runInitCommand resolves them internally.
  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    forceOverwrite: true,
    nonInteractive: true
  });

  const schemaPath = schemaFilePath(workspace);

  // Default workflow is 'demo', default validator is 'zod'.
  expect(result.summary).toContain('ZTD project initialized');
  expect(existsSync(schemaPath)).toBe(true);
  expect(readNormalizedFile(schemaPath)).toContain('create table "user" (');
  expect(existsSync(path.join(workspace, 'tests', 'smoke.test.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'smoke.validation.test.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd.config.json'))).toBe(true);

  const specFile = readNormalizedFile(
    path.join(workspace, 'src', 'catalog', 'specs', '_smoke.spec.ts'),
  );
  expect(specFile).toContain("from 'zod'");
});

test('init completes non-interactively with explicit --workflow empty --validator arktype', async () => {
  const workspace = createTempDir('cli-init-noninteractive-empty-arktype');
  const prompter = new TestPrompter([]);

  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    forceOverwrite: true,
    nonInteractive: true,
    workflow: 'empty',
    validator: 'arktype'
  });

  const schemaPath = schemaFilePath(workspace);

  expect(result.summary).toContain('ZTD project initialized');
  expect(existsSync(schemaPath)).toBe(true);
  expect(readNormalizedFile(schemaPath)).toContain('-- DDL for schema');

  const specFile = readNormalizedFile(
    path.join(workspace, 'src', 'catalog', 'specs', '_smoke.spec.ts'),
  );
  expect(specFile).toContain("from 'arktype'");
});

test('init local-source mode links direct rawsql-ts dependencies from the monorepo without exposing local-source shims to consumer code', async () => {
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
  const coercionsPath = path.join(workspace, 'src', 'catalog', 'runtime', '_coercions.ts');
  const localSourceGuardPath = path.join(workspace, 'scripts', 'local-source-guard.mjs');

  expect(result.summary).toContain('Run pnpm install --ignore-workspace');
  expect(result.summary).toContain('Run pnpm typecheck');
  expect(result.summary).toContain('Run pnpm test');
  expect(result.summary).toContain('@rawsql-ts/sql-contract backed by a local file dependency in developer mode');
  expect(existsSync(path.join(workspace, 'src', 'local', 'sql-contract.ts'))).toBe(false);
  expect(existsSync(localSourceGuardPath)).toBe(true);
  expect(readNormalizedFile(coercionsPath)).toContain('export function normalizeTimestamp');
  expect(packageJson.devDependencies['@rawsql-ts/sql-contract']).toBe(
    `file:${path.relative(workspace, path.join(repoRoot, 'packages', 'sql-contract')).replace(/\\/g, '/')}`
  );
  expect(packageJson.devDependencies).not.toHaveProperty('@rawsql-ts/ztd-cli');
  expect(packageJson.devDependencies).not.toHaveProperty('@rawsql-ts/adapter-node-pg');
  expect(packageJson.devDependencies).not.toHaveProperty('@rawsql-ts/testkit-postgres');
  expect(packageJson.scripts.typecheck).toBe('node ./scripts/local-source-guard.mjs typecheck');
  expect(packageJson.scripts.test).toBe('node ./scripts/local-source-guard.mjs test');
  expect(packageJson.scripts.ztd).toBe('node ./scripts/local-source-guard.mjs ztd');
  expect(readNormalizedFile(localSourceGuardPath)).toContain('Requested subcommand');
  expect(readNormalizedFile(localSourceGuardPath)).toContain('Project root');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('pnpm install --ignore-workspace');
  expect(result.summary).toContain('Run pnpm ztd ztd-config');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('pnpm ztd ztd-config');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain(
    'The scaffold keeps `@rawsql-ts/sql-contract` as a normal package import even in local-source developer mode.'
  );

  const installResult = installScaffoldDependencies(workspace);
  expect(installResult.status).toBe(0);

  const guardResult = spawnSync(process.execPath, [localSourceGuardPath, 'typecheck'], {
    cwd: workspace,
    encoding: 'utf8'
  });
  expect(guardResult.status).toBe(0);
});

test('local-source webapi scaffold exposes ztd via pnpm ztd for dogfooding', async () => {
  const workspace = createTempDir('cli-init-webapi-ztd-local-source');
  const prompter = new TestPrompter([]);

  await runInitCommand(prompter, {
    rootDir: workspace,
    nonInteractive: true,
    forceOverwrite: true,
    workflow: 'demo',
    validator: 'zod',
    appShape: 'webapi',
    localSourceRoot: repoRoot
  });

  const installResult = installScaffoldDependencies(workspace);
  expect(installResult.status).toBe(0);

  const commandResult = runPnpmCommand(workspace, ['ztd', 'ztd-config']);

  expect(commandResult.status).toBe(0);
  expect(commandResult.stdout).toContain('Generated 3 ZTD test rows');
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts'))).toBe(true);
});

test('init local-source mode uses npm script commands when package-lock.json selects npm', async () => {
  const workspace = createTempDir('cli-init-local-source-npm');
  const prompter = new TestPrompter([]);
  const dependencies: Partial<ZtdConfigWriterDependencies> = {
    log: () => undefined,
    installPackages: () => undefined
  };
  writeFileSync(path.join(workspace, 'package-lock.json'), '{}', 'utf8');

  const result = await runInitCommand(prompter, {
    dependencies,
    rootDir: workspace,
    forceOverwrite: true,
    nonInteractive: true,
    workflow: 'empty',
    validator: 'zod',
    localSourceRoot: repoRoot
  });

  expect(result.summary).toContain('Run npm install');
  expect(result.summary).toContain('Run npm run typecheck');
  expect(result.summary).toContain('Run npm run test');
  expect(result.summary).toContain('Run npm run ztd -- ztd-config');
});

test('init local-source mode rejects a root that is not a rawsql-ts monorepo', async () => {
  const workspace = createTempDir('cli-init-local-source-invalid');
  const prompter = new TestPrompter([]);

  await expect(
    runInitCommand(prompter, {
      rootDir: workspace,
      forceOverwrite: true,
      nonInteractive: true,
      workflow: 'empty',
      validator: 'zod',
      localSourceRoot: path.join(workspace, 'not-a-monorepo')
    })
  ).rejects.toThrow('The local-source root does not contain packages/sql-contract/package.json');
});

test('init local-source mode accepts a minimal local-source root with sql-contract only', async () => {
  const workspace = createTempDir('cli-init-local-source-minimal-stack');
  const localSourceRoot = createTempDir('cli-init-local-source-minimal-monorepo');
  const prompter = new TestPrompter([]);

  mkdirSync(path.join(localSourceRoot, 'packages', 'sql-contract'), { recursive: true });
  writeFileSync(
    path.join(localSourceRoot, 'packages', 'sql-contract', 'package.json'),
    JSON.stringify({ name: '@rawsql-ts/sql-contract', version: '0.0.0' }, null, 2),
    'utf8'
  );

  const result = await runInitCommand(prompter, {
    rootDir: workspace,
    forceOverwrite: true,
    nonInteractive: true,
    workflow: 'empty',
    validator: 'zod',
    localSourceRoot
  });

  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    devDependencies: Record<string, string>;
  };

  expect(result.summary).toContain('ZTD project initialized.');
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/sql-contract');
  expect(packageJson.devDependencies).not.toHaveProperty('@rawsql-ts/ztd-cli');
  expect(packageJson.devDependencies).not.toHaveProperty('@rawsql-ts/adapter-node-pg');
  expect(packageJson.devDependencies).not.toHaveProperty('@rawsql-ts/testkit-postgres');
});

test('init rejects non-interactive pg_dump workflow', async () => {
  const workspace = createTempDir('cli-init-noninteractive-pgdump');
  const prompter = new TestPrompter([]);

  await expect(
    runInitCommand(prompter, {
      rootDir: workspace,
      forceOverwrite: true,
      nonInteractive: true,
      workflow: 'pg_dump'
    })
  ).rejects.toThrow('Non-interactive mode does not support the pg_dump workflow');
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

test('TestPrompter.confirm maps yes and no variants', async () => {
  const prompter = new TestPrompter(['y', 'yes', 'n']);
  expect(await prompter.confirm('still there?')).toBe(true);
  expect(await prompter.confirm('again?')).toBe(true);
  expect(await prompter.confirm('final?')).toBe(false);
});

test('TestPrompter.selectChoice rejects invalid inputs', async () => {
  await expect(
    new TestPrompter(['foo']).selectChoice('option?', ['a', 'b'])
  ).rejects.toThrow('Invalid choice');
  await expect(
    new TestPrompter(['99']).selectChoice('option?', ['only'])
  ).rejects.toThrow('outside the valid range');
});
