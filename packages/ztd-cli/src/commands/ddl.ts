import path from 'node:path';
import { Command } from 'commander';
import { runDiffSchema } from './diff';
import { runGenerateEntities } from './genEntities';
import { runPullSchema } from './pull';
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';
import { resolveDatabaseConnection } from '../utils/dbConnection';
import type { DbConnectionFlags, ResolvedDatabaseConnection } from '../utils/dbConnection';
import {
  collectDirectories,
  collectValues,
  normalizeDirectoryList,
  parseExtensions,
  resolveExtensions,
  DEFAULT_DDL_DIRECTORY,
  DEFAULT_EXTENSIONS
} from './options';

interface ConnectionCliOptions {
  url?: string;
  pgDumpPath?: string;
  dbHost?: string;
  dbPort?: string;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
}

interface PullCommandOptions extends ConnectionCliOptions {
  out?: string;
  schema?: string[];
  table?: string[];
}

interface DiffCommandOptions extends ConnectionCliOptions {
  ddlDir?: string[];
  extensions?: string[];
  out?: string;
}

/**
 * Registers all DDL-related commands (`pull`, `gen-entities`, `diff`) on the top-level CLI program.
 * @param program - The Commander program instance to extend.
 */
export function registerDdlCommands(program: Command): void {
  const ddl = program.command('ddl').description('DDL-focused workflows');

  ddl
    .command('pull')
      .description('Retrieve the current schema DDL from a PostgreSQL database')
      .option('--url <databaseUrl>', 'Connection string to use for pg_dump (optional; fallback to env/config)')
      .option('--out <directory>', 'Destination directory for the pulled DDL', DEFAULT_DDL_DIRECTORY)
      .option('--db-host <host>', 'Database host to use instead of DATABASE_URL')
      .option('--db-port <port>', 'Database port (defaults to 5432)')
      .option('--db-user <user>', 'Database user to connect as')
      .option('--db-password <password>', 'Database password')
      .option('--db-name <name>', 'Database name to connect to')
      .option('--pg-dump-path <path>', 'Custom pg_dump executable path')
      .option('--schema <schema>', 'Schema name to include (repeatable)', collectValues, [])
      .option('--table <table>', 'Table spec (schema.table) to include (repeatable)', collectValues, [])
      .action(async (options: PullCommandOptions) => {
        const connection = resolveCliConnection(options);
        await runPullSchema({
          url: connection.url,
          out: options.out ?? DEFAULT_DDL_DIRECTORY,
          pgDumpPath: options.pgDumpPath,
          schemas: options.schema ?? [],
          tables: options.table ?? [],
          connectionContext: connection.context
        });
      });

  ddl
    .command('gen-entities')
    .description('Generate optional entities.ts helpers from the DDL snapshot')
    .option('--ddl-dir <directory>', 'DDL directory to scan (repeatable)', collectDirectories, [])
    .option('--extensions <list>', 'Comma-separated extensions to include', parseExtensions, DEFAULT_EXTENSIONS)
    .option('--out <file>', 'Destination TypeScript file', path.join('src', 'entities.ts'))
    .action(async (options) => {
      const directories = normalizeDirectoryList(options.ddlDir as string[], DEFAULT_DDL_DIRECTORY);
      const extensions = resolveExtensions(options.extensions as string[], DEFAULT_EXTENSIONS);
      await runGenerateEntities({
        directories,
        extensions,
        out: options.out ?? path.join('src', 'entities.ts')
      });
    });

  ddl
    .command('diff')
      .description('Compare local DDL against a live PostgreSQL database and emit a plan')
      .option('--ddl-dir <directory>', 'DDL directory to scan (repeatable)', collectDirectories, [])
      .option('--extensions <list>', 'Comma-separated extensions to include', parseExtensions, DEFAULT_EXTENSIONS)
      .option('--url <databaseUrl>', 'Connection string to use for pg_dump (optional; fallback to env/config)')
      .requiredOption('--out <file>', 'Output path for the generated plan file')
      .option('--db-host <host>', 'Database host to use instead of DATABASE_URL')
      .option('--db-port <port>', 'Database port (defaults to 5432)')
      .option('--db-user <user>', 'Database user to connect as')
      .option('--db-password <password>', 'Database password')
      .option('--db-name <name>', 'Database name to connect to')
      .option('--pg-dump-path <path>', 'Custom pg_dump executable path')
      .action(async (options: DiffCommandOptions) => {
        const directories = normalizeDirectoryList(options.ddlDir ?? [], DEFAULT_DDL_DIRECTORY);
        const extensions = resolveExtensions(options.extensions, DEFAULT_EXTENSIONS);
        const connection = resolveCliConnection(options);
        await runDiffSchema({
          directories,
          extensions,
          url: connection.url,
          out: options.out!,
          pgDumpPath: options.pgDumpPath,
          connectionContext: connection.context
        });
      });
}

/**
 * Resolves connection metadata for CLI commands using flags, environment, and project config.
 * @param options - CLI options containing optional overrides.
 * @returns The resolved connection and context.
 */
function resolveCliConnection(options: ConnectionCliOptions): ResolvedDatabaseConnection {
  // Gather configuration once per command so overrides and defaults stay synchronized.
  return resolveDatabaseConnection(buildFlagSet(options), loadZtdProjectConfig(), options.url);
}

/**
 * Normalizes the incoming CLI flag values into the shared DbConnectionFlags shape.
 * @param options - CLI options exposing partial connection pieces.
 * @returns Flag object consumed by the `resolveDatabaseConnection` helper.
 */
function buildFlagSet(options: ConnectionCliOptions): DbConnectionFlags {
  return {
    host: options.dbHost,
    port: options.dbPort,
    user: options.dbUser,
    password: options.dbPassword,
    database: options.dbName
  };
}

export { collectDirectories, parseExtensions, DEFAULT_EXTENSIONS, DEFAULT_DDL_DIRECTORY } from './options';
