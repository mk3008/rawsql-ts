import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createPostgresTestkitClient, type QueryExecutor } from '../packages/testkit-postgres/src';
import type { TableDefinitionModel } from '../packages/core/dist/src/models/TableDefinitionModel';

type BenchmarkSample = {
  label: 'raw-ddl' | 'generated';
  durationMs: number;
};

type BenchmarkRun = BenchmarkSample & {
  ddlBytes?: number;
};

const TABLE_COUNT = resolveNumberEnv('ZTD_RUNTIME_METADATA_BENCH_TABLES', 1000);
const COLUMN_COUNT = resolveNumberEnv('ZTD_RUNTIME_METADATA_BENCH_COLUMNS', 8);
const MEASURED_RUNS = resolveNumberEnv('ZTD_RUNTIME_METADATA_BENCH_RUNS', 5);
const ROOT_DIR = path.join(process.cwd(), 'tmp', 'testkit-postgres-runtime-metadata-benchmark');
const RAW_ROOT_DIR = path.join(ROOT_DIR, 'raw-ddl');
const REPORT_PATH = path.join(ROOT_DIR, 'report.md');

async function main(): Promise<void> {
  fs.rmSync(ROOT_DIR, { recursive: true, force: true });
  fs.mkdirSync(RAW_ROOT_DIR, { recursive: true });

  try {
    const tableDefinitions = buildSyntheticTableDefinitions(TABLE_COUNT, COLUMN_COUNT);
    const samples: BenchmarkRun[] = [];
    for (let runIndex = 0; runIndex < MEASURED_RUNS; runIndex += 1) {
      samples.push(await measureRawDdlColdStart(tableDefinitions, runIndex));
      samples.push(measureGeneratedColdStart(tableDefinitions));
    }

    const report = buildReport(samples, tableDefinitions);
    fs.writeFileSync(REPORT_PATH, report, 'utf8');
    console.log(report);
  } finally {
    fs.rmSync(ROOT_DIR, { recursive: true, force: true });
  }
}

async function measureRawDdlColdStart(
  tableDefinitions: TableDefinitionModel[],
  runIndex: number
): Promise<BenchmarkRun> {
  const runDir = path.join(RAW_ROOT_DIR, `run-${String(runIndex + 1).padStart(2, '0')}`);
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });
  writeSyntheticDdlFiles(runDir, tableDefinitions);
  const ddlBytes = sumFileBytes(runDir);

  const start = performance.now();
  createPostgresTestkitClient({
    queryExecutor: noopExecutor,
    ddl: {
      directories: [runDir],
      extensions: ['.sql'],
      ddlLint: 'strict',
    },
  });
  const durationMs = performance.now() - start;

  return {
    label: 'raw-ddl',
    durationMs,
    ddlBytes,
  };
}

function measureGeneratedColdStart(tableDefinitions: TableDefinitionModel[]): BenchmarkRun {
  const start = performance.now();
  createPostgresTestkitClient({
    queryExecutor: noopExecutor,
    generated: {
      tableDefinitions,
    },
  });
  return {
    label: 'generated',
    durationMs: performance.now() - start,
  };
}

function buildSyntheticTableDefinitions(tableCount: number, columnCount: number): TableDefinitionModel[] {
  const tables: TableDefinitionModel[] = [];
  for (let index = 0; index < tableCount; index += 1) {
    const tableName = `public.bench_table_${String(index + 1).padStart(4, '0')}`;
    const columns: TableDefinitionModel['columns'] = [];
    columns.push({ name: 'id', typeName: 'bigint', required: true, defaultValue: null, isNotNull: true });
    for (let columnIndex = 1; columnIndex < columnCount; columnIndex += 1) {
      const isNullable = columnIndex % 4 === 0;
      const hasDefault = columnIndex % 3 === 0;
      columns.push({
        name: `col_${String(columnIndex).padStart(2, '0')}`,
        typeName: columnIndex % 2 === 0 ? 'text' : 'numeric',
        required: !isNullable && !hasDefault,
        defaultValue: hasDefault ? `${columnIndex}` : null,
        isNotNull: !isNullable,
      });
    }
    tables.push({ name: tableName, columns });
  }
  return tables;
}

function writeSyntheticDdlFiles(targetDir: string, tableDefinitions: TableDefinitionModel[]): void {
  for (const definition of tableDefinitions) {
    const fileName = `${definition.name.replace(/\./g, '_')}.sql`;
    const columns = definition.columns
      .map((column: TableDefinitionModel['columns'][number]) => {
        const constraints: string[] = [];
        if (column.isNotNull) {
          constraints.push('NOT NULL');
        }
        if (column.defaultValue != null) {
          constraints.push(`DEFAULT ${column.defaultValue}`);
        }
        return `  ${column.name} ${column.typeName ?? 'text'} ${constraints.join(' ')}`.trimEnd();
      })
      .join(',\n');
    const sql = `${buildCommentBlock(definition.name)}CREATE TABLE ${definition.name} (\n${columns}\n);\n`;
    fs.writeFileSync(path.join(targetDir, fileName), sql, 'utf8');
  }
}

function buildCommentBlock(tableName: string): string {
  const lines = [
    `-- Synthetic benchmark fixture for ${tableName}.`,
    '-- The comment block is intentionally verbose so the raw DDL path has to scan a few megabytes of text.',
  ];
  for (let index = 0; index < 30; index += 1) {
    lines.push(
      `-- benchmark note ${String(index + 1).padStart(2, '0')}: generated metadata should make this text irrelevant to the fast path.`
    );
  }
  return `${lines.join('\n')}\n`;
}

function buildReport(samples: BenchmarkRun[], tableDefinitions: TableDefinitionModel[]): string {
  const rawSamples = samples.filter((sample) => sample.label === 'raw-ddl').map((sample) => sample.durationMs);
  const generatedSamples = samples.filter((sample) => sample.label === 'generated').map((sample) => sample.durationMs);
  const rawAvg = average(rawSamples);
  const generatedAvg = average(generatedSamples);
  const improvement = rawAvg > 0 ? ((rawAvg - generatedAvg) / rawAvg) * 100 : 0;
  const ddlBytes = samples.find((sample) => sample.label === 'raw-ddl')?.ddlBytes ?? 0;

  return [
    '# testkit-postgres runtime metadata benchmark',
    '',
    `- Tables: ${tableDefinitions.length}`,
    `- Columns per table: ${tableDefinitions[0]?.columns.length ?? 0}`,
    `- DDL files: ${tableDefinitions.length}`,
    `- DDL size: ${formatBytes(ddlBytes)}`,
    `- Measured runs: ${MEASURED_RUNS}`,
    '',
    '## Measurement Notes',
    '',
    '- The raw DDL path uses a unique on-disk directory per run so the loader cache does not mask the cold-start cost.',
    '- The measurement covers client construction only, which is where generated metadata can skip raw DDL discovery entirely.',
    '- DDL parser and lint costs are still in scope for the raw path because the loader runs them during construction.',
    '',
    '| Path | Avg cold start (ms) | Samples |',
    '| --- | --- | --- |',
    `| raw DDL path | ${rawAvg.toFixed(2)} | ${rawSamples.map((value) => value.toFixed(2)).join(', ')} |`,
    `| generated metadata path | ${generatedAvg.toFixed(2)} | ${generatedSamples.map((value) => value.toFixed(2)).join(', ')} |`,
    '',
    `- Relative improvement: ${improvement.toFixed(1)}%`,
    `- Report path: ${REPORT_PATH}`,
    '',
    'The raw DDL path still scans and parses DDL directories on client creation, while the generated metadata path skips that scan and starts from the schema manifest directly.',
  ].join('\n');
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumFileBytes(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += sumFileBytes(fullPath);
      continue;
    }
    total += fs.statSync(fullPath).size;
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function resolveNumberEnv(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  if (!Number.isFinite(raw) || raw < 1) {
    return fallback;
  }
  return Math.floor(raw);
}

const noopExecutor: QueryExecutor = async () => [];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
