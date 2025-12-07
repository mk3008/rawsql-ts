import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { collectSqlFiles } from '../utils/collectSqlFiles';
import { ensureDirectory } from '../utils/fs';
import { runPgDump } from '../utils/pgDump';
import type { DbConnectionContext } from '../utils/dbConnection';

export interface DiffSchemaOptions {
  directories: string[];
  extensions: string[];
  url: string;
  out: string;
  pgDumpPath?: string;
  connectionContext?: DbConnectionContext;
}

export function runDiffSchema(options: DiffSchemaOptions): void {
  const localSources = collectSqlFiles(options.directories, options.extensions);
  if (localSources.length === 0) {
    throw new Error(`No SQL files were discovered under ${options.directories.join(', ')}`);
  }

  // Concatenate the local DDL files in a stable order for deterministic diff outputs.
  const localSql = localSources.map((source) => source.sql).join('\n\n');
  const remoteSql = runPgDump({
    url: options.url,
    pgDumpPath: options.pgDumpPath,
    connectionContext: options.connectionContext
  });

  const hasChanges = localSql !== remoteSql;
  // Create a unified diff patch only when there are material differences to report.
  const patch = hasChanges
    ? createTwoFilesPatch('local', 'database', localSql, remoteSql, '', '', { context: 3 })
    : '-- No schema differences detected.';

  const header = `-- ztd ddl diff plan\n-- Local DDL: ${options.directories.join(', ')}\n-- Database: ${options.url}\n-- Generated: ${new Date().toISOString()}\n\n`;

  // Guarantee the target path exists before emitting the plan file.
  ensureDirectory(path.dirname(options.out));
  writeFileSync(options.out, `${header}${patch}\n`, 'utf8');
  console.log(`DDL diff plan written to ${options.out}`);
}
