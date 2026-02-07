import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

import { ensureDirectory } from '../utils/fs';
import { copyAgentsTemplate } from '../utils/agents';
import { DEFAULT_ZTD_CONFIG, writeZtdProjectConfig } from '../utils/ztdProjectConfig';
import { runGenerateZtdConfig, type ZtdConfigGenerationOptions } from './ztdConfig';
import { runPullSchema, type PullSchemaOptions } from './pull';

type PackageManager = 'pnpm' | 'npm' | 'yarn';
type PackageInstallKind = 'devDependencies' | 'install';

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
  | 'smokeSpec'
  | 'smokeCoercions'
  | 'smokeRuntime'
  | 'smokeValidationTest'
  | 'testsAgents'
  | 'testsSupportAgents'
  | 'testsGeneratedAgents'
  | 'testsSmoke'
  | 'testkitClient'
  | 'globalSetup'
  | 'vitestConfig'
  | 'tsconfig'
  | 'readme'
  | 'ztdDocsAgent'
  | 'ztdDocsReadme'
  | 'ztdDdlAgents'
  | 'srcAgents'
  | 'srcCatalogAgents'
  | 'srcCatalogRuntimeAgents'
  | 'srcCatalogSpecsAgents'
  | 'srcSqlAgents'
  | 'srcReposAgents'
  | 'viewsRepoAgents'
  | 'tablesRepoAgents'
  | 'jobsAgents'
  | 'sqlReadme'
  | 'viewsRepoReadme'
  | 'tablesRepoReadme'
  | 'jobsReadme'
  | 'sqlClient'
  | 'agents'
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
  runPullSchema: (options: PullSchemaOptions) => Promise<void> | void;
  runGenerateZtdConfig: (options: ZtdConfigGenerationOptions) => Promise<void> | void;
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
  withSqlClient?: boolean;
  withAppInterface?: boolean;
  forceOverwrite?: boolean;
  nonInteractive?: boolean;
}

type ValidatorBackend = 'zod' | 'arktype';

interface OptionalFeatures {
  validator: ValidatorBackend;
}

const MANDATORY_TESTKIT_DEPENDENCIES: Record<string, string> = {
  '@rawsql-ts/testkit-postgres': '^0.15.1'
};
const SQL_CONTRACT_DEPENDENCY: Record<string, string> = {
  '@rawsql-ts/sql-contract': '^0.1.0'
};
const ZOD_DEPENDENCY: Record<string, string> = {
  zod: '^4.3.6'
};
const ARKTYPE_DEPENDENCY: Record<string, string> = {
  arktype: '^2.1.29'
};

async function gatherOptionalFeatures(
  prompter: Prompter,
  _dependencies: ZtdConfigWriterDependencies
): Promise<OptionalFeatures> {
  const validatorChoice = await prompter.selectChoice(
    'Runtime DTO validation is required for ZTD tests. Which validator backend should we install?',
    ['Zod (zod, recommended)', 'ArkType (arktype)']
  );
  const validator: ValidatorBackend = validatorChoice === 0 ? 'zod' : 'arktype';
  return { validator };
}

type InitWorkflow = 'pg_dump' | 'empty' | 'demo';

const README_TEMPLATE = 'README.md';
const TESTS_AGENTS_TEMPLATE = 'tests/AGENTS.md';
const TESTS_SUPPORT_AGENTS_TEMPLATE = 'tests/support/AGENTS.md';
const TESTS_GENERATED_AGENTS_TEMPLATE = 'tests/generated/AGENTS.md';
const SMOKE_SPEC_ZOD_TEMPLATE = 'src/catalog/specs/_smoke.spec.zod.ts';
const SMOKE_SPEC_ARKTYPE_TEMPLATE = 'src/catalog/specs/_smoke.spec.arktype.ts';
const SMOKE_COERCIONS_TEMPLATE = 'src/catalog/runtime/_coercions.ts';
const SMOKE_RUNTIME_TEMPLATE = 'src/catalog/runtime/_smoke.runtime.ts';
const SMOKE_VALIDATION_TEST_TEMPLATE = 'tests/smoke.validation.test.ts';
const TESTS_SMOKE_TEMPLATE = 'tests/smoke.test.ts';
const TESTKIT_CLIENT_TEMPLATE = 'tests/support/testkit-client.ts';
const GLOBAL_SETUP_TEMPLATE = 'tests/support/global-setup.ts';
const VITEST_CONFIG_TEMPLATE = 'vitest.config.ts';
const TSCONFIG_TEMPLATE = 'tsconfig.json';
const SQL_CLIENT_TEMPLATE = 'src/db/sql-client.ts';
const SQL_README_TEMPLATE = 'src/sql/README.md';
const VIEWS_REPO_README_TEMPLATE = 'src/repositories/views/README.md';
const TABLES_REPO_README_TEMPLATE = 'src/repositories/tables/README.md';
const JOBS_README_TEMPLATE = 'src/jobs/README.md';
const SRC_AGENTS_TEMPLATE = 'src/AGENTS.md';
const SRC_CATALOG_AGENTS_TEMPLATE = 'src/catalog/AGENTS.md';
const SRC_CATALOG_RUNTIME_AGENTS_TEMPLATE = 'src/catalog/runtime/AGENTS.md';
const SRC_CATALOG_SPECS_AGENTS_TEMPLATE = 'src/catalog/specs/AGENTS.md';
const SRC_SQL_AGENTS_TEMPLATE = 'src/sql/AGENTS.md';
const SRC_REPOS_AGENTS_TEMPLATE = 'src/repositories/AGENTS.md';
const VIEWS_REPO_AGENTS_TEMPLATE = 'src/repositories/views/AGENTS.md';
const TABLES_REPO_AGENTS_TEMPLATE = 'src/repositories/tables/AGENTS.md';
const JOBS_AGENTS_TEMPLATE = 'src/jobs/AGENTS.md';
const ZTD_AGENTS_TEMPLATE = 'ztd/AGENTS.md';
const ZTD_README_TEMPLATE = 'ztd/README.md';
const ZTD_DDL_AGENTS_TEMPLATE = 'ztd/ddl/AGENTS.md';
const ZTD_DDL_DEMO_TEMPLATE = 'ztd/ddl/demo.sql';

const EMPTY_SCHEMA_COMMENT = (schemaName: string): string =>
  [
    `-- DDL for schema "${schemaName}".`,
    '-- Add CREATE TABLE statements here.',
    ''
  ].join('\n');

const DEMO_SCHEMA_TEMPLATE = (_schemaName: string): string => {
  return loadTemplate(ZTD_DDL_DEMO_TEMPLATE);
};

const AGENTS_FILE_CANDIDATES = ['AGENTS.md', 'AGENTS_ztd.md'];

const APP_INTERFACE_SECTION_MARKER = '## Application Interface Guidance';
const APP_INTERFACE_SECTION = `---
## Application Interface Guidance

1. Repository interfaces follow Command in, Domain out so commands capture inputs and repositories return domain shapes.
2. Command definitions and validation stay unified to prevent divergence between surface APIs and SQL expectations.
3. Input validation relies on zod v4 or later and happens at the repository boundary before any SQL runs.
4. Only validated inputs reach SQL execution; reject raw external objects as soon as possible.
5. Domain models live under a dedicated src/domain location so semantics stay centralized.
6. Build the CRUD behavior first and revisit repository interfaces during review, not before the SQL works.
7. Guard every behavioral change with unit tests so regression risks stay low.
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
    const args = buildPackageManagerArgs(kind, packageManager, packages);
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

    let result = spawnSync(executable, args, preferShell ? shellSpawnOptions : baseSpawnOptions);
    if (result.error && isWin32 && !preferShell) {
      // Retry with cmd.exe only on Windows so .cmd shims resolve reliably.
      result = spawnSync(executable, args, shellSpawnOptions);
    }
    if (result.error && executable !== packageManager) {
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

  // Ask how the user prefers to populate the initial schema.
  const workflowChoice = await prompter.selectChoice(
    'How do you want to start your database workflow?',
    [
      'Pull schema from Postgres (pg_dump)',
      'Create empty scaffold (I will write DDL)',
      'Create scaffold with demo DDL (no app code)'
    ]
  );
  const workflow: InitWorkflow = workflowChoice === 0 ? 'pg_dump' : workflowChoice === 1 ? 'empty' : 'demo';

  const schemaName = normalizeSchemaName(DEFAULT_ZTD_CONFIG.ddl.defaultSchema);
  const schemaFileName = `${sanitizeSchemaFileName(schemaName)}.sql`;

  const absolutePaths: Record<FileKey, string> = {
    schema: path.join(rootDir, DEFAULT_ZTD_CONFIG.ddlDir, schemaFileName),
    config: path.join(rootDir, 'ztd.config.json'),
    smokeSpec: path.join(rootDir, 'src', 'catalog', 'specs', '_smoke.spec.ts'),
    smokeCoercions: path.join(rootDir, 'src', 'catalog', 'runtime', '_coercions.ts'),
    smokeRuntime: path.join(rootDir, 'src', 'catalog', 'runtime', '_smoke.runtime.ts'),
    smokeValidationTest: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'smoke.validation.test.ts'),
    testsAgents: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'AGENTS.md'),
    testsSupportAgents: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'support', 'AGENTS.md'),
    testsGeneratedAgents: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'generated', 'AGENTS.md'),
    testsSmoke: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'smoke.test.ts'),
    readme: path.join(rootDir, 'README.md'),
    sqlReadme: path.join(rootDir, 'src', 'sql', 'README.md'),
    viewsRepoReadme: path.join(rootDir, 'src', 'repositories', 'views', 'README.md'),
    tablesRepoReadme: path.join(rootDir, 'src', 'repositories', 'tables', 'README.md'),
    jobsReadme: path.join(rootDir, 'src', 'jobs', 'README.md'),
    srcAgents: path.join(rootDir, 'src', 'AGENTS.md'),
    srcCatalogAgents: path.join(rootDir, 'src', 'catalog', 'AGENTS.md'),
    srcCatalogRuntimeAgents: path.join(rootDir, 'src', 'catalog', 'runtime', 'AGENTS.md'),
    srcCatalogSpecsAgents: path.join(rootDir, 'src', 'catalog', 'specs', 'AGENTS.md'),
    srcSqlAgents: path.join(rootDir, 'src', 'sql', 'AGENTS.md'),
    srcReposAgents: path.join(rootDir, 'src', 'repositories', 'AGENTS.md'),
    viewsRepoAgents: path.join(rootDir, 'src', 'repositories', 'views', 'AGENTS.md'),
    tablesRepoAgents: path.join(rootDir, 'src', 'repositories', 'tables', 'AGENTS.md'),
    jobsAgents: path.join(rootDir, 'src', 'jobs', 'AGENTS.md'),
    sqlClient: path.join(rootDir, 'src', 'db', 'sql-client.ts'),
    testkitClient: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'support', 'testkit-client.ts'),
    globalSetup: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'support', 'global-setup.ts'),
    vitestConfig: path.join(rootDir, 'vitest.config.ts'),
    tsconfig: path.join(rootDir, 'tsconfig.json'),
    ztdDocsAgent: path.join(rootDir, 'ztd', 'AGENTS.md'),
    ztdDocsReadme: path.join(rootDir, 'ztd', 'README.md'),
    ztdDdlAgents: path.join(rootDir, 'ztd', 'ddl', 'AGENTS.md'),
    agents: path.join(rootDir, 'AGENTS.md'),
    gitignore: path.join(rootDir, '.gitignore'),
    editorconfig: path.join(rootDir, '.editorconfig'),
    prettierignore: path.join(rootDir, '.prettierignore'),
    prettier: path.join(rootDir, '.prettierrc'),
    package: path.join(rootDir, 'package.json')
  };

  const relativePath = (key: FileKey): string =>
    path.relative(rootDir, absolutePaths[key]).replace(/\\/g, '/') || absolutePaths[key];

  const summaries: Partial<Record<FileKey, FileSummary>> = {};

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
        dependencies.writeFile(absolutePaths.schema, DEMO_SCHEMA_TEMPLATE(schemaName));
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

  const optionalFeatures = await gatherOptionalFeatures(prompter, dependencies);

  // Emit supporting documentation that describes the workflow for contributors.
  const readmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.readme,
    relativePath('readme'),
    README_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy,
    true
  );
  if (readmeSummary) {
    summaries.readme = readmeSummary;
  }

  const ztdDocsAgentSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.ztdDocsAgent,
    relativePath('ztdDocsAgent'),
    ZTD_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (ztdDocsAgentSummary) {
    summaries.ztdDocsAgent = ztdDocsAgentSummary;
  }

  const ztdDocsReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.ztdDocsReadme,
    relativePath('ztdDocsReadme'),
    ZTD_README_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (ztdDocsReadmeSummary) {
    summaries.ztdDocsReadme = ztdDocsReadmeSummary;
  }

  const ztdDdlAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.ztdDdlAgents,
    relativePath('ztdDdlAgents'),
    ZTD_DDL_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (ztdDdlAgentsSummary) {
    summaries.ztdDdlAgents = ztdDdlAgentsSummary;
  }

  const srcAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.srcAgents,
    relativePath('srcAgents'),
    SRC_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (srcAgentsSummary) {
    summaries.srcAgents = srcAgentsSummary;
  }

  const srcCatalogAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.srcCatalogAgents,
    relativePath('srcCatalogAgents'),
    SRC_CATALOG_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (srcCatalogAgentsSummary) {
    summaries.srcCatalogAgents = srcCatalogAgentsSummary;
  }

  const srcCatalogRuntimeAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.srcCatalogRuntimeAgents,
    relativePath('srcCatalogRuntimeAgents'),
    SRC_CATALOG_RUNTIME_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (srcCatalogRuntimeAgentsSummary) {
    summaries.srcCatalogRuntimeAgents = srcCatalogRuntimeAgentsSummary;
  }

  const srcCatalogSpecsAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.srcCatalogSpecsAgents,
    relativePath('srcCatalogSpecsAgents'),
    SRC_CATALOG_SPECS_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (srcCatalogSpecsAgentsSummary) {
    summaries.srcCatalogSpecsAgents = srcCatalogSpecsAgentsSummary;
  }

  const srcSqlAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.srcSqlAgents,
    relativePath('srcSqlAgents'),
    SRC_SQL_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (srcSqlAgentsSummary) {
    summaries.srcSqlAgents = srcSqlAgentsSummary;
  }

  const srcReposAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.srcReposAgents,
    relativePath('srcReposAgents'),
    SRC_REPOS_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (srcReposAgentsSummary) {
    summaries.srcReposAgents = srcReposAgentsSummary;
  }

  const viewsRepoAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.viewsRepoAgents,
    relativePath('viewsRepoAgents'),
    VIEWS_REPO_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (viewsRepoAgentsSummary) {
    summaries.viewsRepoAgents = viewsRepoAgentsSummary;
  }

  const tablesRepoAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.tablesRepoAgents,
    relativePath('tablesRepoAgents'),
    TABLES_REPO_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (tablesRepoAgentsSummary) {
    summaries.tablesRepoAgents = tablesRepoAgentsSummary;
  }

  const jobsAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.jobsAgents,
    relativePath('jobsAgents'),
    JOBS_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (jobsAgentsSummary) {
    summaries.jobsAgents = jobsAgentsSummary;
  }

  const sqlReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.sqlReadme,
    relativePath('sqlReadme'),
    SQL_README_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (sqlReadmeSummary) {
    summaries.sqlReadme = sqlReadmeSummary;
  }

  const viewsRepoReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.viewsRepoReadme,
    relativePath('viewsRepoReadme'),
    VIEWS_REPO_README_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (viewsRepoReadmeSummary) {
    summaries.viewsRepoReadme = viewsRepoReadmeSummary;
  }

  const tablesRepoReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.tablesRepoReadme,
    relativePath('tablesRepoReadme'),
    TABLES_REPO_README_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (tablesRepoReadmeSummary) {
    summaries.tablesRepoReadme = tablesRepoReadmeSummary;
  }

  const jobsReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.jobsReadme,
    relativePath('jobsReadme'),
    JOBS_README_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (jobsReadmeSummary) {
    summaries.jobsReadme = jobsReadmeSummary;
  }

  const smokeSpecTemplate =
    optionalFeatures.validator === 'zod' ? SMOKE_SPEC_ZOD_TEMPLATE : SMOKE_SPEC_ARKTYPE_TEMPLATE;
  const smokeSpecSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeSpec,
    relativePath('smokeSpec'),
    smokeSpecTemplate,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeSpecSummary) {
    summaries.smokeSpec = smokeSpecSummary;
  }

  const smokeCoercionsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeCoercions,
    relativePath('smokeCoercions'),
    SMOKE_COERCIONS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeCoercionsSummary) {
    summaries.smokeCoercions = smokeCoercionsSummary;
  }

  const smokeRuntimeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeRuntime,
    relativePath('smokeRuntime'),
    SMOKE_RUNTIME_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeRuntimeSummary) {
    summaries.smokeRuntime = smokeRuntimeSummary;
  }

  const smokeValidationTestSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.smokeValidationTest,
    relativePath('smokeValidationTest'),
    SMOKE_VALIDATION_TEST_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (smokeValidationTestSummary) {
    summaries.smokeValidationTest = smokeValidationTestSummary;
  }

  const sqlClientSummary = writeOptionalTemplateFile(
    absolutePaths.sqlClient,
    relativePath('sqlClient'),
    SQL_CLIENT_TEMPLATE,
    dependencies
  );
  if (sqlClientSummary) {
    summaries.sqlClient = sqlClientSummary;
  }

  const testsAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.testsAgents,
    relativePath('testsAgents'),
    TESTS_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (testsAgentsSummary) {
    summaries.testsAgents = testsAgentsSummary;
  }

  const testsSupportAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.testsSupportAgents,
    relativePath('testsSupportAgents'),
    TESTS_SUPPORT_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (testsSupportAgentsSummary) {
    summaries.testsSupportAgents = testsSupportAgentsSummary;
  }

  const testsGeneratedAgentsSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.testsGeneratedAgents,
    relativePath('testsGeneratedAgents'),
    TESTS_GENERATED_AGENTS_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (testsGeneratedAgentsSummary) {
    summaries.testsGeneratedAgents = testsGeneratedAgentsSummary;
  }

  const testsSmokeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.testsSmoke,
    relativePath('testsSmoke'),
    TESTS_SMOKE_TEMPLATE,
    dependencies,
    prompter,
    overwritePolicy
  );
  if (testsSmokeSummary) {
    summaries.testsSmoke = testsSmokeSummary;
  }

  const testkitSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.testkitClient,
    relativePath('testkitClient'),
    TESTKIT_CLIENT_TEMPLATE,
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
    optionalFeatures
  );
  if (packageSummary) {
    summaries.package = packageSummary;
  }

  // Copy the AGENTS template so every project ships the same AI guardrails.
  const agentsRelative = await ensureAgentsFile(rootDir, relativePath('agents'), dependencies);
  if (agentsRelative) {
    summaries.agents = agentsRelative;
  }

  await ensureTemplateDependenciesInstalled(rootDir, absolutePaths, summaries, dependencies);

  const nextSteps = buildNextSteps(normalizeRelative(rootDir, absolutePaths.schema), workflow);
  const summaryLines = buildSummaryLines(
    summaries as Record<FileKey, FileSummary>,
    optionalFeatures,
    nextSteps
  );
  summaryLines.forEach(dependencies.log);

  return {
    summary: summaryLines.join('\n'),
    files: Object.values(summaries) as FileSummary[]
  };
}

async function ensureAgentsFile(
  rootDir: string,
  fallbackRelative: string,
  dependencies: ZtdConfigWriterDependencies
): Promise<FileSummary | null> {
  const resolution = resolveOrCreateAgentsFile(rootDir, dependencies);
  if (!resolution) {
    return null;
  }
  const relative = normalizeRelative(rootDir, resolution.absolutePath);
  return {
    relativePath: relative || fallbackRelative,
    outcome: resolution.created ? 'created' : 'unchanged'
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

function buildPackageManagerArgs(
  kind: PackageInstallKind,
  packageManager: PackageManager,
  packages: string[]
): string[] {
  if (kind === 'install') {
    return ['install'];
  }

  if (packages.length === 0) {
    return [];
  }

  if (packageManager === 'npm') {
    return ['install', '-D', ...packages];
  }

  return ['add', '-D', ...packages];
}

function detectPackageManager(rootDir: string): PackageManager {
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

  // Fall back to pnpm because rawsql-ts itself standardizes on pnpm.
  return 'pnpm';
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
    // Capture ESM imports and re-exports, including `import type`.
    /\bfrom\s+['"]([^'"]+)['"]/g,
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
  dependencies: ZtdConfigWriterDependencies
): Promise<void> {
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!dependencies.fileExists(packageJsonPath)) {
    dependencies.log(
      'Skipping dependency installation because package.json is missing. Next: run pnpm init (or npm init), install dependencies, then run npx ztd ztd-config.'
    );
    return;
  }

  const packageManager = detectPackageManager(rootDir);
  const referencedPackages = listTemplateReferencedPackages(absolutePaths, summaries);
  const declaredPackages = listDeclaredPackages(rootDir);

  // Install only packages that are not declared yet to avoid unintentionally bumping pinned versions.
  const missingPackages = referencedPackages.filter((name) => !declaredPackages.has(name));
  if (missingPackages.length > 0) {
    dependencies.log(`Installing devDependencies referenced by templates (${packageManager}): ${missingPackages.join(', ')}`);
    await dependencies.installPackages({
      rootDir,
      kind: 'devDependencies',
      packages: missingPackages,
      packageManager
    });
    return;
  }

  // If package.json was updated earlier in the init run, run install so the new entries resolve in node_modules.
  if (summaries.package?.outcome === 'overwritten') {
    dependencies.log(`Running ${packageManager} install to sync dependencies.`);
    await dependencies.installPackages({ rootDir, kind: 'install', packages: [], packageManager });
  }
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
  optionalFeatures: OptionalFeatures
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

  const stackDependencies: Record<string, string> = {
    ...MANDATORY_TESTKIT_DEPENDENCIES,
    ...SQL_CONTRACT_DEPENDENCY
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
      `File ${relative} already exists. Re-run with --yes to overwrite or remove the file before running ztd init.`
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
  const relative = path.relative(rootDir, absolutePath).replace(/\\/g, '/');
  return relative || absolutePath;
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

function buildNextSteps(schemaRelativePath: string, workflow: InitWorkflow): string[] {
  const stepOne =
    workflow === 'pg_dump'
      ? ` 1. Review the dumped DDL in ${schemaRelativePath}`
      : ` 1. If the schema file is empty, edit ${schemaRelativePath}`;
  return [
    stepOne,
    ' 2. Run npx ztd ztd-config',
    ' 3. Provide a SqlClient implementation (adapter or mock)',
    ' 4. Run tests (pnpm test or npx vitest run)'
  ];
}

function buildSummaryLines(
  summaries: Record<FileKey, FileSummary>,
  optionalFeatures: OptionalFeatures,
  nextSteps: string[]
): string[] {
  const orderedKeys: FileKey[] = [
    'schema',
    'config',
    'readme',
    'ztdDocsAgent',
    'ztdDocsReadme',
    'ztdDdlAgents',
    'srcAgents',
    'srcCatalogAgents',
    'srcCatalogRuntimeAgents',
    'srcCatalogSpecsAgents',
    'srcSqlAgents',
    'srcReposAgents',
    'viewsRepoAgents',
    'tablesRepoAgents',
    'jobsAgents',
    'sqlReadme',
    'viewsRepoReadme',
    'tablesRepoReadme',
    'jobsReadme',
    'smokeSpec',
    'smokeCoercions',
    'smokeRuntime',
    'smokeValidationTest',
    'testsAgents',
    'testsSupportAgents',
    'testsGeneratedAgents',
    'testsSmoke',
    'sqlClient',
    'testkitClient',
    'globalSetup',
    'vitestConfig',
    'tsconfig',
    'agents',
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
  lines.push(
    ' - SQL catalog/mapping support via @rawsql-ts/sql-contract (see docs/recipes/sql-contract.md)'
  );
  const validatorLabel =
    optionalFeatures.validator === 'zod'
      ? 'Zod (zod, docs/recipes/validation-zod.md)'
      : 'ArkType (arktype, docs/recipes/validation-arktype.md)';
  lines.push(` - Validator backend: ${validatorLabel}`);
  lines.push('', 'Next steps:', ...nextSteps);
  return lines;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Automate project setup for Zero Table Dependency workflows')
    .option('--with-sqlclient', 'Generate a minimal SqlClient interface for repositories')
    .option('--with-app-interface', 'Append application interface guidance to AGENTS.md only')
    .option('--yes', 'Overwrite existing scaffold files without prompting')
    .action(async (options: { withSqlclient?: boolean; withAppInterface?: boolean; yes?: boolean }) => {
      const prompter = createConsolePrompter();
      try {
        await runInitCommand(prompter, {
          withSqlClient: options.withSqlclient,
          withAppInterface: options.withAppInterface,
          forceOverwrite: options.yes ?? false,
          nonInteractive: !process.stdin.isTTY
        });
      } finally {
        prompter.close();
      }
    });
}
