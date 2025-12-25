import { SelectQueryParser } from '../../packages/core/src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../packages/core/src/transformers/SqlFormatter';
import { customerSummarySql } from './sql/customer_summary';
import { productRankingSql } from './sql/product_ranking';
import { salesSummarySql } from './sql/sales_summary';

const ITERATIONS = Number(process.env.STRINGIFY_ITERATIONS ?? 100_000);
const WARMUP_ITERATIONS = Number(process.env.STRINGIFY_WARMUP ?? 10_000);

if (!Number.isFinite(ITERATIONS) || ITERATIONS <= 0) {
  throw new Error('STRINGIFY_ITERATIONS must be a positive integer.');
}
if (!Number.isFinite(WARMUP_ITERATIONS) || WARMUP_ITERATIONS < 0) {
  throw new Error('STRINGIFY_WARMUP must be zero or positive.');
}

const NS_PER_MICRO = BigInt(1000);

type BenchmarkTarget = {
  label: string;
  sql: string;
};

const BENCHMARK_TARGETS: BenchmarkTarget[] = [
  { label: 'customer-summary', sql: customerSummarySql },
  { label: 'product-ranking', sql: productRankingSql },
  { label: 'sales-summary', sql: salesSummarySql },
];

type TargetResult = {
  label: string;
  iterations: number;
  totalNanoseconds: bigint;
  averageNanoseconds: bigint;
};

function formatAsMicroseconds(value: bigint): string {
  const microseconds = Number(value / NS_PER_MICRO);
  const remainderNs = Number(value % NS_PER_MICRO);
  return `${microseconds.toLocaleString()}μs${remainderNs > 0 ? ` +${remainderNs}ns` : ''}`;
}

function measureStringify(label: string, ast: ReturnType<typeof SelectQueryParser.parse>): TargetResult {
  const formatter = new SqlFormatter({ preset: 'postgres', keywordCase: 'lower' });
  let sink = 0;

  for (let i = 0; i < WARMUP_ITERATIONS; i += 1) {
    sink ^= formatter.format(ast).formattedSql.length;
  }

  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i += 1) {
    const formatted = formatter.format(ast);
    sink ^= formatted.formattedSql.length;
  }
  const end = process.hrtime.bigint();

  const totalNanoseconds = end - start;
  const averageNanoseconds = totalNanoseconds / BigInt(ITERATIONS);
  // Prevent unused variable elimination (even though ts-node won't optimize aggressively).
  if (sink === 0 && start === end) {
    throw new Error('Unreachable guard to keep sink alive.');
  }

  return {
    label,
    iterations: ITERATIONS,
    totalNanoseconds,
    averageNanoseconds,
  };
}

function printTargetResult(result: TargetResult): void {
  console.log(`=== Stringify benchmark: ${result.label} ===`);
  console.log('Purpose: Measure raw AST→SQL stringify times (μs precision) to decide whether extra optimization is needed.');
  console.log(`Warmup iterations: ${WARMUP_ITERATIONS.toLocaleString()}`);
  console.log(`Measured iterations: ${result.iterations.toLocaleString()}`);
  console.log(`Total elapsed: ${formatAsMicroseconds(result.totalNanoseconds)} (${result.totalNanoseconds.toLocaleString()}ns)`);
  console.log(
    `Average per stringify: ${formatAsMicroseconds(result.averageNanoseconds)} (${result.averageNanoseconds.toLocaleString()}ns)`,
  );
  console.log('');
}

function main(): void {
  BENCHMARK_TARGETS.forEach((target) => {
    const ast = SelectQueryParser.parse(target.sql.trim());
    const result = measureStringify(target.label, ast);
    printTargetResult(result);
  });
}

main();
