# @rawsql-ts/ztd-cli

![npm version](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

`ztd-cli` is a SQL-first CLI for feature-first application development.

## Highlights

- DDL is the source of truth, and `pg_dump` output can be used to bootstrap it.
- SQL lives as files, co-located with each feature.
- Development starts from SQL changes, then moves through tests and repair loops.
- ZTD-format SQL tests are the standard, and SQL tuning has a dedicated path.
- Migration artifacts are generated for review, not applied automatically.
- No extra DSL is required.
- VSA-style feature-local SQL layouts are supported.

## Quickstart

Run these in order.

```bash
npm install -D @rawsql-ts/ztd-cli vitest typescript
npx ztd init --starter
# starter scaffold generates compose.yaml, starter DDL, config, and test stubs
npx ztd agents init
cp .env.example .env
# edit ZTD_DB_PORT=5433 if needed
npx ztd ztd-config
docker compose up -d
npx vitest run
```

PowerShell:

```powershell
npm install -D @rawsql-ts/ztd-cli vitest typescript
npx ztd init --starter
# starter scaffold generates compose.yaml, starter DDL, config, and test stubs
npx ztd agents init
Copy-Item .env.example .env
# edit ZTD_DB_PORT=5433 if needed
npx ztd ztd-config
docker compose up -d
npx vitest run
```

## Troubleshooting

### Port Already In Use

If port `5432` is already in use, change `ZTD_DB_PORT` in `.env` and then verify recovery with:

```bash
docker compose up -d
npx vitest run
```

## Create the Users Insert Feature

Use this after Quickstart.

The DDL is in `db/ddl/public.sql`.

Run this first:

```bash
npx ztd feature scaffold --table users --action insert
```

Scaffold the `users-insert` feature with co-located SQL, specs, and tests.

Then ask AI to add the follow-up tests in `src/features/users-insert/tests`. ZTD here means SQL-only tests without migrations or mocks, run against the real database engine.

```text
Write ZTD-format tests for the users insert feature.
Keep them in src/features/users-insert/tests.
Cover:
- required-field validation failures
- successful insert returning an id
Do not apply migrations automatically.
```

Finish by running:

```bash
npx vitest run
```

If you want a deeper walkthrough, keep that in the linked guides instead of expanding this README.

## Commands

| Command | Purpose |
|---|---|
| `ztd init --starter` | Scaffold the starter project with smoke, DDL, compose, and local Postgres wiring. |
| `ztd feature scaffold --table <table> --action <insert/update/delete/get-by-id/list>` | Scaffold a feature-local CRUD/SELECT slice with SQL, entrypoint, QuerySpec, tests, and DTO schemas. |
| `ztd agents init` | Add the optional Codex bootstrap files. |
| `ztd ztd-config` | Regenerate `TestRowMap` and runtime fixture metadata from DDL without Docker. |
| `ztd lint` | Lint SQL against a temporary Postgres. |
| `ztd model-gen` | Generate QuerySpec scaffolding from SQL assets. |
| `ztd query uses` | Find impacted SQL before changing a table or column. |
| `ztd query match-observed` | Rank likely source SQL assets from observed SELECT text. |
| `ztd query sssql scaffold` / `ztd query sssql refresh` | Author and refresh SQL-first optional filter branches. |
| `ztd ddl pull` / `ztd ddl diff` | Inspect a target and prepare migration SQL. |
| `ztd perf init` / `ztd perf run` | Run the tuning loop for index or pipeline investigation. |
| `ztd describe` | Inspect commands in machine-readable form. |

## Glossary

| Term | Meaning |
|---|---|
| ZTD | [Zero Table Dependency](../../docs/guide/ztd-theory.md) - test against a real database engine without creating or mutating application tables. |
| DDL | SQL schema files that act as the source of truth for type generation. |
| TestRowMap | Generated TypeScript types that describe row shape from local DDL. |
| QuerySpec | Contract object that ties a SQL asset file to parameter and output types. |
| SSSQL | [SQL-first optional-filter authoring style](../../docs/guide/sssql-overview.md) that keeps the query truthful and lets the runtime prune only what it must. |

## Further Reading

### User Guides

- [SQL-first End-to-End Tutorial](../../docs/guide/sql-first-end-to-end-tutorial.md) - starter flow, repair loops, and scenario-specific CLI guidance
- [SQL Tool Happy Paths](../../docs/guide/sql-tool-happy-paths.md) - choose between query plan, perf, query uses, and telemetry
- [Dynamic Filter Routing](../../docs/guide/dynamic-filter-routing.md) - decide between DynamicQueryBuilder filters and SSSQL branches
- [ztd.config.json Top-Level Settings](../../docs/guide/ztd-config-top-level-settings.md) - where schema resolution lives and how to read the generated config
- [Perf Tuning Decision Guide](../../docs/guide/perf-tuning-decision-guide.md) - index tuning vs pipeline tuning
- [JOIN Direction Lint Specification](../../docs/guide/join-direction-lint-spec.md) - readable FK-aware JOIN guidance
- [Repository Telemetry Setup](../../docs/guide/repository-telemetry-setup.md) - how to edit the scaffold, emit logs, and investigate with `queryId`
- [Observed SQL Investigation](../../docs/guide/observed-sql-investigation.md) - how to use `ztd query match-observed` when `queryId` is missing
- [ztd-cli Agent Interface](../../docs/guide/ztd-cli-agent-interface.md) - machine-readable command surface

### Advanced User Guides

- [Published-Package Verification Before Release](../../docs/guide/published-package-verification.md) - pack and smoke-test the published-package path
- [What Is SSSQL?](../../docs/guide/sssql-overview.md) - the shortest intro to truthful optional-filter SQL
- [SSSQL for Humans](../../docs/guide/sssql-for-humans.md) - why SSSQL exists and where it fits in the toolchain
- [ztd-cli Telemetry Philosophy](../../docs/guide/ztd-cli-telemetry-philosophy.md) - when to enable telemetry and why it stays opt-in
- [ztd-cli Telemetry Policy](../../docs/guide/ztd-cli-telemetry-policy.md) - which event fields are allowed and how redaction works
- [ztd-cli Telemetry Export Modes](../../docs/guide/ztd-cli-telemetry-export-modes.md) - how to send telemetry to console, debug, file, or OTLP
- [Observed SQL Matching](../../docs/guide/observed-sql-matching.md) - reverse lookup for missing `queryId`, with best-effort ranking and skip/warning reporting
- [Multiple DB Clients in One Workflow](../../docs/guide/multiple-db-clients-in-one-workflow.md) - separate DB contexts, one workflow, and side-by-side `SqlClient` bindings

### Developer Guides

- [Local-Source Dogfooding](../../docs/guide/ztd-local-source-dogfooding.md) - unpublished local checkout workflow
- [Codex Bootstrap Verification](../../docs/dogfooding/ztd-codex-bootstrap-verification.md) - reviewer-checkable fresh-project verification for `ztd agents init`
- [ztd-cli spawn EPERM Investigation](../../docs/dogfooding/ztd-cli-spawn-eperm-investigation.md) - reviewer-checkable root-cause investigation for the local Vitest startup blocker
- [ztd Onboarding Dogfooding](../../docs/dogfooding/ztd-onboarding-dogfooding.md) - reviewer-checkable README Quickstart and tutorial verification for the customer-facing onboarding path

## License

MIT
