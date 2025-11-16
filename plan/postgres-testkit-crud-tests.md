# Postgres Testkit CRUD Test Plan

## Context & comparison
- [DataAccessLayer 1.0](../.plan/DataAccessLayer1.0.md) and the [DataAccessLayer1.0_CUD_Migration_TaskList.md](../.plan/DataAccessLayer1.0_CUD_Migration_TaskList.md) Phase 1 CUD base sections both insist that CRUD logic be derived from the SELECT layer and that tests avoid dependency on real DB tables.
- The postgres testkit currently only exercises SELECT rewrites (see `packages/drivers/postgres-testkit/tests/postgres-driver.test.ts`) and has no coverage for INSERT/UPDATE/DELETE flows, so we lack the DB-table-independent regression safety that the new architecture mandates.

## Goal
Add coverage that satisfies both phases of the DataAccessLayer 1.0 CRUD expectations: (A) smoke tests that verify the Postgres testkit still forwards DML through the fixture-backed layer, and (B) pipeline-centric tests that exercise the SELECT-derived CUD transformations without touching real tables.

## Task list for the AI agent
### Phase A – Smoke tests (current behavior)
1. **Confirm requirements.** Re-read the two `.plan/DataAccessLayer*` documents ([DataAccessLayer 1.0](../.plan/DataAccessLayer1.0.md) and [DataAccessLayer1.0_CUD_Migration_TaskList.md](../.plan/DataAccessLayer1.0_CUD_Migration_TaskList.md)) plus the [postgres-testkit AGENTS](packages/drivers/postgres-testkit/AGENTS.md) so the new tests stay within the SQL/AST-first, fixture-driven philosophy and keep comments/documentation in English.
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

- **Completed work**
  - [x] Phase A smoke coverage now lives in `packages/drivers/postgres-testkit/tests/postgres-driver.test.ts`, where `createPostgresSelectTestDriver` proves the SELECT rewriter, `wrapPostgresDriver` rewrites INSERTs into `INSERT ... SELECT`, `CudValidationError` surfaces and `cudOptions` toggles are exercised, and UPDATE/DELETE flows (via positional params, `QueryConfig`, and `withFixtures`) remain passthrough to the recording connection.
  - [x] Phase B helper coverage in `packages/testkit-core/src/cud/helpers.ts` implements `normalizeInsertValuesToSelect`, `applyTypeCastsToSelect`, `validateInsertShape`, and `validateDtoSelectRuntime`, and the tests in `packages/testkit-core/tests/cud/helpers.test.ts` exercise VALUES normalization, parameterized inserts, column ordering, missing/extra columns, null enforcement, and CAST verification without touching a real DB.
  - [x] Phase B pipeline coverage: `packages/testkit-core/src/cud/TestkitDbAdapter.ts` rewrites INSERTs, injects casts, and runs runtime validation purely against `TableDef` snapshots, while `packages/testkit-core/tests/cud/TestkitDbAdapter.test.ts` proves the strict/fallback behaviors and option gating. `packages/testkit-core/README.md`, `packages/drivers/postgres-testkit/README.md`, and the packages' AGENTS now document the DAL1.0 CUD pipeline, TableDef schema assets, and `cudOptions` propagation so the docs match code.
  - [x] Shared AST helpers such as `packages/testkit-core/src/utils/isSelectableQuery.ts` are exercised by the Postgres wrappers and their tests, keeping SELECT detection AST-first so only the intended SQL paths hit the rewrite pipeline.

- **Outstanding verification**
  - [ ] The Docker-backed demos under `packages/drivers/postgres-testkit/demo/tests` still require a live Postgres instance, so rerunning `pnpm --filter @rawsql-ts/postgres-testkit test` in that environment remains the final manual verification before closing the loop.

## Reflection
- Migrated the driver routing logic to an AST-first approach, documented the SELECT/CUD/pass-through split, and aligned the README/AGENTS doc set with the DAL1.0 expectations so every downstream consumer understands how `cudOptions` flow through the pipelines.
- Updated the CUD helpers/README to highlight TableDef minimums, runtime DTO validation intent, passthrough behavior, and deferred DB-type CAST work without touching live schemas; the remaining open decision list still requires your guidance before we iterate further.

## Open tabs:
- helpers.test.ts: packages/testkit-core/tests/cud/helpers.test.ts
- TestkitDbAdapter.test.ts: packages/testkit-core/tests/cud/TestkitDbAdapter.test.ts
- TestkitDbAdapter.ts: packages/testkit-core/src/cud/TestkitDbAdapter.ts
- postgres-testkit-crud-tests.md: plan/postgres-testkit-crud-tests.md
