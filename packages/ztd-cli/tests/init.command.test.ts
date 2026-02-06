import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { DEFAULT_ZTD_CONFIG } from '../src/utils/ztdProjectConfig';
import {
  runInitCommand,
  normalizeSchemaName,
  sanitizeSchemaFileName,
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
  'tests/support',
  'tests/generated'
];

const requiredAgents = [
  'ztd/AGENTS.md',
  'ztd/ddl/AGENTS.md',
  'src/AGENTS.md',
  'src/catalog/AGENTS.md',
  'src/catalog/runtime/AGENTS.md',
  'src/catalog/specs/AGENTS.md',
  'src/sql/AGENTS.md',
  'src/repositories/AGENTS.md',
  'src/repositories/tables/AGENTS.md',
  'src/repositories/views/AGENTS.md',
  'src/jobs/AGENTS.md',
  'tests/AGENTS.md',
  'tests/support/AGENTS.md',
  'tests/generated/AGENTS.md'
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
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'AGENTS.md'))).toBe(true);
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
  expect(
    existsSync(path.join(workspace, 'AGENTS.md')) || existsSync(path.join(workspace, 'AGENTS_ztd.md'))
  ).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'ddl'))).toBe(true);
  expect(readdirSync(path.join(workspace, 'ztd', 'ddl'))).toEqual(
    expect.arrayContaining([schemaFileName(defaultSchemaName)]),
  );

  for (const dir of requiredDirectories) {
    expect(existsSync(path.join(workspace, dir))).toBe(true);
  }

  for (const agentPath of requiredAgents) {
    expect(existsSync(path.join(workspace, agentPath))).toBe(true);
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
  expect(packageJson.devDependencies.zod).toBeDefined();

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
    'timestampFromDriver as normalizeTimestamp',
  );
  expect(readNormalizedFile(path.join(workspace, 'tests', 'smoke.validation.test.ts'))).toContain(
    'normalizes valid timestamp strings',
  );

  // Ensure the generated testkit client can safely log params with circular references.
  expect(readNormalizedFile(testkitClientPath)).toContain(
    'Provide a SqlClient implementation here',
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

test('init wizard leaves existing ztd/ddl directory untouched', async () => {
  const workspace = createTempDir('cli-init-existing-ztd-ddl');
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  mkdirSync(ddlDir, { recursive: true });

  const prompter = new TestPrompter(['2', '1']);
  await runInitCommand(prompter, { rootDir: workspace });

  expect(existsSync(ddlDir)).toBe(true);
  expect(readdirSync(ddlDir)).toEqual(expect.arrayContaining([schemaFileName(defaultSchemaName)]));
});

test('init wizard can scaffold the optional SqlClient seam', async () => {
  const workspace = createTempDir('cli-init-sqlclient');
  const prompter = new TestPrompter(['2', '1']);

  const result = await runInitCommand(prompter, { rootDir: workspace, withSqlClient: true });

  const sqlClientPath = path.join(workspace, 'src', 'db', 'sql-client.ts');

  expect(existsSync(sqlClientPath)).toBe(true);
  expect(readNormalizedFile(sqlClientPath)).toContain('export type SqlClient');
  expect(result.summary).toContain('src/db/sql-client.ts');
});

test('init wizard preserves existing SqlClient files when opted in', async () => {
  const workspace = createTempDir('cli-init-sqlclient-existing');
  const sqlClientPath = path.join(workspace, 'src', 'db', 'sql-client.ts');
  mkdirSync(path.dirname(sqlClientPath), { recursive: true });
  writeFileSync(sqlClientPath, '// existing\n', 'utf8');

  const prompter = new TestPrompter(['2', '1']);
  const logs: string[] = [];
  const dependencies: Partial<ZtdConfigWriterDependencies> = {
    log: (message) => logs.push(message),
  };

  await runInitCommand(prompter, { rootDir: workspace, withSqlClient: true, dependencies });

  expect(readNormalizedFile(sqlClientPath)).toBe('// existing\n');
  expect(logs.some((message) => message.includes('Skipping src/db/sql-client.ts because the file already exists.'))).toBe(
    true
  );
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
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'smoke.test.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'smoke.validation.test.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'support', 'global-setup.ts'))).toBe(true);
  expect(existsSync(testkitClientPath)).toBe(true);
  expect(existsSync(path.join(workspace, 'vitest.config.ts'))).toBe(true);
  expect(
    existsSync(path.join(workspace, 'AGENTS.md')) || existsSync(path.join(workspace, 'AGENTS_ztd.md'))
  ).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'AGENTS.md'))).toBe(true);
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
