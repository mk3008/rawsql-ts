import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { runPgDump } from '../utils/pgDump';
import { ensureDirectory } from '../utils/fs';

export interface PullSchemaOptions {
  url: string;
  out: string;
  pgDumpPath?: string;
}

export function runPullSchema(options: PullSchemaOptions): void {
  const ddlSql = runPgDump({ url: options.url, pgDumpPath: options.pgDumpPath });
  const directory = path.resolve(options.out);
  // Prepare the destination directory before writing the pulled schema.
  ensureDirectory(directory);

  const targetFile = path.join(directory, 'schema.sql');
  // Persist the dumped schema into a single file for later diffing.
  writeFileSync(targetFile, ddlSql, 'utf8');
  console.log(`Pulled DDL into ${targetFile}`);
}
