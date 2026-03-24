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
# generates docker-compose.yml, starter DDL, config, and test stubs
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
# generates docker-compose.yml, starter DDL, config, and test stubs
Copy-Item .env.example .env
# edit ZTD_DB_PORT=5433 if needed
docker compose up -d
npx ztd ztd-config
npx vitest run
```

The starter scaffold includes `@rawsql-ts/testkit-core`, so `npx ztd ztd-config` works in a fresh standalone project.

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

Add `--with-dogfooding` if you want `PROMPT_DOGFOOD.md` for debugging or prompt review.
Advanced validation, dogfooding, and tuning live in [Further Reading](#further-reading).

## Core features

- `ztd init --starter` creates a feature-first starter scaffold with `smoke`, starter DDL, AGENTS, and local Postgres wiring.
- `ztd ztd-config --watch` keeps generated `TestRowMap` types aligned with DDL as files change.
- `ztd lint` checks SQL against a temporary Postgres before you ship it.
- `ztd model-gen` and `ztd query uses` keep QuerySpec scaffolding and impacted-file discovery close to the feature-first slice.
- `ztd perf init` / `ztd perf run` support tuning without forcing SQL rewrites first.
- `--dry-run` / `--output json` make the workflow reviewable and machine-readable.

## Commands

| Command | Purpose |
|---|---|
| `ztd init --starter` | Scaffold the recommended first-run project. |
| `ztd ztd-config` | Regenerate `TestRowMap` and layout metadata from DDL; add `--watch` for live updates. |
| `ztd lint` | Lint SQL files against a temporary Postgres. |
| `ztd model-gen` | Generate QuerySpec scaffolding from SQL assets. |
| `ztd query uses` | Find impacted SQL before changing a table or column. |
| `ztd ddl pull` / `ztd ddl diff` | Inspect an explicit target and prepare migration SQL. |
| `ztd perf *` | Run the tuning loop (`init`, `db reset`, `run`) for index or pipeline investigation. |
| `ztd describe` | Inspect commands in machine-readable form, including `--output json`. |

After DDL or schema changes, rerun `ztd ztd-config`, `ztd lint`, and `npx vitest run`. Use `ztd ddl diff` or `ztd ddl pull` when you need a migration plan.
Run `npx ztd describe command <name>` for per-command flags and options.

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

### Advanced User Guides

- [ztd-cli Telemetry Philosophy](../../docs/guide/ztd-cli-telemetry-philosophy.md) - opt-in telemetry guidance

### Developer Guides

- [Migration Lifecycle Dogfooding](../../docs/dogfooding/ztd-migration-lifecycle.md) - separate-AI prompts for DDL, SQL, DTO, and migration repair
- [Perf Scale Tuning Dogfooding](../../docs/dogfooding/perf-scale-tuning.md) - separate-AI tuning dogfood
- [Published-Package Verification Before Release](../../docs/guide/published-package-verification.md) - pack and smoke-test the published-package path
- [Local-Source Dogfooding](../../docs/guide/ztd-local-source-dogfooding.md) - unpublished local checkout workflow
- [ztd-cli Agent Interface](../../docs/guide/ztd-cli-agent-interface.md) - machine-readable command surface

## License

MIT
