# Test Guidance

- Tests under `packages/ztd-cli/templates/tests/**/*.test.ts` MUST verify rewrite execution, mapping and validation paths, and DTO-shape behavior when the feature depends on ZTD-managed SQL assets.
- For ZTD-managed SQL assets, a passing-path test should exercise the real DB-backed ZTD execution path; a mock executor alone is not sufficient for the success case.
- Feature-boundary tests are mock-based and live at `src/features/<feature>/tests/<feature>.boundary.test.ts`.
- Query-boundary tests are the ZTD lane and live under `src/features/<feature>/queries/<query>/tests/` with generated analysis and persistent cases colocated per query.
- For new feature work, prefer `ztd feature tests scaffold --feature <feature-name>` to refresh `src/features/<feature>/queries/<query>/tests/generated/TEST_PLAN.md` and `analysis.json`, create the thin `src/features/<feature>/queries/<query>/tests/<query>.boundary.ztd.test.ts` Vitest entrypoint when missing, and keep AI-authored cases under `src/features/<feature>/queries/<query>/tests/cases/`.
- The fixed app-level ZTD runner lives in `tests/support/ztd/harness.ts`; query-local cases and the thin Vitest entrypoint should call into that runner instead of inventing per-query support helpers.
- Keep tests close to the feature they verify when possible.
- Regenerate DDL-derived artifacts before diagnosing missing generated modules.
- Prefer normal `vitest` verification after feature changes.
- Keep repository contracts honest: say whether tests were updated, whether they passed, and what remains unverified.

Use feature-local tests as the first verification surface before adding broader suites.
