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

export interface Prompter {
  selectChoice(question: string, choices: string[]): Promise<number>;
  promptInput(question: string, example?: string): Promise<string>;
  confirm(question: string): Promise<boolean>;
  close(): void;
}

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
  | 'readme'
  | 'srcGuide'
  | 'testsGuide'
  | 'sqlDdlAgent'
  | 'sqlEnumsAgent'
  | 'sqlDomainSpecsAgent'
  | 'agents'
  | 'editorconfig'
  | 'prettier'
  | 'package';

export interface FileSummary {
  relativePath: string;
  outcome: 'created' | 'overwritten' | 'unchanged';
}

export interface InitResult {
  summary: string;
  files: FileSummary[];
}

export interface ZtdConfigWriterDependencies {
  ensureDirectory: (directory: string) => void;
  writeFile: (filePath: string, contents: string) => void;
  fileExists: (filePath: string) => boolean;
  runPullSchema: (options: PullSchemaOptions) => Promise<void> | void;
  runGenerateZtdConfig: (options: ZtdConfigGenerationOptions) => Promise<void> | void;
  checkPgDump: () => boolean;
  log: (message: string) => void;
  copyAgentsTemplate: (rootDir: string) => string | null;
}

export interface InitCommandOptions {
  rootDir?: string;
  dependencies?: Partial<ZtdConfigWriterDependencies>;
}

const SAMPLE_SCHEMA = `CREATE TABLE public.example (
  id serial PRIMARY KEY,
  name text NOT NULL
);
`;

const README_TEMPLATE = 'README.md';
const SRC_GUIDE_TEMPLATE = 'ZTD-GUIDE.md';
const TESTS_GUIDE_TEMPLATE = 'ZTD-TEST-GUIDE.md';
const TESTS_CONFIG_TEMPLATE = 'tests-ztd-layout.generated.ts';
const TESTKIT_CLIENT_TEMPLATE = 'testkit-client.ts';

type SqlFolderAgentKey = Extract<FileKey, 'sqlDdlAgent' | 'sqlEnumsAgent' | 'sqlDomainSpecsAgent'>;

const SQL_FOLDER_AGENT_TARGETS: { key: SqlFolderAgentKey; relativePath: string; templateName: string }[] = [
  {
    key: 'sqlDdlAgent',
    relativePath: 'sql/ddl/AGENTS.md',
    templateName: 'sql/ddl/AGENTS.md'
  },
  {
    key: 'sqlEnumsAgent',
    relativePath: 'sql/enums/AGENTS.md',
    templateName: 'sql/enums/AGENTS.md'
  },
  {
    key: 'sqlDomainSpecsAgent',
    relativePath: 'sql/domain-specs/AGENTS.md',
    templateName: 'sql/domain-specs/AGENTS.md'
  }
];

const NEXT_STEPS = [
  ' 1. Review the schema files under sql/ddl/<schema>.sql',
  ' 2. Inspect tests/ztd-layout.generated.ts for the SQL layout',
  ' 3. Run npx ztd ztd-config',
  ' 4. Run ZTD tests with pg-testkit'
];
const TEMPLATE_DIRECTORY = path.resolve(__dirname, '..', '..', 'templates');

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
  copyAgentsTemplate
};

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
    ztdConfig: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'ztd-row-map.generated.ts'),
    testsConfig: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'ztd-layout.generated.ts'),
    readme: path.join(rootDir, 'README.md'),
    srcGuide: path.join(rootDir, 'src', 'ZTD-GUIDE.md'),
    testsGuide: path.join(rootDir, 'tests', 'ZTD-TEST-GUIDE.md'),
    testkitClient: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'testkit-client.ts'),
    agents: path.join(rootDir, 'AGENTS.md'),
    sqlDdlAgent: path.join(rootDir, 'sql', 'ddl', 'AGENTS.md'),
    sqlEnumsAgent: path.join(rootDir, 'sql', 'enums', 'AGENTS.md'),
    sqlDomainSpecsAgent: path.join(rootDir, 'sql', 'domain-specs', 'AGENTS.md'),
    editorconfig: path.join(rootDir, '.editorconfig'),
    prettier: path.join(rootDir, '.prettierrc'),
    package: path.join(rootDir, 'package.json')
  };

  const relativePath = (key: FileKey): string =>
    path.relative(rootDir, absolutePaths[key]).replace(/\\/g, '/') || absolutePaths[key];

  const summaries: Partial<Record<FileKey, FileSummary>> = {};

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
    // Regenerate tests/ztd-row-map.generated.ts so TestRowMap reflects the DDL snapshot.
    dependencies.ensureDirectory(path.dirname(absolutePaths.ztdConfig));
    dependencies.runGenerateZtdConfig({
      directories: [path.resolve(path.dirname(absolutePaths.schema))],
      extensions: DEFAULT_EXTENSIONS,
      out: absolutePaths.ztdConfig,
      defaultSchema: projectConfig.ddl.defaultSchema,
      searchPath: projectConfig.ddl.searchPath
    });
  } else {
    dependencies.log('Skipping ZTD config generation; existing tests/ztd-row-map.generated.ts preserved.');
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
  summaries.readme = await writeTemplateFile(
    absolutePaths.readme,
    relativePath('readme'),
    README_TEMPLATE,
    dependencies,
    prompter
  );
  summaries.srcGuide = await writeTemplateFile(
    absolutePaths.srcGuide,
    relativePath('srcGuide'),
    SRC_GUIDE_TEMPLATE,
    dependencies,
    prompter
  );
  summaries.testsGuide = await writeTemplateFile(
    absolutePaths.testsGuide,
    relativePath('testsGuide'),
    TESTS_GUIDE_TEMPLATE,
    dependencies,
    prompter
  );

  summaries.testkitClient = await writeTemplateFile(
    absolutePaths.testkitClient,
    relativePath('testkitClient'),
    TESTKIT_CLIENT_TEMPLATE,
    dependencies,
    prompter
  );

  summaries.testsConfig = await writeTemplateFile(
    absolutePaths.testsConfig,
    relativePath('testsConfig'),
    TESTS_CONFIG_TEMPLATE,
    dependencies,
    prompter
  );

  Object.assign(summaries, ensureSqlFolderAgents(rootDir, dependencies, relativePath));

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

  const packageSummary = ensurePackageJsonFormatting(rootDir, relativePath('package'), dependencies);
  if (packageSummary) {
    summaries.package = packageSummary;
  }

  // Copy the AGENTS template so every project ships the same AI guardrails.
  const agentsRelative = await ensureAgentsFile(rootDir, relativePath('agents'), dependencies);
  if (agentsRelative) {
    summaries.agents = agentsRelative;
  }

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
  const templateTarget = dependencies.copyAgentsTemplate(rootDir);
  if (templateTarget) {
    const relative = path.relative(rootDir, templateTarget).replace(/\\/g, '/');
    return { relativePath: relative || fallbackRelative, outcome: 'created' };
  }

  const candidates = ['AGENTS.md', 'AGENTS_ZTD.md'];
  for (const candidate of candidates) {
    const candidatePath = path.join(rootDir, candidate);
    if (dependencies.fileExists(candidatePath)) {
      return { relativePath: candidate, outcome: 'unchanged' };
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
  absolutePath: string,
  relative: string,
  templateName: string,
  dependencies: ZtdConfigWriterDependencies,
  prompter: Prompter
): Promise<FileSummary> {
  // Load shared documentation templates so every new project gets the same guidance.
  const contents = loadTemplate(templateName);
  return writeDocFile(absolutePath, relative, contents, dependencies, prompter);
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
    'srcGuide',
    'testsGuide',
    'testkitClient',
    'sqlDdlAgent',
    'sqlEnumsAgent',
    'sqlDomainSpecsAgent',
    'agents',
    'editorconfig',
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

function ensureSqlFolderAgents(
  rootDir: string,
  dependencies: ZtdConfigWriterDependencies,
  relativePath: (key: FileKey) => string
): Partial<Record<FileKey, FileSummary>> {
  const summaries: Partial<Record<FileKey, FileSummary>> = {};
  for (const target of SQL_FOLDER_AGENT_TARGETS) {
    const targetPath = path.join(rootDir, target.relativePath);
    // Load the shared guidance so every generated project gets the canonical AGENTS content.
    const templateContents = loadTemplate(target.templateName);
    // Make sure the directory exists before writing the AGENT guidance.
    dependencies.ensureDirectory(path.dirname(targetPath));
    const existed = dependencies.fileExists(targetPath);
    if (!existed) {
      // Only emit a new AGENTS.md when there is no existing file to preserve custom guidance.
      dependencies.writeFile(targetPath, templateContents);
    }
    summaries[target.key] = {
      relativePath: relativePath(target.key),
      outcome: existed ? 'unchanged' : 'created'
    };
  }
  return summaries;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Automate project setup for Zero Table Dependency workflows')
    .action(async () => {
      const prompter = createConsolePrompter();
      try {
        await runInitCommand(prompter);
      } finally {
        prompter.close();
      }
    });
}
