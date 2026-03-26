# Zero Table Dependency Project

This scaffold starts from `ztd init`.

The project is feature-first by default:

- keep SQL, specs, and tests close to each feature
- use `@rawsql-ts/sql-contract` for QuerySpec contracts
- `@rawsql-ts/testkit-core` so `npx ztd ztd-config` works in a fresh standalone project and writes the generated runtime manifest to `tests/generated/ztd-fixture-manifest.generated.ts` with `tableDefinitions` schema metadata only

Generate the starter flow with `ztd init --starter` when you want the removable `src/features/smoke/` sample feature, a named-parameter SQL example, and the bundled Postgres compose path.

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
If you add a second DB-backed feature, reuse `tests/support/postgres-testkit.ts` for the pool, config defaults, and cleanup, then keep each feature's fixtures next to the test that needs them.
The starter keeps `ztdRootDir`, `ddlDir`, `defaultSchema`, and `searchPath` in `ztd.config.json`, with the same values mirrored under `ddl` for compatibility. The helper reads the project defaults from one place instead of repeating them in every DB-backed test.

src/catalog may still exist as internal support, but it is not the user-facing standard location.

## Advanced Telemetry

The starter scaffold also includes a no-op repository telemetry seam under `src/infrastructure/telemetry/`.
Use `queryId` as the stable lookup key when you are correlating runtime events, and treat `repositoryName` and `methodName` as human-readable hints that can be renamed later.
The event contract keeps `paramsShape` and `transformations` safe to export because they describe shape, not raw SQL or bind values.

`paramsShape` stays intentionally coarse:

- parameter name
- null or non-null state
- scalar or array shape
- array length bucket when the value is an array

`transformations` stays structured so future additions remain backwards-compatible:

- optional predicate pruning
- paging
- sort
- pipeline decomposition

To connect a sink, replace the default no-op export with your own adapter.

```ts
import { createConsoleRepositoryTelemetry, resolveRepositoryTelemetry } from './src/infrastructure/telemetry/repositoryTelemetry.js';

const repositoryTelemetry = resolveRepositoryTelemetry(
  createConsoleRepositoryTelemetry({
    logger: console
  })
);
```

```ts
const repositoryTelemetry = {
  emit(event) {
    logger.info({ repositoryTelemetry: event }, 'repository telemetry');
  }
};
```

```ts
const repositoryTelemetry = {
  emit(event) {
    const span = trace.getActiveSpan();
    span?.addEvent(`repository.${event.kind}`, {
      queryId: event.queryId,
      repositoryName: event.repositoryName,
      methodName: event.methodName
    });
  }
};
```

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
