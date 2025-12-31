---
"@rawsql-ts/sql-unit-test-bench": patch
---

Benchmark connection profiles

- The customer summary benchmark now records both `perTest` (exclusive) and `shared` connection profiles so the report highlights connection overhead separately from fixture/query work.
- ZTD runs set `dangerousSqlPolicy=off` to keep the bench focused on timing rather than log noise.
- The benchmark and Vitest customer summary tests now share the same scenario helper so both suites exercise the identical repository path, and the new logger captures the actual SQL emitted during each run for the report.
