# @rawsql-ts/ztd-cli

![npm version](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

CLI tool for scaffolding **Zero Table Dependency (ZTD)** projects and keeping DDL-derived test types in sync. ZTD keeps your tests aligned with a real database engine without ever creating or mutating physical tables during the test run.

`ztd-cli` does **not** execute SQL by itself. To run ZTD tests, plug in a database adapter and a DBMS-specific testkit (e.g., `@rawsql-ts/adapter-node-pg` + `@rawsql-ts/testkit-postgres` for Postgres).

## Features

- Project scaffolding with `ztd init` (DDL folder, config, test stubs)
- DDL-to-TypeScript type generation (`TestRowMap`)
- Schema pull from live Postgres via `pg_dump`
- DDL diff against a live database
- SQL linting with fixture-backed validation
- Watch mode for continuous regeneration
- Validator selection (Zod or ArkType) during init

## Installation

```bash
npm install -D @rawsql-ts/ztd-cli
```

## Quick Start

```bash
# 1. Initialize a ZTD layout
npx ztd init

# 2. Put your schema into ztd/ddl/ (edit manually or pull from DB)
npx ztd ddl pull    # Postgres only; uses pg_dump

# 3. Generate test types from DDL
npx ztd ztd-config
# or keep it updated while you edit SQL:
npx ztd ztd-config --watch

# 4. Write tests using generated types + driver wiring
```

The generated artifacts:
- `tests/generated/ztd-row-map.generated.ts` — authoritative `TestRowMap` (do not edit or commit)
- `tests/support/testkit-client.ts` — driver wiring helper
- `ztd.config.json` — CLI defaults and resolver hints

## Commands

| Command | Description |
|---------|-------------|
| `ztd init` | Create a ZTD-ready project layout (DDL folder, config, test stubs) |
| `ztd init --with-sqlclient` | Also scaffold a minimal `SqlClient` boundary for repositories |
| `ztd init --with-app-interface` | Append application interface guidance to `AGENTS.md` only |
| `ztd ztd-config` | Generate `TestRowMap` and layout from DDL files |
| `ztd ztd-config --watch` | Regenerate on DDL changes |
| `ztd ddl pull` | Fetch schema from a live Postgres database via `pg_dump` |
| `ztd ddl diff` | Diff local DDL snapshot against a live database |
| `ztd ddl gen-entities` | Generate `entities.ts` for ad-hoc schema inspection |
| `ztd lint <path>` | Lint SQL files with fixture-backed validation |

## What is ZTD?

Zero Table Dependency rewrites application CRUD statements into fixture-backed SELECT queries, so tests consume fixtures and generated types instead of a live mutable schema.

- Schema changes are expressed via SQL files (DDL)
- `ztd-config` generates TypeScript types from those DDL files
- Tests run deterministically without creating or mutating tables

The typical loop: `ztd ddl pull` -> edit `ztd/ddl/*.sql` -> `ztd ztd-config --watch` -> write tests.

## Glossary

| Term | Description |
|------|-------------|
| **DDL** | SQL files defining schema objects (tables, enums, indexes) |
| **TestRowMap** | Generated TypeScript types describing test rows for each table |
| **Fixture** | Static rows used by the driver to answer queries deterministically |
| **Driver** | Package connecting to your DB engine and running the rewrite + fixture pipeline |

## License

MIT
