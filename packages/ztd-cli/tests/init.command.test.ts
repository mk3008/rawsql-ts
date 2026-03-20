import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import {
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
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('src/features/smoke');
  expect(existsSync(path.join(workspace, 'src', 'features', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'README.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'domain', 'smoke-policy.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'application', 'smoke-workflow.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'persistence', 'smoke.sql'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'persistence', 'smoke.spec.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.validation.test.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.test.ts'))).toBe(true);
  expect(
    readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'persistence', 'smoke.sql'))
  ).toContain(':id::integer as id');
  expect(
    readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.test.ts'))
  ).toContain("../application/smoke-workflow.js");
  expect(
    readNormalizedFile(path.join(workspace, 'src', 'features', 'smoke', 'tests', 'smoke.validation.test.ts'))
  ).toContain("../domain/smoke-policy.js");
  expect(readNormalizedFile(path.join(workspace, 'vitest.config.ts'))).toContain(
    "src/features/**/*.test.ts"
  );
  expect(existsSync(path.join(workspace, 'src', 'domain'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'application'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'presentation'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'infrastructure'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'jobs'))).toBe(false);
  expect(existsSync(path.join(workspace, 'compose.yaml'))).toBe(false);
  expect(result.summary).toContain('src/features/smoke/tests/smoke.test.ts');
  expect(result.summary).toContain('src/features/README.md');
});

test('init starter bootstraps visible AGENTS, compose, starter DDL, and smoke tests', { timeout: 60_000 }, async () => {
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
  expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', 'smoke', 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'tests', 'AGENTS.md'))).toBe(true);
  expect(existsSync(path.join(workspace, 'compose.yaml'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'compose.yaml'))).toContain('image: postgres:17');
  expect(readNormalizedFile(path.join(workspace, 'compose.yaml'))).toContain('ZTD_TEST_DATABASE_URL');
  expect(ddlFiles.length).toBeGreaterThan(0);
  expect(
    readNormalizedFile(path.join(workspace, 'ztd', 'ddl', ddlFiles[0]))
  ).toContain('create table users');
  expect(
    readNormalizedFile(path.join(workspace, 'ztd', 'ddl', ddlFiles[0]))
  ).toContain('Starter user directory for the first CRUD feature');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('Starter Flow');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('ZTD_TEST_DATABASE_URL');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('src/features/users');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('npx ztd ztd-config');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('npx ztd model-gen');
  expect(readNormalizedFile(path.join(workspace, 'README.md'))).toContain('npm run test');
  const packageJson = JSON.parse(readNormalizedFile(path.join(workspace, 'package.json'))) as {
    devDependencies: Record<string, string>;
  };
  expect(packageJson.devDependencies).toHaveProperty('@rawsql-ts/sql-contract');
  expect(result.summary).toContain('compose.yaml');
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
  expect(existsSync(path.join(workspace, '.ztd', 'agents', 'src-features-smoke.md'))).toBe(true);
  expect(readNormalizedFile(path.join(workspace, 'CONTEXT.md'))).toContain('Start with `ztd init --starter`');
  expect(readNormalizedFile(path.join(workspace, 'CONTEXT.md'))).toContain('src/features/smoke');
  expect(readNormalizedFile(path.join(workspace, 'CONTEXT.md'))).toContain('src/features/users');

  const manifest = JSON.parse(readNormalizedFile(path.join(workspace, '.ztd', 'agents', 'manifest.json'))) as {
    routing_rules: Array<{ paths: string[]; scope: string }>;
  };
  expect(manifest.routing_rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ scope: 'src-features' }),
      expect.objectContaining({ scope: 'src-features-smoke-persistence' }),
      expect.objectContaining({ scope: 'src-features-smoke-tests' })
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
  expect(result.summary).toContain('src/features/smoke/tests/smoke.test.ts');
  expect(existsSync(localSourceGuardPath)).toBe(true);
  expect(packageJson.devDependencies['@rawsql-ts/sql-contract']).toBe(
    `file:${path.relative(workspace, path.join(repoRoot, 'packages', 'sql-contract')).replace(/\\/g, '/')}`
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
