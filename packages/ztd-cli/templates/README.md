# Zero Table Dependency Project

This scaffold starts from `ztd init --starter`.

The starter keeps the first run simple:

- `src/features/smoke` for the first green path
- `ztd/ddl/demo.sql` for the starter DDL
- visible `AGENTS.md` guidance
- a Postgres compose path for `ZTD_TEST_DATABASE_URL`
- Vitest-ready smoke tests

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
