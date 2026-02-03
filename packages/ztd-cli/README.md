# @rawsql-ts/ztd-cli

Scaffold **Zero Table Dependency (ZTD)** projects and keep DDL-derived test types in sync.

`@rawsql-ts/ztd-cli` does **not** execute SQL by itself. It provides an adapter-neutral core that scaffolds a ZTD-ready development environment.  
To actually run ZTD tests, you plug in a database adapter (driver-specific) and a DBMS-specific testkit (for example, `@rawsql-ts/adapter-node-pg` plus `@rawsql-ts/testkit-postgres` for Postgres).

## Install

```bash
pnpm add -D @rawsql-ts/ztd-cli
```

To run ZTD-style tests, install:

* a **database adapter** (driver-specific) to execute SQL, and
* a **DBMS-specific testkit** to handle fixture resolution, query rewriting, and result validation.

For Postgres, the typical ZTD setup is:
`@rawsql-ts/adapter-node-pg` (driver adapter) +
`@rawsql-ts/testkit-postgres` (Postgres-specific testkit).

If you run `npx ztd init`, the CLI will install the Postgres driver/testkit stack plus `@rawsql-ts/sql-contract`, and it will always prompt you to select a validator backend (Zod or ArkType). The wizard keeps the required workflow documented in the recipes under `docs/recipes/` (e.g., `docs/recipes/sql-contract.md`, `docs/recipes/validation-zod.md`, and `docs/recipes/validation-arktype.md`), so the implementation path stays centralized and version-controlled.

Then use the CLI through `npx ztd` or the installed `ztd` bin.

## Getting Started (Fast Path)

1. Initialize a ZTD layout:

   ```bash
   npx ztd init
   ```

   For tutorials and greenfield projects, we recommend the optional SQL client seam:

  ```bash
  npx ztd init --with-sqlclient
  ```

  Use `--with-sqlclient` when you want a minimal `SqlClient` boundary for repositories. Skip it if your project
  already has a database abstraction (Prisma, Drizzle, Kysely, custom adapters) to avoid duplicating layers.

  ```bash
  npx ztd init --with-app-interface
  ```

  Use `--with-app-interface` to append the application interface guidance block to `AGENTS.md` without generating the ZTD layout or touching other files.

  ```bash
  npx ztd init --yes
  ```

  Use `--yes` to overwrite existing scaffold files without prompting (useful for non-interactive runs).

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
- `ztd.config.json` (CLI defaults and resolver hints: `dialect`, `ddlDir`, `testsDir`, `ddlLint`, plus `ddl.defaultSchema`/`ddl.searchPath` for resolving unqualified tables)
- `tests/generated/ztd-layout.generated.ts` (generated layout snapshot; do not commit)
- `tests/support/global-setup.ts` (shared test setup used by the generated testkit client)
- `README.md` describing the workflow and commands
- `AGENTS.md` (copied from the package template unless the project already has one; `--with-app-interface` adds the application interface guidance block at the end)
- `ztd/AGENTS.md` and `ztd/README.md` (folder-specific instructions that describe the new schema/domain layout)
- `src/db/sql-client.ts` (optional; generated only with `--with-sqlclient`)
- `src/sql/views/README.md` + `src/sql/jobs/README.md` (SQL file structure)
- `src/repositories/views/README.md` + `src/repositories/tables/README.md` (repository structure)
- `src/jobs/README.md` (job runner structure)
- Example view SQL/repository and job SQL/runner files for the sample schema

The resulting project follows the "DDL -> ztd-config -> tests" flow so you can regenerate everything from SQL-first artifacts.

## Commands

### `ztd init`

Creates a ZTD-ready project layout (DDL folder, config, generated layout, and test support stubs). It does not connect to your database.

Use `--with-sqlclient` to scaffold a minimal repository-facing SQL client for tutorials and new projects. It is opt-in
to avoid colliding with existing database layers. If you use `pg`, adapt `client.query(...)` so it returns a plain row
array (`T[]`) that satisfies the generated `SqlClient` interface.

Use `--with-app-interface` to append the application interface guidance block to `AGENTS.md`. This documentation-only option leaves every other file untouched, making it easy to apply the guidance to existing repositories without rerunning the full layout generator.

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

### `ztd lint`

Lint SQL files before writing ZTD tests so syntax and analysis issues surface immediately.

```bash
npx ztd lint path/to/query.sql
```

- Accepts a single `.sql` file, glob pattern, or directory (directories expand to `**/*.sql`).
- Resolves `ZTD_LINT_DATABASE_URL` or `DATABASE_URL` for the database connection. When no URL is configured, it loads `@testcontainers/postgresql` (if installed) to spin up a temporary Postgres container.
- Dynamically loads the registered adapter (for example `@rawsql-ts/adapter-node-pg` plus `@rawsql-ts/testkit-postgres`) so the rewritten statement is inspected through the fixture pipeline before it runs.
- Executes each rewritten query using `PREPARE ... AS ...` (falling back to `EXPLAIN`) so Postgres (or your adapter) performs the same parsing/type resolution used in tests.
- Reports the file path, location, error code/message/detail/hint, and a caret-marked excerpt to make fixes actionable before running tests.
- Override the database image with `ZTD_LINT_DB_IMAGE` (default `postgres:16-alpine`), or supply a URL to reuse an existing server instead of a container.
- If the adapter is missing, the command stops early with an error that points you at the adapter package to install or instructs you to set `DATABASE_URL`.

## ZTD Testing

The generated `tests/support/testkit-client.ts` is a stub. Replace `createTestkitClient` with a factory that returns an object conforming to `SqlClient` (defined in `src/db/sql-client.ts`). Use it to wire your preferred adapter (for example a Postgres adapter, a mock data source, or a fixture helper) before running the repository tests.

ZTD rewrites every statement into a fixture-friendly shape and expects your adapter to execute the rewritten SQL using the metadata under `tests/generated/ztd-row-map.generated.ts`. The CLI avoids bundling a driver so you can choose whatever stack fits your project; install the necessary adapter package and point it at the generated row map before executing DB-backed suites.

### SQL rewrite logging

If you need to inspect the rewritten SQL, add logging inside your adapter or within `tests/support/testkit-client.ts`. There is no built-in logger in the template, but you can guard logging with environment variables such as:

- `ZTD_SQL_LOG=1` or `true`: log the raw SQL plus the rewritten statement.
- `ZTD_SQL_LOG_PARAMS=1` or `true`: include query parameters in the emitted logs.

Add any adapter-specific options or helpers to control logging per call (for example, guard logging with your own `ZtdSqlLogOptions` type) so the test outputs remain deterministic when logging is disabled.

## Benchmark summary

### Purpose

This benchmark executes the same repository implementation with two different supporting stacks: the Traditional schema/migration workflow (schema setup + seed + query + cleanup) and the ZTD fixture-backed workflow (repository query → rewrite → fixture materialization). The comparison highlights:

- End-to-end wall-clock time including runner startup.
- DB execution time and SQL count so Traditional’s higher SQL volume is explicit.
- ZTD rewrite and fixture breakdowns so the internal costs of the testkit-postgres pipeline are visible.
- Parallelism effects, runner startup costs, and where the break-even point lies as suite size grows.

### Assumptions and environment

This benchmark compares ZTD-style repository tests against a traditional migration-based workflow while exercising the same repository methods. All numbers are measured with the test runner included unless stated otherwise.

#### Environment (measured run)

- Node.js: v22.14.0
- OS: Windows 10 (build 26100)
- CPU: AMD Ryzen 7 7800X3D (16 logical cores)
- Database: PostgreSQL 18.1 (containerized; `testcontainers`)
- Parallel workers: 4
- Report date: 2025-12-20

#### Benchmark shape

- Repository test cases: 3 (`customer_summary`, `product_ranking`, `sales_summary`)
- Each test performs: 1 repository call (1 SQL execution per test case)
- The Traditional workflow wraps every repository execution with migration, seeding, and cleanup SQL, whereas the ZTD workflow captures the same query, feeds it to the testkit-postgres adapter, and replays the rewritten/select-only statements backed by fixtures.
- Suite sizes shown in the report:
  - 3 tests (baseline)
  - 30 tests (the same 3 cases repeated to approximate a larger suite)

The 30-test suite exists to show how runner overhead amortizes as the number of executed tests grows, while keeping the tested SQL and data constant.

#### What is included / excluded

- **Runner-included runs (main comparison):** wall-clock time including `pnpm` + `vitest` startup and test execution.
- **Steady-state section:** measures incremental cost per iteration after the runner is warm (first iteration excluded), to approximate watch/CI-like “many tests per single runner invocation.”
- **Container startup:** excluded (the Postgres container is shared across runs).

#### Fairness / bias notes (important)

This benchmark intentionally measures the **Traditional** workflow under favorable assumptions:

- **Traditional SQL construction cost is treated as zero**: queries are hard-coded raw SQL strings (no ORM/query-builder generation time).
- **Traditional migration/DDL generation cost is treated as zero**: schema/migration SQL is also written directly (no ORM schema DSL or migration generation time).

In contrast, the **ZTD** benchmark includes the repository layer’s normal SQL usage:

- **ZTD includes SQL construction time as exercised by the repository layer** (i.e., whatever the test code does to produce the SQL text), in addition to rewrite/fixture overhead.

Because real-world ORM workflows usually add both query generation and migration generation overhead on top of what is measured here, this setup should be interpreted as a **lower bound for Traditional** and a relatively conservative comparison against ZTD.

### Results (runner included)

#### End-to-end runtime

| Suite size | Scenario | Workers | Avg Total (ms) | Avg Startup (ms) | Avg Execution (ms) | Startup % | Avg ms/test | Avg SQL Count | Avg DB (ms) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3 | Traditional | 1 | 1951.08 | 1013.22 | 937.86 | 51.8% | 650.36 | 36 | 123.06 |
| 3 | Traditional | 4 | 1301.56 | 967.02 | 334.54 | 74.3% | 433.85 | 36 | 39.06 |
| 3 | ZTD | 1 | 2283.66 | 979.91 | 1303.74 | 42.9% | 761.22 | 3 | 11.34 |
| 3 | ZTD | 4 | 1430.64 | 957.75 | 472.89 | 66.9% | 476.88 | 3 | 3.81 |
| 30 | Traditional | 1 | 3085.48 | 1018.71 | 2066.77 | 33.0% | 102.85 | 360 | 1009.85 |
| 30 | Traditional | 4 | 1788.35 | 996.66 | 791.68 | 55.8% | 59.61 | 360 | 392.83 |
| 30 | ZTD | 1 | 2480.84 | 957.91 | 1522.94 | 38.6% | 82.69 | 30 | 44.82 |
| 30 | ZTD | 4 | 1507.46 | 944.57 | 562.88 | 62.7% | 50.25 | 30 | 17.69 |

### What this shows
- **Small suites (3 tests) are dominated by runner startup.** At this scale, Traditional is faster (both serial and 4-worker), because fixed startup overhead and per-test harness work overwhelm ZTD’s per-test savings.
- **As suite size grows (30 tests), ZTD becomes faster end-to-end.**
  - Serial: ZTD 2480.84 ms vs Traditional 3085.48 ms
  - 4 workers: ZTD 1507.46 ms vs Traditional 1788.35 ms
- **Parallel execution helps both approaches**, but the improvement is constrained by startup overhead:
  - With 4 workers, the startup share rises (more of the total becomes fixed runner cost), so scaling is not linear.

### Break-even intuition (where ZTD starts to win)

From these results, the practical break-even is **between 3 and 30 tests** under the current environment and runner-included setup.

Why:
- Traditional has high per-test DB work (many SQL statements + significant DB time).
- ZTD has low per-test DB work (few SQL statements), but adds rewrite + fixture overhead.
- Once the suite is large enough that **execution dominates startup**, ZTD’s reduced DB work overtakes its rewrite/fixture costs.

### ZTD cost structure (what is expensive)

ZTD’s incremental work per test is primarily:
- **SQL-to-ZTD rewrite time**
- **Fixture materialization time**
- **DB query time** (typically small compared to Traditional)

A concrete view is easiest in the steady-state section below, where the runner is warm.

### Steady-state (runner warm) incremental cost

This approximates watch/CI iterations where the runner has already started (first repetition excluded as warmup).

| Suite | Workers | Avg incremental time per iteration (ms) | Avg SQL Count | Avg DB time (ms) | Avg rewrite (ms) | Avg fixture (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Traditional (30 tests) | 1 | 1260.20 | 360 | 1039.98 | - | - |
| ZTD (30 tests) | 1 | 93.73 | 30 | 30.08 | 32.00 | 20.42 |
| ZTD (30 tests) | 4 | 91.14 | 30 | 29.95 | 30.75 | 19.40 |

### What this shows
- Traditional steady-state is dominated by DB time (~1040 ms out of ~1260 ms).
- ZTD steady-state is dominated by **rewrite (~31 ms) + fixture (~20 ms)**; DB time is ~30 ms.
- Parallelism has limited impact in ZTD steady-state here because the per-iteration work is already small and may be bounded by coordination / shared overheads.

### Conclusion

- **Runner included (realistic)**:
  - For very small suites, startup dominates and Traditional can be faster.
  - For larger suites, ZTD wins end-to-end due to dramatically lower DB work and SQL count.
- **Parallel execution matters**, but it mainly reduces the execution portion; runner startup becomes the limiting floor.
- **ZTD’s main costs are rewrite and fixture preparation**, not DB time. This is good news: optimizing rewrite/fixture logic is the highest-leverage path for further speedups.

To regenerate the report, run:

```bash
pnpm ztd:bench
```

The report is written to `tmp/bench/report.md`.

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
- **Driver**: The package that connects to your database engine and runs the rewrite + fixture pipeline (for example, `@rawsql-ts/testkit-postgres` plus `@rawsql-ts/adapter-node-pg`).

## AI Coding Workflow (Optional)

1. Update the relevant `ztd/ddl/<schema>.sql` file (for example, `ztd/ddl/public.sql`) with the desired schema.
2. Run `npx ztd ztd-config` (or `--watch`) to regenerate the generated outputs under `tests/generated/`.
3. Use the row map + fixtures to write repositories, tests, and fixtures.
4. Run tests through the testkit-postgres stack (`@rawsql-ts/testkit-postgres` + `@rawsql-ts/adapter-node-pg`) (or another driver) since `ztd-cli` itself never executes SQL.
5. When generating code with an AI tool, feed it `tests/generated/ztd-row-map.generated.ts`, `tests/generated/ztd-layout.generated.ts`, `ztd.config.json`, and any AGENTS guidance so it can respect the ZTD contract.

## AGENTS.md

`ztd init` copies the AGENTS template from this package into the project root, preferring `AGENTS.md` unless a file already exists (then it falls back to `AGENTS_ztd.md`). The template explains the conventions for AI agents, including which testkit to use, how to treat `tests/generated/ztd-row-map.generated.ts`, and how to avoid mutating schema files. Keep the generated AGENTS file in version control so every future AI assistant receives the same guidance.

`ztd init` also creates `ztd/AGENTS.md` and `ztd/README.md` so contributors always see the canonical DDL, enum, and domain-spec guidance inside the new layout.
