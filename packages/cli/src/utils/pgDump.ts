import { spawnSync } from 'node:child_process';

export interface PgDumpOptions {
  url: string;
  pgDumpPath?: string;
}

export function runPgDump(options: PgDumpOptions): string {
  const executable = options.pgDumpPath ?? process.env.PG_DUMP_PATH ?? 'pg_dump';
  const args = ['--schema-only', '--no-owner', '--no-privileges', '--dbname', options.url];

  // Execute pg_dump in schema-only mode to capture the database definitions.
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.error) {
    throw new Error(
      `Failed to launch pg_dump (${executable}). Ensure it is installed and available in PATH or specify --pg-dump-path.`
    );
  }

  // Fail fast when the dump output is missing or the tool reported an error.
  if (result.status !== 0 || !result.stdout) {
    const stderr = result.stderr ? result.stderr.toString().trim() : 'Unknown error';
    throw new Error(`pg_dump reported an error: ${stderr}`);
  }

  return result.stdout;
}
