import path from 'node:path';
import { Command } from 'commander';
import { runDiffSchema } from './diff';
import { runGenerateEntities } from './genEntities';
import { runPullSchema } from './pull';
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';
import { resolveDatabaseConnection } from '../utils/dbConnection';
import {
  collectDirectories,
  collectValues,
  normalizeDirectoryList,
  parseExtensions,
  resolveExtensions,
  DEFAULT_DDL_DIRECTORY,
  DEFAULT_EXTENSIONS
} from './options';

export function registerDdlCommands(program: Command): void {
  const ddl = program.command('ddl').description('DDL-focused workflows');

    ddl
      .command('pull')
      .description('Retrieve the current schema DDL from a PostgreSQL database')
      .requiredOption('--url <databaseUrl>', 'Connection string to use for pg_dump')
      .option('--out <directory>', 'Destination directory for the pulled DDL', DEFAULT_DDL_DIRECTORY)
      .option('--db-host <host>', 'Database host to use instead of DATABASE_URL')
      .option('--db-port <port>', 'Database port (defaults to 5432)')
      .option('--db-user <user>', 'Database user to connect as')
      .option('--db-password <password>', 'Database password')
      .option('--db-name <name>', 'Database name to connect to')
      .option('--pg-dump-path <path>', 'Custom pg_dump executable path')
      .option('--schema <schema>', 'Schema name to include (repeatable)', collectValues, [])
      .option('--table <table>', 'Table spec (schema.table) to include (repeatable)', collectValues, [])
      .action(async (options) => {
        const connection = resolveDatabaseConnection(
          {
            host: options.dbHost,
            port: options.dbPort,
            user: options.dbUser,
            password: options.dbPassword,
            database: options.dbName
          },
          loadZtdProjectConfig(),
          options.url
        );
        await runPullSchema({
          url: options.url,
          out: options.out,
          pgDumpPath: options.pgDumpPath as string | undefined,
          schemas: options.schema as string[],
          tables: options.table as string[],
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
      .requiredOption('--url <databaseUrl>', 'Connection string to use for pg_dump')
      .requiredOption('--out <file>', 'Output path for the generated plan file')
      .option('--db-host <host>', 'Database host to use instead of DATABASE_URL')
      .option('--db-port <port>', 'Database port (defaults to 5432)')
      .option('--db-user <user>', 'Database user to connect as')
      .option('--db-password <password>', 'Database password')
      .option('--db-name <name>', 'Database name to connect to')
      .option('--pg-dump-path <path>', 'Custom pg_dump executable path')
      .action(async (options) => {
        const directories = normalizeDirectoryList(options.ddlDir as string[], DEFAULT_DDL_DIRECTORY);
        const extensions = resolveExtensions(options.extensions as string[], DEFAULT_EXTENSIONS);
        const connection = resolveDatabaseConnection(
          {
            host: options.dbHost,
            port: options.dbPort,
            user: options.dbUser,
            password: options.dbPassword,
            database: options.dbName
          },
          loadZtdProjectConfig(),
          options.url
        );
        await runDiffSchema({
          directories,
          extensions,
          url: options.url,
          out: options.out,
          pgDumpPath: options.pgDumpPath as string | undefined,
          connectionContext: connection.context
        });
      });
  }

export { collectDirectories, parseExtensions, DEFAULT_EXTENSIONS, DEFAULT_DDL_DIRECTORY } from './options';
