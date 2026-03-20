# @rawsql-ts/ztd-cli

![npm version](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

SQL-first CLI for **Zero Table Dependency (ZTD)** workflows, schema inspection, and migration SQL artifact generation.

`ztd-cli` helps scaffold ZTD projects, keep DDL-derived test types in sync, inspect explicit database targets when needed, and generate reviewable SQL artifacts without silently owning runtime or deployment databases. ZTD keeps tests aligned with a real database engine without creating or mutating physical application tables during the test run.

`ztd-cli` does **not** execute SQL by itself. To run ZTD tests, plug in a database adapter and a DBMS-specific testkit such as `@rawsql-ts/adapter-node-pg` + `@rawsql-ts/testkit-postgres` for Postgres.

## Database Ownership Model

`ztd-cli` owns only the ZTD test database, not the application or deployment database.

| Setting / action | Owned by `ztd-cli` | Typical use |
|---|---|---|
| `ZTD_TEST_DATABASE_URL` | Yes (implicit) | ZTD tests, internal verification, perf workflows |
| `DATABASE_URL` | No | Application runtime, CI/CD, deployment tooling |
| `--url` / complete `--db-*` | No (explicit only) | Non-ZTD target inspection such as `ddl pull`, `ddl diff` |

- `ztd-cli` does not read `DATABASE_URL` automatically — it is not a `ztd-cli` default target.
- Any non-ZTD database target must be passed explicitly via `--url` or `--db-*`.
- `ztd-cli` may generate migration SQL artifacts, but it does not apply them.

## Features

- Project scaffolding with `ztd init` (DDL folder, config, test stubs)
- DDL-to-TypeScript type generation (`TestRowMap`)
- QuerySpec scaffold generation from SQL assets (`ztd model-gen`) via ZTD-owned inspection or explicit-target inspection
- Schema pull from an explicit target Postgres database via `pg_dump`
- DDL diff against an explicit target database for inspection
- SQL linting with fixture-backed validation
- `join-direction` lint for FK-aware JOIN readability, documented in [JOIN Direction Lint Specification](../../docs/guide/join-direction-lint-spec.md)
- Deterministic test specification evidence export (JSON / Markdown)
- Human-readable test documentation export for ZTD test assets
- Watch mode for continuous regeneration
- Validator selection (Zod or ArkType) during init
- Global machine-readable mode via `--output json`
- Runtime command introspection via `ztd describe`
- Dry-run support for write-capable commands such as `init`, `ztd-config`, `model-gen`, and `ddl *`
- Optional raw JSON request payloads for automation on selected commands
- `query uses` powered by the reusable `@rawsql-ts/sql-grep-core` engine

## Installation

```bash
npm install -D @rawsql-ts/ztd-cli
```

## Getting Started with AI

If you are using an AI coding agent, start with a short prompt that sets only the minimum project shape and domain language. You do **not** need to explain package-manager setup in that prompt — the agent handles `npm install` or `pnpm install` automatically.

Treat each query as one unit: 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.

Example prompt:

```text
I want to build a WebAPI application with @rawsql-ts/ztd-cli.
Use Docker and Postgres.
Start from the webapi scaffold.
Model three tables: sales, sale_lines, and products.
  Keep domain, application, presentation, and persistence concerns separated.
  Prepare the initial DDL, scaffold the ZTD project, and explain what was created.
  Do not apply migrations automatically.
  ```

Optional Docker helper:

If you want a local PostgreSQL 18 instance for ZTD tests, use a tiny compose file like this:

```yaml
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: ztd
      POSTGRES_PASSWORD: ztd
      POSTGRES_DB: ztd
    ports:
      - "5432:5432"
    volumes:
      - ztd-postgres-data:/var/lib/postgresql/data

volumes:
  ztd-postgres-data:
```

Then run `docker compose up -d` and point `ZTD_TEST_DATABASE_URL` at that database for the fixture-backed rewrite path.

  What a prompt at this level should usually guarantee:

* a `webapi`-shaped project layout
* starter DDL under `ztd/ddl/`
* initial smoke tests and generated-type workflow via `ztd-config`
* separation between app-facing layers and ZTD-owned persistence assets
* README / CONTEXT / AGENTS guidance that tells the next actor where to keep working

What it does **not** guarantee by itself:

* production-ready DDL review
* finalized API boundaries, DTOs, or SQL contracts
* migration application or deployment execution
* non-ZTD target inspection unless the caller explicitly passes `--url` or `--db-*`

For a typical `webapi` scaffold, the generated directory shape looks like this:

```text
src/
  domain/
  application/
  presentation/
    http/
  infrastructure/
    db/
    telemetry/
    persistence/
      repositories/
        views/
        tables/
  sql/
  catalog/
    specs/
    runtime/
ztd/
  ddl/
tests/
  support/
  generated/
.ztd/
  agents/
```

How to read that layout:

* `src/domain`, `src/application`, and `src/presentation/http` are where generic WebAPI work should begin.
* `src/infrastructure/persistence`, `src/sql`, `src/catalog`, and `ztd/ddl` are the ZTD-owned persistence side.
* `tests/generated` is generated output. Recreate it with `ztd ztd-config` instead of editing it manually.
* Optional AI guidance files can be generated when you explicitly request them, but the default scaffold stays focused on consumer-facing project files.

## Choose The Right Happy Path

`ztd-cli` has two valid happy paths, and they answer different questions:

* `Published package mode` validates what a normal npm consumer sees in a standalone project.
* `Local-source developer mode` validates unreleased changes from a local `rawsql-ts` checkout without publishing first.

Use `Published package mode` when you want to check the real package-consumer experience. Use `Local-source developer mode` when you want to dogfood unpublished changes. A published-package failure does not automatically mean the local-source developer path is broken, and a local-source-only workaround should not be presented as the default npm user flow.

For pre-release work inside this monorepo, use the repository-root verification command `pnpm verify:published-package-mode` to pack artifacts and smoke-test the standalone `ztd-cli` flow before publishing. See [Published-Package Verification Before Release](../../docs/guide/published-package-verification.md).

## Happy Path Quickstart (Published Package Mode)

A complete copy-paste sequence to reach a green test run. Choose the **demo** workflow during `ztd init` to get a working example immediately.

If you want a shorter DDL-to-first-test walkthrough, see [SQL-first End-to-End Tutorial](../../docs/guide/sql-first-end-to-end-tutorial.md).

### Prerequisites

* Node.js 20+
* npm, pnpm, or yarn

### Steps

```bash
# 1. Create a new project (skip if you already have one)
mkdir my-ztd-project && cd my-ztd-project
npm init -y

# 2. Install ztd-cli and the test runner
npm install -D @rawsql-ts/ztd-cli vitest typescript

# 3. Scaffold a ZTD project
#    Select: workflow → "demo", validator → "Zod (recommended)"
npx ztd init
```

After `ztd init` you should see:

| Path                              | Purpose                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `ztd/ddl/public.sql`              | Sample or starter DDL for the default schema                    |
| `ztd.config.json`                 | CLI defaults for DDL and test layout metadata                   |
| `tests/smoke.test.ts`             | Minimal smoke test                                              |
| `tests/smoke.validation.test.ts`  | Validator integration smoke test                                |
| `tests/support/testkit-client.ts` | Driver wiring placeholder                                       |
| `src/catalog/specs/`              | Spec and runtime files for the smoke contract                   |

```bash
# 4. Generate test types from the demo DDL
npx ztd ztd-config
```

After `ztd-config` you should see:

| Path                                       | Purpose                                  |
| ------------------------------------------ | ---------------------------------------- |
| `tests/generated/ztd-row-map.generated.ts` | Authoritative `TestRowMap` (do not edit) |
| `tests/generated/ztd-layout.generated.ts`  | Layout metadata for the test harness     |

```bash
# 5. Run the smoke tests
npx vitest run
```

All smoke tests should pass. You now have a working ZTD project.

### Next steps

* Replace the demo DDL with your own schema, or inspect an explicit target with `npx ztd ddl pull --url <target>`
* Re-run `npx ztd ztd-config` whenever DDL changes (or use `--watch`)
* Add AI guidance files only if you want them in the repo: `npx ztd init --with-ai-guidance`
* Install visible AGENTS files only if you want them in the repo: `npx ztd agents install`
* Wire a real driver in `tests/support/testkit-client.ts` (see [adapter-node-pg](../adapters/adapter-node-pg) for Postgres)
* Write domain tests against generated `TestRowMap` types

> **Tip:** For a non-interactive setup (CI, scripts), use `npx ztd init --yes` with explicit flags. See [Commands](#commands) for details.

## Happy Path Quickstart (Local-Source Developer Mode)

Use this mode when you need to dogfood unreleased `rawsql-ts` changes from a local checkout. This is the supported path for validating new CLI behavior before package publication.

### Prerequisites

* A local `rawsql-ts` checkout
* Node.js 20+
* `pnpm`
* A throwaway project outside any `pnpm` workspace

### Steps

```bash
# 1. Build the CLI from the local checkout
pnpm -C "<LOCAL_SOURCE_ROOT>" --filter @rawsql-ts/ztd-cli build

# 2. Create a standalone throwaway app outside the monorepo
mkdir /tmp/my-ztd-dogfood && cd /tmp/my-ztd-dogfood

# 3. Scaffold from local source
node "<LOCAL_SOURCE_ROOT>/packages/ztd-cli/dist/index.js" init \
  --workflow empty \
  --validator zod \
  --with-ai-guidance \
  --local-source-root "<LOCAL_SOURCE_ROOT>"

# 4. Install the scaffolded dependencies
pnpm install --ignore-workspace

# 5. Generate test types from the DDL
npx ztd ztd-config

# 6. Continue the normal loop
pnpm typecheck
pnpm test
```

Use this path for pre-release dogfooding and unpublished dependency combinations. Use the published-package quickstart above when validating the end-user npm experience.

## Quick Reference

```bash
# Common workflow loop
ZTD_TEST_DATABASE_URL=postgres://... npx ztd ztd-config  # Regenerate types from DDL
ZTD_TEST_DATABASE_URL=postgres://... npx vitest run      # Run tests
npx ztd ddl pull --url postgres://...                    # Inspect an explicit target (optional)
npx ztd ztd-config --watch                               # Keep types updated while editing DDL
```

## Agent-Friendly Automation

`ztd-cli` keeps the human-oriented CLI, but also exposes a machine-readable path for agents and scripts.

Reference docs:

* [ztd-cli Agent Interface](../../docs/guide/ztd-cli-agent-interface.md)
* [ztd-cli Describe Schema](../../docs/guide/ztd-cli-describe-schema.md)

### Global JSON mode

```bash
npx ztd --output json describe
npx ztd --output json describe command model-gen
npx ztd --output json query uses column public.users.email --format json
```

Use global `--output json` when you want command envelopes on stdout and structured diagnostics on stderr.

### Dry-run safety rails

Use `--dry-run` before commands that would write files:

```bash
npx ztd init --dry-run --workflow demo --validator zod
npx ztd ztd-config --dry-run
npx ztd model-gen src/sql/users/list.sql --sql-root src/sql --out src/catalog/specs/list.spec.ts --dry-run
npx ztd ddl pull --url postgres://... --out ztd/ddl --dry-run
npx ztd ddl diff --url postgres://... --out artifacts/schema.diff --dry-run
npx ztd ddl gen-entities --out src/entities.ts --dry-run
```

### JSON request payloads

Selected commands accept `--json <payload>` to reduce flag-by-flag construction in automation. Prefix the value with `@` to load JSON from a file.

```bash
npx ztd init --dry-run --json '{"workflow":"demo","validator":"zod","withSqlclient":true}'
npx ztd ztd-config --output json --json '{"ddlDir":"ztd/ddl","extensions":".sql,.ddl","dryRun":true}'
npx ztd ddl pull --output json --json '{"url":"postgres://example:example@127.0.0.1:5432/app_db","out":"ztd/ddl","schema":["public"],"dryRun":true}'
npx ztd model-gen src/sql/users/list.sql --json '{"sqlRoot":"src/sql","probeMode":"ztd","dryRun":true}'
npx ztd check contract --json '{"format":"json","strict":true}'
npx ztd query uses column --json '{"target":"public.users.email","format":"json","summaryOnly":true}'
npx ztd lint --json '{"path":"src/sql/**/*.sql"}'
```

## Recommended Backend Happy Path

For backend work, split the loop into **ZTD-owned** work and **explicit-target inspection** work instead of mixing them from the start.

| Step                                                                                               | Primary actor | Phase                      | Why                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose the PostgreSQL version and test DB bootstrap                                                | AI / Human    | ZTD-owned                  | Fix the ZTD-owned test database first so generated files, tests, and docs all refer to the same environment.                                              |
| Draft the DDL in `ztd/ddl/*.sql`                                                                   | AI / Human    | ZTD-owned                  | Treat DDL as the source of truth. Prefer application-owned identifiers/timestamps in the initial loop so tests do not depend on sequences or DB defaults. |
| Run `ztd init --workflow empty`                                                                    | CLI           | ZTD-owned                  | Scaffold folders, config, and test placeholders mechanically.                                                                                             |
| Run `ztd ztd-config`                                                                               | CLI           | ZTD-owned                  | Regenerate `TestRowMap` directly from DDL without applying migrations.                                                                                    |
| Write SQL assets under `src/sql` using named params                                                | AI / Human    | ZTD-owned                  | Keep the handwritten SQL authoritative while matching the default `model-gen` policy.                                                                     |
| Implement QuerySpecs, repositories, and ZTD tests                                                  | AI / Human    | ZTD-owned                  | Contract semantics, DTO shape, and query boundaries still require judgment.                                                                               |
| Run `vitest` against an empty Postgres instance                                                    | CLI           | ZTD-owned                  | ZTD should stay green before any physical app tables exist.                                                                                               |
| Run `ztd model-gen --probe-mode ztd` against your local DDL snapshot                               | CLI           | ZTD-owned                  | This keeps QuerySpec scaffolding inside the zero-migration inner loop as long as the referenced schema is represented in `ztd/ddl/*.sql`.                 |
| Inspect a non-ZTD database target only when you need deployed metadata                             | Human / CLI   | Explicit-target inspection | This is where `ddl pull`, `ddl diff`, explicit-target inspection, E2E setup, and migration artifact preparation begin.                                    |
| Run `ztd model-gen --probe-mode live` only when local DDL is intentionally not the source of truth | CLI           | Explicit-target inspection | Use explicit-target inspection for objects missing from local DDL or when you explicitly want deployed metadata.                                          |

Use this split to classify repetition:

* Repeated CLI retries caused by missing flags, missing paths, or boilerplate setup usually belong in docs or CLI automation.
* Repeated AI retries caused by contract shape, nullability, naming, or domain semantics usually indicate design choices that should stay reviewable.
* Prefer the ZTD-owned loop by default. If a task is impossible there because the required metadata is not represented in local DDL, treat it as an explicit-target inspection concern instead of forcing migrations into the inner loop.

## Commands

Most write-capable commands support `--dry-run` and `--json <payload>` for automation. Run `npx ztd describe command <name>` for per-command details.

| Command | Description |
|---------|-------------|
| `ztd init` | Create a ZTD-ready project layout (DDL folder, config, test stubs). Flags: `--yes`, `--workflow <pg_dump\|empty\|demo>`, `--validator <zod\|arktype>`, `--with-ai-guidance`, `--with-sqlclient`, `--with-app-interface`, `--local-source-root <path>` |
| `ztd agents install` | Materialize visible `AGENTS.md` files from the managed templates |
| `ztd agents status` | Report internal/visible AGENTS state and drift signals |
| `ztd ztd-config` | Generate `TestRowMap` and layout from DDL files. Flags: `--watch`, `--quiet` |
| `ztd model-gen <sql-file>` | Generate QuerySpec DTO types and rowMapping by inspecting DDL or an explicit target. Flags: `--probe-mode <ztd\|live>`, `--import-style <package\|relative>`, `--import-from`, `--describe-output`, `--debug-probe` |
| `ztd ddl pull` | Inspect schema state from an explicit target Postgres database via `pg_dump`. Flag: `--pg-dump-shell` |
| `ztd ddl diff` | Compare local DDL snapshot against an explicit target database. Flag: `--pg-dump-shell` |
| `ztd ddl gen-entities` | Generate `entities.ts` for ad-hoc schema inspection |
| `ztd lint <path>` | Lint SQL files with fixture-backed validation |
| `ztd evidence --mode specification` | Export executable specification evidence from SQL catalogs and test files |
| `ztd check contract` | Validate contract consistency |
| `ztd describe` | List command descriptions and machine-readable capability metadata |
| `ztd describe command <name>` | Describe one command in detail, including dry-run and JSON support |
| `ztd --output json <command>` | Emit a versioned JSON envelope for supported commands |
| `ztd query uses table <schema.table>` | Find catalog SQL statements that use a table target |
| `ztd query uses column <schema.table>.<col>` | Find catalog SQL statements that use a column target. Flags: `--sql-root`, `--exclude-generated`, `--any-schema`, `--any-table`, `--view <impact\|detail>` |

### Introspection examples

```bash
npx ztd describe
npx ztd describe command init
npx ztd --output json describe command model-gen
```

## Impact Investigation

Use `ztd query uses` before renaming or deleting catalog-facing SQL assets. The command is strict by default and never broadens matching unless you opt in with relaxed flags.

* `impact` (default) — aggregated "used or not, and by which queries?" view
* `--view detail` — edit-ready locations and snippets for refactoring
* `--exclude-generated` — omit `src/catalog/specs/generated` when those scaffolds add noise
* `--any-schema` / `--any-table` — relaxed matching (drops confidence to `low`)

```bash
# Strict
npx ztd query uses table public.users
npx ztd query uses column public.users.email --view detail
npx ztd query uses table public.sale_lines --exclude-generated

# Relaxed
npx ztd query uses column users.email --any-schema --format json
```

Output includes `confidence`, `notes` (why confidence dropped), `source` (AST vs fallback), and `statement_fingerprint` (stable across whitespace changes). Static column analysis does not guarantee semantic identity.

For the full JSON schema and output field reference, see `npx ztd query uses column public.users.email --format json`.

## What is ZTD?

Zero Table Dependency rewrites application CRUD statements into fixture-backed SELECT queries, so tests consume fixtures and generated types instead of a live mutable schema.

* Schema changes are expressed via SQL files (DDL)
* `ztd-config` generates TypeScript types from those DDL files
* Tests run deterministically without creating or mutating physical tables

The typical loop: edit `ztd/ddl/*.sql` -> `ZTD_TEST_DATABASE_URL=... ztd ztd-config --watch` -> write tests. Use `ddl pull` only when you intentionally inspect an explicit target.

## After DDL/Schema Changes

When your database schema evolves, regenerate test types and re-run tests. Here is the standard workflow and common patterns.

### Standard workflow

```bash
# 1. Update DDL files in ztd/ddl/
#    Edit manually, or inspect an explicit target:
npx ztd ddl pull --url postgres://...

# 2. Regenerate test types
npx ztd ztd-config

# 3. Fix compile errors (if any) in tests and specs
#    Generated TestRowMap shapes may have changed

# 4. Re-run tests
npx vitest run

# 5. (Optional) Lint SQL files against the new schema
npx ztd lint src/sql/
```

### Common patterns

#### Add a column

1. Add the column to your DDL file (`ztd/ddl/*.sql`)
2. Run `npx ztd ztd-config` — the new column appears in `TestRowMap`
3. Update fixtures in tests to include the new column (if required by NOT NULL)
4. Run `npx vitest run`

#### Rename a column

1. Rename the column in the DDL file
2. Run `npx ztd ztd-config` — old name disappears, new name appears in `TestRowMap`
3. Update all references: SQL files, `rowMapping` column maps, fixtures, and specs
4. Run `npx vitest run` to catch any remaining references via compile errors

#### Add a new table

1. Add the CREATE TABLE to a DDL file (new file or existing)
2. Run `npx ztd ztd-config` — new table type appears in `TestRowMap`
3. Write SQL queries and tests for the new table
4. Run `npx vitest run`

#### Drop a column or table

1. Remove from DDL
2. Run `npx ztd ztd-config` — the removed type/column disappears
3. Compile errors guide you to all affected code
4. Remove or update references, then run `npx vitest run`

### Troubleshooting

| Symptom                             | Cause                                      | Fix                                                                                                       |
| ----------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `TestRowMap` not updated            | Forgot to run `ztd-config`                 | Run `npx ztd ztd-config`                                                                                  |
| Compile errors after `ztd-config`   | Schema shape changed                       | Update fixtures, specs, and column maps to match new shape                                                |
| `ztd-config` fails to parse DDL     | Unsupported SQL syntax                     | Simplify the DDL or check for dialect-specific constructs                                                 |
| Tests pass but SQL fails at runtime | DDL and an explicit target are out of sync | Run `npx ztd ddl diff --url <target>` to compare, then `npx ztd ddl pull --url <target>` to inspect again |

> **Tip:** Use `npx ztd ztd-config --watch` during development to regenerate types automatically when DDL files change.

## QuerySpec Workflow

`ztd model-gen` is designed for SQL asset files under `src/sql/` and assumes **named parameters** (`:name`).

Important context:

* `:name` is an intentional project-level SQL asset convention, not native PostgreSQL syntax.
* Before inspection, `model-gen` binds named parameters to PostgreSQL placeholders such as `$1`, `$2` and runs a metadata-only wrapper query.
* `--probe-mode ztd` uses `ZTD_TEST_DATABASE_URL` for the ZTD-owned inspection path.
* `--probe-mode live` is the explicit-target inspection path. Pass `--url` or a complete `--db-*` flag set.
* `ztd-cli` does not read `DATABASE_URL` automatically for either path.
* `--probe-mode ztd` still rewrites the inspection through your DDL snapshot so physical app tables are not required. It uses `ztd.config.json` (`ddlDir`, `ddl.defaultSchema`, `ddl.searchPath`) unless you override the directory with `--ddl-dir`.

```text
1. Write SQL in src/sql/ using named parameters such as :customerId
2. Prefer the ZTD-first command during the inner loop:
   - `ztd model-gen src/sql/my_query.sql --probe-mode ztd --out src/catalog/specs/my-query.spec.ts`
   - Or validate only: `ztd model-gen src/sql/my_query.sql --probe-mode ztd --out src/catalog/specs/my-query.spec.ts --dry-run`
3. Use explicit-target inspection only when local DDL is not the source of truth:
   - `ztd model-gen src/sql/my_query.sql --probe-mode live --out src/catalog/specs/my-query.spec.ts`
4. Review the generated types, rowMapping key, nullability, and normalization
5. Run ZTD tests to confirm the contract
```

Example SQL asset:

```sql
select
  p.id as product_id,
  p.name as product_name,
  p.price as list_price
from public.products p
where p.id = :product_id
```

Example generated scaffold excerpt:

```ts
export const getProductSpec: QuerySpec<{ product_id: unknown }, GetProductRow> = {
  id: 'product.getProduct',
  sqlFile: 'product/get_product.sql',
  params: { shape: 'named', example: { product_id: null } },
  output: {
    mapping: getProductMapping,
    example: {
      productId: 0,
      productName: '',
      listPrice: '',
    },
  },
};
```

Notes:

* SQL asset files should use named parameters (`:name`). `model-gen` rewrites them to `$1`, `$2` before inspection. Positional placeholders are rejected by default (`--allow-positional` for legacy SQL).
* `--probe-mode ztd` (recommended) uses `ZTD_TEST_DATABASE_URL` and your DDL snapshot — no physical app tables needed. Unqualified names resolve via `ddl.defaultSchema` / `ddl.searchPath` in `ztd.config.json`.
* `--probe-mode live` (default for backward compatibility) is for schema objects not yet in local DDL, or when you want metadata from an explicit target.
* The generated file is a starting point. Review nullability, rowMapping key, and example values before committing.
* Run `--describe-output` to inspect the artifact contract without connecting to PostgreSQL. Use `--dry-run` to validate without writing files.

### Optional-condition SQL

For optional filters, prefer keeping the condition in the SQL file itself (`where (:param is null or col = :param)`) before reaching for string-built query assembly. See [ztd-cli SSSQL Authoring](../../docs/guide/ztd-cli-sssql-authoring.md) and [What Is SSSQL?](../../docs/guide/sssql-overview.md) for the full pattern.

## Telemetry Philosophy

`ztd-cli` telemetry is opt-in investigation tooling for dogfooding, debugging, and optimization. It is intentionally outside the default happy path, it must not become mandatory for published-package usage, and production embedding/export stays optional and off by default.

Read the full guidance in [ztd-cli Telemetry Philosophy](../../docs/guide/ztd-cli-telemetry-philosophy.md), [ztd-cli Telemetry Policy](../../docs/guide/ztd-cli-telemetry-policy.md), [ztd-cli Telemetry Export Modes](../../docs/guide/ztd-cli-telemetry-export-modes.md), [Telemetry Dogfooding Scenarios](../../docs/dogfooding/telemetry-dogfooding.md), [SQL Debug Recovery Dogfooding](../../docs/dogfooding/sql-debug-recovery.md), and [Test Documentation Dogfooding](../../docs/dogfooding/test-documentation.md).

## Further Reading

* [Feature Index](../../docs/guide/feature-index.md) — at-a-glance list of easy-to-miss capabilities
* [SQL Tool Happy Paths](../../docs/guide/sql-tool-happy-paths.md) — choose between query plan, perf, query uses, and telemetry based on the problem shape
* [ztd-cli SSSQL Authoring](../../docs/guide/ztd-cli-sssql-authoring.md) — keep optional-condition requests on the SQL-first path
* [Local-Source Dogfooding](../../docs/guide/ztd-local-source-dogfooding.md) — local-source quick start, workspace drift, and import mismatches
* [Postgres Pitfalls](../../docs/guide/postgres-pitfalls.md) — common Postgres-specific surprises
* [Spec-Change Scenarios](../../docs/guide/spec-change-scenarios.md) — condensed digest of common schema changes
* [Mapping vs Validation Pipeline](../../docs/recipes/mapping-vs-validation.md) — avoid coerce/validator conflicts

## Glossary

| Term           | Description                                                                     |
| -------------- | ------------------------------------------------------------------------------- |
| **DDL**        | SQL files defining schema objects (tables, enums, indexes)                      |
| **TestRowMap** | Generated TypeScript types describing test rows for each table                  |
| **Fixture**    | Static rows used by the driver to answer queries deterministically              |
| **Driver**     | Package connecting to your DB engine and running the rewrite + fixture pipeline |

## License

MIT
