# @rawsql-ts/ztd-cli

Scaffold **Zero Table Dependency (ZTD)** projects and keep DDL-derived test types in sync.

`@rawsql-ts/ztd-cli` does **not** execute SQL. To run queries in tests, install a driver such as `@rawsql-ts/pg-testkit` (Postgres).

## Install

```bash
pnpm add -D @rawsql-ts/ztd-cli
```

For actual test execution:

```bash
pnpm add -D @rawsql-ts/pg-testkit
```

If you run `npx ztd init`, the CLI will automatically add and install the devDependencies referenced by the generated templates (Postgres defaults to `@rawsql-ts/pg-testkit`).

Then use the CLI through `npx ztd` or the installed `ztd` bin.

## Getting Started (Fast Path)

1. Initialize a ZTD layout:

   ```bash
   npx ztd init
   ```

2. Put your schema into `ztd/ddl/`:

   - Edit the starter file (default): `ztd/ddl/public.sql`, or
   - Pull from a live Postgres database: `npx ztd ddl pull` (Postgres only; uses `pg_dump`)

3. Generate test types (`TestRowMap`) from DDL:

   ```bash
   npx ztd ztd-config
   # or keep it updated while you edit SQL:
   npx ztd ztd-config --watch
   ```

   This step writes files under `tests/generated/`. Treat everything in that directory as generated output: never edit it and never commit it. If you clone the repo into a clean environment and TypeScript reports missing modules under `tests/generated/`, rerun `npx ztd ztd-config`.

4. Write tests using the generated test types + the driver wiring:

   - `tests/generated/ztd-row-map.generated.ts` (generated test types; authoritative `TestRowMap`)
   - `tests/support/testkit-client.ts` (driver wiring helper)

If you already have a database, the most common loop is:
`ztd ddl pull` -> edit `ztd/ddl/*.sql` -> `ztd ztd-config --watch` -> write tests.

At this point, you can write deterministic DB tests without creating tables or running migrations.

You can introduce ZTD incrementally; existing tests and ORMs can remain untouched.

## What `ztd init` Generates

- `ztd/ddl/<schema>.sql` (starter schema files you can edit or replace; the default schema is `public.sql`)
- `tests/generated/ztd-row-map.generated.ts` (auto-generated `TestRowMap`, the canonical test type contract; do not commit)
- `tests/support/testkit-client.ts` (auto-generated helper that boots a database client, wires a driver, and shares fixtures across the suite)
- `ztd.config.json` (CLI defaults and resolver hints: `dialect`, `ddlDir`, `testsDir`, plus `ddl.defaultSchema`/`ddl.searchPath` for resolving unqualified tables)
- `tests/generated/ztd-layout.generated.ts` (generated layout snapshot; do not commit)
- `tests/support/global-setup.ts` (shared test setup used by the generated testkit client)
- `README.md` describing the workflow and commands
- `AGENTS.md` (copied from the package template unless the project already has one)
- `ztd/AGENTS.md` and `ztd/README.md` (folder-specific instructions that describe the new schema/domain layout)
- Optional guide stubs under `src/` and `tests/` if requested

The resulting project follows the "DDL -> ztd-config -> tests" flow so you can regenerate everything from SQL-first artifacts.

## Commands

### `ztd init`

Creates a ZTD-ready project layout (DDL folder, config, generated layout, and test support stubs). It does not connect to your database.

### `ztd ztd-config`

Reads every `.sql` file under the configured DDL directory and produces the generated artifacts under `tests/generated/`:
- `tests/generated/ztd-row-map.generated.ts`
- `tests/generated/ztd-layout.generated.ts`

- The row map exports `TestRowMap` plus table-specific test-row interfaces.
- `--watch` overwrites only the `tests/generated/` outputs (no other folders are touched during the watch cycle).
- Pass `--default-schema` or `--search-path` to update the `ddl.defaultSchema`/`ddl.searchPath` block in `ztd.config.json` so the CLI and drivers resolve unqualified tables the same way.
- Never edit `tests/generated/` by hand. Rerun `npx ztd ztd-config` whenever schema/layout inputs change.

### `ztd ddl ...`

Every `ztd ddl` subcommand targets the shared DDL directory defined in `ztd.config.json` (default `ztd/ddl/`).

### `ztd ddl pull`

Fetches the schema via `pg_dump`, normalizes the DDL, and writes one file per schema under `ztd/ddl/<schema>.sql` (no `schemas/` subdirectory so each namespace lives at the DDL root).

- Output is deterministic: it drops headers/`SET` statements, sorts objects, and ensures each schema file ends with a clean newline so diffs stay stable.
- You can scope the pull with `--schema <name>` (repeatable) or `--table <schema.table>` (repeatable).

Connection resolution (in order):

1. `DATABASE_URL`
2. CLI overrides (`--url` / `--db-*` flags)
3. A `connection` block in `ztd.config.json`

 A sample `connection` block looks like:

 ```json
 {
   "connection": {
     "host": "db.example",
     "port": 5432,
     "user": "app",
     "password": "secret",
     "database": "app_db"
   }
 }
 ```

Unqualified table references are treated as belonging to the `public` schema by default, so `users` is interpreted as `public.users`. If your project relies on a different namespace, update the `ddl.defaultSchema`/`ddl.searchPath` block in `ztd.config.json` so the CLI and downstream tests agree on how unqualified names are resolved.

 > **Note:** `ztd ddl` commands that contact your database depend on the `pg_dump` executable. Ensure `pg_dump` is installed and reachable via your `PATH` (Windows users can add `C:\Program Files\PostgreSQL\<version>\bin` or open a shell that already exposes `pg_dump`), or pass `--pg-dump-path <path>` / set `PG_DUMP_PATH` to the absolute path before running the command. When authentication fails the CLI echoes the target host/port/database/user so you know what credential set to double-check.

On Windows, register the executable for future PowerShell sessions:

```powershell
setx PG_DUMP_PATH "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
```

Open a new PowerShell window after running this command so the updated environment variable is available to `ztd` commands.

### `ztd ddl gen-entities`

Reads the DDL directory and generates `entities.ts` (optional reference for helpers). Use it when you want TypeScript helpers for ad-hoc schema inspection without replacing `TestRowMap` as the source of truth.

### `ztd ddl diff`

Diffs the local DDL snapshot against a live Postgres database. It uses the shared DDL directory, respects configured extensions, and outputs a human-readable plan with `pg_dump`.

## ZTD Testing

Driver responsibilities live in companion packages such as `@rawsql-ts/pg-testkit` for Postgres.

The driver sits downstream of `testkit-core` and applies the rewrite + fixture pipeline before running any database interaction. Install the driver, configure it in your tests, and point it at the row map from `tests/generated/ztd-row-map.generated.ts`.

### SQL rewrite logging (generated `testkit-client.ts`)

The `tests/support/testkit-client.ts` helper generated by `ztd init` can emit structured logs that show the SQL before and after pg-testkit rewrites it.

Enable it via environment variables:

- `ZTD_SQL_LOG=1` (or `true`/`yes`): log original + rewritten SQL
- `ZTD_SQL_LOG_PARAMS=1` (or `true`/`yes`): include parameters in the logs

You can also enable/disable logging per call by passing `ZtdSqlLogOptions` as the second argument to `createTestkitClient`.

## Concepts (Why ZTD?)

### What is ZTD?

Zero Table Dependency (ZTD) keeps your tests aligned with a real database engine without ever creating or mutating physical tables during the test run.

- Application CRUD statements are rewritten into fixture-backed `SELECT` queries.
- Schema changes are expressed via SQL files (DDL) and their generated row map.
- Tests consume fixtures + types, not a live mutable schema, which keeps the suite deterministic and safe for automated code generation.

### Schema resolution (`defaultSchema` / `searchPath`)

Application SQL can omit schema qualifiers (for example, `SELECT ... FROM users`). Drivers resolve those references using the `ddl.defaultSchema` and `ddl.searchPath` settings in `ztd.config.json` before matching fixtures / DDL metadata.

## Glossary

- **DDL**: SQL files that define schema objects (tables, enums, indexes, etc.).
- **Row map (`TestRowMap`)**: Generated TypeScript types describing test rows for each table from DDL.
- **Fixture**: Static rows used by the driver to answer queries deterministically.
- **Driver**: The package that connects to your database engine and runs the rewrite + fixture pipeline (for example, `@rawsql-ts/pg-testkit`).

## AI Coding Workflow (Optional)

1. Update the relevant `ztd/ddl/<schema>.sql` file (for example, `ztd/ddl/public.sql`) with the desired schema.
2. Run `npx ztd ztd-config` (or `--watch`) to regenerate the generated outputs under `tests/generated/`.
3. Use the row map + fixtures to write repositories, tests, and fixtures.
4. Run tests through `pg-testkit` (or another driver) since `ztd-cli` itself never executes SQL.
5. When generating code with an AI tool, feed it `tests/generated/ztd-row-map.generated.ts`, `tests/generated/ztd-layout.generated.ts`, `ztd.config.json`, and any AGENTS guidance so it can respect the ZTD contract.

## AGENTS.md

`ztd init` copies the AGENTS template from this package into the project root, preferring `AGENTS.md` unless a file already exists (then it falls back to `AGENTS_ztd.md`). The template explains the conventions for AI agents, including which testkit to use, how to treat `tests/generated/ztd-row-map.generated.ts`, and how to avoid mutating schema files. Keep the generated AGENTS file in version control so every future AI assistant receives the same guidance.

`ztd init` also creates `ztd/AGENTS.md` and `ztd/README.md` so contributors always see the canonical DDL, enum, and domain-spec guidance inside the new layout.
