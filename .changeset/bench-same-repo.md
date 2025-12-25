---
"@rawsql-ts/ztd-cli": patch
---

## Benchmark comparison refresh

- Traditional and ZTD now execute the same repository implementation, but Traditional still runs migration/seed/cleanup around each call while ZTD rewrites that query into fixtures.
- The benchmark outputs now surface the total SQL count and DB execution time for both workflows, along with the rewrite and fixture timing that explains why ZTD issues fewer statements.
