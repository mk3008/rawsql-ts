# Benchmark Report Guidance

Same-conditions comparison is the primary deliverable of this document. Every measurement in the main section keeps PostgreSQL concurrency, resource assignment, and Vitest worker counts identical for both Traditional and ZTD before any secondary narrative is introduced. Best-practice configurations are recorded afterward purely as a reference to show how each workflow might be chosen in production once fairness has been demonstrated. Transparency is paramount; consumers should see the constraints, duplicate workloads, and even slower numbers that result from enforcing symmetric DB models.

## Purpose
- Make the same-conditions comparison the foundation of the report, then follow up with best-practice contrasts that explicitly acknowledge their different goals.
- Ensure every approach is described under identical CPU and PostgreSQL conditions in the primary section so readers cannot claim the comparison cheated by using different environments.
- Keep openness high by publishing the pg_stat_activity evidence, SQL work logs, and runner/worker cost splits for each case, including notes when values are intentionally held back until the matching run exists.

## Same-conditions comparison (primary result)
### Case 1 - DB parallel for both Traditional and ZTD
1. Run Traditional in its existing parallel mode (per-worker connections) and capture mean/std dev per suite size (30 / 60 / 120 / 240) with Vitest workers fixed at 4 and 8.
2. Run ZTD with `ZTD_DB_CONCURRENCY=perWorker` so each worker has its own backend while matching the same suite sizes and workers.
3. Report a table with columns: Suite, Method, Workers, Mean, StdDev, ms/test, Max active PostgreSQL sessions (per `SessionSampler`).
4. Annotate the 240-test / 8-worker row with pg_stat_activity evidence to prove `max_active >= 0.7 * workers` for both approaches.
5. Keep this case isolated from other configurations; do not mix serial or best-practice results into the table, and clearly mark any planned measurements that are still pending so readers know why entries are absent.

### Case 2 - DB serial for both Traditional and ZTD
1. Keep Vitest running across 4/8 workers but serialize PostgreSQL access for both workflows.
   - ZTD runs with `ZTD_DB_CONCURRENCY=single` so all DB work reuses one backend.
   - Traditional acquires `TRADITIONAL_DB_SERIAL_LOCK=1` (a global advisory lock) before executing migrations/queries so only one backend touches the database at a time.
2. Use the same table structure as Case 1 and call out the recorded max active sessions, proving they never exceed two when the database is forced to run serially.
3. Reserve this case for serial measurements only; do not reuse parallel numbers here, and document any pending Traditional serial measurements so the symmetry is still enforced.

## Best-practice comparison (secondary reference)
- After the same-conditions comparison proves fairness, briefly compare each approach under the configuration that would be chosen in production.
- ZTD's recommended configuration stays single-session for stability and reproducibility, while Traditional's best throughput mode uses DB parallelism with schema isolation.
- This section is explicitly secondary; it exists to show how the two workflows behave once the baseline fairness is already public.
- Remind readers that slower numbers in the primary section are acceptable because they reflect enforced fairness, not manipulation.

## PostgreSQL concurrency evidence
- The concurrency monitor emits `tmp/bench/pg-concurrency.json` and `tmp/bench/pg-concurrency.md` for every benchmark run.
- Document:
  - Polling interval (default 500 ms).
  - Max concurrent sessions and max active sessions from `pg_stat_activity`.
  - Wait-event distribution and `application_name` breakdown (every worker, sampler, and helper that touches the DB).
  - A timeline sample (last five polls) so readers can see the progression of total/active sessions.

## DB work transparency
- Traditional SQL sequences belong under `tmp/bench/traditional-sql/<case>.sql` so migrations, seeds, queries, and cleanup statements remain inspectable.
- ZTD rewrites land under `tmp/bench/ztd-sql/` when `ZTD_BENCH_SQL_LOG_PREFIX` is enabled; cite those logs in the report to allow comparison of SQL profiles.
- Each measured run emits aggregated metrics (`sqlCount`, `totalDbMs`, `rewriteMs`, `fixtureMs`, `otherProcessingMs`) to `tmp/bench/<scenario>-*.json`; describe those files and their schema when explaining the numbers.

## Runner & worker costs
- Runner-only overhead runs (`ztd-runner`, `traditional-runner`) isolate `pnpm` + `Vitest` startup, so display their startup/execution splits separately from variable cost.
- Worker-level waits (`acquireClient`, `migration`, `releaseClient`) surface in the benchmark logger; note the 95th percentiles to highlight how busy workloads behave.
- Variable cost tables focus on the work that scales with suite size; keep the same formatting as the best-practice tables to make comparisons easier.

## Reproduction notes
```bash
pnpm ztd:bench               # single-session baseline
pnpm ztd:bench:perworker     # per-worker concurrency
TRADITIONAL_DB_SERIAL_LOCK=1 pnpm ztd:bench:perworker  # run the serial Traditional comparison while still measuring 4/8 workers
```
Use the sampled `pg_stat_activity` logs (`tmp/bench/pg-concurrency.*`) alongside the SQL artifacts to verify the tables above.
