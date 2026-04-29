---
"@rawsql-ts/ztd-cli": patch
---

Clarify ZTD constraint coverage in generated query-boundary scaffolds.

`ztd feature tests scaffold` now records constraint-boundary guidance in generated test plans, analysis JSON, and JSON command output. When DDL for the affected tables contains PostgreSQL constraints that the ZTD fixture/CTE lane does not fully enforce, the scaffold emits TODO guidance that points users to traditional physical DB coverage for DB-enforced failure behavior.
