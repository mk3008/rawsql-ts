# ZTD Benchmarking

This benchmark compares traditional migration-style repository tests with ZTD fixture-backed repository tests by executing the same repository implementation in both workflows. The goal is to surface how much of the cost comes from migration/seed/cleanup overhead versus how much comes from query time and the ZTD rewrite pipeline.

## Comparison rules

- Both workflows exercise the same repository class and query definitions so differences stem only from the surrounding test infrastructure.
- Traditional runs create a schema per repetition, apply the `benchmarks/ztd-bench-vs-raw/ddl/ecommerce.sql` migration, seed the required tables, call the repository method, then drop the schema.
- ZTD runs skip migration/seed/cleanup, hook into the repository query to capture the emitted SQL, feed that SQL into pg-testkit for rewrite/fixture generation, and execute the rewritten statements.
- Measurements cover variable suite sizes and steady-state loops so the report can show the impact of runner startup, warm runs, and incremental iteration cost.

## What It Measures

- End-to-end wall-clock time per scenario, including runner startup when applicable.
- Total DB execution time and aggregate SQL statement count so it is clear why Traditional issues more SQL work.
- ZTD-specific breakdowns for rewrite processing, fixture materialization, SQL generation, and any other overhead the fixture pipeline introduces.
- Steady-state iteration metrics that show average incremental time, SQL count, and DB execution after the runner is warm.

## What It Excludes

- Postgres container startup time (the benchmark reuses a single container across all runs).
- External network and application-layer time outside the test process.
- Any caching beyond a single benchmark run (each run rebuilds schema/data for traditional tests).
- Long-lived test runner behavior (watch mode).

## How To Run

```bash
pnpm ztd:bench
```

The command runs the Vitest suites defined under `benchmarks/ztd-bench-vs-raw`, ensuring the benchmark logic and fixtures remain inside this directory rather than depending on the playground workspace.

The report is written to `tmp/bench/report.md`.
Detailed JSON diagnostics stream to `tmp/bench/log.jsonl`; keep the default `quiet` level for minimal output or bump `BENCH_LOG_LEVEL`/use `--verbose`/`--debug` when you want to follow the JSON lines on the console.

Running the benchmark also captures one representative Traditional SQL sequence per case and saves it under `tmp/bench/traditional-sql/` (e.g., `customer-summary.sql`, `product-ranking.sql`, `sales-summary.sql`) so you can inspect the migration, seeding, query, and cleanup statements without collecting multiple repetitions.

## Requirements

- Docker (used by `@testcontainers/postgresql`).
- Node.js 20+.

## Configuration

You can adjust the benchmark without editing code using environment variables:

- `ZTD_BENCH_RUNS` (default: 10) - measured iterations per scenario.
- `ZTD_BENCH_WARMUP` (default: 2) - warmup iterations per scenario.
- `ZTD_BENCH_WORKERS` (default: 4) - parallel worker count for the parallel runs.
- `ZTD_BENCH_REPORT_PATH` - override the report output path.
- `BENCH_CONNECTION_MODELS` (default: `perWorker,caseLocal`) - comma-separated list of connection models to exercise sequentially; each model is applied to both Traditional and ZTD workflows before moving to the next so the report can compare PID/session/worker activity metrics across `perWorker` and `caseLocal`.
- `BENCH_CONNECTION_MODEL` (default: `perWorker`) - the single connection model that both Traditional and ZTD suites use. When `BENCH_CONNECTION_MODELS` is present, this value must match the first entry. The benchmark enforces that this variable agrees with any legacy `ZTD_BENCH_CONNECTION_MODEL`/`TRADITIONAL_BENCH_CONNECTION_MODEL` settings, so both workflows always share the same connectivity.
- `ZTD_BENCH_CONNECTION_MODEL` & `TRADITIONAL_BENCH_CONNECTION_MODEL` (legacy) - these older variables now act as aliases to `BENCH_CONNECTION_MODEL`/`BENCH_CONNECTION_MODELS`. They must be either unset or set to the same normalized model (`perWorker`, `caseLocal`, or `shared`/`case-local` aliases) and must appear inside `BENCH_CONNECTION_MODELS` if that list is used.
- `BENCH_PARALLEL_WORKER_COUNTS` (default: `4,8`) - comma-separated worker counts for the parallel suites; ensures the report covers both 4-worker and 8-worker configurations. Setting `ZTD_BENCH_WORKERS` overrides this list with a single worker count for legacy scripts.
- `BENCH_LOG_LEVEL` (quiet|info|debug) - defaults to `quiet` so only the start/end summaries hit the console while detailed JSON diagnostics stream to `tmp/bench/log.jsonl`. Set it to `info` or `debug`, or pass `--verbose`/`--debug` when invoking `ts-node benchmarks/ztd-test-benchmark.ts`, to mirror those events on the console for troubleshooting.

## Directory Layout

Everything the benchmark needs lives under `benchmarks/ztd-bench-vs-raw`:

- `sql/` contains the canonical query strings executed by both traditional and ZTD tests.
- `ddl/` holds the schema file that pg-testkit uses to validate and plan each rewrite.
- `tests/` hosts the Vitest suites, fixtures, and helpers that drive the runner, steady-state, and global setup flows.

Keeping the benchmark code self-contained makes it clear that this directory is the authoritative measurement surface; it does not depend on playground demos and is safe to run from the repository root.

## Reproducing Results

The benchmark uses SQL from `benchmarks/ztd-bench-vs-raw/sql`, fixtures defined under `benchmarks/ztd-bench-vs-raw/tests/support`, and schema metadata in `benchmarks/ztd-bench-vs-raw/ddl`. Run it from the repository root to ensure the benchmark runner and package dependencies resolve correctly.

## pg-testkit mode comparison

Use `pnpm ztd:bench:pg-testkit-mode` when you want to look at pg-testkit’s two migration modes in isolation. The script runs every case under both the fixture-driven ZTD path and the Traditional DDL/seeding path inside pg-testkit, then writes `tmp/pg-testkit-mode-report.md` with per-case averages for duration, SQL count, DB time, migration time, and cleanup time.

The report is a lightweight complement to the full `pnpm ztd:bench` dataset and is a good place to start when you only need the driver-level comparison without the runner/parallelism instrumentation.

## Assumptions

- Traditional unit tests treat SQL generation cost as zero because SQL is provided as raw strings.
- ZTD unit tests include repository-level SQL generation plus SQL-to-ZTD rewrite costs.
- Runner-based scenarios include Vitest startup time; the in-process lower bound does not.

## Concurrency diagnostics

- The traditional parallel summary in `tmp/bench/report.md` now reports the 95th percentile of connection waiting, migration, and cleanup durations, so you can immediately see which of those steps is limiting throughput when parallel workers are added.
- The new **ZTD Concurrency Diagnostics** section highlights the measured parallel run with the largest suite (typically 120 tests) and the highest worker count; it surfaces the waiting p95 plus the peak `pg_stat_activity` active sessions so you can explain why adding more workers stops improving the runtime.
- A lightweight Vitest smoke test lives at `benchmarks/ztd-bench-vs-raw/tests/diagnostics/traditional-parallelism.test.ts`. It runs a barriered `pg_sleep` workload through `runTraditionalParallelismValidation` and fails if the requested number of PostgreSQL sessions never go active simultaneously. You can rerun it directly with:
  ```bash
  pnpm vitest --config benchmarks/ztd-bench-vs-raw/vitest.config.ts run benchmarks/ztd-bench-vs-raw/tests/diagnostics/traditional-parallelism.test.ts
  ```
  The test runs before the full benchmark and gives CI/local runs a quick fail-fast surface if PostgreSQL cannot open the expected number of concurrent sessions.

## AST stringify microbenchmark

- Purpose: get trustworthy μs/nanosecond measurements for the AST→SQL stringify step so the team can decide whether further optimization is needed.
- Run the dedicated script (it parses the real repository SQL, warms up the formatter, and loops `SqlFormatter.format()` repeatedly):
  ```bash
  pnpm ts-node benchmarks/ztd-bench-vs-raw/stringify-only-benchmark.ts
  ```
- Environment knobs:
  - `STRINGIFY_ITERATIONS` controls how many measured iterations run (default `100000`).
  - `STRINGIFY_WARMUP` controls the warmup iterations before timing (default `10000`).
- Output: for each repository SQL the script prints total iteration count, total elapsed time (μs/ns), and average per-stringify time. Use these numbers to decide if μs-level stability is adequate or more optimization is warranted.
