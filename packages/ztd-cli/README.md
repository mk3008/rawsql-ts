# @rawsql-ts/ztd-cli

![npm version](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

`ztd-cli` is a SQL-first CLI for feature-first application development.

It now treats project structure as Architecture as a Framework: boundaries, public surfaces, dependency direction, and test ownership are meant to be readable from the filesystem itself.

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

## Architecture as a Framework

`ztd-cli` uses one recursive rule for feature-local boundaries:

```text
boundary/
  boundary.ts
  child-boundary/
  tests/
```

- A folder is a boundary.
- `boundary.ts` is that boundary's public surface.
- Child boundaries are child folders that repeat the same rule.
- `tests/` is the verification group owned by that boundary.
- Cross-boundary tests should use `boundary.ts`, not internal helpers.

`src/features/<feature>/queries/` is the main exception.
It is a container for child query boundaries and does not expose its own `boundary.ts`.
The actual query-boundary public surfaces live under `src/features/<feature>/queries/<query>/boundary.ts`.

The starter and feature scaffolds apply that rule under `src/features/<feature>/...`, so the public export surface is visible without reading prose first.
Outside feature-owned boundaries:

- Keep shared feature seams under `src/features/_shared/*`.
- Keep driver-neutral contracts under `src/libraries/*`.
- Keep driver- or sink-specific bindings under `src/adapters/<tech>/*`.
- Keep shared verification seams under `tests/support/*`.
- Keep tool-managed assets under `.ztd/*`.

Adapter boundary rule:

- If `<tech>` is one concrete technology, treat `src/adapters/<tech>/` as the adapter boundary, for example `src/adapters/pg/`.
- If `<tech>` is a family or plural container such as `aws` or `cloud`, treat `src/adapters/<tech>/` as a parent and create child boundaries such as `src/adapters/aws/s3/` and `src/adapters/aws/lambda/`.

Reserve `db/` for DDL, migration, and schema assets only; do not place runtime clients or adapters there.

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

### Feature Test Debugging

### Port Already In Use

If port `5432` is already in use, change `ZTD_DB_PORT` in `.env` and then verify recovery with:

```bash
docker compose up -d
npx vitest run
```

### Docker Network Pool Exhausted

If `docker compose up -d` fails with `all predefined address pools have been fully subnetted`, this is not a `ZTD_DB_PORT` collision.

- The failure is happening before the container binds its port.
- Changing `ZTD_DB_PORT` will not fix it.
- Typical recovery is Docker-side cleanup such as removing unused networks, pruning Docker state, or widening Docker's `default-address-pools` setting.

### ZTD Runtime Debugging

- If an AI-authored ZTD test fails, do not assume the prompt or case file is the only problem; check whether `ztd-cli` or `rawsql-ts` changed the manifest or rewrite path.
- If you see `user_id: null`, compare the direct database `INSERT ... RETURNING ...` result with the ZTD result and inspect `.ztd/generated/ztd-fixture-manifest.generated.ts` first.
- If a local-source workspace is meant to reflect a source change, verify that it resolves `rawsql-ts` from the local source tree rather than a registry copy.
- Check ZTD evidence first (`mode=ztd`, `physicalSetupUsed=false`) before assuming fixture data is wrong.
- Enable SQL trace only when needed with `ZTD_SQL_TRACE=1` (optional `ZTD_SQL_TRACE_DIR`).

## Create the Users Insert Feature

Use this after Quickstart.

The DDL is in `db/ddl/public.sql`.

Run this first:

```bash
npx ztd feature scaffold --table users --action insert
```

Scaffold the `users-insert` feature with co-located SQL, boundaries, and a thin tests entrypoint.
Starter-owned shared support lives under `tests/support/ztd/`; `.ztd/` remains the tool-managed workspace for generated metadata and support files.

When an existing boundary needs one more child query boundary, add it without regenerating the parent boundary:

```bash
npx ztd feature query scaffold --feature users-insert --query-name insert-user-audit --table user_audit --action insert
```

If the boundary is deeper in a VSA-style folder tree, point at the exact boundary folder instead:

```bash
npx ztd feature query scaffold --boundary-dir src/features/orders/write/sales-insert --query-name insert-sales-detail --table sales_detail --action insert
```

Choose exactly one target selector:

- Prefer `--feature` for a feature-root boundary.
- Use `--boundary-dir` for a deeper existing boundary folder.
- Omit both only when the current working directory is already the target boundary.
- The additive scaffold creates `queries/<query-name>/boundary.ts` plus `queries/<query-name>/<query-name>.sql`.
- It creates `queries/` when it is missing.
- It does not edit the parent `boundary.ts`, including in `--dry-run`.
- Parent orchestration, transaction decisions, and response shaping stay human/AI-owned.

After you finish the SQL and DTO edits, run `npx ztd feature tests scaffold --feature <feature-name>`.
That command refreshes `src/features/<feature-name>/queries/<query-name>/tests/generated/TEST_PLAN.md` and `analysis.json`, refreshes `src/features/<feature-name>/queries/<query-name>/tests/boundary-ztd-types.ts`, and creates the thin Vitest entrypoint `src/features/<feature-name>/queries/<query-name>/tests/<query-name>.boundary.ztd.test.ts` only if it is missing.
Persistent case files under `src/features/<feature-name>/queries/<query-name>/tests/cases/` are human/AI-owned and are not overwritten.
ZTD here means query-boundary-local cases that execute through the fixed app-level harness against the real database engine, not a mocked executor.
If `ztd-config` has already run, use `.ztd/generated/ztd-fixture-manifest.generated.ts` as the source for `tableDefinitions` and any fixture-shape hints the case needs.
`beforeDb` is a schema-qualified pure fixture skeleton.
Use validation-only cases for boundary checks and DB-backed cases for the success path.
Keep the feature-root `src/features/<feature-name>/tests/<feature-name>.boundary.test.ts` for mock-based boundary tests.
The ZTD verifier returns machine-checkable evidence (`mode`, `rewriteApplied`, `physicalSetupUsed`) per case.
`afterDb` assertions are intentionally excluded from this ZTD lane; use a traditional DB-state lane when you need post-state assertions.
After the cases are filled, run `npx vitest run src/features/<feature-name>/queries/<query-name>/tests/<query-name>.boundary.ztd.test.ts` to execute the ZTD query test.

## Import Paths

As boundary depth grows, avoid making every import depth-sensitive by default.

- The goal is boundary-change safety, not a blanket root-alias migration.
- Keep local, nearby references relative when they move with the same boundary.
- Stabilize only shared references that are likely to break when work is split horizontally and moved into a deeper child boundary, such as `src/features/_shared/*` or `tests/support/*`.
- One workable tactic is package `imports` or an equivalent alias that works in both TypeScript and runtime resolution, but that is a means, not the architectural goal.
- Minimum rule: imports that cross boundaries should make the target boundary explicit and go through its `boundary.ts` entrypoint.
- Pragmatic exception: designated shared seams such as `src/features/_shared/*` and `tests/support/*` may use stabilized root-level aliases or package-style imports because they are shared support seams, not another boundary's private internals.
- Do not treat this issue as a reason to rewrite every scaffolded import to one style.

## Troubleshooting

- If a DB-backed ZTD case returns `user_id: null`, check the fixture manifest and rewrite path before weakening the case.
- Compare the direct database `INSERT ... RETURNING ...` result with the ZTD result so you can separate a DB issue from a manifest or rewrite issue.
- If the workspace is meant to reflect a source change, verify it resolves `rawsql-ts` from the local source tree instead of a registry copy.
- When debugging rewrite behavior, use `ZTD_SQL_TRACE=1` to emit per-case trace JSON without adding always-on log noise.

```text
Write ZTD-format cases for the query boundary.
Keep the persistent case files in `src/features/<feature>/queries/<query>/tests/cases/`.
Use `src/features/<feature>/queries/<query>/tests/generated/TEST_PLAN.md` and `analysis.json` as the source of truth.
Do not put returned columns into the input fixture; only assert them after the DB-backed case returns.
The validation cases may stay at the feature boundary, but the success case must run through the fixed app-level ZTD runner and verify the returned result.
If the returned result is `null`, stop and fix the scaffold or DDL instead of weakening the case.
Before writing the success-path assertion, inspect the current SQL and query boundary. If the scaffold does not actually return the expected result shape, report that mismatch instead of inventing fixture data or schema overrides.
Do not apply migrations automatically.
```

Finish by running:

```bash
npx vitest run
```

If you want a deeper walkthrough, keep that in the linked guides instead of expanding this README.

## Command Index

This section is a reader-facing index of the main `ztd-cli` entry points.
It is not the exhaustive command reference for every subcommand and flag.
Use `ztd describe` for machine-readable discovery, and follow the linked guides when one command family has a deeper workflow.

| Command | Purpose |
|---|---|
| `ztd init --starter` | Scaffold the starter project with smoke, DDL, compose, and local Postgres wiring. |
| `ztd feature scaffold --table <table> --action <insert/update/delete/get-by-id/list>` | Scaffold a feature-local CRUD/SELECT slice with SQL, `boundary.ts` entrypoints, README, and a thin tests entrypoint. |
| `ztd feature query scaffold --query-name <name> --table <table> --action <insert/update/delete/get-by-id/list>` | Add one child query boundary under an existing boundary folder without rewriting the parent boundary. Use exactly one of `--feature` or `--boundary-dir`, or omit both only when the current working directory is already the target boundary. |
| `ztd feature tests scaffold --feature <feature-name>` | Refresh `src/features/<feature>/queries/<query>/tests/generated/TEST_PLAN.md`, `analysis.json`, and `src/features/<feature>/queries/<query>/tests/boundary-ztd-types.ts`; create the thin `src/features/<feature>/queries/<query>/tests/<query>.boundary.ztd.test.ts` Vitest entrypoint when missing; keep `src/features/<feature>/queries/<query>/tests/cases/` as human/AI-owned persistent cases. |
| `ztd agents init` | Add the optional Codex bootstrap files. |
| `ztd ztd-config` | Regenerate `TestRowMap` and runtime fixture metadata from DDL without Docker. |
| `ztd lint` | Lint SQL against a temporary Postgres. |
| `ztd model-gen` | Generate query-boundary scaffolding from SQL assets. |
| `ztd query uses` | Find impacted SQL before changing a table or column. |
| `ztd query match-observed` | Rank likely source SQL assets from observed SELECT text. |
| `ztd query sssql list` / `scaffold` / `remove` / `refresh` | Inspect, author, undo, and re-anchor SQL-first optional filter branches. See [ztd-cli SSSQL Reference](../../docs/guide/ztd-cli-sssql-reference.md). |
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
- [Traditional Lane Follow-up Plan](../../docs/guide/ztd-cli-traditional-lane-followup-plan.md) - design plan for exposing `--test-kind ztd|traditional` and coexisting lane scaffolds

### Advanced User Guides

- [Published-Package Verification Before Release](../../docs/guide/published-package-verification.md) - pack and smoke-test the published-package path
- [Release And Merge Readiness](../../docs/guide/release-readiness.md) - PR-body contract for baseline exceptions, CLI migration packets, and scaffold proof
- [What Is SSSQL?](../../docs/guide/sssql-overview.md) - the shortest intro to truthful optional-filter SQL
- [SSSQL for Humans](../../docs/guide/sssql-for-humans.md) - why SSSQL exists and where it fits in the toolchain
- [ztd-cli SSSQL Reference](../../docs/guide/ztd-cli-sssql-reference.md) - one-page command and runtime reference for `ztd query sssql`
- [ztd-cli Telemetry Philosophy](../../docs/guide/ztd-cli-telemetry-philosophy.md) - when to enable telemetry and why it stays opt-in
- [ztd-cli Telemetry Policy](../../docs/guide/ztd-cli-telemetry-policy.md) - which event fields are allowed and how redaction works
- [ztd-cli Telemetry Export Modes](../../docs/guide/ztd-cli-telemetry-export-modes.md) - how to send telemetry to console, debug, file, or OTLP
- [Observed SQL Matching](../../docs/guide/observed-sql-matching.md) - reverse lookup for missing `queryId`, with best-effort ranking and skip/warning reporting
- [Multiple DB Clients in One Workflow](../../docs/guide/multiple-db-clients-in-one-workflow.md) - separate DB contexts, one workflow, and side-by-side `SqlClient` bindings

### Developer Guides

- [Local-Source Development](../../docs/guide/ztd-local-source-dogfooding.md) - unpublished local checkout workflow
- [Codex Bootstrap Verification](../../docs/dogfooding/ztd-codex-bootstrap-verification.md) - reviewer-checkable fresh-project verification for `ztd agents init`
- [ztd-cli spawn EPERM Investigation](../../docs/dogfooding/ztd-cli-spawn-eperm-investigation.md) - reviewer-checkable root-cause investigation for the local Vitest startup blocker
- [ztd Onboarding Verification](../../docs/dogfooding/ztd-onboarding-dogfooding.md) - reviewer-checkable README Quickstart and tutorial verification for the customer-facing onboarding path

## License

MIT
