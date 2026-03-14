# Migration Lifecycle Dogfooding

This guide records a practical migration dogfooding loop for `@rawsql-ts/ztd-cli` using a Docker-hosted PostgreSQL instance as the ZTD-owned test database plus an explicit target inspection workflow.

The scenario was validated on:

- Windows 11
- Node.js `v22.14.0`
- pnpm `10.19.0`
- Docker Engine `27.3.1`
- PostgreSQL image `18.1 (Debian 18.1-1.pgdg13+2)`

## Goal

Validate that the following lifecycle remains workable:

1. Scaffold a WebAPI-shaped app.
2. Keep local DDL as the source of truth.
3. Verify the ZTD-owned test database.
4. Change the DDL.
5. Regenerate ZTD artifacts.
6. Generate or prepare an explicit migration artifact.
7. Apply the migration outside `ztd-cli`.
8. Inspect the target schema again.

## What `ztd-cli` owns and what it does not

`ztd-cli` helps with:

- Scaffolding a DDL-first project layout
- Regenerating `TestRowMap` and layout files from `ztd/ddl/*.sql`
- Inspecting explicit target schema state with `ddl pull` and `ddl diff` when `pg_dump` is available on the host
- Generating migration SQL artifacts

`ztd-cli` does not own:

- Applying generated SQL to any non-ZTD target
- Choosing a migration framework
- Automatically transforming the textual DDL diff into a deploy-safe migration plan

That separation is important. In this dogfood run, migration execution stayed explicit and reviewable.

## Scenario summary

The temporary app was created with:

```bash
node packages/ztd-cli/dist/index.js init \
  --app-shape webapi \
  --workflow demo \
  --validator zod \
  --local-source-root <REPO_ROOT> \
  --yes
```

The baseline loop was:

```bash
pnpm ztd ztd-config
pnpm typecheck
pnpm test
docker run --name ztd-webapi-lifecycle-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=taskdogfood \
  -p 55433:5432 \
  -d postgres:18
Get-Content .\ztd\ddl\public.sql |
  docker exec -i ztd-webapi-lifecycle-pg psql -U postgres -d taskdogfood -v ON_ERROR_STOP=1
```

Observed result:

- `pnpm ztd ztd-config` succeeded and generated `4` ZTD rows after the schema change.
- `pnpm typecheck` succeeded before and after the application-layer change.
- `pnpm test` succeeded before and after the application-layer change.
- Applying the DDL to Docker via `psql` succeeded.

## Schema change used in the dogfood run

The second loop introduced:

- `task.description`
- `task_comment`

The deploy step stayed explicit:

```sql
alter table task
  add column if not exists description text;

create table if not exists task_comment (
  task_comment_id bigserial primary key,
  task_id         bigint not null references task(task_id),
  body            text not null,
  created_at      timestamptz not null default current_timestamp
);

create index if not exists idx_task_comment_task
  on task_comment(task_id, created_at desc);
```

Applied with:

```bash
Get-Content .\artifacts\20260313_add_task_description_and_comments.sql |
  docker exec -i ztd-webapi-lifecycle-pg psql -U postgres -d taskdogfood -v ON_ERROR_STOP=1
```

Verification used `information_schema` queries:

```bash
docker exec ztd-webapi-lifecycle-pg psql -U postgres -d taskdogfood \
  -P format=unaligned -P tuples_only=on \
  -c "select table_name || ':' || column_name
      from information_schema.columns
      where table_schema='public'
        and table_name in ('task','task_assignment','task_comment','user')
      order by table_name, ordinal_position;"
```

Observed result:

- `task.description` appeared after the deploy step.
- `task_comment` existed after the deploy step.
- The application-layer tests still passed after the schema and API shape change.

## Recommended migration loop

Use this loop when local DDL is the source of truth:

1. Edit `ztd/ddl/*.sql`.
2. Run `ztd ztd-config`.
3. Run `typecheck` and tests.
4. Prepare an explicit migration SQL file for the live environment.
5. Apply the migration with your deployment tool (`psql`, Flyway, Liquibase, etc.).
6. Verify the live schema.

This dogfood run supports the following recommendation:

- Keep `ztd-cli` inside the authoring, verification, and inspection loop.
- Keep migration execution outside `ztd-cli`, because deploy-time ordering, locking, rollback, and review policy belong to the application or platform owner.

## Observed friction

One important friction surfaced on Windows:

- `ztd ddl diff` currently expects a host-launchable `pg_dump`.
- A Docker-only `pg_dump` wrapper implemented as a `.cmd` file failed with `spawnSync ... EINVAL`.
- The lifecycle itself still worked by using `docker exec ... pg_dump` and `docker exec ... psql` directly, but `ztd ddl diff` was not end-to-end usable in that exact setup.

That means the inspection lifecycle is viable today, but Docker-only Windows users need a shell-capable `pg_dump` entrypoint.

The recommended form is now:

```bash
ztd ddl diff \
  --url postgres://postgres:postgres@localhost:5432/taskdogfood \
  --pg-dump-path "docker exec ztd-webapi-lifecycle-pg pg_dump" \
  --pg-dump-shell \
  --out artifacts/schema.diff.sql
```

The same pattern works for `ztd ddl pull`.

## Takeaway

`ztd-cli` works well as the DDL-first inner-loop tool in a migration-aware backend project.

It is strongest when used for:

- scaffold creation
- DDL-to-artifact regeneration
- contract safety
- drift-prep and schema inspection

It should not be presented as a migration executor. The successful dogfood loop was:

1. author DDL locally
2. regenerate artifacts
3. test locally
4. inspect the target deliberately
5. generate migration SQL artifacts deliberately
6. apply the migration explicitly outside `ztd-cli`
7. verify the target again
