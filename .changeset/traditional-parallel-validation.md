---
"@rawsql-ts/ztd-cli": patch
---

## Traditional parallelism validation

- Traditional parallel benchmarks now validate that they can open the requested number of concurrent PostgreSQL sessions and fail when a misconfiguration prevents concurrency.
- Worker-scoped benchmark clients require explicit `workerId`s so each parallel worker keeps its own session and cannot be serialized by token reuse.
- A new Vitest smoke test simulates a concurrent `pg_sleep` workload and guards future runs against regressions before the full benchmark executes.
