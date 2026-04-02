---
"@rawsql-ts/sql-grep-core": patch
"@rawsql-ts/ztd-cli": patch
---

Fix two dogfooded workflow gaps in the current starter/tutorial path.

`ztd query uses` now discovers scaffolded feature-local `queryspec.ts` files that load SQL through `loadSqlResource(...)`, so DDL repair and usage search work against the generated VSA layout instead of reporting that no QuerySpec entries were found.

`ztd model-gen --probe-mode ztd` now handles starter-style `INSERT ... RETURNING` scaffolds more reliably by deriving RETURNING column types from the loaded DDL metadata when direct probing cannot resolve them, and it also reads starter `.env` settings to find the ZTD-owned test database without requiring a manually exported `ZTD_TEST_DATABASE_URL`.
