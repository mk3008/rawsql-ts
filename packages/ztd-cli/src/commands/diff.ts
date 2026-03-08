import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { collectSqlFiles } from '../utils/collectSqlFiles';
import { formatConnectionTarget } from '../utils/connectionSummary';
import type { DbConnectionContext } from '../utils/dbConnection';
import { ensureDirectory } from '../utils/fs';
import { runPgDump } from '../utils/pgDump';
import { withSpanSync } from '../utils/telemetry';

export interface DiffSchemaOptions {
  directories: string[];
  extensions: string[];
  url: string;
  out: string;
  pgDumpPath?: string;
  connectionContext?: DbConnectionContext;
  dryRun?: boolean;
}

export interface DiffSchemaResult {
  outFile: string;
  patch: string;
  dryRun: boolean;
  hasChanges: boolean;
}

export const DDL_DIFF_SPAN_NAMES = {
  collectLocalDdl: 'collect-local-ddl',
  pullRemoteDdl: 'pull-remote-ddl',
  computeDiffPlan: 'compute-diff-plan',
  emitDiffPlan: 'emit-diff-plan',
} as const;

export function runDiffSchema(options: DiffSchemaOptions): DiffSchemaResult {
  const localSources = withSpanSync(DDL_DIFF_SPAN_NAMES.collectLocalDdl, () => {
    const discovered = collectSqlFiles(options.directories, options.extensions);
    if (discovered.length === 0) {
      throw new Error(`No SQL files were discovered under ${options.directories.join(', ')}`);
    }
    return discovered;
  }, {
    directoryCount: options.directories.length,
    extensionCount: options.extensions.length,
  });

  // Concatenate the local DDL files in a stable order for deterministic diff outputs.
  const localSql = localSources.map((source) => source.sql).join('\n\n');
  const remoteSql = withSpanSync(DDL_DIFF_SPAN_NAMES.pullRemoteDdl, () => {
    return runPgDump({
      url: options.url,
      pgDumpPath: options.pgDumpPath,
      connectionContext: options.connectionContext
    });
  });

  const plan = withSpanSync(DDL_DIFF_SPAN_NAMES.computeDiffPlan, () => {
    const hasChanges = localSql !== remoteSql;
    const patch = hasChanges
      ? createTwoFilesPatch('local', 'database', localSql, remoteSql, '', '', { context: 3 })
      : '-- No schema differences detected.';

    const databaseTarget = formatConnectionTarget(options.connectionContext) || 'target: unknown';
    const header = `-- ztd ddl diff plan\n-- Local DDL: ${options.directories.join(', ')}\n-- Database: ${databaseTarget}\n-- Generated: ${new Date().toISOString()}\n\n`;

    return {
      hasChanges,
      patch: `${header}${patch}\n`,
    };
  }, {
    localFileCount: localSources.length,
  });

  if (!options.dryRun) {
    withSpanSync(DDL_DIFF_SPAN_NAMES.emitDiffPlan, () => {
      ensureDirectory(path.dirname(options.out));
      writeFileSync(options.out, plan.patch, 'utf8');
      console.log(`DDL diff plan written to ${options.out}`);
    }, {
      outFile: options.out,
    });
  }

  return {
    outFile: options.out,
    patch: plan.patch,
    dryRun: Boolean(options.dryRun),
    hasChanges: plan.hasChanges
  };
}
