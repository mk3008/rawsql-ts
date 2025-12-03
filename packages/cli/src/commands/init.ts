import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

import { ensureDirectory } from '../utils/fs';
import { runGenerateEntities, type GenEntitiesOptions } from './genEntities';
import { runPullSchema, type PullSchemaOptions } from './pull';

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
    // Trim whitespace so downstream logic can detect intentional empty answers.
    return (await rl.question(question)).trim();
  }

  return {
    async selectChoice(question: string, choices: string[]): Promise<number> {
      // Loop until the user selects a numeric option that maps to the list.
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
      // Require a non-empty answer so this prompt always returns a meaningful value.
      while (true) {
        const answer = await requestLine(`${question}${example ? ` (${example})` : ''}: `);
        if (answer.length > 0) {
          return answer;
        }
        console.log('This value cannot be empty.');
      }
    },

    async confirm(question: string): Promise<boolean> {
      // Accept simple yes/no variations and keep asking until the input is recognizable.
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

type FileKey = 'schema' | 'entities' | 'readme' | 'srcGuide' | 'testsGuide';

export interface FileSummary {
  relativePath: string;
  outcome: 'created' | 'overwritten' | 'unchanged';
}

export interface InitResult {
  summary: string;
  files: FileSummary[];
}

export interface InitDependencies {
  ensureDirectory: (directory: string) => void;
  writeFile: (filePath: string, contents: string) => void;
  fileExists: (filePath: string) => boolean;
  runPullSchema: (options: PullSchemaOptions) => Promise<void> | void;
  runGenerateEntities: (options: GenEntitiesOptions) => Promise<void> | void;
  checkPgDump: () => boolean;
  log: (message: string) => void;
}

export interface InitCommandOptions {
  rootDir?: string;
  dependencies?: Partial<InitDependencies>;
}

const SAMPLE_SCHEMA = `CREATE TABLE public.example (
  id serial PRIMARY KEY,
  name text NOT NULL
);
`;
const README_CONTENT = `# Zero Table Dependency (ZTD)

Zero Table Dependency keeps your tests aligned with a real Postgres engine without touching physical tables.
All INSERT / UPDATE / DELETE statements are rewritten into fixture-backed SELECT queries, so tests never create or mutate real tables.
DDL files stay in version control, entities describe the row shapes in TypeScript, and pg-testkit routes all CRUD requests through the rewrite pipeline instead of hitting physical tables.
This flow lets you regenerate entity models, write repositories, and execute deterministic tests while preserving DDL as the single source of truth for schema.

## How the Workflow Fits Together

1. **DDL**: Declare your tables, indexes, and constraints under the \`ddl/\` directory. These files are the authoritative schema.
2. **Entities**: Use \`tests/entities.ts\` to describe each table row type for repositories and tests. These interfaces are generated from DDL and exist only at the TypeScript level.
3. **Repository + ZTD Tests**: Build your data access layer against those entities, then run pg-testkit, which rewrites CRUD into fixture-backed SELECT queries and keeps tests zero-table dependent.

This project embraces ZTD so you can focus on reliable SQL, AI-assisted development, and repeatable integration tests without ever provisioning test tables.
`;

const SRC_GUIDE_CONTENT = `# ZTD Implementation Guide

Repositories describe the data access surface, but they never execute migrations.
Instead of creating tables or inserting seed data, pg-testkit rewrites INSERT / UPDATE / DELETE statements into fixture-backed SELECT queries so the test database stays read-only.
Entity interfaces in \`tests/entities.ts\` provide a TypeScript view of each row shape, while the actual schema definition lives in DDL under \`ddl/\`.
Always build repository methods from the entity interfaces, let pg-testkit handle the execution plan, and avoid mocking \`QueryResult\` in your code or tests.

If you need to modify schema, update the DDL in \`ddl/\`, regenerate \`tests/entities.ts\`, and rerun the ZTD test suite.
`;

const TESTS_GUIDE_CONTENT = `# ZTD Test Guide

Generated entities capture each table's column types and nullability so tests know the exact row shape to expect.
Fixtures describe a virtual table state that queries run against: pg-testkit rewrites CRUD into SELECT queries that read from those fixtures without ever updating real tables.
This keeps tests fast, deterministic, and independent of physical tables or migrations.

## Template

1. Import the table interface from \`tests/entities.ts\`.
2. Write CRUD helper wrappers that build SQL to exercise the repository.
3. Assert against the rows returned from your repository or client, knowing they are derived from fixtures rather than real table state.
4. Rerun \`pnpm test\` whenever you adjust DDL or entities so the rewrite pipeline stays in sync.
`;

const NEXT_STEPS = [
  ' 1. Review ddl/schema.sql',
  ' 2. Implement repositories based on tests/entities.ts',
  ' 3. Run ZTD tests using pg-testkit'
];

const DEFAULT_DEPENDENCIES: InitDependencies = {
  ensureDirectory,
  writeFile: (filePath, contents) => writeFileSync(filePath, contents, 'utf8'),
  fileExists: (filePath) => existsSync(filePath),
  runPullSchema,
  runGenerateEntities,
  checkPgDump: () => {
    const executable = process.env.PG_DUMP_PATH ?? 'pg_dump';
    const result = spawnSync(executable, ['--version'], { stdio: 'ignore' });
    return result.status === 0 && !result.error;
  },
  log: (message: string) => {
    console.log(message);
  }
};

export async function runInitCommand(prompter: Prompter, options?: InitCommandOptions): Promise<InitResult> {
  const rootDir = options?.rootDir ?? process.cwd();
  const dependencies: InitDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...(options?.dependencies ?? {})
  };

  const absolutePaths: Record<FileKey, string> = {
    schema: path.join(rootDir, 'ddl', 'schema.sql'),
    entities: path.join(rootDir, 'tests', 'entities.ts'),
    readme: path.join(rootDir, 'README-ZTD.md'),
    srcGuide: path.join(rootDir, 'src', 'ZTD-GUIDE.md'),
    testsGuide: path.join(rootDir, 'tests', 'ZTD-TEST-GUIDE.md')
  };

  // Collect every relevant file so the summary can reference consistent relative paths.
  const relativePath = (key: FileKey): string =>
    path.relative(rootDir, absolutePaths[key]).replace(/\\/g, '/') || absolutePaths[key];

  const summaries: Partial<Record<FileKey, FileSummary>> = {};

  // Prompt the user for their preferred initialization workflow.
  const workflow = await prompter.selectChoice(
    'How do you want to start your database workflow?',
    ['I already have a Postgres database (pull schema)', 'I want to start by writing DDL manually']
  );

  if (workflow === 0) {
    // Database-first: pull schema from postgres before generating entities.
    if (!dependencies.checkPgDump()) {
      throw new Error(
        'Unable to find pg_dump. Install Postgres or set PG_DUMP_PATH before running rawsql-ts init.'
      );
    }
    const connectionString = await prompter.promptInput(
      'Enter the Postgres connection string for your database',
      'postgres://user:pass@host:5432/db'
    );

    const createdSchema = await writeFileWithConsent(
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

    summaries.schema = createdSchema;
  } else {
    // DDL-first: create starter schema text before entity generation.
    const createdSchema = await writeFileWithConsent(
      absolutePaths.schema,
      relativePath('schema'),
      dependencies,
      prompter,
      async () => {
        dependencies.ensureDirectory(path.dirname(absolutePaths.schema));
        dependencies.writeFile(absolutePaths.schema, SAMPLE_SCHEMA);
      }
    );

    summaries.schema = createdSchema;
  }

  const entitiesNeeded = await confirmOverwriteIfExists(
    absolutePaths.entities,
    relativePath('entities'),
    dependencies,
    prompter
  );

  if (entitiesNeeded.write) {
    await dependencies.runGenerateEntities({
      directories: [path.resolve(path.dirname(absolutePaths.schema))],
      extensions: ['.sql'],
      out: absolutePaths.entities
    });
  } else {
    dependencies.log('Skipping entity generation; existing tests/entities.ts preserved.');
  }

  summaries.entities = {
    relativePath: relativePath('entities'),
    outcome: entitiesNeeded.existed ? (entitiesNeeded.write ? 'overwritten' : 'unchanged') : 'created'
  };

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

  const summaryLines = buildSummaryLines(summaries as Record<FileKey, FileSummary>);
  summaryLines.forEach(dependencies.log);

  return {
    summary: summaryLines.join('\n'),
    files: Object.values(summaries) as FileSummary[]
  };
}

async function writeFileWithConsent(
  absolutePath: string,
  relative: string,
  dependencies: InitDependencies,
  prompter: Prompter,
  writer: () => Promise<void> | void
): Promise<FileSummary> {
  // Confirm overwriting so we never replace files without explicit approval.
  const { existed, write } = await confirmOverwriteIfExists(
    absolutePath,
    relative,
    dependencies,
    prompter
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

async function confirmOverwriteIfExists(
  absolutePath: string,
  relative: string,
  dependencies: InitDependencies,
  prompter: Prompter
): Promise<OverwriteCheck> {
  // Only prompt when the file is present so we can skip unnecessary confirmation.
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
  dependencies: InitDependencies,
  prompter: Prompter
): Promise<FileSummary> {
  // Keep the documentation helpers DRY while honoring overwrite consent.
  const summary = await writeFileWithConsent(
    absolutePath,
    relative,
    dependencies,
    prompter,
    async () => {
      dependencies.ensureDirectory(path.dirname(absolutePath));
      dependencies.writeFile(absolutePath, contents);
    }
  );
  return summary;
}

function buildSummaryLines(summaries: Record<FileKey, FileSummary>): string[] {
  // Maintain a fixed order so the summary consistently lists the same files.
  const orderedKeys: FileKey[] = ['schema', 'entities', 'readme', 'srcGuide', 'testsGuide'];
  const lines = ['rawsql-ts project initialized.', '', 'Created:'];

  for (const key of orderedKeys) {
    const summary = summaries[key];
    const note =
      summary.outcome === 'created'
        ? ''
        : summary.outcome === 'overwritten'
        ? ' (overwritten existing file)'
        : ' (existing file preserved)';
    lines.push(` - ${summary.relativePath}${note}`);
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
