# Postgres Testkit CRUD Test Plan

## Context & comparison
- DataAccessLayer 1.0 and the accompanying CUD/migration task list both insist that CRUD logic be derived from the SELECT layer and that tests avoid dependency on real DB tables (`DataAccessLayer 1.0` sections 1–4 and the “Phase 1 CUD base” sections of `DataAccessLayer1.0_CUD_Migration_TaskList.md`).
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
