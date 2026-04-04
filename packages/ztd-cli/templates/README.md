# Zero Table Dependency Project

This scaffold starts from `ztd init`.

The project is feature-first by default:

- keep SQL, specs, and tests close to each feature
- use `@rawsql-ts/sql-contract` for QuerySpec contracts
- `@rawsql-ts/testkit-core` so `npx ztd ztd-config` works in a fresh standalone project and writes the generated runtime manifest to `.ztd/generated/ztd-fixture-manifest.generated.ts` with `tableDefinitions` schema metadata only

Generate the starter flow with `ztd init --starter` when you want the removable `src/features/smoke/` sample feature, a named-parameter SQL example, and the bundled Postgres compose path.

If you need the repository telemetry seam that comes with the starter, use [Repository Telemetry Setup](../../../docs/guide/repository-telemetry-setup.md) for the edit points, logging examples, and queryId-based flow.

Use feature-local tests as the default shape:

```bash
npx vitest run src/features/**/*.test.ts
```

When you add SQL-backed tests, copy `.env.example` to `.env`, update `ZTD_DB_PORT` if needed, start Postgres, and then run the corresponding Vitest suites.
Make sure Docker Desktop or another Docker daemon is already running before you start the compose path, because `docker compose up -d` only launches the stack.
The generated Vitest setup derives `ZTD_TEST_DATABASE_URL` from `.env`, so the test runtime sees the same port setting as the compose file.
If `5432` is already in use, change `ZTD_DB_PORT` in `.env` before you run those suites, for example:

```bash
cp .env.example .env
# edit ZTD_DB_PORT=5433 if needed
docker compose up -d
npx vitest run
```

The generated runtime manifest is the preferred input for `@rawsql-ts/testkit-postgres`; raw DDL directories remain a fallback for legacy layouts. The generated contract itself is schema metadata only (`tableDefinitions`), so test rows stay explicit.
The removable starter smoke test shows the DB-backed path through `createStarterPostgresTestkitClient`, so the starter can fail fast when setup is incomplete.
If you add a second DB-backed feature, reuse `.ztd/support/postgres-testkit.ts` for the pool, config defaults, and cleanup, then keep each queryspec's fixtures next to the test that needs them.
The starter keeps `ztdRootDir`, `ddlDir`, `defaultSchema`, and `searchPath` in `ztd.config.json`. The helper reads the project defaults from one place instead of repeating them in every DB-backed test.

src/catalog may still exist as internal support, but it is not the user-facing standard location.

For `queryId`-based investigation, read [Repository Telemetry Setup](../../../docs/guide/repository-telemetry-setup.md).
For reverse lookup from observed SQL, read [Observed SQL Investigation](../../../docs/guide/observed-sql-investigation.md).

## Getting Started with AI

Use this short prompt:
Choose `ztd init` or `ztd init --starter` based on whether I want the removable starter sample.

```text
I want to build a feature-first application with @rawsql-ts/ztd-cli.
Start from `src/features/smoke` and add the next feature.
Use `src/features/smoke/tests/smoke.queryspec.test.ts` as the pattern for the first real DB-backed ZTD test.
Keep handwritten SQL, QuerySpec, repository code, and tests inside `src/features/<feature-name>`.
Treat the QuerySpec and its ZTD-backed test as one completion unit; do not stop at a property-only check.
Keep entryspec tests mock-based in `src/features/<feature-name>/tests/<feature-name>.entryspec.test.ts`.
Make sure the queryspec result executes through the DB-backed ZTD path and checks mapping and validation, not just property values.
Do not put returned columns into the input fixture; assert them only after the DB-backed result returns.
If the returned result is `null`, stop and fix the scaffold or DDL instead of weakening the success-path schema or seeding fake rows.
Before writing the success-path assertion, inspect the current SQL and QuerySpec. If the scaffold does not actually return the expected result shape, report that mismatch instead of inventing fixture data or schema overrides.
After the SQL and DTO edits settle, run `ztd feature tests scaffold --feature <feature-name>` to refresh `tests/generated/TEST_PLAN.md` and `analysis.json`, create the thin `tests/<query-name>.queryspec.ztd.test.ts` Vitest entrypoint if it is missing, and keep `tests/cases/` as human/AI-owned persistent cases around the fixed app-level ZTD runner. `generated/*` is CLI owned and refreshable, while the thin entrypoint is kept. If `ztd-config` has already run, use `.ztd/generated/ztd-fixture-manifest.generated.ts` as the source for `tableDefinitions` and any fixture-shape hints the case needs. `beforeDb` and `afterDb` are pure fixture skeletons with schema-qualified table keys. `afterDb` compares rows by subset match after normalizing object key order, while row order itself is ignored. When the cases are ready, run `npx vitest run src/features/<feature-name>/<query-name>/tests/<query-name>.queryspec.ztd.test.ts` to execute the ZTD query test.
Read the nearest AGENTS.md files first.
Do not apply migrations automatically.
```

Add `--with-dogfooding` if you want `PROMPT_DOGFOOD.md` for prompt review.

The feature-first path is successful when:

- `users` is the next feature to add
- SQL, specs, and tests stay feature-local
- the same vocabulary appears in the README, AGENTS files, and tutorial docs

If you need the deeper change scenarios, read the tutorial and dogfooding docs under `docs/`.
