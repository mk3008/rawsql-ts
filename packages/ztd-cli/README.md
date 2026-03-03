# @rawsql-ts/ztd-cli

![npm version](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

CLI tool for scaffolding **Zero Table Dependency (ZTD)** projects and keeping DDL-derived test types in sync. ZTD keeps your tests aligned with a real database engine without ever creating or mutating physical tables during the test run.

`ztd-cli` does **not** execute SQL by itself. To run ZTD tests, plug in a database adapter and a DBMS-specific testkit (e.g., `@rawsql-ts/adapter-node-pg` + `@rawsql-ts/testkit-postgres` for Postgres).

## Features

- Project scaffolding with `ztd init` (DDL folder, config, test stubs)
- DDL-to-TypeScript type generation (`TestRowMap`)
- Live QuerySpec scaffold generation from SQL assets (`ztd model-gen`)
- Schema pull from live Postgres via `pg_dump`
- DDL diff against a live database
- SQL linting with fixture-backed validation
- Deterministic test specification evidence export (JSON / Markdown)
- Watch mode for continuous regeneration
- Validator selection (Zod or ArkType) during init

## Installation

```bash
npm install -D @rawsql-ts/ztd-cli
```

## Happy Path Quickstart

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
| `ztd/ddl/demo.sql` | Sample DDL (3 tables: user, task, task_assignment) |
| `ztd.config.json` | CLI defaults and resolver hints |
| `tests/smoke.test.ts` | Minimal smoke test |
| `tests/smoke.validation.test.ts` | Validator integration smoke test |
| `tests/support/testkit-client.ts` | Driver wiring placeholder |
| `src/catalog/specs/` | Spec and runtime files for the smoke contract |

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
- Wire a real driver in `tests/support/testkit-client.ts` (see [adapter-node-pg](../adapters/adapter-node-pg) for Postgres)
- Write domain tests against generated `TestRowMap` types

> **Tip:** For a non-interactive setup (CI, scripts), use `npx ztd init --yes` with explicit flags. See [Commands](#commands) for details.

## Quick Reference

```bash
# Common workflow loop
npx ztd ddl pull          # Pull schema from Postgres (optional)
npx ztd ztd-config        # Regenerate types from DDL
npx vitest run             # Run tests
npx ztd ztd-config --watch # Or keep types updated while editing DDL
```

## Commands

| Command | Description |
|---------|-------------|
| `ztd init` | Create a ZTD-ready project layout (DDL folder, config, test stubs) |
| `ztd init --yes` | Non-interactive mode: accept defaults (demo workflow, Zod validator) and overwrite existing files |
| `ztd init --workflow <type>` | Specify schema workflow: `pg_dump`, `empty`, or `demo` |
| `ztd init --validator <type>` | Specify validator backend: `zod` or `arktype` |
| `ztd init --with-sqlclient` | Also scaffold a minimal `SqlClient` boundary for repositories |
| `ztd init --with-app-interface` | Append application interface guidance to `AGENTS.md` only |
| `ztd ztd-config` | Generate `TestRowMap` and layout from DDL files (prints next-step hints) |
| `ztd ztd-config --watch` | Regenerate on DDL changes |
| `ztd model-gen <sql-file>` | Generate QuerySpec DTO types and rowMapping by probing a live database |
| `ztd ztd-config --quiet` | Suppress next-step hints (useful in scripts) |
| `ztd ddl pull` | Fetch schema from a live Postgres database via `pg_dump` |
| `ztd ddl diff` | Diff local DDL snapshot against a live database |
| `ztd ddl gen-entities` | Generate `entities.ts` for ad-hoc schema inspection |
| `ztd lint <path>` | Lint SQL files with fixture-backed validation |
| `ztd evidence --mode specification` | Export executable specification evidence from SQL catalogs and test files |
| `ztd query uses table <schema.table>` | Find catalog SQL statements that use a table target |
| `ztd query uses column <schema.table>.<column>` | Find catalog SQL statements that use a column target with explicit uncertainty labels |

## Impact Investigation

Use `ztd query uses` before renaming or deleting catalog-facing SQL assets. The command is strict by default and never broadens matching unless you opt in with relaxed flags.

- Use `--view impact` for the initial "used or not, and by which queries?" pass.
- Use `--view detail` when you need edit-ready locations and snippets for refactoring.

### Strict examples

```bash
npx ztd query uses table public.users
npx ztd query uses column public.users.email
npx ztd query uses column public.users.email --format json
npx ztd query uses column public.users.email --view detail
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
  "warnings": []
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
- Before probing the live database, `model-gen` binds named parameters to PostgreSQL placeholders such as `$1`, `$2`, and sends a probe query with placeholder values.
- The probe connection can come from `DATABASE_URL`, `ztd.config.json`, `--url`, or the `--db-*` flags.

```text
1. Write SQL in src/sql/ using named parameters such as :customerId
2. Run: ztd model-gen src/sql/my_query.sql --out src/catalog/specs/my-query.spec.ts
3. Review the generated types, rowMapping key, nullability, and normalization
4. Run ZTD tests to confirm the contract
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
- `--sql-root` defaults to `src/sql` and controls how `sqlFile` plus `spec id` are derived.
- `--debug-probe` prints the bound probe SQL and ordered parameter names to stderr before the live probe runs.
- Common failure modes are unsupported placeholder syntax, connection/authentication errors, invalid probe SQL, and queries that do not expose any columns.

## Further Reading

- [Feature Index](../../docs/guide/feature-index.md) — at-a-glance list of easy-to-miss capabilities
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
