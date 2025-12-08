import { spawnSync } from 'node:child_process';
import os from 'node:os';
import type { DbConnectionContext } from './dbConnection';
import { describeConnectionContext } from './connectionSummary';

export interface PgDumpOptions {
  url: string;
  pgDumpPath?: string;
  extraArgs?: string[];
  connectionContext?: DbConnectionContext;
}

/**
 * Wraps `pg_dump` in schema-only mode for the given connection URL and returns the captured DDL output.
 */
export function runPgDump(options: PgDumpOptions): string {
  const executable = options.pgDumpPath ?? process.env.PG_DUMP_PATH ?? 'pg_dump';
  const args = [
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    ...(options.extraArgs ?? []),
    '--dbname',
    options.url
  ];

  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const connectionNote = describeConnectionContext(options.connectionContext);
  const extraArgsNote = options.extraArgs?.length ? ` (extra args: ${options.extraArgs.join(' ')})` : '';

  if (result.error) {
    const windowsHint =
      os.platform() === 'win32'
        ? ' On Windows, ensure "C:\\Program Files\\PostgreSQL\\<version>\\bin" is on PATH or use a shell where pg_dump is available.'
        : '';

    if (isExecutableMissing(result.error, result.stderr?.toString())) {
      throw new Error(
        `pg_dump executable not found (${executable}). Install PostgreSQL or pass --pg-dump-path to point at the binary.${windowsHint}`
      );
    }

    throw new Error(
      `Failed to launch pg_dump (${executable})${connectionNote}: ${result.error.message ?? 'Unknown error'}${extraArgsNote}`
    );
  }

  if (result.status !== 0 || !result.stdout) {
    const stderr = result.stderr ? result.stderr.toString().trim() : 'Unknown error';
    throw new Error(`pg_dump reported an error${connectionNote}: ${stderr}${extraArgsNote}`);
  }

  return result.stdout;
}

function isExecutableMissing(error: NodeJS.ErrnoException, stderr?: string): boolean {
  if (error.code === 'ENOENT') {
    return true;
  }

  if (!stderr) {
    return false;
  }

  const normalized = stderr.toLowerCase();
  return normalized.includes('not recognized') || normalized.includes('command not found');
}
