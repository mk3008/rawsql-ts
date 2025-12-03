import { Command } from 'commander';
import { runDiffSchema } from './diff';
import { runGenerateEntities } from './genEntities';
import { runPullSchema } from './pull';

const DEFAULT_EXTENSIONS = ['.sql'];
const DEFAULT_DIRECTORY = 'ddl';
const EXTENSION_TOKEN_PATTERN = /^[A-Za-z0-9_]+$/;
// DEFAULT_EXTENSIONS assumes '.sql' only; parseExtensions always sorts its output so callers can rely on deterministic ordering.

function collectDirectories(value: string, previous: string[]): string[] {
  // Duplicates are preserved for now; switch to a Set if deduplication is ever desired.
  return [...previous, value];
}

/**
 * Normalize the comma-separated extension list passed through the CLI options.
 * Accepts either a CSV string or an array of extension tokens.
 */
export function parseExtensions(value: string | string[]): string[] {
  const rawEntries = Array.isArray(value) ? value : value.split(',');

  const normalized = rawEntries
    // Trim whitespace so words from CSV and array inputs follow the same cleanup path.
    .map((entry) => entry.trim())
    // Drop blanks and the meaningless "." token before coercion.
    .filter((entry) => entry.length > 0 && entry !== '.')
    // Strip a leading dot for validation, then accept only permitted characters.
    .map((entry) => (entry.startsWith('.') ? entry.slice(1) : entry))
    .filter((token) => token.length > 0 && EXTENSION_TOKEN_PATTERN.test(token))
    // Reapply the dot prefix after validation while forcing lowercase for stability.
    .map((token) => `.${token.toLowerCase()}`);

  // Deduplicate and sort so the output order remains deterministic for every caller.
  return Array.from(new Set(normalized)).sort();
}

export function registerDdlCommands(program: Command): void {
  const ddl = program.command('ddl').description('DDL-focused workflows');

  ddl
    .command('gen-entities')
    .description('Generate TypeScript entity row types from DDL files')
    .option('--ddl-dir <directory>', 'DDL directory to scan (repeatable)', collectDirectories, [])
    .option('--extensions <list>', 'Comma-separated extensions to include', parseExtensions, DEFAULT_EXTENSIONS)
    .requiredOption('--out <file>', 'Destination TypeScript file for generated entities')
    .action(async (options) => {
      const directories = (options.ddlDir as string[]).length ? (options.ddlDir as string[]) : [DEFAULT_DIRECTORY];
      const extensions = (options.extensions as string[]).length ? (options.extensions as string[]) : DEFAULT_EXTENSIONS;
      // Guarantee downstream helpers can rely on at least one directory and extension set.
      await runGenerateEntities({ directories, extensions, out: options.out });
    });

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
        const directories = (options.ddlDir as string[]).length ? (options.ddlDir as string[]) : [DEFAULT_DIRECTORY];
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
