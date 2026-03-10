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
import {
  PERF_BENCHMARK_DEFAULTS,
  diffPerfBenchmarkReports,
  formatPerfBenchmarkReport,
  formatPerfDiffReport,
  runPerfBenchmark,
  type PerfBenchmarkFormat,
  type PerfBenchmarkMode
} from '../perf/benchmark';
import { isJsonOutput, parseJsonPayload, writeCommandEnvelope } from '../utils/agentCli';
import { withSpan, withSpanSync } from '../utils/telemetry';
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

interface PerfRunOptions {
  query?: string;
  params?: string;
  strategy?: string;
  material?: string;
  mode?: string;
  repeat?: string;
  warmup?: string;
  classifyThresholdSeconds?: string;
  timeoutMinutes?: string;
  save?: boolean;
  dryRun?: boolean;
  label?: string;
  json?: string;
}

interface PerfReportDiffOptions {
  format?: string;
  json?: string;
}

export const PERF_COMMAND_SPANS = {
  resolveRunOptions: 'resolve-perf-run-options',
  executeBenchmark: 'execute-perf-benchmark',
  renderBenchmark: 'render-perf-report',
  loadDiff: 'load-perf-report-diff',
  renderDiff: 'render-perf-diff-output',
} as const;

export function registerPerfCommands(program: Command): void {
  const perf = program.command('perf').description('Opt-in perf sandbox workflows for reproducible SQL experiments');
  perf.addHelpText(
    'after',
    `
Examples:
  $ ztd perf init
  $ ztd perf db reset --dry-run
  $ ztd perf seed --dry-run
  $ ztd perf run --query src/sql/report.sql --dry-run
  $ ztd perf report diff perf/evidence/run_001 perf/evidence/run_002
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

  perf
    .command('run')
    .description('Benchmark one SQL query and capture evidence for AI-driven tuning loops')
    .option('--query <sqlFile>', 'SQL file to benchmark inside the perf sandbox')
    .option('--params <path>', 'JSON or YAML file with query parameters (object for named placeholders, array for positional)')
    .option('--strategy <strategy>', 'Execution strategy (direct|decomposed)', 'direct')
    .option('--material <cteNames>', 'Comma-separated CTEs to materialize when --strategy decomposed is used')
    .option('--mode <mode>', 'Benchmark mode (auto|latency|completion)', 'auto')
    .option('--repeat <count>', `Measured repetitions for latency mode (default: ${PERF_BENCHMARK_DEFAULTS.repeat})`)
    .option('--warmup <count>', `Warmup repetitions for latency mode (default: ${PERF_BENCHMARK_DEFAULTS.warmup})`)
    .option('--classify-threshold-seconds <seconds>', `Threshold for auto mode classification (default: ${PERF_BENCHMARK_DEFAULTS.classifyThresholdSeconds})`)
    .option('--timeout-minutes <minutes>', `Timeout for measured runs (default: ${PERF_BENCHMARK_DEFAULTS.timeoutMinutes})`)
    .option('--save', 'Persist benchmark evidence under perf/evidence/run_xxx')
    .option('--dry-run', 'Resolve mode, params, and evidence shape without touching PostgreSQL')
    .option('--label <name>', 'Attach a short label to the saved run directory')
    .option('--json <payload>', 'Pass perf run options as a JSON object')
    .action(async (options: PerfRunOptions) => {
      await runPerfRunCommand(options);
    });

  const report = perf.command('report').description('Compare saved perf benchmark evidence');
  report
    .command('diff <baselineDir> <candidateDir>')
    .description('Compare two saved perf benchmark runs and highlight the primary metric delta')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--json <payload>', 'Pass perf report diff options as a JSON object')
    .action((baselineDir: string, candidateDir: string, options: PerfReportDiffOptions) => {
      runPerfReportDiffCommand(baselineDir, candidateDir, options);
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

async function runPerfRunCommand(options: PerfRunOptions): Promise<void> {
  const resolved = withSpanSync(PERF_COMMAND_SPANS.resolveRunOptions, () => {
    const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
    const queryFile = normalizeRequiredStringOption(merged.query, '--query');

    return {
      rootDir: process.cwd(),
      queryFile,
      paramsFile: normalizeOptionalStringOption(merged.params),
      strategy: normalizePerfStrategy(normalizeOptionalStringOption(merged.strategy) ?? 'direct'),
      material: normalizeCsvListOption(merged.material),
      mode: normalizeBenchmarkMode(normalizeOptionalStringOption(merged.mode) ?? 'auto'),
      repeat: normalizePositiveIntegerOption(merged.repeat, '--repeat', PERF_BENCHMARK_DEFAULTS.repeat),
      warmup: normalizeNonNegativeIntegerOption(merged.warmup, '--warmup', PERF_BENCHMARK_DEFAULTS.warmup),
      classifyThresholdSeconds: normalizePositiveIntegerOption(
        merged.classifyThresholdSeconds,
        '--classify-threshold-seconds',
        PERF_BENCHMARK_DEFAULTS.classifyThresholdSeconds
      ),
      timeoutMinutes: normalizePositiveIntegerOption(merged.timeoutMinutes, '--timeout-minutes', PERF_BENCHMARK_DEFAULTS.timeoutMinutes),
      save: normalizeBooleanOption(merged.save),
      dryRun: normalizeBooleanOption(merged.dryRun),
      label: normalizeOptionalStringOption(merged.label)
    };
  }, {
    jsonPayload: Boolean(options.json),
  });

  const report = await withSpan(PERF_COMMAND_SPANS.executeBenchmark, () => {
    return runPerfBenchmark(resolved);
  }, {
    strategy: resolved.strategy,
    requestedMode: resolved.mode,
    save: resolved.save,
    dryRun: resolved.dryRun,
  });

  withSpanSync(PERF_COMMAND_SPANS.renderBenchmark, () => {
    emitPerfReport('perf run', report);
  }, {
    selectedMode: report.selected_mode,
    strategy: report.strategy,
    saved: report.saved,
    dryRun: report.dry_run,
  });
}

function runPerfReportDiffCommand(baselineDir: string, candidateDir: string, options: PerfReportDiffOptions): void {
  const resolved = withSpanSync(PERF_COMMAND_SPANS.loadDiff, () => {
    const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
    const format = normalizePerfFormat(normalizeOptionalStringOption(merged.format));
    const report = diffPerfBenchmarkReports(path.resolve(process.cwd(), baselineDir), path.resolve(process.cwd(), candidateDir));

    return { format, report };
  }, {
    jsonPayload: Boolean(options.json),
  });

  if (isJsonOutput()) {
    withSpanSync(PERF_COMMAND_SPANS.renderDiff, () => {
      writeCommandEnvelope('perf report diff', resolved.report);
    }, {
      format: resolved.format,
    });
    return;
  }

  withSpanSync(PERF_COMMAND_SPANS.renderDiff, () => {
    process.stdout.write(formatPerfDiffReport(resolved.report, resolved.format));
  }, {
    format: resolved.format,
  });
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
    writeCommandEnvelope(command, data);
    return;
  }

  if (textLines) {
    process.stdout.write(`${textLines.join('\n')}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function emitPerfReport(command: 'perf run', report: Awaited<ReturnType<typeof runPerfBenchmark>>): void {
  if (isJsonOutput()) {
    writeCommandEnvelope(command, report);
    return;
  }

  process.stdout.write(formatPerfBenchmarkReport(report, 'text'));
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

function normalizeOptionalStringOption(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected a string option but received ${typeof value}.`);
  }
  return value;
}

function normalizeRequiredStringOption(value: unknown, label: string): string {
  const normalized = normalizeOptionalStringOption(value);
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeBooleanOption(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`Expected a boolean option but received ${typeof value}.`);
  }
  return value;
}

function normalizePositiveIntegerOption(value: unknown, label: string, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function normalizeNonNegativeIntegerOption(value: unknown, label: string, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function normalizeCsvListOption(value: unknown): string[] {
  const normalized = normalizeOptionalStringOption(value);
  if (!normalized) {
    return [];
  }
  return normalized.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function normalizePerfStrategy(value: string): 'direct' | 'decomposed' {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'direct' || normalized === 'decomposed') {
    return normalized;
  }
  throw new Error(`Unsupported perf execution strategy: ${value}`);
}

function normalizeBenchmarkMode(value: string): PerfBenchmarkMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'auto' || normalized === 'latency' || normalized === 'completion') {
    return normalized;
  }
  throw new Error(`Unsupported perf benchmark mode: ${value}`);
}

function normalizePerfFormat(value: string | undefined): PerfBenchmarkFormat {
  const normalized = (value ?? 'text').trim().toLowerCase();
  if (normalized === 'text' || normalized === 'json') {
    return normalized;
  }
  throw new Error(`Unsupported format: ${value}`);
}

