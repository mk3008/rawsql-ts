# Zero Table Dependency Project

This scaffold starts from `ztd init`.

The project is feature-first by default:

- keep SQL, specs, and tests close to each feature
- use `@rawsql-ts/sql-contract` for QuerySpec contracts
- `@rawsql-ts/testkit-core` so `npx ztd ztd-config` works in a fresh standalone project

Generate the starter flow with `ztd init --starter` when you want the removable `src/features/smoke/` sample feature, a named-parameter SQL example, and the bundled Postgres compose path.

Use feature-local tests as the default shape:

```bash
npx vitest run src/features/**/*.test.ts
```

When you add SQL-backed tests, start Postgres, export `ZTD_TEST_DATABASE_URL`, and then run the corresponding Vitest suites.
If `5432` is already in use, stop the conflicting process or run Postgres on another local port and update `ZTD_TEST_DATABASE_URL` before you run those suites, for example:

```bash
docker run -d --rm --name ztd-starter-pg -e POSTGRES_USER=ztd -e POSTGRES_PASSWORD=ztd -e POSTGRES_DB=ztd -p 5433:5432 postgres:18
export ZTD_TEST_DATABASE_URL=postgres://ztd:ztd@localhost:5433/ztd
npx vitest run
```

src/catalog may still exist as internal support, but it is not the user-facing standard location.

For DDL, SQL, DTO, and migration repair loops, read the tutorial and dogfooding docs under `docs/`.

## Getting Started with AI

Use this short prompt:

```text
I want to build a feature-first application with @rawsql-ts/ztd-cli.
Choose ztd init or ztd init --starter based on whether I want the removable starter sample.
Add a users feature next.
Keep handwritten SQL, spec, and tests inside src/features/<feature>.
Do not apply migrations automatically.
```

Add `--with-dogfooding` if you want `PROMPT_DOGFOOD.md` for prompt review.

The feature-first path is successful when:

- `users` is the next feature to add
- SQL, specs, and tests stay feature-local
- the same vocabulary appears in the README, AGENTS files, and tutorial docs

If you need the deeper change scenarios, read the tutorial and dogfooding docs under `docs/`.
