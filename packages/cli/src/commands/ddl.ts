import { Command } from 'commander';
import { runDiffSchema } from './diff';
import { runPullSchema } from './pull';
import { collectDirectories, parseExtensions, DEFAULT_DDL_DIRECTORY, DEFAULT_EXTENSIONS } from './options';

export function registerDdlCommands(program: Command): void {
  const ddl = program.command('ddl').description('DDL-focused workflows');

  ddl
    .command('pull')
    .description('Retrieve the current schema DDL from a PostgreSQL database')
    .requiredOption('--url <databaseUrl>', 'Connection string to use for pg_dump')
    .requiredOption('--out <directory>', 'Destination directory for the pulled DDL')
    .option('--pg-dump-path <path>', 'Custom pg_dump executable path')
      .action(async (options) => {
        // pgDumpPath fallback occurs within runPullSchema.
        await runPullSchema({
          url: options.url,
          out: options.out,
          pgDumpPath: options.pgDumpPath as string | undefined
        });
      });

  ddl
    .command('diff')
    .description('Compare local DDL against a live PostgreSQL database and emit a plan')
    .option('--ddl-dir <directory>', 'DDL directory to scan (repeatable)', collectDirectories, [])
    .option('--extensions <list>', 'Comma-separated extensions to include', parseExtensions, DEFAULT_EXTENSIONS)
    .requiredOption('--url <databaseUrl>', 'Connection string to use for pg_dump')
    .requiredOption('--out <file>', 'Output path for the generated plan file')
    .option('--pg-dump-path <path>', 'Custom pg_dump executable path')
      .action(async (options) => {
        const directories = (options.ddlDir as string[]).length ? (options.ddlDir as string[]) : [DEFAULT_DDL_DIRECTORY];
        const extensions = (options.extensions as string[]).length ? (options.extensions as string[]) : DEFAULT_EXTENSIONS;
        // Ensure diffing always has a deterministic local SQL snapshot to compare with the remote schema.
        // pgDumpPath fallback occurs within runDiffSchema.
        await runDiffSchema({
          directories,
          extensions,
          url: options.url,
          out: options.out,
          pgDumpPath: options.pgDumpPath as string | undefined
        });
  });
}

export { collectDirectories, parseExtensions, DEFAULT_EXTENSIONS, DEFAULT_DDL_DIRECTORY } from './options';
