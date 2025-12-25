---
"@rawsql-ts/ztd-cli": patch
---

## Benchmark concurrency diagnostics

- Traditional parallel in-process runs now report 95th percentile waiting, migration, and cleanup durations so the Markdown report surfaces where the parallel workflow spends its time.
- ZTD in-process runs capture waiting p95 plus the peak number of PostgreSQL sessions for the largest measured suite, and the report now exposes them in a dedicated “ZTD Concurrency Diagnostics” section.
- The documentation points to the new Vitest smoke test (`benchmarks/ztd-bench/tests/diagnostics/traditional-parallelism.test.ts`) so you can rerun the validation quickly before launching the full benchmark.
