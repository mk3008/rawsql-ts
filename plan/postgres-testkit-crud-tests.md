# Postgres Testkit CRUD Test Plan

## Context & comparison
- DataAccessLayer 1.0 and the accompanying CUD/migration task list both insist that CRUD logic be derived from the SELECT layer and that tests avoid dependency on real DB tables (`DataAccessLayer 1.0` sections 1-4 and the “Phase 1 CUD base” sections of `DataAccessLayer1.0_CUD_Migration_TaskList.md`).
- The postgres testkit currently only exercises SELECT rewrites (see `packages/drivers/postgres-testkit/tests/postgres-driver.test.ts`) and has no coverage for INSERT/UPDATE/DELETE flows, so we lack the DB-table-independent regression safety that the new architecture mandates.

## Goal
Add coverage that satisfies both phases of the DataAccessLayer 1.0 CRUD expectations: (A) smoke tests that verify the Postgres testkit still forwards DML through the fixture-backed layer, and (B) pipeline-centric tests that exercise the SELECT-derived CUD transformations without touching real tables.

## Task list for the AI agent
### Phase A – Smoke tests (current behavior)
1. **Confirm requirements.** Re-read the two `.plan/DataAccessLayer*` documents and the postgres-testkit AGENTS to ensure the new tests stay within the SQL/AST-first, fixture-driven philosophy and keep comments/documentation in English.
2. **Inventory the current driver test helpers.** Study `createRecordingConnection` and the existing `describe('postgres select test driver')` and `describe('wrapPostgresDriver')` suites to understand how they capture executed SQL and that the current cases run only SELECT queries.
3. **Design CRUD scenarios.** Pick representative INSERT, UPDATE, and DELETE statements, covering raw SQL, param arrays, and `QueryConfig` overloads plus `withFixtures` scopes so the scenarios remain siloed to the recording connection.
4. **Extend the test suite.** Add tests to `packages/drivers/postgres-testkit/tests/postgres-driver.test.ts` that:
   - Call `createPostgresSelectTestDriver` and `wrapPostgresDriver` with the planned CRUD statements.
   - Assert the recording connection receives the original DML (no unintended rewrite) and correct params.
   - Confirm scoped fixture versions can run CRUD without actual tables.
5. **Verify best practices.** Keep inline comments only before non-trivial helper blocks, run `pnpm --filter @rawsql-ts/postgres-testkit test`, and document the new tests (still in English).

### Phase B – DataAccessLayer 1.0 CRUD pipeline tests
1. **Unit-test transformation helpers.**
   - Add Vitest cases for `normalizeInsertValuesToSelect`, covering plain VALUES, parameterized inserts, and column-reordering scenarios.
   - Test `applyTypeCastsToSelect` so SELECT payloads derived from DTOs get explicit CASTs based on `TableDef` column metadata, including error handling when columns are missing.
   - Verify `validateInsertShape` detects missing required columns, extraneous columns, and `NOT NULL` constraints when the AST/`TableDef` mismatch.
   - Cover `validateDtoSelectRuntime` (or the runtime DTO validation path) to show `FROM`-less SELECTs trigger the configured checks without needing real tables.
2. **Integration tests for TestkitDbAdapter's CUD pipeline.**
   - Feed an INSERT statement that begins with VALUES and assert it becomes an `INSERT ... SELECT` after the rewrite.
   - Confirm the rewritten SELECT has CASTs applied according to the `TableDef`.
   - Trigger validations (shape/runtime) by simulating missing data or extra columns and assert the adapter surfaces the expected errors before touching a real DB.
   - Ensure runtime DTO validation (when enabled via options) runs purely based on the `FROM`-less DTO SELECT without connecting to Postgres.
3. **Enforce table-independence.** Explicitly note in the tests that all table metadata comes from in-memory `TableDef` instances or local schema snapshots, and make it clear that schema resolution never queries `information_schema`, `pg_catalog`, ORM metadata, or any other live Postgres tables.
4. **Document the pipeline coverage.** Add or update README/test docs (in English) to call out the new DAL1.0 alignment and mention that the CRUD tests remain fixture-driven.

## Current status

- **Implemented tasks**
  - Phase A (Postgres driver CRUD smoke tests): covers INSERT/UPDATE/DELETE via `packages/drivers/postgres-testkit/tests/postgres-driver.test.ts`, proving `createPostgresSelectTestDriver`, `wrapPostgresDriver`, and scoped fixtures forward original DML.
  - Phase B helpers: `packages/testkit-core/src/cud/helpers.ts` now contains `normalizeInsertValuesToSelect`, `applyTypeCastsToSelect`, `validateInsertShape`, and `validateDtoSelectRuntime`, with corresponding tests in `packages/testkit-core/tests/cud/helpers.test.ts` covering VALUES, parameterized values, and column order.
  - Phase B pipeline: `TestkitDbAdapter` (`packages/testkit-core/src/cud/TestkitDbAdapter.ts`) plus `packages/testkit-core/tests/cud/TestkitDbAdapter.test.ts` rewrite INSERT → INSERT...SELECT, apply casts, and run shape/runtime validation solely using TableDef snapshots. The README (`packages/testkit-core/README.md`) now explains the DAL1.0 CUD pipeline, including the minimal TableDef schema (columns/dbType/nullable/default), how to generate snapshots, and how TestkitDbAdapter consumes them.
  - Shared utilities: AST-based `isSelectableQuery` lives in `testkit-core` and is reused by the Postgres driver and `wrapPostgresDriver`.
  - Driver integration documentation: Postgres/sqlite READMEs and AGENTS now describe the SELECT/CUD/other routing, `cudOptions` flag propagation, `CudValidationError` diagnostics, TableDef snapshot usage, and note that AST parsing (via `SqlParser`/`InsertQuery`) determines INSERT detection instead of regex.

- **Incomplete tasks**
 1. Docker demo tests (`demo/tests/*`) still require Postgres; rerun `pnpm --filter @rawsql-ts/postgres-testkit test` in that environment as the final verification.



- **Open decisions**
  - **Default policy for CUD validation.** Should casts and runtime validation be enabled by default, and should environments (CI vs local) be able to toggle them?
  - **Storage format for TableDef snapshots.** Should we store them as TS, JSON, or generate them automatically, and where should those artifacts live?
  - **DBMS-specific CAST strategy.** How do we map Postgres-specific types like NUMERIC, JSONB, and ENUM into the CAST pipeline safely?

- **CudValidationError exposure**
  - Should `CudValidationError` surface as structured diagnostics (kind/column/message) so callers can react programmatically, or as consolidated plain messages for humans?

## Reflection
- Migrated the driver routing logic to an AST-first approach, documented the SELECT/CUD/pass-through split, and aligned the README/AGENTS doc set with the DAL1.0 expectations so every downstream consumer understands how `cudOptions` flow through the pipelines.
- Updated the CUD helpers/README to highlight TableDef minimums, runtime DTO validation intent, passthrough behavior, and deferred DB-type CAST work without touching live schemas; the remaining open decision list still requires your guidance before we iterate further.

## Open tabs:
- helpers.test.ts: packages/testkit-core/tests/cud/helpers.test.ts
- TestkitDbAdapter.test.ts: packages/testkit-core/tests/cud/TestkitDbAdapter.test.ts
- TestkitDbAdapter.ts: packages/testkit-core/src/cud/TestkitDbAdapter.ts
- postgres-testkit-crud-tests.md: plan/postgres-testkit-crud-tests.md
