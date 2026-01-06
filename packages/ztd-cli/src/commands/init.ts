import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

import { ensureDirectory } from '../utils/fs';
import { copyAgentsTemplate } from '../utils/agents';
import { DEFAULT_ZTD_CONFIG, loadZtdProjectConfig, writeZtdProjectConfig } from '../utils/ztdProjectConfig';
import { runGenerateZtdConfig, type ZtdConfigGenerationOptions } from './ztdConfig';
import { runPullSchema, type PullSchemaOptions } from './pull';
import { DEFAULT_EXTENSIONS } from './options';

type PackageManager = 'pnpm' | 'npm' | 'yarn';
type PackageInstallKind = 'devDependencies' | 'install';

/**
 * Prompt interface for interactive input during `ztd init`.
 */
export interface Prompter {
  selectChoice(question: string, choices: string[]): Promise<number>;
  promptInput(question: string, example?: string): Promise<string>;
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
  | 'ztdConfig'
  | 'testsConfig'
  | 'testkitClient'
  | 'globalSetup'
  | 'vitestConfig'
  | 'readme'
  | 'sqlClient'
  | 'ztdDocsAgent'
  | 'ztdDocsReadme'
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
}

const SAMPLE_SCHEMA = `CREATE TABLE public.example (
  id serial PRIMARY KEY,
  name text NOT NULL
);
`;

const README_TEMPLATE = 'README.md';
const TESTS_CONFIG_TEMPLATE = 'tests/ztd-layout.generated.ts';
const TESTKIT_CLIENT_TEMPLATE = 'tests/support/testkit-client.ts';
const GLOBAL_SETUP_TEMPLATE = 'tests/support/global-setup.ts';
const VITEST_CONFIG_TEMPLATE = 'vitest.config.ts';
const SQL_CLIENT_TEMPLATE = 'src/db/sql-client.ts';

const NEXT_STEPS = [
  ' 1. Review the schema files under ztd/ddl/<schema>.sql',
  ' 2. Inspect tests/generated/ztd-layout.generated.ts for the SQL layout',
  ' 3. Run npx ztd ztd-config',
  ' 4. Run ZTD tests with pg-testkit'
];

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

  const schemaFileName = `${DEFAULT_ZTD_CONFIG.ddl.defaultSchema}.sql`;

  const absolutePaths: Record<FileKey, string> = {
    schema: path.join(rootDir, DEFAULT_ZTD_CONFIG.ddlDir, schemaFileName),
    config: path.join(rootDir, 'ztd.config.json'),
    ztdConfig: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'generated', 'ztd-row-map.generated.ts'),
    testsConfig: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'generated', 'ztd-layout.generated.ts'),
    readme: path.join(rootDir, 'README.md'),
    sqlClient: path.join(rootDir, 'src', 'db', 'sql-client.ts'),
    testkitClient: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'support', 'testkit-client.ts'),
    globalSetup: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'support', 'global-setup.ts'),
    vitestConfig: path.join(rootDir, 'vitest.config.ts'),
    ztdDocsAgent: path.join(rootDir, 'ztd', 'AGENTS.md'),
    ztdDocsReadme: path.join(rootDir, 'ztd', 'README.md'),
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
  const workflow = await prompter.selectChoice(
    'How do you want to start your database workflow?',
    ['Pull schema from Postgres (DDL-first)', 'Write DDL manually']
  );

  if (workflow === 0) {
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
      async () => {
        dependencies.ensureDirectory(path.dirname(absolutePaths.schema));
        await dependencies.runPullSchema({
          url: connectionString,
          out: path.dirname(absolutePaths.schema)
        });
      }
    );

    summaries.schema = schemaSummary;
  } else {
    // Manual path: seed the DDL directory with a starter schema so ztd-config can run.
    const schemaSummary = await writeFileWithConsent(
      absolutePaths.schema,
      relativePath('schema'),
      dependencies,
      prompter,
      async () => {
        dependencies.ensureDirectory(path.dirname(absolutePaths.schema));
        dependencies.writeFile(absolutePaths.schema, SAMPLE_SCHEMA);
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
    () => {
      writeZtdProjectConfig(rootDir);
    }
  );
  summaries.config = configSummary;

  const projectConfig = loadZtdProjectConfig(rootDir);

  const ztdConfigTarget = await confirmOverwriteIfExists(
    absolutePaths.ztdConfig,
    relativePath('ztdConfig'),
    dependencies,
    prompter
  );

  if (ztdConfigTarget.write) {
    // Regenerate tests/generated/ztd-row-map.generated.ts so TestRowMap reflects the DDL snapshot.
    dependencies.ensureDirectory(path.dirname(absolutePaths.ztdConfig));
    await dependencies.runGenerateZtdConfig({
      directories: [path.resolve(path.dirname(absolutePaths.schema))],
      extensions: DEFAULT_EXTENSIONS,
      out: absolutePaths.ztdConfig,
      defaultSchema: projectConfig.ddl.defaultSchema,
      searchPath: projectConfig.ddl.searchPath,
      ddlLint: projectConfig.ddlLint
    });
  } else {
    dependencies.log(
      'Skipping ZTD config generation; existing tests/generated/ztd-row-map.generated.ts preserved.'
    );
  }

  summaries.ztdConfig = {
    relativePath: relativePath('ztdConfig'),
    outcome: ztdConfigTarget.existed
      ? ztdConfigTarget.write
        ? 'overwritten'
        : 'unchanged'
      : 'created'
  };

  // Emit supporting documentation that describes the workflow for contributors.
  const readmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.readme,
    relativePath('readme'),
    README_TEMPLATE,
    dependencies,
    prompter,
    true
  );
  if (readmeSummary) {
    summaries.readme = readmeSummary;
  }

  if (options?.withSqlClient) {
    const sqlClientSummary = writeOptionalTemplateFile(
      absolutePaths.sqlClient,
      relativePath('sqlClient'),
      SQL_CLIENT_TEMPLATE,
      dependencies
    );
    if (sqlClientSummary) {
      summaries.sqlClient = sqlClientSummary;
    }
  }

  const testkitSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.testkitClient,
    relativePath('testkitClient'),
    TESTKIT_CLIENT_TEMPLATE,
    dependencies,
    prompter
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
    prompter
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
    prompter
  );
  if (vitestConfigSummary) {
    summaries.vitestConfig = vitestConfigSummary;
  }

  const testsConfigSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.testsConfig,
    relativePath('testsConfig'),
    TESTS_CONFIG_TEMPLATE,
    dependencies,
    prompter
  );
  if (testsConfigSummary) {
    summaries.testsConfig = testsConfigSummary;
  }

  // Seed the shared guidance that lives inside the ztd/ directory so contributors see the new instructions.
  const ztdDocsAgentSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.ztdDocsAgent,
    relativePath('ztdDocsAgent'),
    'ztd/AGENTS.md',
    dependencies,
    prompter
  );
  if (ztdDocsAgentSummary) {
    summaries.ztdDocsAgent = ztdDocsAgentSummary;
  }

  // Provide the companion README inside ztd/ so maintainers understand the schema, spec, and enum intentions.
  const ztdDocsReadmeSummary = await writeTemplateFile(
    rootDir,
    absolutePaths.ztdDocsReadme,
    relativePath('ztdDocsReadme'),
    'ztd/README.md',
    dependencies,
    prompter
  );
  if (ztdDocsReadmeSummary) {
    summaries.ztdDocsReadme = ztdDocsReadmeSummary;
  }

  const ztdRootDir = path.join(rootDir, 'ztd');
  // Ensure the domain-specs and enums anchors exist so contributors immediately see where those artifacts belong.
  dependencies.ensureDirectory(path.join(ztdRootDir, 'domain-specs'));
  dependencies.ensureDirectory(path.join(ztdRootDir, 'enums'));

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

  const packageSummary = ensurePackageJsonFormatting(rootDir, relativePath('package'), dependencies);
  if (packageSummary) {
    summaries.package = packageSummary;
  }

  // Copy the AGENTS template so every project ships the same AI guardrails.
  const agentsRelative = await ensureAgentsFile(rootDir, relativePath('agents'), dependencies);
  if (agentsRelative) {
    summaries.agents = agentsRelative;
  }

  await ensureTemplateDependenciesInstalled(rootDir, absolutePaths, summaries, dependencies);

  const summaryLines = buildSummaryLines(summaries as Record<FileKey, FileSummary>);
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
  const packages = new Set<string>(['@rawsql-ts/pg-testkit']);
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
    dependencies.log('Skipping dependency installation because package.json is missing.');
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
  dependencies: ZtdConfigWriterDependencies
): FileSummary | null {
  const packagePath = path.join(rootDir, 'package.json');
  // Skip wiring defaults when the project does not yet have a package manifest.
  if (!dependencies.fileExists(packagePath)) {
    return null;
  }

  const document = readFileSync(packagePath, 'utf8');
  const parsed = JSON.parse(document) as Record<string, unknown>;
  let changed = false;

  const scripts = (parsed.scripts as Record<string, string> | undefined) ?? {};
  const requiredScripts: Record<string, string> = {
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
  // Add the formatting toolchain dependencies that back the scripts and hooks.
  for (const [dep, version] of Object.entries(formattingDeps)) {
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
  return { relativePath: relative, outcome: 'overwritten' };
}

async function writeFileWithConsent(
  absolutePath: string,
  relative: string,
  dependencies: ZtdConfigWriterDependencies,
  prompter: Prompter,
  writer: () => Promise<void> | void
): Promise<FileSummary> {
  const { existed, write } = await confirmOverwriteIfExists(absolutePath, relative, dependencies, prompter);
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

async function confirmOverwriteIfExists(
  absolutePath: string,
  relative: string,
  dependencies: ZtdConfigWriterDependencies,
  prompter: Prompter
): Promise<OverwriteCheck> {
  const existed = dependencies.fileExists(absolutePath);
  if (!existed) {
    return { existed: false, write: true };
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
  prompter: Prompter
): Promise<FileSummary> {
  const summary = await writeFileWithConsent(
    absolutePath,
    relative,
    dependencies,
    prompter,
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
  allowFallback?: boolean
): Promise<FileSummary | null> {
  const templateTarget = resolveTemplateTarget(rootDir, absolutePath, relative, dependencies, allowFallback);
  if (!templateTarget) {
    return null;
  }

  // Load shared documentation templates so every new project gets the same guidance.
  const contents = loadTemplate(templateName);
  return writeDocFile(templateTarget.absolutePath, templateTarget.relativePath, contents, dependencies, prompter);
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

function buildSummaryLines(summaries: Record<FileKey, FileSummary>): string[] {
  const orderedKeys: FileKey[] = [
    'schema',
    'config',
    'testsConfig',
    'ztdConfig',
    'readme',
    'sqlClient',
    'testkitClient',
    'globalSetup',
    'vitestConfig',
    'ztdDocsAgent',
    'ztdDocsReadme',
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

  lines.push('', 'Next steps:', ...NEXT_STEPS);
  return lines;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Automate project setup for Zero Table Dependency workflows')
    .option('--with-sqlclient', 'Generate a minimal SqlClient interface for repositories')
    .option('--with-app-interface', 'Append application interface guidance to AGENTS.md only')
    .action(async (options: { withSqlclient?: boolean; withAppInterface?: boolean }) => {
      const prompter = createConsolePrompter();
      try {
        await runInitCommand(prompter, {
          withSqlClient: options.withSqlclient,
          withAppInterface: options.withAppInterface
        });
      } finally {
        prompter.close();
      }
    });
}
