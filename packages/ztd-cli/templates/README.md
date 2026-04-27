# Zero Table Dependency Project

This scaffold starts from `ztd init`.

This generated project is either:

- standalone customer-facing output that resolves published packages, or
- local-source workspace output that resolves `rawsql-ts` packages through `file:` dependencies back to a monorepo checkout

Check `package.json` to see which mode you are in. If you see `file:` dependencies that point back to a monorepo checkout, this is a local-source workspace and the monorepo checkout is the source of truth.

The project is feature-first by default:

- keep SQL, boundaries, and tests close to each feature
- use `src/features`, `src/adapters`, and `src/libraries` as the app-code roots
- keep `db/` for DDL, migration, and schema assets only
- use `@rawsql-ts/sql-contract` for query contract metadata and catalog execution
- keep feature-root boundary tests under `src/features/<feature>/tests/`
- keep CLI-owned generated assets under `src/features/<feature>/queries/<query>/tests/generated`
- keep human/AI-owned persistent cases under `src/features/<feature>/queries/<query>/tests/cases`
- keep the thin query-boundary entrypoint next to them under `src/features/<feature>/queries/<query>/tests/`
- keep starter-owned shared support under `tests/support/ztd/`
- keep tool-managed fixture metadata under `.ztd/generated/`
- `ztd.config.json` controls generated metadata and runtime defaults while the feature-local tests stay next to the feature they cover

When you add SQL-backed tests, copy `.env.example` to `.env` and adjust `ZTD_DB_PORT` if needed before running the DB-backed suites.

If `docker compose up -d` fails with `all predefined address pools have been fully subnetted`, treat that as a Docker network-pool problem rather than a `ZTD_DB_PORT` collision. In that case, recover Docker networking first; changing `ZTD_DB_PORT` alone will not fix it.

```bash
npx vitest run src/features/**/*.test.ts
```

The generated runtime manifest is the preferred input for `@rawsql-ts/testkit-postgres`; raw DDL directories remain a fallback for legacy layouts. The generated contract itself is schema metadata only (`tableDefinitions`), so test rows stay explicit.
The starter keeps `ztdRootDir`, `ddlDir`, `defaultSchema`, and `searchPath` in `ztd.config.json`. The helper reads the project defaults from one place instead of repeating them in every DB-backed test.

`src/features/<feature>/tests/` is where feature-root boundary tests live. Query-local ZTD assets live under `src/features/<feature>/queries/<query>/tests/{generated,cases}` with the thin entrypoint beside them. Starter-owned shared support lives at `tests/support/ztd/`, while `.ztd/` is the tool-managed workspace for generated metadata and support files. Keep `FeatureQueryExecutor` in `src/features/_shared/`, keep the driver-neutral `SqlClient` contract in `src/libraries/sql/sql-client.ts`, and put driver or sink bindings under `src/adapters/<tech>/`.

When an import crosses one of the canonical roots, use the root alias instead of a depth-sensitive relative path:

- `#features/*` for `src/features/*`
- `#libraries/*` for `src/libraries/*`
- `#adapters/*` for `src/adapters/*`
- `#tests/*` for `tests/*`

Keep local same-root references relative when they move with the same boundary. Use the alias when the import crosses a root boundary or points at shared support.

## Getting Started with AI

Use this short prompt:
Choose `ztd init` or `ztd init --starter` based on whether you want the removable starter sample.

```text
I want to build a feature-first application with @rawsql-ts/ztd-cli.
Treat the project structure as Architecture as a Framework.
Every boundary folder exposes only `boundary.ts`, and sub-boundaries repeat the same rule.
Keep handwritten SQL, query boundaries, repository code, and tests inside `src/features/<feature-name>`.
Treat the query boundary contract and its ZTD-backed test as one completion unit; do not stop at a property-only check.
Keep feature-boundary tests mock-based in `src/features/<feature-name>/tests/<feature-name>.boundary.test.ts`.
Keep shared feature seams in `src/features/_shared/*`, shared verification seams in `tests/support/*`, and tool-managed files in `.ztd/*`.
Keep the driver-neutral `SqlClient` contract in `src/libraries/sql/sql-client.ts`.
Put driver or sink bindings under `src/adapters/<tech>/` instead of under `db/`.
Make sure the query-boundary result executes through the DB-backed ZTD path and checks mapping and validation, not just property values.
Do not put returned columns into the input fixture; assert them only after the DB-backed result returns.
If the returned result is `null`, stop and fix the scaffold or DDL instead of weakening the success-path schema or seeding fake rows.
Before writing the success-path assertion, inspect the current SQL and query boundary. If the scaffold does not actually return the expected result shape, report that mismatch instead of inventing fixture data or schema overrides.
After the SQL and DTO edits settle, run `ztd feature tests scaffold --feature <feature-name>` to refresh `src/features/<feature-name>/queries/<query-name>/tests/generated/TEST_PLAN.md` and `analysis.json`, create the thin `src/features/<feature-name>/queries/<query-name>/tests/<query-name>.boundary.ztd.test.ts` Vitest entrypoint if it is missing, and keep `src/features/<feature-name>/queries/<query-name>/tests/cases/` as human/AI-owned persistent cases around the fixed app-level ZTD runner. `generated/*` is CLI-owned and refreshable, while the thin entrypoint is kept. If `ztd-config` has already run, use `.ztd/generated/ztd-fixture-manifest.generated.ts` as the source for `tableDefinitions` and any fixture-shape hints the case needs. `beforeDb` is a pure fixture skeleton with schema-qualified table keys. The helper returns machine-checkable evidence (`mode`, `rewriteApplied`, `physicalSetupUsed`) for each case. Enable SQL trace only when needed with `ZTD_SQL_TRACE=1` (optional `ZTD_SQL_TRACE_DIR`). `afterDb` assertions are intentionally excluded from this ZTD lane; use a traditional DB-state lane when you need post-state assertions. When the cases are ready, run `npx vitest run src/features/<feature-name>/queries/<query-name>/tests/<query-name>.boundary.ztd.test.ts` to execute the ZTD query test.

## Troubleshooting

- If a DB-backed ZTD case returns `user_id: null`, inspect the fixture manifest and rewrite path before weakening the case.
- Compare the direct database `INSERT ... RETURNING ...` result with the ZTD result to tell whether the problem is the DB, the manifest, or the rewrite path.
- If the workspace is meant to reflect a source change, verify it resolves `rawsql-ts` from the local source tree instead of a registry copy.
- Check the returned evidence in the ZTD entrypoint (`mode=ztd`, `physicalSetupUsed=false`) before debugging fixtures.
- If an AI-authored ZTD test fails, do not assume the prompt or case file is the only problem; `ztd-cli` or `rawsql-ts` can still be the source of the bug.
- A `user_id: null` symptom usually points at fixture manifest, metadata, or rewrite path trouble rather than the DB engine itself.
- When a local-source workspace should reflect a source change, verify the local `rawsql-ts` checkout is being resolved instead of a registry copy.
- Enable `ZTD_SQL_TRACE=1` only when investigating rewrite issues so normal logs stay quiet.
Read the nearest AGENTS.md files first.
Do not apply migrations automatically.
```

Add the optional prompt-review file if you want `PROMPT_DOGFOOD.md` for prompt review.

The feature-first path is successful when:

- `users` is the next feature to add
- SQL, boundary entrypoints, and tests stay feature-local
- the same vocabulary appears in the README, AGENTS files, and tutorial docs

If you need the deeper change scenarios, consult the source-repository guides when you are working from the monorepo checkout; this generated workspace may not contain `docs/`.
