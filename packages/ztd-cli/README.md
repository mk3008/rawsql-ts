# @rawsql-ts/ztd-cli

![npm version](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## What

`ztd-cli` is a SQL-first CLI for feature-first application development. It treats handwritten SQL (DDL and named-parameter DML) as the source of truth and scaffolds feature-local layouts.

When SQL changes introduce inconsistencies, the toolchain surfaces them as type errors and test failures before they ship.

The focus is SQL maintainability: keep schema, queries, specs, and tests close to each feature, and let the toolchain show you what broke when the SQL changed.

## Why

- DDL stays the source of truth for the shape you test.
- You can keep the app and deployment databases out of the inner loop while still testing against a real engine.
- Migration artifacts are generated for review, but they are not applied automatically.

## Quickstart

### macOS / Linux / Git Bash

```bash
npm install -D @rawsql-ts/ztd-cli vitest typescript
npx ztd init --starter
# starter scaffold generates compose.yaml, starter DDL, config, and test stubs
npx ztd agents init
cp .env.example .env
# edit ZTD_DB_PORT=5433 if needed
docker compose up -d
npx ztd ztd-config
npx vitest run
```

### PowerShell

```powershell
npm install -D @rawsql-ts/ztd-cli vitest typescript
npx ztd init --starter
# starter scaffold generates compose.yaml, starter DDL, config, and test stubs
npx ztd agents init
Copy-Item .env.example .env
# edit ZTD_DB_PORT=5433 if needed
docker compose up -d
npx ztd ztd-config
npx vitest run
```

The starter scaffold includes `@rawsql-ts/testkit-core`, so `npx ztd ztd-config` works in a fresh standalone project and writes the generated runtime manifest to `tests/generated/ztd-fixture-manifest.generated.ts`.
That manifest carries `tableDefinitions` schema metadata only; test rows stay explicit fixtures outside the generated contract.
The removable starter smoke path also shows `@rawsql-ts/testkit-postgres` and `createPostgresTestkitClient` for the DB-backed test that catches setup problems early.
If you want the fixture-resolution details, read the `@rawsql-ts/testkit-postgres` package README after the starter smoke path.

If you add a no-op repository telemetry seam under `src/infrastructure/telemetry/`, use `queryId` as the stable lookup key, and keep `repositoryName`, `methodName`, `paramsShape`, and `transformations` as safe execution metadata only.
That seam does not emit SQL text or bind values by default, so you can decide explicitly when to connect console, pino, or OpenTelemetry sinks.

Make sure Docker Desktop or another Docker daemon is already running before you start the compose path, because `docker compose up -d` only launches the stack.
The generated Vitest setup derives `ZTD_TEST_DATABASE_URL` from `.env`, so the test runtime sees the same port setting as the compose file.

> `ztd-cli` prepares the workflow, but it does not execute SQL by itself. Pair it with a database adapter and a DBMS-specific testkit such as `@rawsql-ts/adapter-node-pg` + `@rawsql-ts/testkit-postgres` for Postgres.

If `5432` is busy, use another local port and update `ZTD_DB_PORT` in `.env`.

* macOS / Linux / Git Bash:

  ```bash
  cp .env.example .env
  # edit ZTD_DB_PORT=5433 if needed
  docker compose up -d
  npx vitest run
  ```

* PowerShell:

  ```powershell
  Copy-Item .env.example .env
  # edit ZTD_DB_PORT=5433 if needed
  docker compose up -d
  npx vitest run
  ```


## Getting Started with AI

Use this prompt after Quickstart.

```text
I want to build a feature-first application with @rawsql-ts/ztd-cli.
Start from src/features/smoke and add a users feature next.
Keep handwritten SQL, spec, and tests inside src/features/<feature>.
Do not apply migrations automatically.
```

Quickstart already places `npx ztd agents init` immediately after starter scaffold creation.
If you skipped that step and still want the opt-in Codex bootstrap for the project, run it before asking Codex to inspect `src/features/smoke`.
If you want `PROMPT_DOGFOOD.md` for debugging or prompt review, pass `--with-dogfooding` to `npx ztd init --starter`.

`ztd agents init` adds:

- visible `AGENTS.md` guidance
- `.codex/config.toml`
- `.codex/agents/`
- `.agents/skills/`

Existing user-owned guidance files are preserved; use `npx ztd agents status` if you need to review customer bootstrap targets separately from internal `.ztd` guidance, including managed, customized, or unmanaged-conflict files.

A good first request after setup is:

```text
Read the nearest AGENTS files, inspect src/features/smoke, and plan the next users feature.
```

## Core features

- `ztd init --starter` creates a feature-first starter scaffold with `smoke`, starter DDL, and local Postgres wiring.
- `ztd agents init` adds the opt-in Codex bootstrap on demand: visible `AGENTS.md`, `.codex/agents`, `.agents/skills`, and `.codex/config.toml`.
- `ztd ztd-config --watch` keeps generated `TestRowMap` types and runtime fixture metadata aligned with DDL as files change.
- `ztd lint` checks SQL against a temporary Postgres before you ship it.
- `ztd model-gen` and `ztd query uses` keep QuerySpec scaffolding and impacted-file discovery close to the feature-first slice.
- `ztd query sssql scaffold` and `ztd query sssql refresh` move optional filters into SQL-first authoring and keep runtime pruning explicit. Runtime no longer injects new filter predicates.
- `ztd query match-observed` ranks likely source SQL assets for an observed SELECT statement when `queryId` is missing. See the investigation guide for the full flow.
- `ztd perf init` / `ztd perf run` support tuning without forcing SQL rewrites first.
- `--dry-run` / `--output json` make the workflow reviewable and machine-readable.

## Commands

| Command | Purpose |
|---|---|
| `ztd init --starter` | Scaffold the recommended first-run project. |
| `ztd agents init` | Add the opt-in Codex bootstrap after starter setup. |
| `ztd ztd-config` | Regenerate `TestRowMap`, runtime fixture metadata, and layout metadata from DDL; add `--watch` for live updates. |
| `ztd lint` | Lint SQL files against a temporary Postgres. |
| `ztd model-gen` | Generate QuerySpec scaffolding from SQL assets. |
| `ztd query uses` | Find impacted SQL before changing a table or column. |
| `ztd query match-observed` | Rank likely source SQL assets from observed SELECT text. |
| `ztd query sssql scaffold` / `ztd query sssql refresh` | Author and refresh SQL-first optional filter branches. |
| `ztd ddl pull` / `ztd ddl diff` | Inspect an explicit target and prepare migration SQL. |
| `ztd perf *` | Run the tuning loop (`init`, `db reset`, `run`) for index or pipeline investigation. |
| `ztd describe` | Inspect commands in machine-readable form, including `--output json`. |

After DDL or schema changes, rerun `ztd ztd-config`, `ztd lint`, and `npx vitest run`. Use `ztd ddl diff` or `ztd ddl pull` when you need a migration plan. The generated runtime manifest is the preferred input for `@rawsql-ts/testkit-postgres`; raw DDL directories remain a fallback for legacy layouts.
Run `npx ztd describe command <name>` for per-command flags and options.

## ztd.config.json

`ztd.config.json` now keeps schema resolution at the top level:

```json
{
  "dialect": "postgres",
  "ddlDir": "ztd/ddl",
  "testsDir": "tests",
  "defaultSchema": "public",
  "searchPath": ["public"],
  "ddlLint": "strict"
}
```

`ddl.defaultSchema` and `ddl.searchPath` are no longer read. If an older project still keeps schema settings under `ddl`, move them to the top-level `defaultSchema` and `searchPath` fields.

## Glossary

| Term | Meaning |
|---|---|
| ZTD | Zero Table Dependency - test against a real database engine without creating or mutating application tables. |
| DDL | SQL schema files that act as the source of truth for type generation. |
| TestRowMap | Generated TypeScript types that describe row shape from local DDL. |
| QuerySpec | Contract object that ties a SQL asset file to parameter and output types. |

## Further Reading

### User Guides

- [SQL-first End-to-End Tutorial](../../docs/guide/sql-first-end-to-end-tutorial.md) - starter flow, repair loops, and scenario-specific CLI guidance
- [SQL Tool Happy Paths](../../docs/guide/sql-tool-happy-paths.md) - choose between query plan, perf, query uses, and telemetry
- [Perf Tuning Decision Guide](../../docs/guide/perf-tuning-decision-guide.md) - index tuning vs pipeline tuning
- [JOIN Direction Lint Specification](../../docs/guide/join-direction-lint-spec.md) - readable FK-aware JOIN guidance
- [Repository Telemetry Setup](../../docs/guide/repository-telemetry-setup.md) - how to edit the scaffold, emit logs, and investigate with `queryId`
- [Observed SQL Investigation](../../docs/guide/observed-sql-investigation.md) - how to use `ztd query match-observed` when `queryId` is missing

### Advanced User Guides

- [ztd-cli Telemetry Philosophy](../../docs/guide/ztd-cli-telemetry-philosophy.md) - opt-in telemetry guidance
- [Observed SQL Matching](../../docs/guide/observed-sql-matching.md) - why reverse lookup exists and where it fits

#### Multiple DB Clients in One Workflow

`ztd-config` can already produce separate artifacts for multiple DB contexts. At runtime, treat each context as its own `SqlClient` and keep the clients side by side when a single workflow needs to talk to more than one database.

```ts
type AppClients = {
  dbA: SqlClient;
  dbB: SqlClient;
};

async function runWorkflow(clients: AppClients) {
  const users = await createUsersRepository(clients.dbA).listActiveUsers();
  const invoices = await createBillingRepository(clients.dbB).listOpenInvoices();

  return { users, invoices };
}
```

This is the minimum runtime step needed for multi-DB workflows. It is not saga orchestration itself; it is the client-binding pattern that makes a saga-style design possible later. See the proof test in [packages/testkit-postgres/tests/client.test.ts](../testkit-postgres/tests/client.test.ts).

### Developer Guides

- [Migration Lifecycle Dogfooding](../../docs/dogfooding/ztd-migration-lifecycle.md) - separate-AI prompts for DDL, SQL, DTO, and migration repair
- [Perf Scale Tuning Dogfooding](../../docs/dogfooding/perf-scale-tuning.md) - separate-AI tuning dogfood
- [Published-Package Verification Before Release](../../docs/guide/published-package-verification.md) - pack and smoke-test the published-package path
- [Local-Source Dogfooding](../../docs/guide/ztd-local-source-dogfooding.md) - unpublished local checkout workflow
- [ztd-cli Agent Interface](../../docs/guide/ztd-cli-agent-interface.md) - machine-readable command surface
- [Codex Bootstrap Verification](../../docs/dogfooding/ztd-codex-bootstrap-verification.md) - reviewer-checkable fresh-project verification for `ztd agents init`
- [ztd-cli spawn EPERM Investigation](../../docs/dogfooding/ztd-cli-spawn-eperm-investigation.md) - reviewer-checkable root-cause investigation for the local Vitest startup blocker
- [ztd Onboarding Dogfooding](../../docs/dogfooding/ztd-onboarding-dogfooding.md) - reviewer-checkable README Quickstart and tutorial verification for the customer-facing onboarding path

## License

MIT
