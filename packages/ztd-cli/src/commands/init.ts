import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

import { ensureDirectory } from '../utils/fs';
import { copyAgentsTemplate, installVisibleAgents, writeInternalAgentsArtifacts } from '../utils/agents';
import { DEFAULT_ZTD_CONFIG, writeZtdProjectConfig } from '../utils/ztdProjectConfig';
import { runGenerateZtdConfig, type ZtdConfigGenerationOptions } from './ztdConfig';
import { runPullSchema, type PullSchemaOptions } from './pull';
import { isJsonOutput, parseJsonPayload, writeCommandEnvelope } from '../utils/agentCli';
import { rejectControlChars, rejectEncodedTraversal } from '../utils/agentSafety';

type PackageManager = 'pnpm' | 'npm' | 'yarn';
type PackageInstallKind = 'devDependencies' | 'install';
interface PnpmWorkspaceGuard {
  workspaceRoot: string | null;
  shouldIgnoreWorkspace: boolean;
}

interface NpmWorkspaceGuard {
  workspaceRoot: string | null;
  shouldDisableWorkspaces: boolean;
}

/**
 * Prompt interface for interactive input during `ztd init`.
 */
export interface Prompter {
  selectChoice(question: string, choices: string[]): Promise<number>;
  promptInput(question: string, example?: string): Promise<string>;
  promptInputWithDefault(question: string, defaultValue: string, example?: string): Promise<string>;
  confirm(question: string): Promise<boolean>;
  close(): void;
}

/**
 * Create a readline-backed prompter that reads from stdin/stdout.
 */
export function createConsolePrompter(): Prompter {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdout.isTTY
  });

  async function requestLine(question: string): Promise<string> {
    return (await rl.question(question)).trim();
  }

  async function requestLineWithDefault(
    question: string,
    defaultValue: string,
    example?: string
  ): Promise<string> {
    const prompt = `${question}${example ? ` (${example})` : ''} [default: ${defaultValue}]: `;
    const answer = await requestLine(prompt);
    return answer.length > 0 ? answer : defaultValue;
  }

  return {
    async selectChoice(question: string, choices: string[]): Promise<number> {
      while (true) {
        console.log(question);
        for (let i = 0; i < choices.length; i += 1) {
          console.log(`  ${i + 1}. ${choices[i]}`);
        }

        const answer = await requestLine('Select an option: ');
        const selected = Number(answer);
        if (Number.isFinite(selected) && selected >= 1 && selected <= choices.length) {
          return selected - 1;
        }
        console.log('Please choose a valid option number.');
      }
    },

    async promptInput(question: string, example?: string): Promise<string> {
      while (true) {
        const answer = await requestLine(`${question}${example ? ` (${example})` : ''}: `);
        if (answer.length > 0) {
          return answer;
        }
        console.log('This value cannot be empty.');
      }
    },

    async promptInputWithDefault(question: string, defaultValue: string, example?: string): Promise<string> {
      return requestLineWithDefault(question, defaultValue, example);
    },

    async confirm(question: string): Promise<boolean> {
      while (true) {
        const answer = (await requestLine(`${question} (y/N): `)).toLowerCase();
        if (answer === '') {
          return false;
        }
        if (answer === 'y' || answer === 'yes') {
          return true;
        }
        if (answer === 'n' || answer === 'no') {
          return false;
        }
        console.log('Please respond with y(es) or n(o).');
      }
    },

    close(): void {
      rl.close();
    }
  };
}

type FileKey =
  | 'schema'
  | 'config'
  | 'starterCompose'
  | 'smokeSpec'
  | 'localSourceGuardScript'
  | 'smokeValidationTest'
  | 'smokeTest'
  | 'featureRootReadme'
  | 'smokeReadme'
  | 'smokeApplicationReadme'
  | 'smokeDomainReadme'
  | 'smokePersistenceReadme'
  | 'smokeTestsReadme'
  | 'smokeDomain'
  | 'smokeApplication'
  | 'smokeSql'
  | 'querySpecExampleTest'
  | 'testkitClient'
  | 'globalSetup'
  | 'vitestConfig'
  | 'tsconfig'
  | 'ztdDocsReadme'
  | 'sqlReadme'
  | 'readme'
  | 'context'
  | 'promptDogfood'
  | 'internalAgentsManifest'
  | 'internalAgentsRoot'
  | 'internalAgentsSrc'
  | 'internalAgentsTests'
  | 'internalAgentsZtd'
  | 'sqlClient'
  | 'sqlClientAdapters'
  | 'gitignore'
  | 'editorconfig'
  | 'prettierignore'
  | 'prettier'
  | 'package';

/**
 * Summarizes how an individual file was created during initialization.
 */
export interface FileSummary {
  relativePath: string;
  outcome: 'created' | 'overwritten' | 'unchanged';
}

/**
 * Result payload for `ztd init` describing outputs and next steps.
 */
export interface InitResult {
  summary: string;
  files: FileSummary[];
}

/**
 * Dependency overrides used to orchestrate the init flow and IO side effects.
 */
export interface ZtdConfigWriterDependencies {
  ensureDirectory: (directory: string) => void;
  writeFile: (filePath: string, contents: string) => void;
  fileExists: (filePath: string) => boolean;
  runPullSchema: (options: PullSchemaOptions) => Promise<unknown> | unknown;
  runGenerateZtdConfig: (options: ZtdConfigGenerationOptions) => Promise<unknown> | unknown;
  checkPgDump: () => boolean;
  log: (message: string) => void;
  copyAgentsTemplate: (rootDir: string) => string | null;
  installPackages: (options: {
    rootDir: string;
    kind: PackageInstallKind;
    packages: string[];
    packageManager: PackageManager;
  }) => Promise<void> | void;
}

/**
 * Options for configuring the `ztd init` command execution.
 */
export interface InitCommandOptions {
  rootDir?: string;
  dependencies?: Partial<ZtdConfigWriterDependencies>;
  appShape?: InitAppShape;
  starter?: boolean;
  postgresImage?: string;
  withAiGuidance?: boolean;
  withDogfooding?: boolean;
  withAppInterface?: boolean;
  skipInstall?: boolean;
  forceOverwrite?: boolean;
  nonInteractive?: boolean;
  workflow?: InitWorkflow;
  validator?: ValidatorBackend;
  localSourceRoot?: string;
  dryRun?: boolean;
}

type ValidatorBackend = 'zod' | 'arktype';
type InitDependencyProfile = 'registry' | 'local-source';
type InitAppShape = 'default' | 'webapi';

interface OptionalFeatures {
  validator: ValidatorBackend;
  aiGuidance: boolean;
  dogfooding: boolean;
}

interface InitScaffoldProfile {
  dependencyProfile: InitDependencyProfile;
  localSourceRoot: string | null;
}

interface InitScaffoldLayout {
  readmeTemplate: string;
  contextTemplate: string;
  promptDogfoodPath: string | null;
  promptDogfoodTemplate: string | null;
  sqlClientTemplate: string;
  sqlClientAdaptersTemplate: string;
  testkitClientTemplate: string;
  featureReadmePath: string;
  featureReadmeTemplate: string;
  smokeReadmePath: string;
  smokeReadmeTemplate: string;
  smokeApplicationReadmePath: string;
  smokeApplicationReadmeTemplate: string;
  smokeDomainReadmePath: string;
  smokeDomainReadmeTemplate: string;
  smokePersistenceReadmePath: string;
  smokePersistenceReadmeTemplate: string;
  smokeTestsReadmePath: string;
  smokeTestsReadmeTemplate: string;
  smokeDomainPath: string;
  smokeDomainTemplate: string;
  smokeApplicationPath: string;
  smokeApplicationTemplate: string;
  smokeSqlPath: string;
  smokeSpecPath: string;
  smokeSpecTemplate: string;
  smokeValidationTestPath: string;
  smokeValidationTestTemplate: string;
  smokeTestPath: string;
  smokeTestTemplate: string;
  sqlClientPath: string;
  sqlClientAdaptersPath: string;
}

const STACK_DEV_DEPENDENCIES: Record<string, string> = {
  '@rawsql-ts/sql-contract': '^0.3.1',
  '@rawsql-ts/testkit-core': '^0.16.1',
  '@rawsql-ts/ztd-cli': '^0.20.3',
};
const LOCAL_SOURCE_STACK_PACKAGE_DIRS: Record<string, string> = {
  '@rawsql-ts/sql-contract': path.join('packages', 'sql-contract'),
  '@rawsql-ts/testkit-core': path.join('packages', 'testkit-core')
};
const ZOD_DEPENDENCY: Record<string, string> = {
  zod: '^4.3.6'
};
const ARKTYPE_DEPENDENCY: Record<string, string> = {
  arktype: '2.2.0'
};

async function gatherOptionalFeatures(
  prompter: Prompter,
  _dependencies: ZtdConfigWriterDependencies,
  validatorOverride?: ValidatorBackend,
  aiGuidanceOverride?: boolean,
  dogfoodingOverride?: boolean
): Promise<OptionalFeatures> {
  if (validatorOverride) {
    return {
      validator: validatorOverride,
      aiGuidance: aiGuidanceOverride ?? false,
      dogfooding: dogfoodingOverride ?? false
    };
  }
  const validatorChoice = await prompter.selectChoice(
    'Runtime DTO validation is required for ZTD tests. Which validator backend should we install?',
    ['Zod (zod, recommended)', 'ArkType (arktype)']
  );
  const validator: ValidatorBackend = validatorChoice === 0 ? 'zod' : 'arktype';
  return {
    validator,
    aiGuidance: aiGuidanceOverride ?? false,
    dogfooding: dogfoodingOverride ?? false
  };
}

type InitWorkflow = 'pg_dump' | 'empty' | 'demo';

const README_TEMPLATE = 'README.md';
const CONTEXT_TEMPLATE = 'CONTEXT.md';
const PROMPT_DOGFOOD_TEMPLATE = 'PROMPT_DOGFOOD.md';
const DEFAULT_POSTGRES_IMAGE = 'postgres:18';
const STARTER_COMPOSE_FILE = 'compose.yaml';
const FEATURE_ROOT_README_TEMPLATE = 'src/features/README.md';
const FEATURE_SMOKE_README_TEMPLATE = 'src/features/smoke/README.md';
const FEATURE_SMOKE_APPLICATION_README_TEMPLATE = 'src/features/smoke/application/README.md';
const FEATURE_SMOKE_DOMAIN_README_TEMPLATE = 'src/features/smoke/domain/README.md';
const FEATURE_SMOKE_PERSISTENCE_README_TEMPLATE = 'src/features/smoke/persistence/README.md';
const FEATURE_SMOKE_TESTS_README_TEMPLATE = 'src/features/smoke/tests/README.md';
const FEATURE_SMOKE_DOMAIN_TEMPLATE = 'src/features/smoke/domain/smoke-policy.ts';
const FEATURE_SMOKE_APPLICATION_TEMPLATE = 'src/features/smoke/application/smoke-workflow.ts';
const FEATURE_SMOKE_SQL_TEMPLATE = 'src/features/smoke/persistence/smoke.sql';
const FEATURE_SMOKE_SPEC_TEMPLATE = 'src/features/smoke/persistence/smoke.spec.ts';
const FEATURE_SMOKE_VALIDATION_TEST_TEMPLATE = 'src/features/smoke/tests/smoke.validation.test.ts';
const FEATURE_SMOKE_TEST_TEMPLATE = 'src/features/smoke/tests/smoke.test.ts';
const LOCAL_SOURCE_GUARD_TEMPLATE = 'scripts/local-source-guard.mjs';
const QUERYSPEC_EXAMPLE_TEST_TEMPLATE = 'tests/queryspec.example.test.ts';
const TESTKIT_CLIENT_TEMPLATE = 'tests/support/testkit-client.ts';
const GLOBAL_SETUP_TEMPLATE = 'tests/support/global-setup.ts';
const VITEST_CONFIG_TEMPLATE = 'vitest.config.ts';
const TSCONFIG_TEMPLATE = 'tsconfig.json';
const SQL_CLIENT_TEMPLATE = 'src/db/sql-client.ts';
const SQL_CLIENT_ADAPTERS_TEMPLATE = 'src/db/sql-client-adapters.ts';
const SQL_README_TEMPLATE = 'src/sql/README.md';
const JOBS_README_TEMPLATE = 'src/jobs/README.md';
const ZTD_README_TEMPLATE = 'ztd/README.md';
const ZTD_DDL_DEMO_TEMPLATE = 'ztd/ddl/demo.sql';

const EMPTY_SCHEMA_COMMENT = (schemaName: string): string =>
  [
    `-- DDL for schema "${schemaName}".`,
    '-- Add CREATE TABLE statements here.',
    ''
  ].join('\n');

const STARTER_SCHEMA_TEMPLATE = (schemaName: string): string =>
  [
    `-- Starter DDL for schema "${schemaName}".`,
    '-- The starter flow begins with a single users table so the first feature stays obvious.',
    '',
    'create table users (',
    '  user_id bigint generated by default as identity primary key,',
    '  email text not null unique,',
    '  display_name text not null,',
    '  is_active boolean not null default true,',
    '  created_at timestamptz not null default current_timestamp',
    ');',
    '',
    'comment on table users is',
    "  'Starter user directory for the first CRUD feature.';",
    '',
    'comment on column users.user_id is',
    "  'Primary key for a user.';",
    'comment on column users.email is',
    "  'Email address for the user.';",
    'comment on column users.display_name is',
    "  'Human-readable display name for the user.';",
    'comment on column users.is_active is',
    "  'Whether the user is active.';",
    'comment on column users.created_at is',
    "  'Timestamp when the user row was created.';",
    ''
  ].join('\n');

const STARTER_README_APPENDIX = (postgresImage: string): string =>
  [
    '## Starter Flow',
    '',
    '1. Start Postgres with `docker compose up -d`.',
    `2. The bundled compose file uses \`${postgresImage}\`.`,
    '3. Export `ZTD_TEST_DATABASE_URL=postgres://ztd:ztd@localhost:5432/ztd` before running Vitest.',
    '4. Read `src/features/smoke/` first, then add `src/features/users/` as your first real feature.',
    '5. Run `npx ztd ztd-config` to regenerate DDL-derived test rows and layout metadata.',
    '6. Run `npx ztd model-gen --probe-mode ztd <sql-file> --out <spec-file>` to scaffold a QuerySpec from that SQL file.',
    '7. Run `npm run test` or `npx vitest run` to confirm the smoke slice is green.',
    ''
  ].join('\n');

const STARTER_COMPOSE_TEMPLATE = (postgresImage: string): string =>
  [
    '# Starter Postgres environment for ZTD tests.',
    '# Start it with: docker compose up -d',
    '# After it is running, export ZTD_TEST_DATABASE_URL=postgres://ztd:ztd@localhost:5432/ztd',
    '',
    'services:',
    '  postgres:',
    `    image: ${postgresImage}`,
    '    environment:',
    '      POSTGRES_DB: ztd',
    '      POSTGRES_PASSWORD: ztd',
    '      POSTGRES_USER: ztd',
    '    ports:',
    '      - "5432:5432"',
    ''
  ].join('\n');

const DEMO_SCHEMA_TEMPLATE = (_schemaName: string): string => {
  return loadTemplate(ZTD_DDL_DEMO_TEMPLATE);
};

function buildStarterReadmeContents(postgresImage: string): string {
  const base = loadTemplate(README_TEMPLATE).replace(/\r\n/g, '\n').trimEnd();
  return `${base}\n\n${STARTER_README_APPENDIX(postgresImage)}`;
}

function resolveInitScaffoldLayout(rootDir: string, _appShape: InitAppShape): InitScaffoldLayout {
  return {
    readmeTemplate: README_TEMPLATE,
    contextTemplate: CONTEXT_TEMPLATE,
    promptDogfoodPath: path.join(rootDir, 'PROMPT_DOGFOOD.md'),
    promptDogfoodTemplate: PROMPT_DOGFOOD_TEMPLATE,
    sqlClientTemplate: SQL_CLIENT_TEMPLATE,
    sqlClientAdaptersTemplate: SQL_CLIENT_ADAPTERS_TEMPLATE,
    testkitClientTemplate: TESTKIT_CLIENT_TEMPLATE,
    featureReadmePath: path.join(rootDir, 'src', 'features', 'README.md'),
    featureReadmeTemplate: FEATURE_ROOT_README_TEMPLATE,
    smokeReadmePath: path.join(rootDir, 'src', 'features', 'smoke', 'README.md'),
    smokeReadmeTemplate: FEATURE_SMOKE_README_TEMPLATE,
    smokeApplicationReadmePath: path.join(rootDir, 'src', 'features', 'smoke', 'application', 'README.md'),
    smokeApplicationReadmeTemplate: FEATURE_SMOKE_APPLICATION_README_TEMPLATE,
    smokeDomainReadmePath: path.join(rootDir, 'src', 'features', 'smoke', 'domain', 'README.md'),
    smokeDomainReadmeTemplate: FEATURE_SMOKE_DOMAIN_README_TEMPLATE,
    smokePersistenceReadmePath: path.join(rootDir, 'src', 'features', 'smoke', 'persistence', 'README.md'),
    smokePersistenceReadmeTemplate: FEATURE_SMOKE_PERSISTENCE_README_TEMPLATE,
    smokeTestsReadmePath: path.join(rootDir, 'src', 'features', 'smoke', 'tests', 'README.md'),
    smokeTestsReadmeTemplate: FEATURE_SMOKE_TESTS_README_TEMPLATE,
    smokeDomainPath: path.join(rootDir, 'src', 'features', 'smoke', 'domain', 'smoke-policy.ts'),
    smokeDomainTemplate: FEATURE_SMOKE_DOMAIN_TEMPLATE,
    smokeApplicationPath: path.join(rootDir, 'src', 'features', 'smoke', 'application', 'smoke-workflow.ts'),
    smokeApplicationTemplate: FEATURE_SMOKE_APPLICATION_TEMPLATE,
    smokeSqlPath: path.join(rootDir, 'src', 'features', 'smoke', 'persistence', 'smoke.sql'),
    smokeSpecPath: path.join(rootDir, 'src', 'features', 'smoke', 'persistence', 'smoke.spec.ts'),
    smokeSpecTemplate: FEATURE_SMOKE_SPEC_TEMPLATE,
    smokeValidationTestPath: path.join(rootDir, 'src', 'features', 'smoke', 'tests', 'smoke.validation.test.ts'),
    smokeValidationTestTemplate: FEATURE_SMOKE_VALIDATION_TEST_TEMPLATE,
    smokeTestPath: path.join(rootDir, 'src', 'features', 'smoke', 'tests', 'smoke.test.ts'),
    smokeTestTemplate: FEATURE_SMOKE_TEST_TEMPLATE,
    sqlClientPath: path.join(rootDir, 'src', 'db', 'sql-client.ts'),
    sqlClientAdaptersPath: path.join(rootDir, 'src', 'db', 'sql-client-adapters.ts')
  };
}

const AGENTS_FILE_CANDIDATES = ['AGENTS.md', 'AGENTS_ztd.md'];

const APP_INTERFACE_SECTION_MARKER = '## Application Interface Guidance';
const APP_INTERFACE_SECTION = `---
## Application Interface Guidance

1. Feature folders are the default change unit.
2. Keep domain, application, persistence, and tests close to the feature they support.
3. Input validation should happen at the feature boundary before SQL runs.
4. Only validated inputs reach SQL execution; reject raw external objects as soon as possible.
5. Keep \`smoke\` small enough to delete after the first real feature is added.
6. Build the slice first and revisit shared extraction during review, not before the feature works.
7. Guard every behavioral change with feature-local tests so regression risks stay low.
`;

function resolveTemplateDirectory(): string {
  const candidates = [
    // Prefer the installed package layout: <pkg>/dist/commands → <pkg>/templates.
    path.resolve(__dirname, '..', '..', '..', 'templates'),
    // Support legacy layouts that copied templates into dist/.
    path.resolve(__dirname, '..', '..', 'templates'),
    // Support running tests directly from the monorepo source tree.
    path.resolve(process.cwd(), 'packages', 'ztd-cli', 'templates')
  ];

  // Pick the first directory that contains the expected template entrypoint.
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, README_TEMPLATE))) {
      return candidate;
    }
  }

  return candidates[0];
}

// Resolve templates from a shipped directory so `ztd init` works after `npm install`.
const TEMPLATE_DIRECTORY = resolveTemplateDirectory();

const DEFAULT_DEPENDENCIES: ZtdConfigWriterDependencies = {
  ensureDirectory,
  writeFile: (filePath, contents) => writeFileSync(filePath, contents, 'utf8'),
  fileExists: (filePath) => existsSync(filePath),
  runPullSchema,
  runGenerateZtdConfig,
  checkPgDump: () => {
    const executable = process.env.PG_DUMP_PATH ?? 'pg_dump';
    const result = spawnSync(executable, ['--version'], { stdio: 'ignore' });
    return result.status === 0 && !result.error;
  },
  log: (message: string) => {
    console.log(message);
  },
  copyAgentsTemplate,
  installPackages: ({ rootDir, kind, packages, packageManager }) => {
    // Use the Windows shim executables so spawnSync finds the package manager in PATH.
    const executable = resolvePackageManagerExecutable(packageManager);
    const shellExecutable = resolvePackageManagerShellExecutable(executable, packageManager);
    const args = buildPackageManagerArgs(kind, packageManager, packages, rootDir);
    if (args.length === 0) {
      return;
    }

    const isWin32 = process.platform === 'win32';
    // Prefer shell execution for .cmd/.bat on Windows to avoid a guaranteed failure.
    const preferShell = isWin32 && /\.(cmd|bat)$/i.test(executable);
    const baseSpawnOptions = {
      cwd: rootDir,
      stdio: 'inherit' as const,
      shell: false
    };
    const shellSpawnOptions = {
      ...baseSpawnOptions,
      shell: true
    };

    let result = spawnSync(preferShell ? shellExecutable : executable, args, preferShell ? shellSpawnOptions : baseSpawnOptions);
    if (result.error && isWin32 && !preferShell) {
      // Retry with cmd.exe only on Windows so .cmd shims resolve reliably.
      result = spawnSync(shellExecutable, args, shellSpawnOptions);
    }
    if ((result.error || result.status !== 0) && executable !== packageManager) {
      // Retry with the bare command name in case a resolved path is rejected.
      result = spawnSync(packageManager, args, baseSpawnOptions);
      if (result.error && isWin32) {
        // Final fallback to shell when the bare command still fails on Windows.
        result = spawnSync(packageManager, args, shellSpawnOptions);
      }
    }
    if (result.error || result.status !== 0) {
      const base = `Failed to run ${packageManager} ${args.join(' ')}`;
      const reason = result.error
        ? `: ${result.error.message}`
        : ` (exit code: ${result.status ?? 'unknown'}, signal: ${result.signal ?? 'none'})`;
      throw new Error(`${base}${reason}`);
    }
  }
};

/**
 * Run the interactive `ztd init` workflow and return the resulting summary.
 */
export async function runInitCommand(prompter: Prompter, options?: InitCommandOptions): Promise<InitResult> {
  const rootDir = options?.rootDir ?? process.cwd();
  const dependencies: ZtdConfigWriterDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...(options?.dependencies ?? {})
  };
  const overwritePolicy = {
    force: options?.forceOverwrite ?? false,
    nonInteractive: options?.nonInteractive ?? false
  };

  if (options?.withAppInterface) {
    // Provide the documentation-only path before triggering any scaffolding work.
    const summary = await appendAppInterfaceGuidance(rootDir, dependencies);
    dependencies.log(`Appended application interface guidance to ${summary.relativePath}.`);
    return {
      summary: `App interface guidance appended to ${summary.relativePath}.`,
      files: [summary]
    };
  }

  // Determine workflow: use explicit flag, non-interactive default, starter preset, or prompt.
  let workflow: InitWorkflow;
  let starter = options?.starter === true;
  if (options?.workflow) {
    workflow = options.workflow;
  } else if (starter) {
    workflow = 'demo';
  } else if (overwritePolicy.nonInteractive) {
    workflow = 'demo';
  } else {
    const workflowChoice = await prompter.selectChoice(
      'How do you want to start your database workflow?',
      [
        'Starter (recommended): visible AGENTS, compose, smoke tests, and sample DDL',
        'Pull schema from Postgres (pg_dump)',
        'Create empty scaffold (I will write DDL)',
        'Create scaffold with demo DDL (no app code)'
      ]
    );
    starter = workflowChoice === 0;
    workflow = workflowChoice === 0 ? 'demo' : workflowChoice === 1 ? 'pg_dump' : workflowChoice === 2 ? 'empty' : 'demo';
  }

  if (overwritePolicy.nonInteractive && workflow === 'pg_dump') {
    throw new Error(
      'Non-interactive mode does not support the pg_dump workflow (requires connection string prompt).'
    );
  }

  const schemaName = normalizeSchemaName(DEFAULT_ZTD_CONFIG.ddl.defaultSchema);
  const schemaFileName = `${sanitizeSchemaFileName(schemaName)}.sql`;
  const appShape: InitAppShape = options?.appShape ?? 'default';
  const postgresImage = options?.postgresImage?.trim() || DEFAULT_POSTGRES_IMAGE;
  const scaffoldLayout = resolveInitScaffoldLayout(rootDir, appShape);

  const absolutePaths: Record<FileKey, string> = {
    schema: path.join(rootDir, DEFAULT_ZTD_CONFIG.ddlDir, schemaFileName),
    config: path.join(rootDir, 'ztd.config.json'),
    starterCompose: path.join(rootDir, STARTER_COMPOSE_FILE),
    localSourceGuardScript: path.join(rootDir, 'scripts', 'local-source-guard.mjs'),
    featureRootReadme: scaffoldLayout.featureReadmePath,
    smokeReadme: scaffoldLayout.smokeReadmePath,
    smokeApplicationReadme: scaffoldLayout.smokeApplicationReadmePath,
    smokeDomainReadme: scaffoldLayout.smokeDomainReadmePath,
    smokePersistenceReadme: scaffoldLayout.smokePersistenceReadmePath,
    smokeTestsReadme: scaffoldLayout.smokeTestsReadmePath,
    smokeDomain: scaffoldLayout.smokeDomainPath,
    smokeApplication: scaffoldLayout.smokeApplicationPath,
    smokeSql: scaffoldLayout.smokeSqlPath,
    smokeSpec: scaffoldLayout.smokeSpecPath,
    smokeValidationTest: scaffoldLayout.smokeValidationTestPath,
    smokeTest: scaffoldLayout.smokeTestPath,
    querySpecExampleTest: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'queryspec.example.test.ts'),
    readme: path.join(rootDir, 'README.md'),
    context: path.join(rootDir, 'CONTEXT.md'),
    promptDogfood: scaffoldLayout.promptDogfoodPath ?? path.join(rootDir, 'PROMPT_DOGFOOD.md'),
    internalAgentsManifest: path.join(rootDir, '.ztd', 'agents', 'manifest.json'),
    internalAgentsRoot: path.join(rootDir, '.ztd', 'agents', 'root.md'),
    internalAgentsSrc: path.join(rootDir, '.ztd', 'agents', 'src.md'),
    internalAgentsTests: path.join(rootDir, '.ztd', 'agents', 'tests.md'),
    internalAgentsZtd: path.join(rootDir, '.ztd', 'agents', 'ztd.md'),
    sqlReadme: path.join(rootDir, 'src', 'sql', 'README.md'),
    sqlClient: scaffoldLayout.sqlClientPath,
    sqlClientAdapters: scaffoldLayout.sqlClientAdaptersPath,
    testkitClient: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'support', 'testkit-client.ts'),
    globalSetup: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'support', 'global-setup.ts'),
    vitestConfig: path.join(rootDir, 'vitest.config.ts'),
    tsconfig: path.join(rootDir, 'tsconfig.json'),
    ztdDocsReadme: path.join(rootDir, 'ztd', 'README.md'),
    gitignore: path.join(rootDir, '.gitignore'),
    editorconfig: path.join(rootDir, '.editorconfig'),
    prettierignore: path.join(rootDir, '.prettierignore'),
    prettier: path.join(rootDir, '.prettierrc'),
    package: path.join(rootDir, 'package.json')
  };

  const relativePath = (key: FileKey): string =>
    path.relative(rootDir, absolutePaths[key]).replace(/\\/g, '/') || absolutePaths[key];

  const summaries: Partial<Record<FileKey, FileSummary>> = {};
  const scaffoldProfile = resolveInitScaffoldProfile(rootDir, options?.localSourceRoot);

  // Ask how the user prefers to populate the initial schema.
  if (workflow === 'pg_dump') {
    // Database-first path: pull the schema before writing any DDL files.
    if (!dependencies.checkPgDump()) {
      throw new Error('Unable to find pg_dump. Install Postgres or set PG_DUMP_PATH before running ztd init.');
    }
    const connectionString = await prompter.promptInput(
      'Enter the Postgres connection string for your database',
      'postgres://user:pass@host:5432/db'
    );

    const schemaSummary = await writeFileWithConsent(
      absolutePaths.schema,
      relativePath('schema'),
      dependencies,
      prompter,
      overwritePolicy,
      async () => {
        dependencies.ensureDirectory(path.dirname(absolutePaths.schema));
        await dependencies.runPullSchema({
          url: connectionString,
          out: path.dirname(absolutePaths.schema),
          schemas: [schemaName]
        });
      }
    );

    summaries.schema = schemaSummary;
  } else if (workflow === 'empty') {
    // Manual path: seed the DDL directory with a starter schema so ztd-config can run.
    const schemaSummary = await writeFileWithConsent(
      absolutePaths.schema,
      relativePath('schema'),
      dependencies,
      prompter,
      overwritePolicy,
      async () => {
        dependencies.ensureDirectory(path.dirname(absolutePaths.schema));
        dependencies.writeFile(absolutePaths.schema, EMPTY_SCHEMA_COMMENT(schemaName));
      }
    );

    summaries.schema = schemaSummary;
  } else {
    const schemaSummary = await writeFileWithConsent(
      absolutePaths.schema,
      relativePath('schema'),
      dependencies,
      prompter,
      overwritePolicy,
      async () => {
        dependencies.ensureDirectory(path.dirname(absolutePaths.schema));
        dependencies.writeFile(
          absolutePaths.schema,
          starter ? STARTER_SCHEMA_TEMPLATE(schemaName) : DEMO_SCHEMA_TEMPLATE(schemaName)
        );
      }
    );

    summaries.schema = schemaSummary;
  }

  // Seed the ztd.config.json defaults so downstream tooling knows where ddl/tests live.
  const configSummary = await writeFileWithConsent(
    absolutePaths.config,
    relativePath('config'),
    dependencies,
    prompter,
    overwritePolicy,
    () => {
      writeZtdProjectConfig(rootDir, {
        ddl: {
          defaultSchema: schemaName,
          searchPath: [schemaName]
        }
      });
    }
  );
  summaries.config = configSummary;

  const validatorOverride = options?.validator ?? (starter || overwritePolicy.nonInteractive ? 'zod' : undefined);
  const optionalFeatures = await gatherOptionalFeatures(
    prompter,
    dependencies,
    validatorOverride,
    options?.withAiGuidance,
    options?.withDogfooding
  );

  // Emit supporting documentation that describes the workflow for contributors.
  const readmeSummary = await writeDocFile(
    absolutePaths.readme,
    relativePath('readme'),
    starter ? buildStarterReadmeContents(postgresImage) : loadTemplate(README_TEMPLATE),
    dependencies,
    prompter,
    overwritePolicy
  );
  if (readmeSummary) {
    summaries.readme = readmeSummary;
  }

  if (starter) {
    const composeSummary = await writeDocFile(
      absolutePaths.starterCompose,
      relativePath('starterCompose'),
      STARTER_COMPOSE_TEMPLATE(postgresImage),
      dependencies,
      prompter,
      overwritePolicy
    );
    summaries.starterCompose = composeSummary;
  }

  if (optionalFeatures.aiGuidance) {
    const contextSummary = await writeTemplateFile(
      rootDir,
      absolutePaths.context,
      relativePath('context'),
      scaffoldLayout.contextTemplate,
      dependencies,
      prompter,
      overwritePolicy,
      true
    );
    if (contextSummary) {
      summaries.context = contextSummary;
    }
  }

  if (optionalFeatures.dogfooding && scaffoldLayout.promptDogfoodTemplate) {
    const promptDogfoodSummary = await writeTemplateFile(
      rootDir,
      absolutePaths.promptDogfood,
      relativePath('promptDogfood'),
      scaffoldLayout.promptDogfoodTemplate,
      dependencies,
      prompter,
      overwritePolicy,
      true
    );
    if (promptDogfoodSummary) {
      summaries.promptDogfood = promptDogfoodSummary;
    }
  }

  if (optionalFeatures.aiGuidance) {
    for (const summary of writeInternalAgentsArtifacts(rootDir)) {
      if (summary.relativePath === relativePath('internalAgentsManifest')) {
        summaries.internalAgentsManifest = summary;
      } else if (summary.relativePath === relativePath('internalAgentsRoot')) {
        summaries.internalAgentsRoot = summary;
      } else if (summary.relativePath === relativePath('internalAgentsSrc')) {
        summaries.internalAgentsSrc = summary;
      } else if (summary.relativePath === relativePath('internalAgentsTests')) {
        summaries.internalAgentsTests = summary;
      } else if (summary.relativePath === relativePath('internalAgentsZtd')) {
        summaries.internalAgentsZtd = summary;
      }
    }
  }

  const featureRootReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.featureRootReadme,
    relativePath('featureRootReadme'),
    scaffoldLayout.featureReadmeTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (featureRootReadmeSummary) {
    summaries.featureRootReadme = featureRootReadmeSummary;
  }

  const smokeReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeReadme,
    relativePath('smokeReadme'),
    scaffoldLayout.smokeReadmeTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeReadmeSummary) {
    summaries.smokeReadme = smokeReadmeSummary;
  }

  const smokeApplicationReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeApplicationReadme,
    relativePath('smokeApplicationReadme'),
    scaffoldLayout.smokeApplicationReadmeTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeApplicationReadmeSummary) {
    summaries.smokeApplicationReadme = smokeApplicationReadmeSummary;
  }

  const smokeDomainReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeDomainReadme,
    relativePath('smokeDomainReadme'),
    scaffoldLayout.smokeDomainReadmeTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeDomainReadmeSummary) {
    summaries.smokeDomainReadme = smokeDomainReadmeSummary;
  }

  const smokePersistenceReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokePersistenceReadme,
    relativePath('smokePersistenceReadme'),
    scaffoldLayout.smokePersistenceReadmeTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokePersistenceReadmeSummary) {
    summaries.smokePersistenceReadme = smokePersistenceReadmeSummary;
  }

  const smokeTestsReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeTestsReadme,
    relativePath('smokeTestsReadme'),
    scaffoldLayout.smokeTestsReadmeTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeTestsReadmeSummary) {
    summaries.smokeTestsReadme = smokeTestsReadmeSummary;
  }

  const smokeDomainSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeDomain,
    relativePath('smokeDomain'),
    scaffoldLayout.smokeDomainTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeDomainSummary) {
    summaries.smokeDomain = smokeDomainSummary;
  }

  const smokeApplicationSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeApplication,
    relativePath('smokeApplication'),
    scaffoldLayout.smokeApplicationTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeApplicationSummary) {
    summaries.smokeApplication = smokeApplicationSummary;
  }

  const smokeSqlSummary = writeOptionalTemplateFile(
    absolutePaths.smokeSql,
    relativePath('smokeSql'),
    FEATURE_SMOKE_SQL_TEMPLATE,
    dependencies
  );
  if (smokeSqlSummary) {
    summaries.smokeSql = smokeSqlSummary;
  }

  const smokeSpecSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeSpec,
    relativePath('smokeSpec'),
    scaffoldLayout.smokeSpecTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeSpecSummary) {
    summaries.smokeSpec = smokeSpecSummary;
  }

  const smokeValidationTestSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeValidationTest,
    relativePath('smokeValidationTest'),
    scaffoldLayout.smokeValidationTestTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeValidationTestSummary) {
    summaries.smokeValidationTest = smokeValidationTestSummary;
  }

  const smokeTestSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeTest,
    relativePath('smokeTest'),
    scaffoldLayout.smokeTestTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeTestSummary) {
    summaries.smokeTest = smokeTestSummary;
  }

  if (scaffoldProfile.dependencyProfile === 'local-source') {
    const localSourceGuardSummary = await writeDocFile(
      absolutePaths.localSourceGuardScript,
      relativePath('localSourceGuardScript'),
      buildLocalSourceGuardContents(absolutePaths.localSourceGuardScript, scaffoldProfile),
      dependencies,
      prompter,
      overwritePolicy
    );
    if (localSourceGuardSummary) {
      summaries.localSourceGuardScript = localSourceGuardSummary;
    }
  }


  const sqlClientSummary = writeOptionalTemplateFile(
    absolutePaths.sqlClient,
    relativePath('sqlClient'),
    scaffoldLayout.sqlClientTemplate,
    dependencies
  );
  if (sqlClientSummary) {
    summaries.sqlClient = sqlClientSummary;

    // Only scaffold the pg adapter alongside the SqlClient interface.
    const sqlClientAdaptersSummary = writeOptionalTemplateFile(
      absolutePaths.sqlClientAdapters,
      relativePath('sqlClientAdapters'),
      scaffoldLayout.sqlClientAdaptersTemplate,
      dependencies
    );
    if (sqlClientAdaptersSummary) {
      summaries.sqlClientAdapters = sqlClientAdaptersSummary;
    }
  }

  const querySpecExampleTestSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.querySpecExampleTest,
    relativePath('querySpecExampleTest'),
    QUERYSPEC_EXAMPLE_TEST_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (querySpecExampleTestSummary) {
    summaries.querySpecExampleTest = querySpecExampleTestSummary;
  }

  const testkitSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.testkitClient,
    relativePath('testkitClient'),
    scaffoldLayout.testkitClientTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (testkitSummary) {
    summaries.testkitClient = testkitSummary;
  }

  const globalSetupSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.globalSetup,
    relativePath('globalSetup'),
    GLOBAL_SETUP_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (globalSetupSummary) {
    summaries.globalSetup = globalSetupSummary;
  }

  if (starter) {
    const visibleAgentSummaries = installVisibleAgents(rootDir);
    if (visibleAgentSummaries.some((summary) => summary.relativePath === 'AGENTS.md')) {
      dependencies.log('Visible AGENTS.md files installed for the starter flow.');
    }
  }

  const vitestConfigSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.vitestConfig,
    relativePath('vitestConfig'),
    VITEST_CONFIG_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (vitestConfigSummary) {
    summaries.vitestConfig = vitestConfigSummary;
  }

  const tsconfigSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.tsconfig,
    relativePath('tsconfig'),
    TSCONFIG_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (tsconfigSummary) {
    summaries.tsconfig = tsconfigSummary;
  }

  const editorconfigSummary = copyTemplateFileIfMissing(
    rootDir,
    relativePath('editorconfig'),
    '.editorconfig',
    dependencies
  );
  if (editorconfigSummary) {
    summaries.editorconfig = editorconfigSummary;
  }

  const prettierSummary = copyTemplateFileIfMissing(
    rootDir,
    relativePath('prettier'),
    '.prettierrc',
    dependencies
  );
  if (prettierSummary) {
    summaries.prettier = prettierSummary;
  }

  const gitignoreSummary = copyTemplateFileIfMissing(
    rootDir,
    relativePath('gitignore'),
    '.gitignore',
    dependencies
  );
  if (gitignoreSummary) {
    summaries.gitignore = gitignoreSummary;
  }

  const prettierignoreSummary = copyTemplateFileIfMissing(
    rootDir,
    relativePath('prettierignore'),
    '.prettierignore',
    dependencies
  );
  if (prettierignoreSummary) {
    summaries.prettierignore = prettierignoreSummary;
  }

  const packageSummary = ensurePackageJsonFormatting(
    rootDir,
    relativePath('package'),
    dependencies,
    optionalFeatures,
    scaffoldProfile
  );
  if (packageSummary) {
    summaries.package = packageSummary;
  }

  const installNote = await ensureTemplateDependenciesInstalled(
    rootDir,
    absolutePaths,
    summaries,
    dependencies,
    scaffoldProfile,
    options?.skipInstall === true
  );
  const shouldIncludeManualInstallStep =
    options?.skipInstall === true || installNote?.startsWith('Dependency install failed') === true;

  const nextSteps = buildNextSteps(
    normalizeRelative(rootDir, absolutePaths.schema),
    workflow,
    rootDir,
    scaffoldProfile,
    shouldIncludeManualInstallStep,
    starter,
    postgresImage
  );
  const summaryLines = buildSummaryLines(
    summaries as Record<FileKey, FileSummary>,
    optionalFeatures,
    nextSteps,
    scaffoldProfile,
    starter,
    postgresImage,
    installNote
  );
  summaryLines.forEach(dependencies.log);

  return {
    summary: summaryLines.join('\n'),
    files: Object.values(summaries) as FileSummary[]
  };
}

function resolvePackageManagerExecutable(packageManager: PackageManager): string {
  const override = process.env.ZTD_PACKAGE_MANAGER_PATH;
  if (override) {
    return override;
  }

  if (process.platform !== 'win32') {
    return packageManager;
  }

  // Prefer .cmd shims first on Windows so they take precedence over extension-less files.
  const cmdFallbacks: Record<PackageManager, string> = {
    npm: 'npm.cmd',
    pnpm: 'pnpm.cmd',
    yarn: 'yarn.cmd'
  };
  const cmdResolved = resolveExecutableInPath(cmdFallbacks[packageManager]);
  if (cmdResolved) {
    return cmdResolved;
  }

  // Fall back to the extension-less name if no cmd shim is found.
  const resolved = resolveExecutableInPath(packageManager);
  if (resolved) {
    return resolved;
  }

  return cmdFallbacks[packageManager] ?? packageManager;
}

export function resolvePackageManagerShellExecutable(
  executable: string,
  packageManager: PackageManager,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform !== 'win32') {
    return executable;
  }

  // `shell: true` delegates through cmd.exe, which splits unquoted absolute paths with spaces.
  // Use the shim basename so the shell resolves it from PATH without truncating at `C:\Program`.
  if (/\.(cmd|bat)$/i.test(executable) && path.win32.isAbsolute(executable)) {
    return path.win32.basename(executable);
  }

  return executable || packageManager;
}

function resolveExecutableInPath(executable: string): string | null {
  const pathValue = process.env.PATH ?? process.env.Path ?? '';
  if (!pathValue) {
    return null;
  }

  const pathEntries = pathValue
    .split(path.delimiter)
    .map((entry) => {
      const trimmed = entry.trim();
      if (process.platform !== 'win32') {
        return trimmed;
      }
      if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    })
    .filter(Boolean);
  const hasExtension = path.extname(executable).length > 0;
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM')
          .split(';')
          .map((ext) => ext.trim())
          .filter(Boolean)
      : [''];

  // Check each PATH entry with PATHEXT so we can resolve shim executables.
  for (const entry of pathEntries) {
    if (hasExtension) {
      const candidate = path.join(entry, executable);
      if (existsSync(candidate)) {
        return candidate;
      }
      continue;
    }

    for (const ext of extensions) {
      const candidate = path.join(entry, `${executable}${ext}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function findAncestorPnpmWorkspaceRoot(rootDir: string): string | null {
  let cursor = path.resolve(rootDir);

  while (true) {
    const parentDir = path.dirname(cursor);
    if (parentDir === cursor) {
      return null;
    }
    cursor = parentDir;

    if (existsSync(path.join(cursor, 'pnpm-workspace.yaml'))) {
      return cursor;
    }
  }
}

export function resolvePnpmWorkspaceGuard(
  rootDir: string,
  packageManager: PackageManager
): PnpmWorkspaceGuard {
  if (packageManager !== 'pnpm') {
    return { workspaceRoot: null, shouldIgnoreWorkspace: false };
  }

  const workspaceRoot = findAncestorPnpmWorkspaceRoot(rootDir);
  return {
    workspaceRoot,
    shouldIgnoreWorkspace: workspaceRoot !== null,
  };
}

function resolveNpmWorkspaceGuard(rootDir: string, packageManager: PackageManager): NpmWorkspaceGuard {
  if (packageManager !== 'npm') {
    return { workspaceRoot: null, shouldDisableWorkspaces: false };
  }

  const workspaceRoot = findAncestorWorkspaceRoot(rootDir);
  return {
    workspaceRoot,
    shouldDisableWorkspaces: workspaceRoot !== null,
  };
}

function findAncestorWorkspaceRoot(rootDir: string): string | null {
  let cursor = path.resolve(rootDir);

  while (true) {
    const parentDir = path.dirname(cursor);
    if (parentDir === cursor) {
      return null;
    }
    cursor = parentDir;

    const packagePath = path.join(cursor, 'package.json');
    if (!existsSync(packagePath)) {
      continue;
    }

    try {
      const parsed = JSON.parse(readFileSync(packagePath, 'utf8')) as Record<string, unknown>;
      if (parsed.workspaces !== undefined) {
        return cursor;
      }
    } catch {
      continue;
    }
  }
}

export interface InitInstallStrategy {
  installCommand: string;
  workspaceGuard: PnpmWorkspaceGuard;
  shouldDeferAutoInstall: boolean;
}

function buildManualInstallCommand(
  kind: PackageInstallKind,
  packageManager: PackageManager,
  packages: string[],
  rootDir: string
): string {
  return [packageManager, ...buildPackageManagerArgs(kind, packageManager, packages, rootDir)].join(' ');
}

export function resolveInitInstallStrategy(
  rootDir: string,
  packageManager: PackageManager,
  environment?: { platform?: NodeJS.Platform; npmCommand?: string }
): InitInstallStrategy {
  const workspaceGuard = resolvePnpmWorkspaceGuard(rootDir, packageManager);
  const npmWorkspaceGuard = resolveNpmWorkspaceGuard(rootDir, packageManager);
  const installCommand =
    packageManager === 'pnpm' && workspaceGuard.shouldIgnoreWorkspace
      ? 'pnpm install --ignore-workspace'
      : packageManager === 'npm' && npmWorkspaceGuard.shouldDisableWorkspaces
        ? 'npm install --workspaces=false'
        : `${packageManager} install`;
  const platform = environment?.platform ?? process.platform;
  // npm_command is provided by npm/pnpm for lifecycle and exec invocations, which we use as a fallback in real CLI runs.
  const npmCommand = environment?.npmCommand ?? process.env.npm_command;

  return {
    installCommand,
    workspaceGuard,
    shouldDeferAutoInstall: platform === 'win32' && packageManager === 'pnpm' && npmCommand === 'exec'
  };
}

export function buildPackageManagerArgs(
  kind: PackageInstallKind,
  packageManager: PackageManager,
  packages: string[],
  rootDir?: string
): string[] {
  const pnpmWorkspaceGuard =
    rootDir !== undefined ? resolvePnpmWorkspaceGuard(rootDir, packageManager) : { shouldIgnoreWorkspace: false };
  const npmWorkspaceGuard =
    rootDir !== undefined
      ? resolveNpmWorkspaceGuard(rootDir, packageManager)
      : { workspaceRoot: null, shouldDisableWorkspaces: false };

  if (kind === 'install') {
    if (packageManager === 'pnpm' && pnpmWorkspaceGuard.shouldIgnoreWorkspace) {
      return ['install', '--ignore-workspace'];
    }
    if (packageManager === 'npm' && npmWorkspaceGuard.shouldDisableWorkspaces) {
      return ['install', '--workspaces=false'];
    }
    return ['install'];
  }

  if (packages.length === 0) {
    return [];
  }

  if (packageManager === 'npm') {
    return npmWorkspaceGuard.shouldDisableWorkspaces
      ? ['install', '-D', ...packages, '--workspaces=false']
      : ['install', '-D', ...packages];
  }

  return packageManager === 'pnpm' && pnpmWorkspaceGuard.shouldIgnoreWorkspace
    ? ['add', '-D', ...packages, '--ignore-workspace']
    : ['add', '-D', ...packages];
}

function defaultPackageManagerForScaffold(scaffoldProfile?: InitScaffoldProfile): PackageManager {
  return scaffoldProfile?.dependencyProfile === 'local-source' ? 'pnpm' : 'npm';
}

function detectPackageManager(rootDir: string, fallbackPackageManager: PackageManager = 'npm'): PackageManager {
  // Prefer lockfiles to avoid guessing when multiple package managers are installed.
  if (existsSync(path.join(rootDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(path.join(rootDir, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(path.join(rootDir, 'package-lock.json'))) {
    return 'npm';
  }

  // Default external standalone consumers to npm unless the scaffold explicitly targets local-source dogfooding.
  return fallbackPackageManager;
}

function extractPackageName(specifier: string): string | null {
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('node:') ||
    specifier.startsWith('#')
  ) {
    return null;
  }

  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    if (!scope || !name) {
      return null;
    }
    return `${scope}/${name}`;
  }

  const [name] = specifier.split('/');
  return name || null;
}

function listReferencedPackagesFromSource(source: string): string[] {
  const packages = new Set<string>();
  const patterns = [
    // Capture ESM imports and re-exports, including `import type`, but only
    // when the statement itself starts with import/export so SQL string
    // literals like `from "user"` do not get misidentified as packages.
    /^\s*(?:import|export)\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm,
    // Capture dynamic imports.
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Capture CommonJS requires.
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier) {
        continue;
      }

      const packageName = extractPackageName(specifier);
      if (!packageName) {
        continue;
      }
      packages.add(packageName);
    }
  }

  return [...packages];
}

function listDeclaredPackages(rootDir: string): Set<string> {
  const packagePath = path.join(rootDir, 'package.json');
  if (!existsSync(packagePath)) {
    return new Set<string>();
  }

  const parsed = JSON.parse(readFileSync(packagePath, 'utf8')) as Record<string, unknown>;
  const keys = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;
  const declared = new Set<string>();

  for (const key of keys) {
    const record = parsed[key];
    if (!record || typeof record !== 'object') {
      continue;
    }

    for (const name of Object.keys(record as Record<string, unknown>)) {
      declared.add(name);
    }
  }

  return declared;
}

function listTemplateReferencedPackages(
  absolutePaths: Record<FileKey, string>,
  summaries: Partial<Record<FileKey, FileSummary>>
): string[] {
  const packages = new Set<string>();
  const touchedKeys = Object.entries(summaries)
    .filter((entry): entry is [FileKey, FileSummary] => Boolean(entry[1]))
    .filter(([, summary]) => summary.outcome === 'created' || summary.outcome === 'overwritten')
    .map(([key]) => key);

  for (const key of touchedKeys) {
    const filePath = absolutePaths[key];
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js')) {
      continue;
    }
    if (!existsSync(filePath)) {
      continue;
    }

    // Parse template output after it is written so the detected packages match the emitted scaffold exactly.
    const contents = readFileSync(filePath, 'utf8');
    listReferencedPackagesFromSource(contents).forEach((name) => packages.add(name));
  }

  return [...packages].sort();
}

async function ensureTemplateDependenciesInstalled(
  rootDir: string,
  absolutePaths: Record<FileKey, string>,
  summaries: Partial<Record<FileKey, FileSummary>>,
  dependencies: ZtdConfigWriterDependencies,
  scaffoldProfile: InitScaffoldProfile,
  skipInstall: boolean
): Promise<string | null> {
  const packageManager = detectPackageManager(rootDir, defaultPackageManagerForScaffold(scaffoldProfile));
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!dependencies.fileExists(packageJsonPath)) {
    const note = `Skipping dependency installation because package.json is missing. Next: run ${packageManager} init, install dependencies, then run npx ztd ztd-config.`;
    dependencies.log(note);
    return note;
  }

  const installStrategy = resolveInitInstallStrategy(rootDir, packageManager);
  if (installStrategy.workspaceGuard.shouldIgnoreWorkspace) {
    dependencies.log(
      `Detected parent pnpm workspace at ${installStrategy.workspaceGuard.workspaceRoot}. Running pnpm with --ignore-workspace so this initialized project keeps isolated installs.`
    );
  }
  if (skipInstall) {
    const note = `Skipping dependency installation because --skip-install was set. Next: run ${installStrategy.installCommand} manually before executing ztd-config or tests.`;
    dependencies.log(note);
    return note;
  }
  const referencedPackages = listTemplateReferencedPackages(absolutePaths, summaries);
  const declaredPackages = listDeclaredPackages(rootDir);

  // Install only packages that are not declared yet to avoid unintentionally bumping pinned versions.
  const missingPackages = referencedPackages.filter((name) => !declaredPackages.has(name));
  if (missingPackages.length > 0) {
    if (installStrategy.shouldDeferAutoInstall) {
      const manualAddCommand = buildManualInstallCommand('devDependencies', packageManager, missingPackages, rootDir);
      const note = `Skipping automatic ${manualAddCommand} because Windows pnpm exec can break the current ztd process after package.json changes. Next: run ${manualAddCommand} manually.`;
      dependencies.log(note);
      return note;
    }

    dependencies.log(`Installing devDependencies referenced by templates (${packageManager}): ${missingPackages.join(', ')}`);
    try {
      await dependencies.installPackages({
        rootDir,
        kind: 'devDependencies',
        packages: missingPackages,
        packageManager
      });
      return null;
    } catch (error) {
      const note = `Dependency install failed, but the scaffold was created: ${extractErrorMessage(error)}`;
      dependencies.log(note);
      return note;
    }
  }
  // Avoid mutating the current pnpm exec shim on Windows while it is still executing this command.
  if (summaries.package?.outcome === 'created' || summaries.package?.outcome === 'overwritten') {
    if (installStrategy.shouldDeferAutoInstall) {
      const note = `Skipping automatic ${installStrategy.installCommand} because Windows pnpm exec can break the current ztd process after package.json changes. Next: run ${installStrategy.installCommand} manually.`;
      dependencies.log(note);
      return note;
    }

    dependencies.log(`Running ${installStrategy.installCommand} to sync dependencies.`);
    try {
      await dependencies.installPackages({ rootDir, kind: 'install', packages: [], packageManager });
      return null;
    } catch (error) {
      const note = `Dependency install failed, but the scaffold was created: ${extractErrorMessage(error)}`;
      dependencies.log(note);
      return note;
    }
  }

  return null;
}

function copyTemplateFileIfMissing(
  rootDir: string,
  relative: string,
  templateName: string,
  dependencies: ZtdConfigWriterDependencies
): FileSummary | null {
  const templatePath = path.join(TEMPLATE_DIRECTORY, templateName);
  // Skip copying when the CLI package does not include the requested template.
  if (!existsSync(templatePath)) {
    return null;
  }

  const targetPath = path.join(rootDir, relative);
  // Avoid overwriting a file that the project already maintains.
  if (dependencies.fileExists(targetPath)) {
    return null;
  }

  dependencies.ensureDirectory(path.dirname(targetPath));
  // Emit the template content so the generated project gets the same formatting defaults.
  dependencies.writeFile(targetPath, readFileSync(templatePath, 'utf8'));
  return { relativePath: relative, outcome: 'created' };
}

function writeOptionalTemplateFile(
  absolutePath: string,
  relative: string,
  templateName: string,
  dependencies: ZtdConfigWriterDependencies
): FileSummary | null {
  const templatePath = path.join(TEMPLATE_DIRECTORY, templateName);
  // Skip when the template is missing from the installed package.
  if (!existsSync(templatePath)) {
    return null;
  }

  if (dependencies.fileExists(absolutePath)) {
    // Preserve existing files for opt-in scaffolds without prompting.
    dependencies.log(`Skipping ${relative} because the file already exists.`);
    return { relativePath: relative, outcome: 'unchanged' };
  }

  dependencies.ensureDirectory(path.dirname(absolutePath));
  dependencies.writeFile(absolutePath, readFileSync(templatePath, 'utf8'));
  return { relativePath: relative, outcome: 'created' };
}

function ensurePackageJsonFormatting(
  rootDir: string,
  relative: string,
  dependencies: ZtdConfigWriterDependencies,
  optionalFeatures: OptionalFeatures,
  scaffoldProfile: InitScaffoldProfile
): FileSummary | null {
  const packagePath = path.join(rootDir, 'package.json');
  const packageExists = dependencies.fileExists(packagePath);
  const parsed = packageExists
    ? (JSON.parse(readFileSync(packagePath, 'utf8')) as Record<string, unknown>)
    : {
        name: inferPackageName(rootDir),
        version: '0.0.0',
        private: true
      };
  let changed = false;

  const scripts = (parsed.scripts as Record<string, string> | undefined) ?? {};
  const requiredScripts: Record<string, string> = {
    test: 'vitest run',
    typecheck: 'tsc --noEmit',
    format: 'prettier . --write',
    lint: 'eslint .',
    'lint:fix': 'eslint . --fix'
  };
  if (scaffoldProfile.dependencyProfile === 'local-source') {
    // Route test and typecheck through the local-source guard so parent workspaces cannot silently hijack execution.
    requiredScripts.test = 'node ./scripts/local-source-guard.mjs test';
    requiredScripts.typecheck = 'node ./scripts/local-source-guard.mjs typecheck';
    requiredScripts.ztd = 'node ./scripts/local-source-guard.mjs ztd';
  }

  // Ensure the canonical formatting and lint scripts exist without overwriting custom commands.
  for (const [name, value] of Object.entries(requiredScripts)) {
    if (name in scripts) {
      continue;
    }
    scripts[name] = value;
    changed = true;
  }

  if (changed) {
    parsed.scripts = scripts;
  }

  // Provide lint-staged wiring for the formatting pipeline when no configuration is present.
  if (!('lint-staged' in parsed)) {
    parsed['lint-staged'] = {
      '*.{ts,tsx,js,jsx,json,md,sql}': ['pnpm format']
    };
    changed = true;
  }

  // Wire simple-git-hooks only if the user has not already customized it.
  if (!('simple-git-hooks' in parsed)) {
    parsed['simple-git-hooks'] = {
      'pre-commit': 'pnpm lint-staged'
    };
    changed = true;
  }

  const devDependencies = (parsed.devDependencies as Record<string, string> | undefined) ?? {};
  const formattingDeps: Record<string, string> = {
    eslint: '^9.22.0',
    'lint-staged': '^16.2.7',
    'prettier': '^3.7.4',
    'prettier-plugin-sql': '^0.19.2',
    'simple-git-hooks': '^2.13.1'
  };
  const testingDeps: Record<string, string> = {
    vitest: '^4.0.7',
    typescript: '^5.8.2',
    '@types/node': '^22.13.10'
  };
  // Add the formatting toolchain dependencies that back the scripts and hooks.
  for (const [dep, version] of Object.entries(formattingDeps)) {
    if (dep in devDependencies) {
      continue;
    }
    devDependencies[dep] = version;
    changed = true;
  }

  const stackDependencies: Record<string, string> =
    scaffoldProfile.dependencyProfile === 'local-source'
      ? buildLocalSourceStackDependencies(rootDir, scaffoldProfile)
      : {
          ...STACK_DEV_DEPENDENCIES
        };
  if (optionalFeatures.validator === 'zod') {
    Object.assign(stackDependencies, ZOD_DEPENDENCY);
  } else {
    Object.assign(stackDependencies, ARKTYPE_DEPENDENCY);
  }

  // Ensure test and typecheck toolchain dependencies are present for a runnable scaffold.
  for (const [dep, version] of Object.entries(testingDeps)) {
    if (dep in devDependencies) {
      continue;
    }
    devDependencies[dep] = version;
    changed = true;
  }

  for (const [dep, version] of Object.entries(stackDependencies)) {
    if (dep in devDependencies) {
      continue;
    }
    devDependencies[dep] = version;
    changed = true;
  }

  if (!changed) {
    return null;
  }

  parsed.devDependencies = devDependencies;
  dependencies.ensureDirectory(path.dirname(packagePath));
  // Persist the updated manifest so the new scripts and tools are available immediately.
  dependencies.writeFile(packagePath, `${JSON.stringify(parsed, null, 2)}\n`);
  return { relativePath: relative, outcome: packageExists ? 'overwritten' : 'created' };
}

function inferPackageName(rootDir: string): string {
  const baseName = path.basename(rootDir).toLowerCase();
  const normalized = baseName.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (normalized.length > 0) {
    return normalized;
  }
  return 'ztd-project';
}

async function writeFileWithConsent(
  absolutePath: string,
  relative: string,
  dependencies: ZtdConfigWriterDependencies,
  prompter: Prompter,
  overwritePolicy: OverwritePolicy,
  writer: () => Promise<void> | void
): Promise<FileSummary> {
  const { existed, write } = await confirmOverwriteIfExists(
    absolutePath,
    relative,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (!write) {
    return { relativePath: relative, outcome: 'unchanged' };
  }
  await writer();
  return { relativePath: relative, outcome: existed ? 'overwritten' : 'created' };
}

interface OverwriteCheck {
  existed: boolean;
  write: boolean;
}

interface OverwritePolicy {
  force: boolean;
  nonInteractive: boolean;
}

async function confirmOverwriteIfExists(
  absolutePath: string,
  relative: string,
  dependencies: ZtdConfigWriterDependencies,
  prompter: Prompter,
  overwritePolicy: OverwritePolicy
): Promise<OverwriteCheck> {
  const existed = dependencies.fileExists(absolutePath);
  if (!existed) {
    return { existed: false, write: true };
  }
  if (overwritePolicy.force) {
    return { existed: true, write: true };
  }
  if (overwritePolicy.nonInteractive) {
    throw new Error(
      `File ${relative} already exists. Re-run with --force to overwrite or remove the file before running ztd init.`
    );
  }
  const overwrite = await prompter.confirm(`File ${relative} already exists. Overwrite?`);
  if (!overwrite) {
    return { existed: true, write: false };
  }
  return { existed: true, write: true };
}

async function writeDocFile(
  absolutePath: string,
  relative: string,
  contents: string,
  dependencies: ZtdConfigWriterDependencies,
  prompter: Prompter,
  overwritePolicy: OverwritePolicy
): Promise<FileSummary> {
  const summary = await writeFileWithConsent(
    absolutePath,
    relative,
    dependencies,
    prompter,
    overwritePolicy,
    () => {
      dependencies.ensureDirectory(path.dirname(absolutePath));
      dependencies.writeFile(absolutePath, contents);
    }
  );
  return summary;
}

async function writeTemplateFile(
  rootDir: string,
  absolutePath: string,
  relative: string,
  templateName: string,
  dependencies: ZtdConfigWriterDependencies,
  prompter: Prompter,
  overwritePolicy: OverwritePolicy,
  allowFallback?: boolean
): Promise<FileSummary | null> {
  const templateTarget = resolveTemplateTarget(rootDir, absolutePath, relative, dependencies, allowFallback);
  if (!templateTarget) {
    return null;
  }

  // Load shared documentation templates so every new project gets the same guidance.
  const contents = loadTemplate(templateName);
  return writeDocFile(
    templateTarget.absolutePath,
    templateTarget.relativePath,
    contents,
    dependencies,
    prompter,
    overwritePolicy
  );
}

interface TemplateTarget {
  absolutePath: string;
  relativePath: string;
}

function resolveTemplateTarget(
  rootDir: string,
  absolutePath: string,
  relative: string,
  dependencies: ZtdConfigWriterDependencies,
  allowFallback?: boolean
): TemplateTarget | null {
  if (!dependencies.fileExists(absolutePath)) {
    return { absolutePath, relativePath: relative };
  }

  if (!allowFallback || !isRootMarkdown(relative)) {
    dependencies.log(`Skipping template ${relative} because the target file already exists.`);
    return null;
  }

  // When the preferred destination already exists, try emitting a sibling with a "_ztd" suffix.
  const parsed = path.parse(absolutePath);
  const fallbackAbsolute = path.join(parsed.dir, `${parsed.name}_ztd${parsed.ext}`);
  if (dependencies.fileExists(fallbackAbsolute)) {
    const existingRelative = normalizeRelative(rootDir, fallbackAbsolute);
    dependencies.log(
      `Skipping template ${relative} because both ${relative} and ${existingRelative} already exist.`
    );
    return null;
  }

  const fallbackRelative = normalizeRelative(rootDir, fallbackAbsolute);
  dependencies.log(`Existing ${relative} preserved; writing template as ${fallbackRelative}.`);
  return { absolutePath: fallbackAbsolute, relativePath: fallbackRelative };
}

function normalizeRelative(rootDir: string, absolutePath: string): string {
  // Normalize the path relative to the project root so summaries use forward slashes.
  const relative = normalizeCliPath(path.relative(rootDir, absolutePath));
  return relative || absolutePath;
}

function normalizeCliPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Normalizes a schema identifier into the canonical lowercase form used by ztd-cli file naming.
 * Empty input falls back to the configured default schema.
 */
export function normalizeSchemaName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_ZTD_CONFIG.ddl.defaultSchema;
  }
  return trimmed.replace(/^"|"$/g, '').toLowerCase();
}

/**
 * Sanitizes a normalized schema identifier so it can be used as a filesystem-safe file stem.
 * Returns `schema` when all characters are stripped by sanitization.
 */
export function sanitizeSchemaFileName(schemaName: string): string {
  const sanitized = schemaName.replace(/[^a-z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  return sanitized || 'schema';
}

interface AgentsFileResolution {
  absolutePath: string;
  created: boolean;
}

function resolveOrCreateAgentsFile(
  rootDir: string,
  dependencies: ZtdConfigWriterDependencies
): AgentsFileResolution | null {
  // Prefer materializing the bundled template before looking for existing attention files.
  const templateTarget = dependencies.copyAgentsTemplate(rootDir);
  if (templateTarget) {
    return { absolutePath: templateTarget, created: true };
  }

  for (const candidate of AGENTS_FILE_CANDIDATES) {
    const candidatePath = path.join(rootDir, candidate);
    if (dependencies.fileExists(candidatePath)) {
      return { absolutePath: candidatePath, created: false };
    }
  }

  return null;
}

async function appendAppInterfaceGuidance(
  rootDir: string,
  dependencies: ZtdConfigWriterDependencies
): Promise<FileSummary> {
  const resolution = resolveOrCreateAgentsFile(rootDir, dependencies);
  if (!resolution) {
    throw new Error('Failed to locate or create an AGENTS file for application guidance.');
  }

  const relativePath = normalizeRelative(rootDir, resolution.absolutePath);
  const existingContents = readFileSync(resolution.absolutePath, 'utf8');

  // Skip appending when the guidance section already exists to avoid duplicates.
  if (existingContents.includes(APP_INTERFACE_SECTION_MARKER)) {
    return { relativePath, outcome: 'unchanged' };
  }

  // Ensure the appended block is separated by blank lines for readability.
  const baseline = existingContents.endsWith('\n') ? existingContents : `${existingContents}\n`;
  const spacer = baseline.endsWith('\n\n') ? '' : '\n';
  dependencies.writeFile(
    resolution.absolutePath,
    `${baseline}${spacer}${APP_INTERFACE_SECTION}\n`
  );

  return { relativePath, outcome: 'overwritten' };
}

function isRootMarkdown(relative: string): boolean {
  return relative.toLowerCase().endsWith('.md') && !relative.includes('/');
}

function loadTemplate(templateName: string): string {
  const templatePath = path.join(TEMPLATE_DIRECTORY, templateName);
  // Fail fast if the template bundle was shipped without the requested file.
  if (!existsSync(templatePath)) {
    throw new Error(`Missing template file: ${templateName}`);
  }
  return readFileSync(templatePath, 'utf8');
}

function buildLocalSourceGuardContents(
  absolutePath: string,
  scaffoldProfile: InitScaffoldProfile
): string {
  const template = loadTemplate(LOCAL_SOURCE_GUARD_TEMPLATE);
  if (scaffoldProfile.dependencyProfile !== 'local-source' || !scaffoldProfile.localSourceRoot) {
    return template.replace('__LOCAL_SOURCE_ZTD_CLI__', './packages/ztd-cli/dist/index.js');
  }

  const cliEntry = path.join(scaffoldProfile.localSourceRoot, 'packages', 'ztd-cli', 'dist', 'index.js');
  const projectRoot = path.dirname(path.dirname(absolutePath));
  const relativeCliEntry = normalizeCliPath(path.relative(projectRoot, cliEntry));
  const cliImportPath =
    relativeCliEntry.startsWith('.') || relativeCliEntry.startsWith('/') ? relativeCliEntry : `./${relativeCliEntry}`;
  return template.replace('__LOCAL_SOURCE_ZTD_CLI__', cliImportPath);
}

function buildNextSteps(
  schemaRelativePath: string,
  workflow: InitWorkflow,
  rootDir: string,
  scaffoldProfile: InitScaffoldProfile,
  includeInstallStep: boolean,
  starter: boolean,
  postgresImage: string
): { nextSteps: string[]; fallbackSteps: string[] } {
  const packageManager = detectPackageManager(rootDir, defaultPackageManagerForScaffold(scaffoldProfile));
  const installStrategy = resolveInitInstallStrategy(rootDir, packageManager);
  const installCommand = installStrategy.installCommand;
  const runScriptCommand = (script: 'typecheck' | 'test'): string =>
    packageManager === 'npm' ? `npm run ${script}` : `${packageManager} ${script}`;
  const runLocalSourceZtdCommand =
    packageManager === 'npm' ? 'npm run ztd --' : `${packageManager} ztd`;
  const ztdCommand =
    packageManager === 'npm' ? 'npx ztd' : packageManager === 'yarn' ? 'yarn exec ztd' : 'pnpm exec ztd';
  const firstStep =
    workflow === 'pg_dump'
      ? `Review the dumped DDL in ${schemaRelativePath} and adjust it before generating downstream artifacts`
      : `If the schema file is empty, edit ${schemaRelativePath} before generating downstream artifacts`;
  const sqlStep = 'Start in src/features/smoke/ and copy that layout for your first real feature';
  const aiGuidanceStep = 'Open README.md and follow the Getting Started With AI section before writing repository code';
  const generationSteps = [
    `Run ${ztdCommand} ztd-config to regenerate DDL-derived test rows and layout metadata`,
    `Run ${ztdCommand} model-gen --probe-mode ztd <sql-file> --out <spec-file> to scaffold a QuerySpec from that SQL file`
  ];
  const wiringStep = 'Review src/features/smoke/application/smoke-workflow.ts and the persistence files so the first slice stays local';
  const firstTestStep = `Run tests (${runScriptCommand('test')} or npx vitest run) to pass the generated smoke tests before adding more features`;
  const sampleTestStep =
    'Open src/features/smoke/tests/smoke.test.ts for the feature-local sample and tests/queryspec.example.test.ts for the repo-level support sample';
  const fallbackSteps = [
    `If ${ztdCommand} ztd-config fails, keep editing ${schemaRelativePath} and the feature-local SQL file first, then rerun generation after the DDL is ready`,
    `If ${ztdCommand} model-gen fails, keep the SQL file and rerun it after ${ztdCommand} ztd-config succeeds; the ztd probe path does not need DATABASE_URL`,
    'If you do not have ZTD_TEST_DATABASE_URL yet, use the generated smoke test as the first DB-free pass and wait to add SQL-backed tests until the connection is ready'
  ];

  if (starter) {
    const starterNextSteps = [
      'Run docker compose up -d to start the bundled Postgres container',
      `The bundled compose file uses ${postgresImage}; export ZTD_TEST_DATABASE_URL=postgres://ztd:ztd@localhost:5432/ztd before running Vitest`,
      `Run tests (${runScriptCommand('test')} or npx vitest run) to confirm the smoke slice is green`,
      'Read src/features/smoke/ first, then copy that layout for src/features/users/ as your first real feature',
      ...generationSteps,
      wiringStep,
      sampleTestStep,
      firstTestStep
    ];
    return {
      nextSteps: starterNextSteps.map((step, index) => ` ${index + 1}. ${step}`),
      fallbackSteps: fallbackSteps.map((step) => ` - ${step}`)
    };
  }

  if (scaffoldProfile.dependencyProfile === 'local-source') {
    const localSourceSteps = [
      `Run ${installCommand}`,
      firstStep,
      sqlStep,
      ...generationSteps.map((step) => step.replace(ztdCommand, runLocalSourceZtdCommand)),
      wiringStep,
      sampleTestStep,
      firstTestStep,
      `Run ${runScriptCommand('typecheck')} before you start wiring handwritten repository code`
    ];
    return {
      nextSteps: localSourceSteps.map((step, index) => ` ${index + 1}. ${step}`),
      fallbackSteps: fallbackSteps
        .map((step) => step.split(ztdCommand).join(runLocalSourceZtdCommand))
        .map((step) => ` - ${step}`)
    };
  }

  const nextSteps = [firstStep, sqlStep];
  if (includeInstallStep || installStrategy.shouldDeferAutoInstall) {
    nextSteps.push(`Run ${installCommand}`);
  }
  nextSteps.push(aiGuidanceStep, ...generationSteps, wiringStep, sampleTestStep, firstTestStep);
  // Avoid repeating the same install hint when the deferred-install path already emitted it explicitly.
  if (installStrategy.workspaceGuard.shouldIgnoreWorkspace && !installStrategy.shouldDeferAutoInstall) {
    fallbackSteps.push('This project is nested under a parent pnpm workspace; use pnpm install --ignore-workspace for manual installs.');
  }
  return {
    nextSteps: nextSteps.map((step, index) => ` ${index + 1}. ${step}`),
    fallbackSteps: fallbackSteps.map((step) => ` - ${step}`)
  };
}

function resolveInitScaffoldProfile(rootDir: string, localSourceRoot?: string): InitScaffoldProfile {
  if (!localSourceRoot) {
    return { dependencyProfile: 'registry', localSourceRoot: null };
  }

  const resolvedRoot = path.resolve(rootDir, localSourceRoot);

  // Validate every direct rawsql-ts scaffold dependency up front so local-source installs
  // cannot silently mix local packages with registry packages.
  for (const packageDir of Object.values(LOCAL_SOURCE_STACK_PACKAGE_DIRS)) {
    const packageJsonPath = path.join(resolvedRoot, packageDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error(
        `The local-source root does not contain ${normalizeCliPath(path.join(packageDir, 'package.json'))}: ${normalizeCliPath(resolvedRoot)}`
      );
    }
  }

  return {
    dependencyProfile: 'local-source',
    localSourceRoot: resolvedRoot
  };
}

function buildLocalSourceStackDependencies(
  rootDir: string,
  scaffoldProfile: InitScaffoldProfile
): Record<string, string> {
  if (scaffoldProfile.dependencyProfile !== 'local-source' || !scaffoldProfile.localSourceRoot) {
    return {
      ...STACK_DEV_DEPENDENCIES
    };
  }

  return {
    ...STACK_DEV_DEPENDENCIES,
    ...Object.fromEntries(
      Object.entries(LOCAL_SOURCE_STACK_PACKAGE_DIRS).map(([packageName, packageDir]) => [
        packageName,
        toFileDependencySpecifier(rootDir, path.join(scaffoldProfile.localSourceRoot!, packageDir))
      ])
    )
  };
}

function toFileDependencySpecifier(rootDir: string, targetDir: string): string {
  const relativeTarget = normalizeCliPath(path.relative(rootDir, targetDir));
  const withDotPrefix =
    relativeTarget.startsWith('.') || relativeTarget.startsWith('/') ? relativeTarget : `./${relativeTarget}`;
  return `file:${withDotPrefix}`;
}

function buildSummaryLines(
  summaries: Record<FileKey, FileSummary>,
  optionalFeatures: OptionalFeatures,
  nextSteps: { nextSteps: string[]; fallbackSteps: string[] },
  scaffoldProfile: InitScaffoldProfile,
  starter: boolean,
  postgresImage: string,
  installNote?: string | null
): string[] {
  const orderedKeys: FileKey[] = [
    'schema',
    'config',
    'starterCompose',
    'readme',
    'context',
    'promptDogfood',
    'internalAgentsManifest',
    'internalAgentsRoot',
    'internalAgentsSrc',
    'internalAgentsTests',
    'internalAgentsZtd',
    'ztdDocsReadme',
    'sqlReadme',
    'featureRootReadme',
    'smokeReadme',
    'smokeApplicationReadme',
    'smokeDomainReadme',
    'smokePersistenceReadme',
    'smokeTestsReadme',
    'smokeDomain',
    'smokeApplication',
    'smokeSql',
    'smokeSpec',
    'localSourceGuardScript',
    'smokeValidationTest',
    'smokeTest',
    'querySpecExampleTest',
    'sqlClient',
    'sqlClientAdapters',
    'testkitClient',
    'globalSetup',
    'vitestConfig',
    'tsconfig',
    'gitignore',
    'editorconfig',
    'prettierignore',
    'prettier',
    'package'
  ];
  const lines = ['ZTD project initialized.', '', 'Created:'];

  for (const key of orderedKeys) {
    const summary = summaries[key];
    const note =
      summary?.outcome === 'created'
        ? ''
        : summary?.outcome === 'overwritten'
        ? ' (overwritten existing file)'
        : ' (existing file preserved)';
    if (summary) {
      lines.push(` - ${summary.relativePath}${note}`);
    }
  }

  lines.push('', 'Validation configuration:');
  const stackLine =
    scaffoldProfile.dependencyProfile === 'local-source'
      ? ' - SQL catalog/mapping support via @rawsql-ts/sql-contract backed by a local file dependency in developer mode (see docs/recipes/sql-contract.md)'
      : ' - SQL catalog/mapping support via @rawsql-ts/sql-contract (see docs/recipes/sql-contract.md)';
  lines.push(stackLine);
  const validatorLabel =
    optionalFeatures.validator === 'zod'
      ? 'Zod (zod, docs/recipes/validation-zod.md)'
      : 'ArkType (arktype, docs/recipes/validation-arktype.md)';
  lines.push(` - Validator backend: ${validatorLabel}`);
  if (starter) {
    lines.push('', 'Starter flow:');
    lines.push(' - Visible AGENTS.md files are installed for the starter flow.');
    lines.push(` - Bundled Postgres compose image: ${postgresImage}`);
    lines.push(' - Run docker compose up -d before Vitest so the starter DB path is ready.');
  }
  if (optionalFeatures.aiGuidance) {
    lines.push('', 'AI guidance:');
    lines.push(' - Internal guidance is managed under .ztd/agents/.');
    lines.push(' - Visible AGENTS.md files are disabled by default. Enable with: ztd agents install');
  }
  if (installNote) {
    lines.push('', 'Dependency installation:');
    lines.push(` - ${installNote}`);
  }
  lines.push('', 'Next steps:', ...nextSteps.nextSteps);
  if (nextSteps.fallbackSteps.length > 0) {
    lines.push('', 'If this fails:', ...nextSteps.fallbackSteps);
  }
  return lines;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

const VALID_WORKFLOWS: readonly InitWorkflow[] = ['pg_dump', 'empty', 'demo'] as const;
const VALID_VALIDATORS: readonly ValidatorBackend[] = ['zod', 'arktype'] as const;
const VALID_APP_SHAPES: readonly InitAppShape[] = ['default', 'webapi'] as const;

interface InitDryRunPlan {
  schemaVersion: 1;
  workflow: InitWorkflow;
  validator: ValidatorBackend;
  starter: boolean;
  postgresImage: string;
  dryRun: true;
  files: string[];
}

function buildInitDryRunPlan(rootDir: string, options: {
  appShape: InitAppShape;
  starter?: boolean;
  postgresImage?: string;
  withAiGuidance?: boolean;
  withDogfooding?: boolean;
  withAppInterface?: boolean;
  workflow: InitWorkflow;
  validator: ValidatorBackend;
  localSourceRoot?: string;
}): InitDryRunPlan {
  const schemaName = normalizeSchemaName(DEFAULT_ZTD_CONFIG.ddl.defaultSchema);
  const schemaFileName = `${sanitizeSchemaFileName(schemaName)}.sql`;
  const scaffoldLayout = resolveInitScaffoldLayout(rootDir, options.appShape);
  const starter = options.starter === true;
  const postgresImage = options.postgresImage?.trim() || DEFAULT_POSTGRES_IMAGE;
  const files = [
    'ztd.config.json',
    path.join(DEFAULT_ZTD_CONFIG.ddlDir, schemaFileName),
    path.join('src', 'features', 'README.md'),
    path.join('src', 'features', 'smoke', 'README.md'),
    path.join('src', 'features', 'smoke', 'application', 'README.md'),
    path.join('src', 'features', 'smoke', 'domain', 'README.md'),
    path.join('src', 'features', 'smoke', 'persistence', 'README.md'),
    path.join('src', 'features', 'smoke', 'tests', 'README.md'),
    path.join('src', 'features', 'smoke', 'domain', 'smoke-policy.ts'),
    path.join('src', 'features', 'smoke', 'application', 'smoke-workflow.ts'),
    path.join('src', 'features', 'smoke', 'persistence', 'smoke.sql'),
    path.join('src', 'features', 'smoke', 'persistence', 'smoke.spec.ts'),
    path.join('src', 'features', 'smoke', 'tests', 'smoke.validation.test.ts'),
    path.join('src', 'features', 'smoke', 'tests', 'smoke.test.ts'),
    path.join(DEFAULT_ZTD_CONFIG.testsDir, 'support', 'testkit-client.ts'),
    path.join(DEFAULT_ZTD_CONFIG.testsDir, 'support', 'global-setup.ts'),
    path.join(DEFAULT_ZTD_CONFIG.testsDir, 'queryspec.example.test.ts'),
    path.join(DEFAULT_ZTD_CONFIG.testsDir, 'generated', 'ztd-row-map.generated.ts'),
    path.join(DEFAULT_ZTD_CONFIG.testsDir, 'generated', 'ztd-layout.generated.ts'),
    'README.md',
    'src/sql/README.md',
    'vitest.config.ts',
    'tsconfig.json'
  ];

  if (starter) {
    files.push(
      STARTER_COMPOSE_FILE,
      'AGENTS.md',
      path.join('ztd', 'AGENTS.md'),
      path.join('ztd', 'ddl', 'AGENTS.md'),
      path.join('src', 'AGENTS.md'),
      path.join('src', 'features', 'AGENTS.md'),
      path.join('src', 'features', 'smoke', 'AGENTS.md'),
      path.join('src', 'features', 'smoke', 'application', 'AGENTS.md'),
      path.join('src', 'features', 'smoke', 'domain', 'AGENTS.md'),
      path.join('src', 'features', 'smoke', 'persistence', 'AGENTS.md'),
      path.join('src', 'features', 'smoke', 'tests', 'AGENTS.md'),
      path.join('tests', 'AGENTS.md'),
      path.join('tests', 'support', 'AGENTS.md'),
      path.join('tests', 'generated', 'AGENTS.md')
    );
  }

  if (options.withAiGuidance) {
    files.push('.ztd/agents/manifest.json');
    files.push('.ztd/agents/root.md');
    files.push('.ztd/agents/src.md');
    files.push('.ztd/agents/src-features.md');
    files.push('.ztd/agents/src-features-smoke.md');
    files.push('.ztd/agents/src-features-application.md');
    files.push('.ztd/agents/src-features-domain.md');
    files.push('.ztd/agents/src-features-persistence.md');
    files.push('.ztd/agents/src-features-tests.md');
    files.push('.ztd/agents/src-sql.md');
    files.push('.ztd/agents/tests.md');
    files.push('.ztd/agents/ztd.md');
    files.push('CONTEXT.md');
  }

  if (options.withDogfooding) {
    files.push('PROMPT_DOGFOOD.md');
  }

  files.push(normalizeCliPath(path.relative(rootDir, scaffoldLayout.sqlClientPath)));
  files.push(normalizeCliPath(path.relative(rootDir, scaffoldLayout.sqlClientAdaptersPath)));

  if (options.withAppInterface) {
    files.splice(0, files.length, 'AGENTS.md');
  }
  if (options.localSourceRoot) {
    resolveInitScaffoldProfile(rootDir, options.localSourceRoot);
  }

  return {
    schemaVersion: 1,
    workflow: options.workflow,
    validator: options.validator,
    starter,
    postgresImage,
    dryRun: true,
    files: files.map((file) => normalizeCliPath(file))
  };
}

function validateJsonBooleanFlag(value: unknown, flagName: string): value is boolean | undefined {
  if (value === undefined || typeof value === 'boolean') {
    return true;
  }

  console.error(`Invalid --${flagName} value in --json payload. Expected a boolean.`);
  process.exit(1);
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Automate project setup for Zero Table Dependency workflows')
    .option('--app-shape <type>', 'Deprecated compatibility option; the vertical scaffold ignores it')
    .option('--starter', 'Generate the recommended starter flow with visible AGENTS, compose, and sample DDL')
    .option('--postgres-image <image>', 'Postgres image/tag to use in the starter compose file (default: postgres:18)')
    .option('--with-ai-guidance', 'Generate internal AI guidance files such as CONTEXT.md and .ztd/agents/*')
    .option('--with-dogfooding', 'Generate PROMPT_DOGFOOD.md for AI prompt dogfooding and debugging')
    .option('--with-app-interface', 'Append application interface guidance to AGENTS.md only')
    .option('--skip-install', 'Create the scaffold without installing dependencies')
    .option('--yes', 'Accept defaults without interactive prompts')
    .option('--force', 'Allow ztd init to overwrite files it owns')
    .option('--workflow <type>', 'Schema workflow: pg_dump, empty, or demo (default: demo)')
    .option('--validator <type>', 'Validator backend: zod or arktype (default: zod)')
    .option('--dry-run', 'Validate init options and emit the planned scaffold without writing files')
    .option('--json <payload>', 'Pass init options as a JSON object')
    .option(
      '--local-source-root <path>',
      'Link @rawsql-ts dependencies to a local monorepo root for dogfooding instead of published npm packages'
    )
    .action(async (options: {
      appShape?: string;
      starter?: boolean;
      postgresImage?: string;
      withAiGuidance?: boolean;
      withDogfooding?: boolean;
      withAppInterface?: boolean;
      skipInstall?: boolean;
      yes?: boolean;
      force?: boolean;
      workflow?: string;
      validator?: string;
      localSourceRoot?: string;
      dryRun?: boolean;
      json?: string;
    }) => {
      const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
      if (typeof merged.localSourceRoot === 'string') {
        merged.localSourceRoot = rejectEncodedTraversal(rejectControlChars(merged.localSourceRoot, '--local-source-root'), '--local-source-root');
      }
      // Reject stringly-typed booleans from --json so unsupported payloads cannot silently enable features.
      validateJsonBooleanFlag(merged.yes, 'yes');
      validateJsonBooleanFlag(merged.dryRun, 'dry-run');
      validateJsonBooleanFlag(merged.force, 'force');
      validateJsonBooleanFlag(merged.starter, 'starter');
      validateJsonBooleanFlag(merged.withAiGuidance, 'with-ai-guidance');
      validateJsonBooleanFlag(merged.withDogfooding, 'with-dogfooding');
      validateJsonBooleanFlag(merged.withAppInterface, 'with-app-interface');
      validateJsonBooleanFlag(merged.skipInstall, 'skip-install');
      if (merged.postgresImage !== undefined && typeof merged.postgresImage !== 'string') {
        console.error('Invalid --postgres-image value in --json payload. Expected a string.');
        process.exit(1);
      }
      // Validate --workflow value if provided.
      if (merged.workflow && !VALID_WORKFLOWS.includes(merged.workflow as InitWorkflow)) {
        console.error(`Invalid --workflow value: "${merged.workflow}". Must be one of: ${VALID_WORKFLOWS.join(', ')}`);
        process.exit(1);
      }
      // Validate --validator value if provided.
      if (merged.validator && !VALID_VALIDATORS.includes(merged.validator as ValidatorBackend)) {
        console.error(`Invalid --validator value: "${merged.validator}". Must be one of: ${VALID_VALIDATORS.join(', ')}`);
        process.exit(1);
      }
      if (merged.appShape && !VALID_APP_SHAPES.includes(merged.appShape as InitAppShape)) {
        console.error(`Invalid --app-shape value: "${merged.appShape}". Must be one of: ${VALID_APP_SHAPES.join(', ')}`);
        process.exit(1);
      }

      const isNonInteractive = merged.yes === true || !process.stdin.isTTY || merged.dryRun === true;

      // When --yes is used, apply defaults for unspecified flags.
      const workflow = (merged.workflow as InitWorkflow | undefined) ?? (isNonInteractive ? 'demo' : undefined);
      const validator = (merged.validator as ValidatorBackend | undefined) ?? (isNonInteractive ? 'zod' : undefined);
      const appShape = (merged.appShape as InitAppShape | undefined) ?? 'default';
      const starter = merged.starter === true;
      const postgresImage = (merged.postgresImage as string | undefined) ?? DEFAULT_POSTGRES_IMAGE;

      if (isNonInteractive && workflow === 'pg_dump') {
        console.error('Non-interactive mode does not support the pg_dump workflow (requires connection string prompt).');
        process.exit(1);
      }

      if (merged.dryRun === true) {
        const plan = buildInitDryRunPlan(process.cwd(), {
          appShape,
          starter,
          postgresImage,
          withAiGuidance: merged.withAiGuidance === true,
          withDogfooding: merged.withDogfooding === true,
          withAppInterface: merged.withAppInterface === true,
          workflow: workflow ?? 'demo',
          validator: validator ?? 'zod',
          localSourceRoot: merged.localSourceRoot
        });
        if (isJsonOutput()) {
          writeCommandEnvelope('init', plan);
        } else {
          process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
        }
        return;
      }

      const prompter = createConsolePrompter();
      try {
        await runInitCommand(prompter, {
          appShape,
          starter,
          postgresImage,
          withAiGuidance: merged.withAiGuidance === true,
          withDogfooding: merged.withDogfooding === true,
          withAppInterface: merged.withAppInterface === true,
          skipInstall: merged.skipInstall === true,
          forceOverwrite: merged.force === true,
          nonInteractive: isNonInteractive,
          workflow,
          validator,
          localSourceRoot: merged.localSourceRoot
        });
      } finally {
        prompter.close();
      }
    });
}
