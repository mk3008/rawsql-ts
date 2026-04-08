---
title: Starter First-End Tutorial
outline: deep
---

# Starter First-End Tutorial

This tutorial shows the shortest path from `ztd init --starter` to a small `users` feature that can be changed, broken, and repaired with AI help.

The tutorial uses one starter project, one `smoke` feature, and one `users` feature. The same project is reused for every scenario:

1. first run
2. CRUD feature creation
3. DDL change
4. SQL change
5. DTO change
6. migration artifact creation

README gives the first-run copy-paste path. This tutorial gives the scenario-level flow and the preferred CLI for each repair loop.

## Scenario CLI at a glance

| Scenario | Primary CLI | Why |
| --- | --- | --- |
| DDL repair | `npx ztd query uses column users.email --specs-dir src/features/users-insert --any-schema --view detail` | Find the impacted feature-local SQL files before editing them |
| SQL repair | `npx ztd model-gen --probe-mode ztd src/features/users-insert/queries/insert-users/insert-users.sql` | Inspect the generated contract for the SQL asset before updating the handwritten query boundary |
| DTO repair | `npx vitest run` after the DTO change | Verify the feature-local runtime and tests after the shape change |
| migration | `npx ztd ztd-config`, optionally `npx ztd ddl pull --url <target-db-url>` to inspect the target, then `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` to prepare review output plus apply SQL | Prepare a manually applied migration without asking ztd-cli to deploy it |
| tuning | `npx ztd query plan <sql-file>` and the perf guide under `docs/guide/` | Keep perf work in the separate tuning path, not in the starter tutorial |

`ZTD_DB_URL` is the only implicit database owned by ztd-cli. Use `--url` or a complete `--db-*` flag set for `ddl pull` and `ddl diff` when you want to inspect any other target.

## 1. Create the starter project

Run:

```bash
npx ztd init --starter
# Optional: install the customer-facing Codex bootstrap for the AI-guided path
npx ztd agents init
```

The starter generates:

- `src/features/smoke`
- `db/ddl/public.sql`
- `compose.yaml`
- optional customer-facing Codex bootstrap (installed by `npx ztd agents init`)
- Vitest smoke tests

Run `npx ztd agents init` immediately after scaffold creation when you want the customer-facing Codex bootstrap for the AI-guided path.
That opt-in bootstrap adds visible `AGENTS.md`, `db/AGENTS.md`, `db/ddl/AGENTS.md`, `src/AGENTS.md`, `src/features/AGENTS.md`, `.codex/config.toml`, and `.codex/agents/*`.

The smallest DB-backed starter example lives in `src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts`.
 It uses `@rawsql-ts/testkit-postgres` and `createPostgresTestkitClient`, so a missing `ZTD_DB_URL`, a stopped Postgres container, or a schema mismatch fails before you build a larger feature.
If you want the fixture-loading details, read `packages/testkit-postgres/README.md` after the starter smoke test.

## 2. Start Postgres and run the smoke test

Use the bundled compose file:

Make sure Docker Desktop or another Docker daemon is already running before you start the compose path, because `docker compose up -d` only launches the stack.

```bash
cp .env.example .env
# edit ZTD_DB_PORT=5433 if needed
docker compose up -d
npx vitest run
```

The starter setup derives `ZTD_DB_URL` from `.env`, so changing `ZTD_DB_PORT` changes both the compose port and the test runtime.

If port `5432` is already in use, update `ZTD_DB_PORT` in `.env` before you rerun the compose path, for example:

```bash
cp .env.example .env
# edit ZTD_DB_PORT=5433
docker compose up -d
npx vitest run
```

If you are using PowerShell, the same `.env` file works:

```powershell
Copy-Item .env.example .env
# edit ZTD_DB_PORT=5433
docker compose up -d
npx vitest run
```

If `docker compose up -d` fails with `all predefined address pools have been fully subnetted`, do not treat it as a port-collision problem. That error means Docker cannot allocate another bridge network, so changing `ZTD_DB_PORT` will not help. Clean up unused Docker networks or widen Docker's address-pool configuration first, then rerun the compose path.

The smoke test proves the starter wiring is sound before you add real feature work.
It also proves the DB-backed ZTD path is reachable from the starter, not just the DB-free sample path.

If the project was installed with `pnpm install`, keep using pnpm when you add the database adapter for the SQL repair loop:

```bash
pnpm add -D @rawsql-ts/adapter-node-pg
```

Avoid mixing `npm install -D` into a pnpm-managed starter project because that can fail before the adapter is added.

## 3. Add the first real feature

Use `src/features/smoke` as the starter-only teaching example, but scaffold the first real CRUD slice with the CLI:

```bash
npx ztd feature scaffold --table users --action insert
```

That v1 scaffold fixes the initial layout to the recursive boundary rule:

- `src/features/users-insert/boundary.ts`
- `src/features/users-insert/tests/users-insert.boundary.test.ts`
- `src/features/users-insert/queries/insert-users/boundary.ts`
- `src/features/users-insert/queries/insert-users/insert-users.sql`
- `src/features/users-insert/queries/insert-users/tests/generated/`
- `src/features/users-insert/queries/insert-users/tests/cases/`
- `src/features/users-insert/README.md`

Each folder is a boundary, each `boundary.ts` is that boundary's public surface, and each boundary keeps its own `tests/` group nearby.

The feature scaffold creates the boundary files, SQL file, feature-root boundary test, and the query-local `tests/generated/` plus `tests/cases/` directories.

After you finish the SQL and DTO edits, run `npx ztd feature tests scaffold --feature users-insert`.
That command refreshes `src/features/users-insert/queries/insert-users/tests/generated/TEST_PLAN.md` and `analysis.json`, refreshes `src/features/users-insert/queries/insert-users/tests/boundary-ztd-types.ts`, and creates the thin `src/features/users-insert/queries/insert-users/tests/insert-users.boundary.ztd.test.ts` Vitest entrypoint only if it is missing.
Persistent case files under `src/features/users-insert/queries/insert-users/tests/cases/` stay human/AI-owned and are not overwritten.

Treat `tests/support/ztd/` as starter-owned shared support and read-only for feature-specific work.
If `ztd-config` has already run, use `.ztd/generated/ztd-fixture-manifest.generated.ts` as the source for `tableDefinitions` and any fixture-shape hints when you fill the case files.
`beforeDb` and `afterDb` are schema-qualified pure fixture skeletons.
AI-authored cases belong in `src/features/users-insert/queries/insert-users/tests/cases/`, while the fixed app-level runner stays in `tests/support/ztd/harness.ts`.
Keep the feature-root `src/features/users-insert/tests/users-insert.boundary.test.ts` for mock-based boundary tests.
`afterDb` is subset-based per row, rows are treated as an unordered multiset, row order is ignored, and the verifier truncates tables named in `beforeDb` with `restart identity cascade` before seeding.
When the cases are ready, run `npx vitest run src/features/users-insert/queries/insert-users/tests/insert-users.boundary.ztd.test.ts` to execute the ZTD query test.

## 4. Run the CRUD scenario

Use the prompt from `packages/ztd-cli/README.md` or `PROMPT_DOGFOOD.md`:

This prompt is meant to be copied into another AI instance so we can observe whether the scaffold and AGENTS guidance are enough on their own.

```text
Add a users insert feature to this feature-first project.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.ztd/agents/*` if present.
Start with `npx ztd feature scaffold --table users --action insert`.
Keep `boundary.ts`, the query-local `boundary.ts`, and the query-local SQL resource inside `src/features/users-insert`.
Before you edit DTOs or write persistent query cases, run `npx ztd feature tests scaffold --feature users-insert`. That command refreshes `src/features/users-insert/queries/insert-users/tests/generated/TEST_PLAN.md` and `analysis.json`, refreshes `src/features/users-insert/queries/insert-users/tests/boundary-ztd-types.ts`, and creates the thin `src/features/users-insert/queries/insert-users/tests/insert-users.boundary.ztd.test.ts` Vitest entrypoint only if it is missing. Persistent case files under `src/features/users-insert/queries/insert-users/tests/cases/` stay human/AI-owned and are not overwritten. If `ztd-config` has already run, use `.ztd/generated/ztd-fixture-manifest.generated.ts` as the source for `tableDefinitions` and any fixture-shape hints when you fill the case files. The validation cases may stay at the feature boundary, but the success case must execute through the fixed app-level ZTD runner and verify the returned result. Do not put returned columns into the input fixture. Read `TEST_PLAN.md` and `analysis.json` before filling the persistent case files under `src/features/users-insert/queries/insert-users/tests/cases/`. `afterDb` is subset-based per row, rows are treated as an unordered multiset, row order is ignored, and the verifier truncates tables named in `beforeDb` with `restart identity cascade` before seeding. After the cases are ready, run `npx vitest run src/features/users-insert/queries/insert-users/tests/insert-users.boundary.ztd.test.ts` to execute the ZTD feature test.
If the returned id is null, stop and fix the scaffold or DDL instead of weakening the test.
Before writing the success-path assertion, inspect `insert-users.sql` and `boundary.ts`. If the scaffold does not actually return a non-null id, report that mismatch instead of inventing fixture data or schema overrides.
Do not apply migrations automatically.
```

Expected result:

- the agent edits the `users-insert` feature only
- the agent keeps SQL and the feature entrypoint feature-local
- the agent adds tests only after the scaffold exists
- the next command is a normal project test run

## 5. Run the DDL / SQL / DTO change scenarios

Use the same `users` project for each scenario:

- change the DDL and let the agent repair the failures
- change the SQL and let the agent repair the failures
- change the DTO shape and let the agent repair the failures

Each scenario should end with `vitest` passing again.

For DDL repair, run `npx ztd query uses column users.email --specs-dir src/features/users-insert --any-schema --view detail` first so the impacted SQL files come from the CLI, not from guesswork. Passing the feature folder as `--specs-dir` is a normal way to narrow the project-wide scan, not a workaround for feature-local layouts.

For SQL repair, keep the SQL assets under `src/features/users-insert/queries/insert-users/`, keep the query on the starter DDL's `users` table, and rerun `model-gen` against `src/features/users-insert/queries/insert-users/insert-users.sql` directly to inspect the generated contract before you update the handwritten query boundary. Do not target `src/features/users-insert/queries/insert-users/boundary.ts` with `--out`, because that file is the runtime boundary that also owns `loadSqlResource` and the execution flow. In VSA layouts, `model-gen` now treats the SQL file location as the primary contract source, so `--sql-root` is only needed for older shared-root layouts.

For migration work, use an explicit `--url <target-db-url>` with `ddl pull` or `ddl diff` so the target database is never inferred from the starter test database by accident.

Read the review summary first:

- the summary tells you what changed logically
- the risks section lists destructive and operational apply-plan risks separately
- even a small summary can still carry destructive risks when the generated apply SQL rebuilds a table
- the generated `.sql` file stays SQL-only so you can review or apply it separately
- the companion `.json` file is for AI/tools that need structured migration metadata
- if you hand-edit the generated migration SQL, run `npx ztd ddl risk --file tmp/users.diff.sql` so the final SQL is re-evaluated with the same structured risk contract
- current `ztd ddl diff` CLI does not expose the lower-level drop-avoidance options from core, so treat drop-related risks as mandatory review points

Tuning belongs to the separate performance guide and dogfooding set, not to the starter lifecycle in this tutorial. Keep the starter path focused on CRUD, DDL, SQL, DTO, and migration repair loops.

## 6. Run the migration loop

When the schema change needs a deployable migration, keep the flow explicit:

Use a fresh AI prompt for this step so we can confirm the migration guidance works without human patching in the middle.

1. Edit the DDL in `db/ddl/public.sql` or the relevant schema file.
2. Run `npx ztd ztd-config` to refresh the ZTD-generated artifacts, including `.ztd/generated/ztd-fixture-manifest.generated.ts` for runtime schema metadata (`tableDefinitions` only).
3. Optionally run `npx ztd ddl pull --url <target-db-url>` to inspect the target, then run `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` when you need a migration plan.
4. Read the text summary first, inspect the generated SQL second, and apply the SQL outside `ztd-cli`.
5. Re-run `npx ztd ztd-config` and `npx vitest run` after the migration lands so the generated runtime manifest stays in sync with the schema metadata.

The fixture contract is intentionally split:

- generated `tableDefinitions` are the normal runtime path after `ztd-config`
- explicit `tableDefinitions` / `tableRows` are for local tests that want direct fixtures
- `ddl.directories` is the fallback only when no generated manifest exists

This step belongs in the tutorial because the starter path should show not only how to add a feature, but also how to evolve the schema safely without asking `ztd-cli` to own deployment.

## 7. What good looks like

After the starter flow is green, the user should be able to answer these questions without guessing:

- Where does the next feature live?
- Which files should the agent read first?
- Which command verifies the change?
- Which files stay feature-local?
- How do I prepare a migration without making `ztd-cli` deploy it for me?

If the answer is unclear, fix the scaffold, the prompt, or the AGENTS guidance before adding more tutorial content.
