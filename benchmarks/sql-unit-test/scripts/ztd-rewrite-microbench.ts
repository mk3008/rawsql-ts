import path from 'node:path';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { SqlParser } from '@rawsql-ts/core';
import { ResultSelectRewriter } from '@rawsql-ts/testkit-core';
import { DefaultFixtureProvider } from '@rawsql-ts/testkit-core';
import { buildFixtures } from '../tests/support/customer-summary-fixtures';
import { customerSummarySql } from '../sql/customer_summary';
import { tableSchemas } from '../tests/generated/ztd-row-map.generated';

const STAGE_LOG_PATH = path.join('tmp', 'ztd-rewrite-microbench.jsonl');
const REPORT_PATH = path.join('docs', 'bench', 'ztd-rewrite-microbench.md');
const VARIANTS = ['small', 'large'] as const;
type Variant = (typeof VARIANTS)[number];
type StageName = 'parse' | 'ztd_convert' | 'stringify';
const STAGES: StageName[] = ['parse', 'ztd_convert', 'stringify'];
const WARMUP_ITERATIONS = 2;
const MEASURE_ITERATIONS = 8;
const INNER_LOOPS = 1000;

interface StageRecord {
  timestamp: string;
  variant: Variant;
  iteration: number;
  innerLoops: number;
  parseTotalMs: number;
  parsePerCallMs: number;
  ztdConvertTotalMs: number;
  ztdConvertPerCallMs: number;
  stringifyTotalMs: number;
  stringifyPerCallMs: number;
  totalMs: number;
  totalPerCallMs: number;
  formattedLength: number;
}

interface StatsBucket {
  sum: number;
  sumSq: number;
  count: number;
}

type StatsMap = Record<Variant, Record<StageName, StatsBucket>>;

function createStats(): StatsMap {
  const map = {} as StatsMap;
  for (const variant of VARIANTS) {
    map[variant] = {} as Record<StageName, StatsBucket>;
    for (const stage of STAGES) {
      map[variant][stage] = { sum: 0, sumSq: 0, count: 0 };
    }
  }
  return map;
}

function buildVariantSql(variant: Variant): string {
  const base = customerSummarySql.trim();
  if (variant === 'small') {
    return base;
  }

  const fillerValues = Array.from({ length: 16 }, (_, index) => `SELECT ${index} AS filler_id`);
  const fillerCte = `filler_cte AS (\n  ${fillerValues.join('\n  UNION ALL ')}\n)`;
  const replaced = base.replace('FROM customer c', 'FROM customer c CROSS JOIN filler_cte f');
  return `WITH ${fillerCte}\n${replaced}`;
}

function computeStats(bucket: StatsBucket) {
  const mean = bucket.sum / bucket.count;
  const variance =
    bucket.count > 1
      ? Math.max(0, (bucket.sumSq - (bucket.sum * bucket.sum) / bucket.count) / (bucket.count - 1))
      : 0;
  const stdDev = Math.sqrt(variance);
  const stdErr = stdDev / Math.sqrt(bucket.count);
  return { mean, stdDev, stdErr };
}

async function logStage(record: StageRecord): Promise<void> {
  await appendFile(STAGE_LOG_PATH, JSON.stringify(record) + '\n');
}

async function writeReport(stats: StatsMap) {
  const reportLines: string[] = [];
  reportLines.push('# ZTD rewrite microbenchmark');
  reportLines.push('');
  reportLines.push('## Scope');
  reportLines.push('- Measures the pure rewrite pipeline (parse + AST conversion + SQL formatting) without any database interaction.');
  reportLines.push('- Runs against the same customer summary SQL in both a small and a large variant to spotlight AST size effects.');
  reportLines.push(`- Warmup: ${WARMUP_ITERATIONS} iterations; measured iterations per variant: ${MEASURE_ITERATIONS}.`);
  reportLines.push(`- Each measured iteration repeats the rewrite stages ${INNER_LOOPS} times and reports per-call averages (total / ${INNER_LOOPS}) to reduce timer noise.`);
  reportLines.push('');
  reportLines.push('## Stage definitions');
  reportLines.push('- `parse`: `SqlParser.parse` consumes the SQL string into a `ParsedStatement`.');
  reportLines.push('- `ztd_convert`: `ResultSelectRewriter.convertStatement` plus schema-alias rewriting on the parsed AST.');
  reportLines.push('- `stringify`: `SqlFormatter.format` renders the rewritten AST back into text.');
  reportLines.push('');
  reportLines.push('## Measurements');
  reportLines.push('');
  reportLines.push('| Variant | Stage | Mean (ms/call) | StdDev (ms) | StdErr (ms) |');
  reportLines.push('| --- | --- | --- | --- | --- |');

  for (const variant of VARIANTS) {
    for (const stage of STAGES) {
      const bucket = stats[variant][stage];
      const { mean, stdDev, stdErr } = computeStats(bucket);
      reportLines.push(`| ${variant} | ${stage} | ${mean.toFixed(2)} | ${stdDev.toFixed(2)} | ${stdErr.toFixed(2)} |`);
    }
  }

  reportLines.push('');
  reportLines.push('## Notes');
  reportLines.push('- The microbenchmark reports mean / standard deviation / standard error per stage after discarding warmup iterations.');
  reportLines.push(`- Each iteration aggregates ${INNER_LOOPS} rewrites so that the reported mean is the per-call average (total / ${INNER_LOOPS}) and timer noise is reduced.`);
  reportLines.push('- Higher values in `ztd_convert` suggest the AST rewrite work is the primary tuning candidate; compare small vs large to see the sensitivity to SQL size.');
  reportLines.push(`- Raw stage logs: ${STAGE_LOG_PATH}`);
  reportLines.push('');
  reportLines.push('## Next focus');
  for (const variant of VARIANTS) {
    const stageEntries = STAGES.map((stage) => {
      const { mean } = computeStats(stats[variant][stage]);
      return { stage, mean };
    }).sort((a, b) => b.mean - a.mean);
    const top = stageEntries[0];
    reportLines.push(`- ${variant}: ${top.stage} dominates (mean ${top.mean.toFixed(2)} ms).`);
  }
  await writeFile(REPORT_PATH, reportLines.join('\n'), 'utf8');
}

function recordStage(stats: StatsMap, variant: Variant, stage: StageName, duration: number) {
  const bucket = stats[variant][stage];
  bucket.sum += duration;
  bucket.sumSq += duration * duration;
  bucket.count += 1;
}

async function main(): Promise<void> {
  await mkdir('tmp', { recursive: true });
  await writeFile(STAGE_LOG_PATH, '', 'utf8');

  const fixtures = buildFixtures();
  const definitionModels = Object.entries(tableSchemas).map(([tableName, schema]) => ({
    name: tableName,
    columns: Object.entries(schema.columns).map(([columnName, typeName]) => ({
      name: columnName,
      typeName,
      required: false,
      defaultValue: null,
      isNotNull: false,
    })),
  }));
  const fixtureProvider = new DefaultFixtureProvider(definitionModels as unknown as any, fixtures);
  const fixtureSnapshot = fixtureProvider.resolve();
  const rewriter = new ResultSelectRewriter(fixtureProvider, 'error');
  const rewriterAny = rewriter as unknown as {
    convertStatement(parsed: unknown, inputs: { fixtureTables: unknown; tableDefinitions: unknown; fixturesApplied: unknown[] }): {
      sql: unknown;
    };
    rewriteSchemaQualifiers(sql: unknown, fixtures: unknown[]): void;
    formatter: { format(component: unknown): { formattedSql: string } };
  };
  const stats = createStats();
  const iterationsPerVariant = MEASURE_ITERATIONS;

  for (const variant of VARIANTS) {
    const sql = buildVariantSql(variant);
    for (let iteration = 1; iteration <= WARMUP_ITERATIONS + MEASURE_ITERATIONS; iteration += 1) {
      let parseTotalMs = 0;
      let ztdConvertTotalMs = 0;
      let stringifyTotalMs = 0;
      let formattedLength = 0;

      for (let inner = 0; inner < INNER_LOOPS; inner += 1) {
        const parseStart = performance.now();
        const parsed = SqlParser.parse(sql);
        parseTotalMs += performance.now() - parseStart;

        const convertStart = performance.now();
        const converted = rewriterAny.convertStatement(parsed, {
          fixtureTables: fixtureSnapshot.fixtureTables,
          tableDefinitions: fixtureSnapshot.tableDefinitions,
          fixturesApplied: fixtureSnapshot.fixturesApplied,
        });
        if (converted.sql) {
          rewriterAny.rewriteSchemaQualifiers(converted.sql, fixtureSnapshot.fixtureTables);
        }
        ztdConvertTotalMs += performance.now() - convertStart;

        const stringifyStart = performance.now();
        let formattedSql: string | undefined;
        if (converted.sql) {
          formattedSql = rewriterAny.formatter.format(converted.sql).formattedSql;
        }
        stringifyTotalMs += performance.now() - stringifyStart;

        if (formattedSql) {
          formattedLength += formattedSql.length;
        }
      }

      if (iteration > WARMUP_ITERATIONS) {
        const totalMs = parseTotalMs + ztdConvertTotalMs + stringifyTotalMs;
        const parsePerCallMs = parseTotalMs / INNER_LOOPS;
        const ztdConvertPerCallMs = ztdConvertTotalMs / INNER_LOOPS;
        const stringifyPerCallMs = stringifyTotalMs / INNER_LOOPS;
        const totalPerCallMs = totalMs / INNER_LOOPS;
        const record: StageRecord = {
          timestamp: new Date().toISOString(),
          variant,
          iteration: iteration - WARMUP_ITERATIONS,
          innerLoops: INNER_LOOPS,
          parseTotalMs,
          parsePerCallMs,
          ztdConvertTotalMs,
          ztdConvertPerCallMs,
          stringifyTotalMs,
          stringifyPerCallMs,
          totalMs,
          totalPerCallMs,
          formattedLength,
        };
        await logStage(record);
        recordStage(stats, variant, 'parse', parsePerCallMs);
        recordStage(stats, variant, 'ztd_convert', ztdConvertPerCallMs);
        recordStage(stats, variant, 'stringify', stringifyPerCallMs);
      }
    }
  }

  await writeReport(stats);
  console.log(`Generated JSONL log: ${STAGE_LOG_PATH}`);
  console.log(`Generated Markdown report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error('Rewrite microbench failed', error);
  process.exit(1);
});
