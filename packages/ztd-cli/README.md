# @rawsql-ts/ztd-cli

## What is ZTD?

Zero Table Dependency (ZTD) keeps your tests aligned with a real database engine without ever creating or mutating physical tables during the test run. All CRUD statements are rewritten into fixture-backed `SELECT` queries, and every schema change is expressed through SQL files and their generated row map. Tests consume those rows, not the live database, which keeps the suite deterministic, repeatable, and safe for automated generation tools.

## What is @rawsql-ts/ztd-cli?

`@rawsql-ts/ztd-cli` is a **DB-independent** scaffolding engine for ZTD workflows. It never executes SQL itself; instead, it inspects DDL files, produces the `tests/ztd-config.ts` row map, and keeps project metadata (like `ztd.config.json`) in sync. To execute real SQL or run fixtures, install a companion driver such as `@rawsql-ts/pg-testkit` (Postgres) or `@rawsql-ts/sqlite-testkit` and connect your tests through that driver.

## Install

```bash
pnpm add -D @rawsql-ts/ztd-cli
```

For actual test execution:

```bash
pnpm add -D @rawsql-ts/pg-testkit
```

Then use the CLI through `npx ztd` or the installed `ztd` bin.

## ztd init

`ztd init` scaffolds the ZTD workflow:

- `ddl/schema.sql` (starter schema you can edit or replace)
 - `ztd.config.json` (hints for AI and CLI defaults: `dialect`, `ddlDir`, `testsDir`, plus a `ddl` block that controls `defaultSchema`/`searchPath` so pg-testkit can resolve unqualified tables)
- `tests/ztd-config.ts` (auto-generated `TestRowMap`, the canonical row type contract)
- `README.md` describing the workflow and commands
- `AGENTS.md` (copied from the package template unless the project already has one)
- Optional guide stubs under `src/` and `tests/` if requested

The resulting project follows the "DDL -> ztd-config -> ZTD test -> AI coding" flow so you can regenerate everything from SQL-first artifacts.

## DDL workflow

Every `ztd ddl` subcommand targets the shared DDL directory defined in `ztd.config.json` (default `ddl/`).

### `ztd ddl pull`

 Fetches the schema via `pg_dump`, normalizes the DDL, and writes one file per schema under `ddl/schemas/<schema>.sql` instead of a single `schema.sql`. The output drops headers, `SET` statements, and `\restrict` markers, sorts objects (schemas, tables, alterations, sequences, indexes) deterministically, and ensures each schema file ends with a clean newline so `ztd gen-config` and your AI flows always see stable input.

 The command resolves the database connection in three steps: prefer a `DATABASE_URL` environment variable, honor explicit flags (`--db-host`, `--db-port`, `--db-user`, `--db-password`, `--db-name`) when supplied, and finally fall back to a `connection` block in `ztd.config.json` if present. Flags that provide partial credentials will cause the CLI to error before invoking `pg_dump` so you know exactly what is missing, and the generated error message always mentions the connection target together with concrete fixes.

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


You can scope the pull with `--schema <name>` (repeatable) or `--table <schema.table>` (repeatable); filtered pulls only emit the requested schemas/tables and their dependent objects. If no filters are provided, the command retrieves the full schema and still splits it by namespace.

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

## ztd-config

`ztd ztd-config` reads every `.sql` file under the configured DDL directory and produces `tests/ztd-config.ts`, which exports `TestRowMap` plus the table-specific test-row interfaces. This file is the only place your tests should look for column shapes and nullability. The command can `--watch` the DDL sources and automatically regenerate the row map, but the watcher **only overwrites `tests/ztd-config.ts`**; no other folders (`src/`, fixtures, `AGENTS.md`, etc.) are touched during the watch cycle.

Pass `--default-schema` or `--search-path` when running `ztd ztd-config` to update the `ddl.defaultSchema`/`ddl.searchPath` block in `ztd.config.json` so pg-testkit and the CLI agree on how unqualified table names should be resolved.

Watch mode is safe: it regenerates the tests file as soon as DDL changes are saved and logs every write so you can confirm no additional files were modified.

## ZTD Testing

Driver responsibilities live in companion packages:

- `@rawsql-ts/pg-testkit` for Postgres
- `@rawsql-ts/sqlite-testkit` for SQLite

Both drivers sit downstream of `testkit-core` and apply the rewrite + fixture pipeline before running any database interaction. Install the driver that matches your engine, configure it in your tests, and point it at the row map from `tests/ztd-config.ts`.

## AI Coding Workflow

1. Update `ddl/schema.sql` with the desired schema.
2. Run `npx ztd ztd-config` (or `--watch`) to regenerate the authoritative `TestRowMap`.
3. Use the row map + fixtures to write repositories, tests, and fixtures.
4. Run tests through `pg-testkit` (or another driver) since `ztd-cli` itself never executes SQL.
5. When generating code with an AI tool, feed it `tests/ztd-config.ts`, `ztd.config.json`, and any AGENTS guidance so it can respect the ZTD contract.

## AGENTS.md

`ztd init` copies the AGENTS template from this package into the project root, preferring `AGENTS.md` unless a file already exists (then it falls back to `AGENTS_ZTD.md`). The template explains the conventions for AI agents, including which testkit to use, how to treat `tests/ztd-config.ts`, and how to avoid mutating schema files. Keep the generated AGENTS file in version control so every future AI assistant receives the same guidance.
