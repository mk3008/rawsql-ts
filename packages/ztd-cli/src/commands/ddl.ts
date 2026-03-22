import path from 'node:path';
import { Command } from 'commander';
import { runDiffSchema } from './diff';
import { runGenerateEntities } from './genEntities';
import { runPullSchema } from './pull';
import { resolveExplicitCliConnection, type ConnectionCliOptions } from './connectionOptions';
import {
  collectDirectories,
  collectValues,
  normalizeDirectoryList,
  parseExtensions,
  resolveExtensions,
  DEFAULT_DDL_DIRECTORY,
  DEFAULT_EXTENSIONS
} from './options';
import { isJsonOutput, parseJsonPayload, writeCommandEnvelope } from '../utils/agentCli';
import { validateProjectPath, validateResourceIdentifier } from '../utils/agentSafety';

interface PullCommandOptions extends ConnectionCliOptions {
  pgDumpPath?: string;
  pgDumpShell?: boolean;
  out?: string;
  schema?: string[];
  table?: string[];
  dryRun?: boolean;
  json?: string;
}

interface DiffCommandOptions extends ConnectionCliOptions {
  pgDumpPath?: string;
  pgDumpShell?: boolean;
  ddlDir?: string[];
  extensions?: string[];
  out?: string;
  dryRun?: boolean;
  json?: string;
}

/**
 * Registers all DDL-related commands (`pull`, `gen-entities`, `diff`) on the top-level CLI program.
 * @param program - The Commander program instance to extend.
 */
export function registerDdlCommands(program: Command): void {
  const ddl = program.command('ddl').description('DDL-focused workflows');

  ddl
    .command('pull')
      .description('Inspect schema state from an explicit target database and normalize the pulled DDL')
      .option('--url <databaseUrl>', 'Explicit target database URL for inspection workflows (preferred over --db-*)')
      .option('--out <directory>', 'Destination directory for the pulled DDL', DEFAULT_DDL_DIRECTORY)
      .option('--db-host <host>', 'Explicit target database host when --url is not used')
      .option('--db-port <port>', 'Explicit target database port (defaults to 5432)')
      .option('--db-user <user>', 'Explicit target database user')
      .option('--db-password <password>', 'Explicit target database password')
      .option('--db-name <name>', 'Explicit target database name')
      .option('--pg-dump-path <path>', 'Custom pg_dump executable path')
      .option('--pg-dump-shell', 'Run the pg_dump path through a shell so wrapper commands like "docker exec <container> pg_dump" can be used')
      .option('--schema <schema>', 'Schema name to include (repeatable)', collectValues, [])
      .option('--table <table>', 'Table spec (schema.table) to include (repeatable)', collectValues, [])
      .option('--dry-run', 'Validate pull inputs and normalize the dump without writing files')
      .option('--json <payload>', 'Pass pull options as a JSON object')
      .action(async (options: PullCommandOptions) => {
        const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
        const connection = resolveExplicitCliConnection(merged);
        const result = await runPullSchema({
          url: connection.url,
          out: validateProjectPath(String(merged.out ?? DEFAULT_DDL_DIRECTORY), '--out'),
          pgDumpPath: merged.pgDumpPath,
          pgDumpShell: Boolean(merged.pgDumpShell),
          schemas: (merged.schema ?? []).map((value) => validateResourceIdentifier(String(value), '--schema')),
          tables: (merged.table ?? []).map((value) => validateResourceIdentifier(String(value), '--table')),
          connectionContext: connection.context,
          dryRun: Boolean(merged.dryRun)
        });
        if (isJsonOutput()) {
          writeCommandEnvelope('ddl pull', {
            schemaVersion: 1,
            dryRun: result.dryRun,
            outDir: result.outDir,
            files: result.files.map((file) => ({ schema: file.schema, path: file.filePath, bytes: file.contents.length }))
          });
        }
      });

  ddl
    .command('gen-entities')
    .description('Generate optional entities.ts helpers from the DDL snapshot')
    .option('--ddl-dir <directory>', 'DDL directory to scan (repeatable)', collectDirectories, [])
    .option('--extensions <list>', 'Comma-separated extensions to include', parseExtensions, DEFAULT_EXTENSIONS)
    .option('--out <file>', 'Destination TypeScript file', path.join('src', 'entities.ts'))
    .option('--dry-run', 'Render entities without writing the destination file')
    .option('--json <payload>', 'Pass generation options as a JSON object')
    .action(async (options) => {
      const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
      const directories = normalizeDirectoryList(merged.ddlDir as string[], DEFAULT_DDL_DIRECTORY);
      const extensions = resolveExtensions(merged.extensions as string[], DEFAULT_EXTENSIONS);
      const result = await runGenerateEntities({
        directories,
        extensions,
        out: validateProjectPath(String(merged.out ?? path.join('src', 'entities.ts')), '--out'),
        dryRun: Boolean(merged.dryRun)
      });
      if (isJsonOutput()) {
        writeCommandEnvelope('ddl gen-entities', {
          schemaVersion: 1,
          dryRun: result.dryRun,
          outFile: result.outFile,
          tables: result.tables.map((table) => table.name),
          bytes: result.rendered.length
        });
      }
    });

  ddl
      .command('diff')
      .description('Compare local DDL against an explicit target database and emit review-first text/json summaries plus pure SQL artifacts')
      .option('--ddl-dir <directory>', 'DDL directory to scan (repeatable)', collectDirectories, [])
      .option('--extensions <list>', 'Comma-separated extensions to include', parseExtensions, DEFAULT_EXTENSIONS)
      .option('--url <databaseUrl>', 'Explicit target database URL for inspection workflows (preferred over --db-*)')
      .option('--out <file>', 'Output path for the generated SQL artifact; companion .txt/.json review files are written alongside it')
      .option('--db-host <host>', 'Explicit target database host when --url is not used')
      .option('--db-port <port>', 'Explicit target database port (defaults to 5432)')
      .option('--db-user <user>', 'Explicit target database user')
      .option('--db-password <password>', 'Explicit target database password')
      .option('--db-name <name>', 'Explicit target database name')
      .option('--pg-dump-path <path>', 'Custom pg_dump executable path')
      .option('--pg-dump-shell', 'Run the pg_dump path through a shell so wrapper commands like "docker exec <container> pg_dump" can be used')
      .option('--dry-run', 'Compute the diff summary without writing the SQL/.txt/.json artifacts')
      .option('--json <payload>', 'Pass diff options as a JSON object')
      .action(async (options: DiffCommandOptions) => {
        const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
        const outPath = resolveRequiredProjectPath(merged.out, '--out');
        const directories = normalizeDirectoryList(merged.ddlDir ?? [], DEFAULT_DDL_DIRECTORY);
        const extensions = resolveExtensions(merged.extensions, DEFAULT_EXTENSIONS);
        const connection = resolveExplicitCliConnection(merged);
        const result = await runDiffSchema({
          directories,
          extensions,
          url: connection.url,
          out: outPath,
          pgDumpPath: merged.pgDumpPath,
          pgDumpShell: Boolean(merged.pgDumpShell),
          connectionContext: connection.context,
          dryRun: Boolean(merged.dryRun)
        });
        if (isJsonOutput()) {
          writeCommandEnvelope('ddl diff', {
            schemaVersion: 1,
            dryRun: result.dryRun,
            outFile: result.outFile,
            hasChanges: result.hasChanges,
            artifacts: result.artifacts,
            summary: result.summary,
            riskNotes: result.riskNotes,
            sqlBytes: result.sql.length
          });
          return;
        }

        process.stdout.write(result.text);
      });
}

export { collectDirectories, parseExtensions, DEFAULT_EXTENSIONS, DEFAULT_DDL_DIRECTORY } from './options';

function resolveRequiredProjectPath(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required (either via ${label} or --json {"${label.slice(2)}":"..."}).`);
  }

  return validateProjectPath(value, label);
}
