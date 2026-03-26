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
| DDL repair | `npx ztd query uses column users.email --specs-dir src/features/users/persistence --any-schema --view detail` | Find the impacted feature-local SQL files before editing them |
| SQL repair | `npx ztd model-gen --probe-mode ztd src/features/users/persistence/users.sql --out src/features/users/persistence/users.spec.ts` | Regenerate the spec from the feature-local SQL asset |
| DTO repair | `npx vitest run` after the DTO change | Verify the feature-local runtime and tests after the shape change |
| migration | `npx ztd ztd-config`, optionally `npx ztd ddl pull --url <target-db-url>` to inspect the target, then `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` to prepare review output plus apply SQL | Prepare a manually applied migration without asking ztd-cli to deploy it |
| tuning | `npx ztd query plan <sql-file>` and the perf guide under `docs/guide/` | Keep perf work in the separate tuning path, not in the starter tutorial |

`ZTD_TEST_DATABASE_URL` is the only implicit database owned by ztd-cli. Use `--url` or a complete `--db-*` flag set for `ddl pull` and `ddl diff` when you want to inspect any other target.

## 1. Create the starter project

Run:

```bash
npx ztd init --starter
```

The starter generates:

- `src/features/smoke`
- `ztd/ddl/demo.sql`
- `compose.yaml`
- visible `AGENTS.md` guidance
- Vitest smoke tests

The smallest DB-backed starter example lives in `src/features/smoke/tests/smoke.queryspec.test.ts`.
It uses `@rawsql-ts/testkit-postgres` and `createPostgresTestkitClient`, so a missing `ZTD_TEST_DATABASE_URL`, a stopped Postgres container, or a schema mismatch fails before you build a larger feature.
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

The starter setup derives `ZTD_TEST_DATABASE_URL` from `.env`, so changing `ZTD_DB_PORT` changes both the compose port and the test runtime.

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

The smoke test proves the starter wiring is sound before you add real feature work.
It also proves the DB-backed ZTD path is reachable from the starter, not just the DB-free sample path.

If the project was installed with `pnpm install`, keep using pnpm when you add the database adapter for the SQL repair loop:

```bash
pnpm add -D @rawsql-ts/adapter-node-pg
```

Avoid mixing `npm install -D` into a pnpm-managed starter project because that can fail before the adapter is added.

## 3. Add the first real feature

Use `src/features/smoke` as the teaching example and add `src/features/users` as the first real feature.

Keep the feature local:

- `src/features/users/domain`
- `src/features/users/application`
- `src/features/users/persistence`
- `src/features/users/tests`

The feature should own its SQL, spec, and tests instead of reaching for `src/catalog` as the starting place.

## 4. Run the CRUD scenario

Use the prompt from `packages/ztd-cli/README.md` or `PROMPT_DOGFOOD.md`:

This prompt is meant to be copied into another AI instance so we can observe whether the scaffold and AGENTS guidance are enough on their own.

```text
Add a users feature to this feature-first project.
Read the nearest AGENTS.md files first.
Keep handwritten SQL, specs, and tests inside src/features/users.
Do not apply migrations automatically.
```

Expected result:

- the agent edits the `users` feature only
- the agent keeps SQL, spec, and tests feature-local
- the next command is a normal project test run

## 5. Run the DDL / SQL / DTO change scenarios

Use the same `users` project for each scenario:

- change the DDL and let the agent repair the failures
- change the SQL and let the agent repair the failures
- change the DTO shape and let the agent repair the failures

Each scenario should end with `vitest` passing again.

For DDL repair, run `npx ztd query uses column users.email --specs-dir src/features/users/persistence --any-schema --view detail` first so the impacted SQL files come from the CLI, not from guesswork. Passing the feature folder as `--specs-dir` is a normal way to narrow the project-wide scan, not a workaround for feature-local layouts.

For SQL repair, keep the SQL assets under the feature folder, keep the query on the starter DDL's `users` table, and rerun `model-gen` against the feature-local SQL file directly. In VSA layouts, `model-gen` now treats the SQL file location as the primary contract source, so `--sql-root` is only needed for older shared-root layouts.

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

1. Edit the DDL in `ztd/ddl/demo.sql` or the relevant schema file.
2. Run `npx ztd ztd-config` to refresh the ZTD-generated artifacts, including `tests/generated/ztd-fixture-manifest.generated.ts` for runtime schema metadata (`tableDefinitions` only).
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
