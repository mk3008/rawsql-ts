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

The [ztd-cli README](../../packages/ztd-cli/README.md) gives the first-run copy-paste path. This tutorial gives the scenario-level flow and the preferred CLI for each repair loop.

## Scenario CLI at a glance

| Scenario | Primary CLI | Why |
| --- | --- | --- |
| DDL repair | `npx ztd query uses column users.email --sql-root src/features/users/persistence --specs-dir src/features/users/persistence --any-schema --view detail` | Find the impacted feature-local SQL files before editing them |
| SQL repair | `npx ztd model-gen --probe-mode ztd --sql-root src/features/users/persistence src/features/users/persistence/users.sql --out src/features/users/persistence/users.spec.ts` | Regenerate the spec from the feature-local SQL asset |
| DTO repair | `npx vitest run` after the DTO change | Verify the feature-local runtime and tests after the shape change |
| migration | `npx ztd ztd-config`, optionally `npx ztd ddl pull --url <target-db-url>` to inspect the target, then `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` to prepare review output plus apply SQL | Prepare a manually applied migration without asking ztd-cli to deploy it |
| tuning | `npx ztd query plan <sql-file>` and the [Perf Tuning Decision Guide](./perf-tuning-decision-guide.md) | Perf investigation is a separate workflow from the starter repair loops |

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

## 2. Start Postgres and run the smoke test

Use the bundled compose file:

```bash
docker compose up -d
export ZTD_TEST_DATABASE_URL=postgres://ztd:ztd@localhost:5432/ztd
npx vitest run
```

If port `5432` is already in use, stop the conflicting process or run Postgres on another port and update `ZTD_TEST_DATABASE_URL`, for example:

```bash
docker run -d --rm --name ztd-starter-pg -e POSTGRES_USER=ztd -e POSTGRES_PASSWORD=ztd -e POSTGRES_DB=ztd -p 5433:5432 postgres:18
export ZTD_TEST_DATABASE_URL=postgres://ztd:ztd@localhost:5433/ztd
npx vitest run
```

If you are using PowerShell, keep the variable in the same shell before you run Vitest:

```powershell
$env:ZTD_TEST_DATABASE_URL = 'postgres://ztd:ztd@localhost:5433/ztd'
npx vitest run
```

The smoke test proves the starter wiring is sound before you add real feature work.

If the project was installed with `pnpm install`, keep using pnpm when you add the database adapter for the SQL repair loop:

```bash
pnpm add -D @rawsql-ts/adapter-node-pg
```

Avoid mixing `npm install -D` into a pnpm-managed starter project because that can fail before the adapter is added.

## 3. Add the first real feature

Use `src/features/smoke` as a reference and add `src/features/users` as the first real feature.

Keep the feature local:

- `src/features/users/domain`
- `src/features/users/application`
- `src/features/users/persistence`
- `src/features/users/tests`

The feature should own its SQL, spec, and tests instead of reaching for `src/catalog` as the starting place.

## 4. Run the CRUD scenario

Copy the following prompt into your AI assistant:

```text
Add a users feature to this feature-first project.
Read the nearest AGENTS.md files first.
Keep handwritten SQL, specs, and tests inside src/features/users.
Do not apply migrations automatically.
```

The same prompt is also available in `packages/ztd-cli/README.md` and `PROMPT_DOGFOOD.md`.

Expected result:

- the assistant edits the `users` feature only
- SQL, spec, and tests stay feature-local
- the next step is a normal `npx vitest run`

## 5. Run the DDL / SQL / DTO change scenarios

Use the same `users` project for each scenario:

- change the DDL and let the agent repair the failures
- change the SQL and let the agent repair the failures
- change the DTO shape and let the agent repair the failures

Each scenario should end with `vitest` passing again.

For DDL repair, run `npx ztd query uses column users.email --sql-root src/features/users/persistence --specs-dir src/features/users/persistence --any-schema --view detail` first so the impacted SQL files come from the CLI, not from guesswork.

For SQL repair, keep the SQL assets under the feature folder, keep the query on the starter DDL's `users` table, and pass that folder explicitly as `--sql-root` when you ask `model-gen` to refresh the spec.

For migration work, use an explicit `--url <target-db-url>` with `ddl pull` or `ddl diff` so the target database is never inferred from the starter test database by accident.

Tuning is covered separately in the [Perf Tuning Decision Guide](./perf-tuning-decision-guide.md).

## 6. Run the migration loop

When the schema change needs a deployable migration, keep the flow explicit:

1. Edit the DDL in `ztd/ddl/demo.sql` or the relevant schema file.
2. Run `npx ztd ztd-config` to refresh the ZTD-generated artifacts.
3. Optionally run `npx ztd ddl pull --url <target-db-url>` to inspect the target, then run `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` when you need a migration plan.
4. Read the text summary first, inspect the generated SQL second, and apply the SQL outside `ztd-cli`.
5. Re-run `npx ztd ztd-config` and `npx vitest run` after the migration lands.

When reviewing `ddl diff` output:

- the summary tells you what changed logically
- the risks section lists destructive and operational apply-plan risks separately
- even a small summary can still carry destructive risks when the generated apply SQL rebuilds a table
- the generated `.sql` file stays SQL-only so you can review or apply it separately
- the companion `.json` file is for AI/tools that need structured migration metadata
- if you hand-edit the generated migration SQL, run `npx ztd ddl risk --file tmp/users.diff.sql` so the final SQL is re-evaluated with the same structured risk contract
- current `ztd ddl diff` CLI does not expose the lower-level drop-avoidance options from core, so treat drop-related risks as mandatory review points

## 7. What good looks like

After the starter flow is green, you should be able to answer these questions without guessing:

- Where does the next feature live?
- Which files should the agent read first?
- Which command verifies the change?
- Which files stay feature-local?
- How do I prepare a migration without making `ztd-cli` deploy it for me?

If any answer is unclear, revisit the scaffold, the prompt, or the AGENTS guidance.
