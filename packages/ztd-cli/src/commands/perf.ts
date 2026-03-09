import { Command } from 'commander';
import path from 'node:path';
import {
  applyPerfInitPlan,
  buildInsertStatementsForTable,
  buildPerfInitPlan,
  loadPerfSeedConfig,
  resetPerfSandbox,
  seedPerfSandbox
} from '../perf/sandbox';
import { isJsonOutput, parseJsonPayload, writeCommandResultEnvelope } from '../utils/agentCli';
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';
import { CreateTableQuery, MultiQuerySplitter, SqlParser, createTableDefinitionFromCreateTableQuery } from 'rawsql-ts';
import { collectSqlFiles } from '../utils/collectSqlFiles';

interface PerfInitOptions {
  dryRun?: boolean;
  json?: string;
}

interface PerfSeedOptions {
  dryRun?: boolean;
  json?: string;
}

interface PerfResetOptions {
  dryRun?: boolean;
  json?: string;
}

export function registerPerfCommands(program: Command): void {
  const perf = program.command('perf').description('Opt-in perf sandbox workflows for reproducible SQL experiments');
  perf.addHelpText(
    'after',
    `
Examples:
  $ ztd perf init
  $ ztd perf db reset --dry-run
  $ ztd perf seed --dry-run
`
  );

  perf
    .command('init')
    .description('Scaffold the perf sandbox configuration and Docker assets')
    .option('--dry-run', 'Emit the perf scaffold plan without writing files')
    .option('--json <payload>', 'Pass perf init options as a JSON object')
    .action((options: PerfInitOptions) => {
      runPerfInitCommand(options);
    });

  const db = perf.command('db').description('Manage the perf sandbox database');
  db
    .command('reset')
    .description('Recreate the perf sandbox schema from local DDL')
    .option('--dry-run', 'Emit the reset plan without touching Docker or PostgreSQL')
    .option('--json <payload>', 'Pass perf db reset options as a JSON object')
    .action(async (options: PerfResetOptions) => {
      await runPerfDbResetCommand(options);
    });

  perf
    .command('seed')
    .description('Generate deterministic synthetic data from perf/seed.yml')
    .option('--dry-run', 'Emit the seed plan without touching PostgreSQL')
    .option('--json <payload>', 'Pass perf seed options as a JSON object')
    .action(async (options: PerfSeedOptions) => {
      await runPerfSeedCommand(options);
    });
}

function runPerfInitCommand(options: PerfInitOptions): void {
  const merged = resolvePerfOptions(options);
  const plan = buildPerfInitPlan(process.cwd());

  if (merged.dryRun) {
    emitPerfResult('perf init', {
      dryRun: true,
      files: plan.files.map((file) => path.relative(process.cwd(), file.path).replace(/\\/g, '/'))
    });
    return;
  }

  const written = applyPerfInitPlan(plan).map((file) => path.relative(process.cwd(), file).replace(/\\/g, '/'));
  emitPerfResult('perf init', {
    dryRun: false,
    files: written
  }, [`Perf sandbox initialized.`, ...written.map((file) => `- ${file}`)]);
}

async function runPerfDbResetCommand(options: PerfResetOptions): Promise<void> {
  const merged = resolvePerfOptions(options);
  const config = loadZtdProjectConfig(process.cwd());
  const ddlSources = collectSqlFiles([path.resolve(process.cwd(), config.ddlDir)], ['.sql']);

  if (merged.dryRun) {
    emitPerfResult('perf db reset', {
      dryRun: true,
      ddl_files: ddlSources.map((source) => source.path),
      ddl_file_count: ddlSources.length
    });
    return;
  }

  const result = await resetPerfSandbox(process.cwd());
  const displayConnectionUrl = toDisplayConnectionUrl(result.connectionUrl);
  emitPerfResult('perf db reset', {
    dryRun: false,
    connection_url: displayConnectionUrl,
    used_docker: result.usedDocker,
    ddl_files: result.appliedFiles,
    ddl_statement_count: result.ddlStatements
  }, [
    `Perf sandbox reset complete.`,
    `Connection: ${displayConnectionUrl}`,
    `DDL files: ${result.appliedFiles.length}`,
    `DDL statements: ${result.ddlStatements}`
  ]);
}

async function runPerfSeedCommand(options: PerfSeedOptions): Promise<void> {
  const merged = resolvePerfOptions(options);

  if (merged.dryRun) {
    const plan = buildPerfSeedDryRunPlan(process.cwd());
    emitPerfResult('perf seed', {
      dryRun: true,
      seed: plan.seed,
      tables: plan.tables
    });
    return;
  }

  const result = await seedPerfSandbox(process.cwd());
  const displayConnectionUrl = toDisplayConnectionUrl(result.connectionUrl);
  emitPerfResult('perf seed', {
    dryRun: false,
    connection_url: displayConnectionUrl,
    used_docker: result.usedDocker,
    seed: result.seed,
    inserted_rows: result.insertedRows
  }, [
    `Perf seed complete.`,
    `Connection: ${displayConnectionUrl}`,
    `Seed: ${result.seed}`,
    ...Object.entries(result.insertedRows).map(([tableName, rows]) => `- ${tableName}: ${rows} rows`)
  ]);
}

function buildPerfSeedDryRunPlan(rootDir: string): { seed: number; tables: Record<string, number> } {
  const config = loadZtdProjectConfig(rootDir);
  const seedConfig = loadPerfSeedConfig(rootDir);
  const ddlSources = collectSqlFiles([path.resolve(rootDir, config.ddlDir)], ['.sql']);
  const definitions = ddlSources.flatMap((source) => {
    const split = MultiQuerySplitter.split(source.sql);
    return split.queries.flatMap((chunk: { sql: string }) => {
      const sql = chunk.sql.trim();
      if (!sql) {
        return [];
      }
      const parsed = SqlParser.parse(sql);
      if (!(parsed instanceof CreateTableQuery)) {
        return [];
      }
      return [createTableDefinitionFromCreateTableQuery(parsed)];
    });
  });

  const tables = Object.fromEntries(
    Object.entries(seedConfig.tables).map(([tableName, tableConfig]) => {
      const definition = definitions.find((candidate) => candidate.name === tableName || candidate.name === `${config.ddl.defaultSchema}.${tableName}`);
      if (!definition) {
        throw new Error(`No table definition found for perf seed table: ${tableName}`);
      }
      return [definition.name, buildInsertStatementsForTable(definition, tableConfig.rows, seedConfig).length];
    })
  );

  return { seed: seedConfig.seed, tables };
}

function toDisplayConnectionUrl(connectionUrl: string): string {
  try {
    const parsed = new URL(connectionUrl);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '[unavailable]';
  }
}

function emitPerfResult(command: string, data: Record<string, unknown>, textLines?: string[]): void {
  if (isJsonOutput()) {
    writeCommandResultEnvelope(command, true, data);
    return;
  }

  if (textLines) {
    process.stdout.write(`${textLines.join('\n')}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function resolvePerfOptions<T extends { json?: string; dryRun?: boolean }>(options: T): { dryRun: boolean } {
  const merged = options.json
    ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') }
    : options;

  if (merged.dryRun !== undefined && typeof merged.dryRun !== 'boolean') {
    throw new Error('Expected --dry-run to resolve to a boolean.');
  }

  return {
    dryRun: Boolean(merged.dryRun)
  };
}
