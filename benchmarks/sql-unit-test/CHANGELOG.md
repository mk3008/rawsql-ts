# @rawsql-ts/sql-unit-test-bench

## 0.0.1

### Patch Changes

- [#348](https://github.com/mk3008/rawsql-ts/pull/348) [`39de01d`](https://github.com/mk3008/rawsql-ts/commit/39de01d82a6f0f85e3474caf390788cd511ded61) Thanks [@mk3008](https://github.com/mk3008)! - The customer summary benchmark now collects every SQL statement (setup DDL, seed, repository query, cleanup, and rewritten SQL) into `tmp/customer-summary-stage-costs.jsonl`, and the report/measurements focus on the total time to finish each configured test count rather than per-test averages.

- [#348](https://github.com/mk3008/rawsql-ts/pull/348) [`39de01d`](https://github.com/mk3008/rawsql-ts/commit/39de01d82a6f0f85e3474caf390788cd511ded61) Thanks [@mk3008](https://github.com/mk3008)! - Benchmark connection profiles
  - The customer summary benchmark now records both `perTest` (exclusive) and `shared` connection profiles so the report highlights connection overhead separately from fixture/query work.
  - ZTD runs set `dangerousSqlPolicy=off` to keep the bench focused on timing rather than log noise.
  - The benchmark and Vitest customer summary tests now share the same scenario helper so both suites exercise the identical repository path, and the new logger captures the actual SQL emitted during each run for the report.
