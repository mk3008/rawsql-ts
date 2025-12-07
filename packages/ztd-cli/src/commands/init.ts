import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

import { ensureDirectory } from '../utils/fs';
import { copyAgentsTemplate } from '../utils/agents';
import { DEFAULT_ZTD_CONFIG, loadZtdProjectConfig, writeZtdProjectConfig } from '../utils/ztdProjectConfig';
import { runGenerateZtdConfig, type ZtdConfigGenerationOptions } from './ztdConfig';
import { runPullSchema, type PullSchemaOptions } from './pull';
import { DEFAULT_DDL_DIRECTORY, DEFAULT_EXTENSIONS } from './options';

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

type FileKey = 'schema' | 'config' | 'ztdConfig' | 'readme' | 'srcGuide' | 'testsGuide' | 'agents';

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

const README_CONTENT = `# Zero Table Dependency Project

This project follows the ZTD flow: change the DDL in \`ddl/\`, regenerate \`tests/ztd-config.ts\`, and drive tests through a companion driver such as \`@rawsql-ts/pg-testkit\`.

## Workflow

1. Edit \`ddl/schema.sql\` to declare tables and indexes.
2. Run \`npx ztd ztd-config\` (or \`--watch\`) to refresh \`tests/ztd-config.ts\`.
3. Build tests and fixtures that consume \`TestRowMap\`.
4. Execute tests via \`pg-testkit\` or another driver so the rewrite pipeline stays intact.
`;

const SRC_GUIDE_CONTENT = `# ZTD Implementation Guide

The \`src/\` directory should contain pure TypeScript logic that depends on the row interfaces produced by \`tests/ztd-config.ts\`.
Avoid importing \`tests/ztd-config.ts\` from production code; tests import the row map, repositories import DTOs, and fixtures live under \`tests/\`.
`;

const TESTS_GUIDE_CONTENT = `# ZTD Test Guide

Fixtures are generated from \`ddl/\` definitions and reused by \`pg-testkit\`.
Always import table types from \`tests/ztd-config.ts\` before writing scenarios, and rerun \`npx ztd ztd-config\` whenever the schema changes.
`;

const NEXT_STEPS = [' 1. Review ddl/schema.sql', ' 2. Run npx ztd ztd-config', ' 3. Run ZTD tests with pg-testkit'];

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

  const absolutePaths: Record<FileKey, string> = {
    schema: path.join(rootDir, DEFAULT_ZTD_CONFIG.ddlDir, 'schema.sql'),
    config: path.join(rootDir, 'ztd.config.json'),
    ztdConfig: path.join(rootDir, DEFAULT_ZTD_CONFIG.testsDir, 'ztd-config.ts'),
    readme: path.join(rootDir, 'README.md'),
    srcGuide: path.join(rootDir, 'src', 'ZTD-GUIDE.md'),
    testsGuide: path.join(rootDir, 'tests', 'ZTD-TEST-GUIDE.md'),
    agents: path.join(rootDir, 'AGENTS.md')
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
    // Regenerate tests/ztd-config.ts so TestRowMap reflects the DDL snapshot.
    dependencies.ensureDirectory(path.dirname(absolutePaths.ztdConfig));
    dependencies.runGenerateZtdConfig({
      directories: [path.resolve(path.dirname(absolutePaths.schema))],
      extensions: DEFAULT_EXTENSIONS,
      out: absolutePaths.ztdConfig,
      defaultSchema: projectConfig.ddl.defaultSchema,
      searchPath: projectConfig.ddl.searchPath
    });
  } else {
    dependencies.log('Skipping ZTD config generation; existing tests/ztd-config.ts preserved.');
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
  summaries.readme = await writeDocFile(
    absolutePaths.readme,
    relativePath('readme'),
    README_CONTENT,
    dependencies,
    prompter
  );
  summaries.srcGuide = await writeDocFile(
    absolutePaths.srcGuide,
    relativePath('srcGuide'),
    SRC_GUIDE_CONTENT,
    dependencies,
    prompter
  );
  summaries.testsGuide = await writeDocFile(
    absolutePaths.testsGuide,
    relativePath('testsGuide'),
    TESTS_GUIDE_CONTENT,
    dependencies,
    prompter
  );

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

function buildSummaryLines(summaries: Record<FileKey, FileSummary>): string[] {
  const orderedKeys: FileKey[] = [
    'schema',
    'config',
    'ztdConfig',
    'readme',
    'srcGuide',
    'testsGuide',
    'agents'
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
    .action(async () => {
      const prompter = createConsolePrompter();
      try {
        await runInitCommand(prompter);
      } finally {
        prompter.close();
      }
    });
}
