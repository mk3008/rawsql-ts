---
'@rawsql-ts/ztd-cli': patch
---

Add SQL rewrite logging to generated pg-testkit client

- Generated `tests/support/testkit-client.ts` can emit structured logs showing the SQL before and after pg-testkit rewrites it.
- Logging can be enabled via `ZTD_SQL_LOG` and can optionally include parameters via `ZTD_SQL_LOG_PARAMS`.
- Logging is resilient to non-JSON primitives (e.g. `bigint`) and circular references, so enabling it won't crash a test run.
