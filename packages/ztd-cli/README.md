# @rawsql-ts/ztd-cli

![npm version](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

CLI tool for scaffolding **Zero Table Dependency (ZTD)** projects and keeping DDL-derived test types in sync. ZTD keeps your tests aligned with a real database engine without ever creating or mutating physical tables during the test run.

`ztd-cli` does **not** execute SQL by itself. To run ZTD tests, plug in a database adapter and a DBMS-specific testkit (e.g., `@rawsql-ts/adapter-node-pg` + `@rawsql-ts/testkit-postgres` for Postgres).

## Features

- Project scaffolding with `ztd init` (DDL folder, config, test stubs)
- DDL-to-TypeScript type generation (`TestRowMap`)
- QuerySpec scaffold generation from SQL assets (`ztd model-gen`) via ZTD or live probes
- Schema pull from live Postgres via `pg_dump`
- DDL diff against a live database
- SQL linting with fixture-backed validation
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

## Choose The Right Happy Path

`ztd-cli` has two valid happy paths, and they answer different questions:

- `Published package mode` validates what a normal npm consumer sees in a standalone project.
- `Local-source developer mode` validates unreleased changes from a local `rawsql-ts` checkout without publishing first.

Use `Published package mode` when you want to check the real package-consumer experience. Use `Local-source developer mode` when you want to dogfood unpublished changes. A published-package failure does not automatically mean the local-source developer path is broken, and a local-source-only workaround should not be presented as the default npm user flow.

For pre-release work inside this monorepo, use the repository-root verification command `pnpm verify:published-package-mode` to pack artifacts and smoke-test the standalone `ztd-cli` flow before publishing. See [Published-Package Verification Before Release](../../docs/guide/published-package-verification.md).

## Happy Path Quickstart (Published Package Mode)

A complete copy-paste sequence to reach a green test run. Choose the **demo** workflow during `ztd init` to get a working example immediately.

### Prerequisites

- Node.js 20+
- npm, pnpm, or yarn

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

| Path | Purpose |
|------|---------|
| `ztd/ddl/public.sql` | Sample or starter DDL for the default schema |
| `ztd.config.json` | CLI defaults and resolver hints |
| `tests/smoke.test.ts` | Minimal smoke test |
| `tests/smoke.validation.test.ts` | Validator integration smoke test |
| `tests/support/testkit-client.ts` | Driver wiring placeholder |
| `src/catalog/specs/` | Spec and runtime files for the smoke contract |
| `CONTEXT.md` | Agent-focused project invariants and recommended command usage |
| `.ztd/agents/manifest.json` | Managed AI guidance index with security notices and entrypoints |

```bash
# 4. Generate test types from the demo DDL
npx ztd ztd-config
```

After `ztd-config` you should see:

| Path | Purpose |
|------|---------|
| `tests/generated/ztd-row-map.generated.ts` | Authoritative `TestRowMap` (do not edit) |
| `tests/generated/ztd-layout.generated.ts` | Layout metadata for the test harness |

```bash
# 5. Run the smoke tests
npx vitest run
```

All smoke tests should pass. You now have a working ZTD project.

### Next steps

- Replace the demo DDL with your own schema, or pull from a live database with `npx ztd ddl pull`
- Re-run `npx ztd ztd-config` whenever DDL changes (or use `--watch`)
- Install visible AGENTS files only if you want them in the repo: `npx ztd agents install`
- Wire a real driver in `tests/support/testkit-client.ts` (see [adapter-node-pg](../adapters/adapter-node-pg) for Postgres)
- Write domain tests against generated `TestRowMap` types

> **Tip:** For a non-interactive setup (CI, scripts), use `npx ztd init --yes` with explicit flags. See [Commands](#commands) for details.


## Happy Path Quickstart (Local-Source Developer Mode)

Use this mode when you need to dogfood unreleased `rawsql-ts` changes from a local checkout. This is the supported path for validating new CLI behavior before package publication.

### Prerequisites

- A local `rawsql-ts` checkout
- Node.js 20+
- `pnpm`
- A throwaway project outside any `pnpm` workspace

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
npx ztd ddl pull          # Pull schema from Postgres (optional)
npx ztd ztd-config        # Regenerate types from DDL
npx vitest run             # Run tests
npx ztd ztd-config --watch # Or keep types updated while editing DDL
```

## Agent-Friendly Automation

`ztd-cli` keeps the human-oriented CLI, but now also exposes a machine-readable path for agents and scripts.

Reference docs:

- [ztd-cli Agent Interface](../../docs/guide/ztd-cli-agent-interface.md)
- [ztd-cli Describe Schema](../../docs/guide/ztd-cli-describe-schema.md)

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
npx ztd ddl pull --out ztd/ddl --dry-run
npx ztd ddl diff --out artifacts/schema.diff --dry-run
npx ztd ddl gen-entities --out src/entities.ts --dry-run
```

### JSON request payloads

Selected commands accept `--json <payload>` to reduce flag-by-flag construction in automation. Prefix the value with `@` to load JSON from a file.

```bash
npx ztd init --dry-run --json '{"workflow":"demo","validator":"zod","withSqlclient":true}'
npx ztd ztd-config --output json --json '{"ddlDir":"ztd/ddl","extensions":".sql,.ddl","dryRun":true}'
npx ztd ddl pull --output json --json '{"out":"ztd/ddl","schema":["public"],"dryRun":true}'
npx ztd model-gen src/sql/users/list.sql --json '{"sqlRoot":"src/sql","probeMode":"ztd","dryRun":true}'
npx ztd check contract --json '{"format":"json","strict":true}'
npx ztd query uses column --json '{"target":"public.users.email","format":"json","summaryOnly":true}'
npx ztd lint --json '{"path":"src/sql/**/*.sql"}'
```

## Recommended Backend Happy Path

For backend work, split the loop into **ZTD-only** work and **Live-schema** work instead of mixing them from the start.

| Step | Primary actor | Phase | Why |
|------|---------------|-------|-----|
| Choose the PostgreSQL version and Docker DSN | AI / Human | ZTD-only | Fix the runtime target first so generated files, tests, and docs all refer to the same environment. |
| Draft the DDL in `ztd/ddl/*.sql` | AI / Human | ZTD-only | Treat DDL as the source of truth. Prefer application-owned identifiers/timestamps in the initial loop so tests do not depend on sequences or DB defaults. |
| Run `ztd init --workflow empty` | CLI | ZTD-only | Scaffold folders, config, and test placeholders mechanically. |
| Run `ztd ztd-config` | CLI | ZTD-only | Regenerate `TestRowMap` directly from DDL without applying migrations. |
| Write SQL assets under `src/sql` using named params | AI / Human | ZTD-only | Keep the handwritten SQL authoritative while matching the default `model-gen` policy. |
| Implement QuerySpecs, repositories, and ZTD tests | AI / Human | ZTD-only | Contract semantics, DTO shape, and query boundaries still require judgment. |
| Run `vitest` against an empty Postgres instance | CLI | ZTD-only | ZTD should stay green before any physical app tables exist. |
| Run `ztd model-gen --probe-mode ztd` against your local DDL snapshot | CLI | ZTD-only | This keeps QuerySpec scaffolding inside the zero-migration inner loop as long as the referenced schema is represented in `ztd/ddl/*.sql`. |
| Apply DDL to a live database only when you need live-schema tooling | Human / CLI | Live-schema | This is where `ddl pull`, `ddl diff`, E2E setup, deploy-time migration work, and optional live probing begin. |
| Run `ztd model-gen --probe-mode live` only when local DDL is intentionally not the source of truth | CLI | Live-schema | Use live probing for objects missing from local DDL or when you explicitly want the currently deployed database metadata. |

Use this split to classify repetition:

- Repeated CLI retries caused by missing flags, missing paths, or boilerplate setup usually belong in docs or CLI automation.
- Repeated AI retries caused by contract shape, nullability, naming, or domain semantics usually indicate design choices that should stay reviewable.
- Prefer the ZTD-only loop by default. If a task is impossible there because the required metadata is not represented in local DDL, treat it as a Live-schema concern instead of forcing migrations into the inner loop.

## Commands

| Command | Description |
|---------|-------------|
| `ztd init` | Create a ZTD-ready project layout (DDL folder, config, test stubs) |
| `ztd init --yes` | Non-interactive mode: accept defaults (demo workflow, Zod validator) and overwrite existing files |
| `ztd init --workflow <type>` | Specify schema workflow: `pg_dump`, `empty`, or `demo` |
| `ztd init --validator <type>` | Specify validator backend: `zod` or `arktype` |
| `ztd init --dry-run` | Validate init inputs and emit the planned scaffold without writing files |
| `ztd init --json <payload>` | Pass init options as a raw JSON object for automation |
| `ztd init --local-source-root <path>` | Scaffold for local-source dogfooding and link `@rawsql-ts/sql-contract` from a monorepo path instead of npm |
| `ztd init --with-sqlclient` | Also scaffold a minimal `SqlClient` boundary for repositories |
| `ztd init --with-app-interface` | Append application interface guidance to `AGENTS.md` only |
| `ztd agents install` | Materialize visible `AGENTS.md` files from the managed templates |
| `ztd agents status` | Report internal/visible AGENTS state and drift signals |
| `ztd ztd-config` | Generate `TestRowMap` and layout from DDL files (prints next-step hints) |
| `ztd ztd-config --watch` | Regenerate on DDL changes |
| `ztd ztd-config --dry-run` | Validate DDL inputs and render generated outputs without writing files |
| `ztd ztd-config --json <payload>` | Pass ztd-config options as a raw JSON object |
| `ztd model-gen <sql-file>` | Generate QuerySpec DTO types and rowMapping by probing live PostgreSQL metadata or ZTD-backed DDL metadata |
| `ztd model-gen --dry-run` | Validate the probe and generated output without writing the destination file |
| `ztd model-gen --describe-output` | Describe the generated artifact contract, output rules, and collision behavior |
| `ztd model-gen --json <payload>` | Pass `model-gen` options as a raw JSON object |
| `ztd model-gen --import-style <style>` | Switch generated `sql-contract` imports between package and local relative styles |
| `ztd model-gen --import-from <specifier>` | Override the generated `sql-contract` import target explicitly |
| `ztd ztd-config --quiet` | Suppress next-step hints (useful in scripts) |
| `ztd ddl pull` | Fetch schema from a live Postgres database via `pg_dump` |
| `ztd ddl pull --dry-run` | Run `pg_dump` and normalize the schema without writing files |
| `ztd ddl pull --json <payload>` | Pass pull options as a raw JSON object |
| `ztd ddl diff` | Diff local DDL snapshot against a live database |
| `ztd ddl diff --dry-run` | Compute the diff plan without writing the patch file |
| `ztd ddl diff --json <payload>` | Pass diff options as a raw JSON object |
| `ztd ddl gen-entities` | Generate `entities.ts` for ad-hoc schema inspection |
| `ztd ddl gen-entities --dry-run` | Render `entities.ts` output without writing the destination file |
| `ztd ddl gen-entities --json <payload>` | Pass generation options as a raw JSON object |
| `ztd lint <path>` | Lint SQL files with fixture-backed validation |
| `ztd lint --json <payload>` | Pass the lint path as a raw JSON object |
| `ztd evidence --mode specification` | Export executable specification evidence from SQL catalogs and test files |
| `ztd evidence --json <payload>` | Pass evidence options as a raw JSON object |
| `ztd check contract --json <payload>` | Pass contract-check options as a raw JSON object |
| `ztd describe` | List command descriptions and machine-readable capability metadata |
| `ztd describe command <name>` | Describe one command in detail, including dry-run and JSON support |
| `ztd --output json <command>` | Emit a versioned JSON envelope for supported commands |
| `ztd query uses table <schema.table>` | Find catalog SQL statements that use a table target |
| `ztd query uses column <schema.table>.<column>` | Find catalog SQL statements that use a column target with explicit uncertainty labels |
| `ztd query uses column --json <payload>` | Pass the target and query-uses options as a raw JSON object |
| `ztd query uses --sql-root <dir>` | Resolve existing `spec.sqlFile` values against a project SQL root such as `src/sql` before trying legacy spec-relative paths |
| `ztd query uses --exclude-generated` | Exclude specs under `src/catalog/specs/generated` when those files are review-only noise during impact scans |

### Introspection examples

```bash
npx ztd describe
npx ztd describe command init
npx ztd --output json describe command model-gen
```

## Impact Investigation

Use `ztd query uses` before renaming or deleting catalog-facing SQL assets. The command is strict by default and never broadens matching unless you opt in with relaxed flags.

Existing `spec.sqlFile` strings do not need to change. `query uses` now resolves them against the project SQL root first (`--sql-root`, default `src/sql`) and then falls back to the legacy spec-relative lookup for backward compatibility.

- `impact` is the default view for the initial "used or not, and by which queries?" pass.
- Use `--view detail` when you need edit-ready locations and snippets for refactoring.
- Use `--exclude-generated` when `src/catalog/specs/generated` contains review-only scaffolds that would otherwise add noise to the scan. The flag is optional, and the default scan set is unchanged.

`--exclude-generated` excludes specs under `src/catalog/specs/generated` only. Existing projects do not need to change their catalog layout or `spec.sqlFile` conventions.

Recommended pattern from dogfooding:

- Table add / column add: the default scan is usually enough because the expected answer is often "no matches".
- Table rename / column rename / column type change: prefer `--exclude-generated` because generated and probe specs are more likely to add noise to the impact list.

Observed dogfooding example for a rename check:

- Without the flag: `catalogs: 9`, `matches: 3`
- With `--exclude-generated`: `catalogs: 5`, `matches: 1`

### Strict examples

```bash
npx ztd query uses table public.users
npx ztd query uses table public.users --sql-root src/sql
npx ztd query uses table public.users --exclude-generated
npx ztd query uses column public.users.email
npx ztd query uses column public.users.email --format json
npx ztd query uses column public.users.email --view detail
npx ztd query uses table public.sale_items --exclude-generated
npx ztd query uses table public.sale_lines --exclude-generated
npx ztd query uses column public.products.title --exclude-generated
npx ztd query uses column public.sale_items.quantity --exclude-generated
npx ztd query uses table public.sale_lines --view detail --exclude-generated
```

### Relaxed examples

```bash
npx ztd query uses table users --any-schema
npx ztd query uses column users.email --any-schema
npx ztd query uses column email --any-schema --any-table --format json
```

### JSON example

```json
{
  "schemaVersion": 2,
  "mode": "exact",
  "view": "impact",
  "target": {
    "kind": "column",
    "raw": "public.users.email",
    "schema": "public",
    "table": "users",
    "column": "email"
  },
  "summary": {
    "catalogsScanned": 1,
    "statementsScanned": 1,
    "matches": 1,
    "fallbackMatches": 0,
    "unresolvedSqlFiles": 0,
    "parseWarnings": 0
  },
  "matches": [
    {
      "kind": "impact",
      "catalog_id": "catalog.users",
      "query_id": "catalog.users:1",
      "statement_fingerprint": "239a3252c4fe",
      "sql_file": "src/sql/users.sql",
      "usageKindCounts": {
        "order-by": 1,
        "select": 1,
        "where": 1
      },
      "confidence": "low",
      "notes": [
        "statement-has-ambiguous-occurrences",
        "statement-has-unqualified-column"
      ],
      "source": "ast",
      "representatives": [
        {
          "usage_kind": "order-by",
          "location": {
            "startLine": 4,
            "startColumn": 10,
            "endLine": 4,
            "endColumn": 15,
            "fileOffsetStart": 57,
            "fileOffsetEnd": 62
          },
          "snippet": "ORDER BY email",
          "confidence": "low",
          "notes": [
            "unqualified-column"
          ]
        },
        {
          "usage_kind": "where",
          "location": {
            "startLine": 3,
            "startColumn": 7,
            "endLine": 3,
            "endColumn": 12,
            "fileOffsetStart": 37,
            "fileOffsetEnd": 42
          },
          "snippet": "WHERE email = $1",
          "exprHints": [
            "comparison"
          ],
          "confidence": "low",
          "notes": [
            "unqualified-column"
          ]
        }
      ]
    }
  ],
  "warnings": [],
  "display": {
    "summaryOnly": false,
    "totalMatches": 1,
    "returnedMatches": 1,
    "totalWarnings": 0,
    "returnedWarnings": 0,
    "truncated": false
  }
}
```

### Output fields

- `mode` tells you whether the query ran in `exact`, `any-schema`, or `any-schema-any-table` mode.
- `view` tells you whether the report is aggregated for impact investigation or expanded for refactor detail.
- `confidence` exposes how reliable a match is. Relaxed mode and ambiguous static matches intentionally drop to `low`.
- `notes` lists why confidence dropped, such as `unqualified-column`, `wildcard-select`, or `parser-fallback`.
- `source` distinguishes AST-derived matches from fallback-derived matches.
- `statement_fingerprint` is a stable hash of normalized statement text. It is designed to survive comment and whitespace changes under the current normalization contract.
- `impact` view aggregates by statement fingerprint, while `detail` view emits one row per occurrence with clause-aware locations.
- `impact` representatives may omit `select` due to high variance and length; use `detail` for edit-ready `SELECT` occurrences.
- `display` reports whether `--summary-only` or `--limit` truncated the returned rows while preserving the underlying summary totals.

Static column analysis does not guarantee semantic identity.

The absence of `exprHints` does not imply the absence of expression features. `exprHints` is best-effort only.

## After DDL/Schema Changes

When your database schema evolves, regenerate test types and re-run tests. Here is the standard workflow and common patterns.

### Standard workflow

```bash
# 1. Update DDL files in ztd/ddl/
#    Edit manually, or pull from a live database:
npx ztd ddl pull

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

| Symptom | Cause | Fix |
|---------|-------|-----|
| `TestRowMap` not updated | Forgot to run `ztd-config` | Run `npx ztd ztd-config` |
| Compile errors after `ztd-config` | Schema shape changed | Update fixtures, specs, and column maps to match new shape |
| `ztd-config` fails to parse DDL | Unsupported SQL syntax | Simplify the DDL or check for dialect-specific constructs |
| Tests pass but SQL fails at runtime | DDL and live DB are out of sync | Run `npx ztd ddl diff` to compare, then `npx ztd ddl pull` to re-sync |

> **Tip:** Use `npx ztd ztd-config --watch` during development to regenerate types automatically when DDL files change.

## What is ZTD?

Zero Table Dependency rewrites application CRUD statements into fixture-backed SELECT queries, so tests consume fixtures and generated types instead of a live mutable schema.

- Schema changes are expressed via SQL files (DDL)
- `ztd-config` generates TypeScript types from those DDL files
- Tests run deterministically without creating or mutating tables

The typical loop: `ztd ddl pull` -> edit `ztd/ddl/*.sql` -> `ztd ztd-config --watch` -> write tests.

## QuerySpec Workflow

`ztd model-gen` is designed for SQL asset files under `src/sql/` and assumes **named parameters** (`:name`).

Important context:
- `:name` is an intentional project-level SQL asset convention, not native PostgreSQL syntax.
- Before probing, `model-gen` binds named parameters to PostgreSQL placeholders such as `$1`, `$2` and runs a metadata-only wrapper query.
- The probe connection can come from `DATABASE_URL`, `ztd.config.json`, `--url`, or the `--db-*` flags.
- `--probe-mode live` is the default. It requires the referenced tables/views to exist in the target database.
- `--probe-mode ztd` keeps the same live Postgres connection, but rewrites the probe through your DDL snapshot so physical app tables are not required. It uses `ztd.config.json` (`ddlDir`, `ddl.defaultSchema`, `ddl.searchPath`) unless you override the directory with `--ddl-dir`.

```text
1. Write SQL in src/sql/ using named parameters such as :customerId
2. Prefer the ZTD-first command during the inner loop:
   - `ztd model-gen src/sql/my_query.sql --probe-mode ztd --out src/catalog/specs/my-query.spec.ts`
   - Or validate only: `ztd model-gen src/sql/my_query.sql --probe-mode ztd --out src/catalog/specs/my-query.spec.ts --dry-run`
3. Use the live probe only when local DDL is not the source of truth:
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
- SQL asset files should use named parameters (`:name`) by policy.
- PostgreSQL does not understand `:name` directly; `model-gen` rewrites the probe query to indexed placeholders before execution.
- Positional placeholders (`$1`, `$2`, ...) are rejected by default.
- Use `--allow-positional` only for legacy SQL that you cannot rewrite yet.
- `--probe-mode ztd` is the recommended choice for the fast ZTD-only loop when you already have `ztd/ddl/*.sql` but have not applied migrations.
- In `--probe-mode ztd`, unqualified table references are resolved with the same `defaultSchema` / `searchPath` priority configured in `ztd.config.json`.
- The default remains `--probe-mode live` for backward compatibility, but documentation and happy-path guidance treat `--probe-mode ztd` as the preferred inner-loop mode.
- `--probe-mode live` remains the right choice for schema objects that are not yet represented in local DDL, or when you intentionally want the currently deployed database metadata.
- `--ddl-dir` overrides the DDL directory only for `--probe-mode ztd`.
- `--import-style package` keeps the generated import on `@rawsql-ts/sql-contract`.
- `--import-style relative` targets `src/local/sql-contract.ts` by convention and requires `--out`.
- `--import-from` overrides the generated import target and can point at either a bare package specifier or a filesystem path.
- `--sql-root` defaults to `src/sql` and controls how `sqlFile` plus `spec id` are derived.
- `--dry-run` validates the probe and reports the intended output path without writing the generated file.
- `--describe-output` prints the generated artifact contract without connecting to PostgreSQL.
- `--json <payload>` accepts a raw JSON object of command options for automation.
- `--debug-probe` prints the bound probe SQL and ordered parameter names to stderr before the live probe runs.
- Common failure modes are unsupported placeholder syntax, connection/authentication errors, missing live schema objects in `live` mode, missing DDL directories in `ztd` mode, invalid probe SQL, and queries that do not expose any columns.
- The generated file is a starting point only. Review imports, nullability, cardinality, rowMapping key, runtime normalization, and example values before typechecking or committing it.

### Optional-condition SQL belongs in SSSQL first

If the request is "add an optional filter" for a SQL asset under `src/sql/`, prefer keeping that optionality in the SQL file itself before reaching for string-built query assembly.

Use truthful branches such as:

```sql
where (:brand_name is null or p.brand_name = :brand_name)
```

This keeps the saved SQL asset readable, probeable, and reviewable in the normal ZTD loop:

1. edit the SQL file
2. run `ztd model-gen --probe-mode ztd` if the contract changed
3. run `ztd lint` and tests

When the runtime layer uses `rawsql-ts`, pair that SQL with `DynamicQueryBuilder` and `optionalConditionParameters` instead of inventing a separate `WHERE` concatenation path.

Read more:

- [ztd-cli SSSQL Authoring](../../docs/guide/ztd-cli-sssql-authoring.md)
- [What Is SSSQL?](../../docs/guide/sssql-overview.md)
- [SSSQL Optional-Condition Dogfooding](../../docs/dogfooding/sssql-optional-condition.md)

### Developer note: unqualified names and CLI test coverage

- The ZTD probe path resolves unqualified table names such as `from users` through the same `ddl.defaultSchema` / `ddl.searchPath` order that runtime rewrites use.
- The DB-backed CLI regression tests for this path live in `packages/ztd-cli/tests/cliCommands.test.ts`.
- Those CLI tests are skipped when `pg_dump` is unavailable in `PATH`, because the suite shares the same disposable-Postgres gate as other CLI database tests.

Manual reproduction command (empty Postgres + DDL snapshot + unqualified SQL):

```bash
ztd model-gen src/sql/users/list_users.sql \
  --probe-mode ztd \
  --sql-root src/sql \
  --out src/catalog/specs/generated/list-users.spec.ts \
  --debug-probe \
  --url postgres://postgres:postgres@127.0.0.1:55432/app_db
```

Use DDL such as `CREATE TABLE public.users (...)` in `ztd/ddl/public.sql`, keep the SQL unqualified (`select user_id from users`), and set `ddl.defaultSchema` / `ddl.searchPath` in `ztd.config.json` to the schema order you expect.

## Telemetry Philosophy

`ztd-cli` telemetry is opt-in investigation tooling for dogfooding, debugging, and optimization. It is intentionally outside the default happy path, it must not become mandatory for published-package usage, and production embedding/export stays optional and off by default.

Read the full guidance in [ztd-cli Telemetry Philosophy](../../docs/guide/ztd-cli-telemetry-philosophy.md), [ztd-cli Telemetry Policy](../../docs/guide/ztd-cli-telemetry-policy.md), [ztd-cli Telemetry Export Modes](../../docs/guide/ztd-cli-telemetry-export-modes.md), [Telemetry Dogfooding Scenarios](../../docs/dogfooding/telemetry-dogfooding.md), [SQL Debug Recovery Dogfooding](../../docs/dogfooding/sql-debug-recovery.md), and [Test Documentation Dogfooding](../../docs/dogfooding/test-documentation.md).
## Further Reading

- Local-source quick start:

```bash
npx ztd init --workflow empty --validator zod --local-source-root ../../..
```

This mode emits `src/local/sql-contract.ts`, links `@rawsql-ts/sql-contract` via `file:`, switches `test` / `typecheck` through a local-source guard, and keeps `model-gen --probe-mode ztd --import-style relative` ready for a nested dogfooding app under `tmp/`.

- [Feature Index](../../docs/guide/feature-index.md) — at-a-glance list of easy-to-miss capabilities
- [SQL Tool Happy Paths](../../docs/guide/sql-tool-happy-paths.md) — choose between query plan, perf, query uses, and telemetry based on the problem shape
- [ztd-cli SSSQL Authoring](../../docs/guide/ztd-cli-sssql-authoring.md) — keep optional-condition requests on the SQL-first path in ZTD projects
- [Local-Source Dogfooding](../../docs/guide/ztd-local-source-dogfooding.md) — avoid nested pnpm workspace drift and generated import mismatches
- [Postgres Pitfalls](../../docs/guide/postgres-pitfalls.md) — common Postgres-specific surprises
- [Spec-Change Scenarios](../../docs/guide/spec-change-scenarios.md) — condensed digest of common schema changes
- [Mapping vs Validation Pipeline](../../docs/recipes/mapping-vs-validation.md) — avoid coerce/validator conflicts

## Glossary

| Term | Description |
|------|-------------|
| **DDL** | SQL files defining schema objects (tables, enums, indexes) |
| **TestRowMap** | Generated TypeScript types describing test rows for each table |
| **Fixture** | Static rows used by the driver to answer queries deterministically |
| **Driver** | Package connecting to your DB engine and running the rewrite + fixture pipeline |

## License

MIT
