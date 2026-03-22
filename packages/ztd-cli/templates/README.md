# Zero Table Dependency Project

This scaffold starts from `ztd init --starter`.

The starter keeps the first run simple:

- `src/features/smoke` for the first green path
- `ztd/ddl/demo.sql` for the starter DDL
- visible `AGENTS.md` guidance
- a Postgres compose path for `ZTD_TEST_DATABASE_URL`
- Vitest-ready smoke tests
- `@rawsql-ts/testkit-core` so `npx ztd ztd-config` works in a fresh standalone project

Start Postgres with `docker compose up -d`, export `ZTD_TEST_DATABASE_URL=postgres://ztd:ztd@localhost:5432/ztd`, then run `npx vitest run`.
If `5432` is already in use, stop the conflicting process or run Postgres on another local port and update `ZTD_TEST_DATABASE_URL` before you run Vitest, for example:

```bash
docker run -d --rm --name ztd-starter-pg -e POSTGRES_USER=ztd -e POSTGRES_PASSWORD=ztd -e POSTGRES_DB=ztd -p 5433:5432 postgres:18
export ZTD_TEST_DATABASE_URL=postgres://ztd:ztd@localhost:5433/ztd
npx vitest run
```

If you generated the starter with `pnpm install`, keep using pnpm for extra packages:

```bash
pnpm add -D @rawsql-ts/adapter-node-pg
npx ztd model-gen --probe-mode ztd --sql-root src/features/users/persistence src/features/users/persistence/users.sql --out src/features/users/persistence/users.spec.ts
```

src/catalog may still exist as internal support, but it is not the user-facing standard location.

For DDL, SQL, DTO, and migration repair loops, read the tutorial and dogfooding docs under `docs/`.

## Getting Started with AI

Use this short prompt:

```text
I want to build a feature-first application with @rawsql-ts/ztd-cli.
Use ztd init --starter.
Start from src/features/smoke and add a users feature next.
Keep handwritten SQL, spec, and tests inside src/features/<feature>.
Do not apply migrations automatically.
```

Add `--with-dogfooding` if you want `PROMPT_DOGFOOD.md` for prompt review.

The starter path is successful when:

- `smoke` passes first
- `users` is the next feature to add
- SQL, specs, and tests stay feature-local
- the same vocabulary appears in the README, AGENTS files, and tutorial docs

If you need the deeper change scenarios, read the tutorial and dogfooding docs under `docs/`.
