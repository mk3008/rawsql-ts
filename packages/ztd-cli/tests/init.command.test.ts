import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { DEFAULT_ZTD_CONFIG } from '../src/utils/ztdProjectConfig';
import { runInitCommand, type ZtdConfigWriterDependencies, type Prompter } from '../src/commands/init';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

const schemaFileName = `${DEFAULT_ZTD_CONFIG.ddl.defaultSchema}.sql`;
const schemaFilePath = (workspace: string): string =>
  path.join(workspace, DEFAULT_ZTD_CONFIG.ddlDir, schemaFileName);

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

  async confirm(_question: string): Promise<boolean> {
    const answer = this.nextResponse().trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  }

  close(): void {
    // No resources to clean up in the mock prompter.
  }
}

test('init wizard bootstraps a repo when writing DDL manually', async () => {
  const workspace = createTempDir('cli-init-ddl');
  const prompter = new TestPrompter(['2']);

  const result = await runInitCommand(prompter, { rootDir: workspace });

  const testkitClientPath = path.join(workspace, 'tests', 'support', 'testkit-client.ts');

  expect(result.summary).toMatchSnapshot();
  expect(existsSync(schemaFilePath(workspace))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-layout.generated.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'support', 'global-setup.ts'))).toBe(true);
  expect(existsSync(testkitClientPath)).toBe(true);
  expect(existsSync(path.join(workspace, 'vitest.config.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd.config.json'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Zero Table Dependency');
  expect(readNormalizedFile(schemaFilePath(workspace))).toContain('CREATE TABLE public.example');
  expect(
    readNormalizedFile(path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts'))
  ).toContain('export interface TestRowMap');
  expect(readNormalizedFile(path.join(workspace, 'tests', 'generated', 'ztd-layout.generated.ts'))).toContain(
    `ztdRootDir`
  );
  expect(
    existsSync(path.join(workspace, 'AGENTS.md')) || existsSync(path.join(workspace, 'AGENTS_ztd.md'))
  ).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'domain-specs'))).toBe(true);
  expect(readdirSync(path.join(workspace, 'ztd', 'domain-specs'))).toEqual([]);
  expect(existsSync(path.join(workspace, 'ztd', 'enums'))).toBe(true);
  expect(readdirSync(path.join(workspace, 'ztd', 'enums'))).toEqual([]);

  // Ensure the generated testkit client can safely log params with circular references.
  expect(readNormalizedFile(testkitClientPath)).toContain('[Circular]');
});

test('init wizard leaves existing ztd anchor directories untouched', async () => {
  const workspace = createTempDir('cli-init-existing-ztd-dirs');
  const domainSpecsDir = path.join(workspace, 'ztd', 'domain-specs');
  const enumsDir = path.join(workspace, 'ztd', 'enums');
  // Pre-create the anchors to prove init leaves them intact.
  mkdirSync(domainSpecsDir, { recursive: true });
  mkdirSync(enumsDir, { recursive: true });

  const prompter = new TestPrompter(['2']);
  await runInitCommand(prompter, { rootDir: workspace });

  expect(existsSync(domainSpecsDir)).toBe(true);
  expect(existsSync(enumsDir)).toBe(true);
  expect(readdirSync(domainSpecsDir)).toEqual([]);
  expect(readdirSync(enumsDir)).toEqual([]);
});

test('init wizard can scaffold the optional SqlClient seam', async () => {
  const workspace = createTempDir('cli-init-sqlclient');
  const prompter = new TestPrompter(['2']);

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

  const prompter = new TestPrompter(['2']);
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

test('init installs template-referenced packages when package.json exists', async () => {
  const workspace = createTempDir('cli-init-deps');
  writeFileSync(
    path.join(workspace, 'package.json'),
    JSON.stringify({ name: 'ztd-project', version: '0.0.0' }, null, 2),
    'utf8'
  );

  const prompter = new TestPrompter(['2']);
  const installs: Array<{ kind: string; packages: string[]; packageManager: string }> = [];
  const dependencies: Partial<ZtdConfigWriterDependencies> = {
    log: () => undefined,
    installPackages: ({ kind, packages, packageManager }) => {
      installs.push({ kind, packages, packageManager });
    }
  };

  await runInitCommand(prompter, { rootDir: workspace, dependencies });

  expect(installs.length).toBe(1);
  expect(installs[0].kind).toBe('devDependencies');
  expect(installs[0].packageManager).toBe('pnpm');
  expect(installs[0].packages).toEqual(
    expect.arrayContaining([
      '@rawsql-ts/pg-testkit',
      '@rawsql-ts/testkit-core',
      '@testcontainers/postgresql',
      'pg',
      'vitest'
    ])
  );
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

  const prompter = new TestPrompter(['1', 'postgres://user@host/db']);
  const dependencies: Partial<ZtdConfigWriterDependencies> = {
    checkPgDump: () => true,
    runPullSchema: async (options) => {
      pullCount += 1;
      mkdirSync(options.out, { recursive: true });
      writeFileSync(path.join(options.out, schemaFileName), pulledSchema, 'utf8');
    }
  };

  const result = await runInitCommand(prompter, { rootDir: workspace, dependencies });

  const testkitClientPath = path.join(workspace, 'tests', 'support', 'testkit-client.ts');

  expect(pullCount).toBe(1);
  expect(result.summary).toMatchSnapshot();
  expect(readNormalizedFile(schemaFilePath(workspace))).toContain('CREATE TABLE public.migrated');
  expect(existsSync(path.join(workspace, 'README.md'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Zero Table Dependency');
  expect(existsSync(path.join(workspace, 'ztd.config.json'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts'))).toBe(true);
  expect(
    readNormalizedFile(path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts'))
  ).toContain('export interface TestRowMap');
  expect(existsSync(path.join(workspace, 'tests', 'generated', 'ztd-layout.generated.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'support', 'global-setup.ts'))).toBe(true);
  expect(existsSync(testkitClientPath)).toBe(true);
  expect(existsSync(path.join(workspace, 'vitest.config.ts'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'tests', 'generated', 'ztd-layout.generated.ts'))).toContain(
    'enumsDir'
  );
  expect(
    existsSync(path.join(workspace, 'AGENTS.md')) || existsSync(path.join(workspace, 'AGENTS_ztd.md'))
  ).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'ztd', 'README.md'))).toBe(true);

  // Ensure the generated testkit client can safely log params with circular references.
  expect(readNormalizedFile(testkitClientPath)).toContain('[Circular]');
});

test('init wizard rejects when pg_dump is missing', async () => {
  const workspace = createTempDir('cli-init-pg-missing');
  const prompter = new TestPrompter(['1', 'postgres://user@host/db']);

  await expect(
    runInitCommand(prompter, {
      rootDir: workspace,
      dependencies: {
        checkPgDump: () => false
      }
    })
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
