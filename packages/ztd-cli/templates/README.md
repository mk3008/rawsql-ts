# Zero Table Dependency Project

This project uses Zero Table Dependency (ZTD) to keep SQL, DDL, and tests aligned.

## What ZTD owns

`ztd-cli` is responsible for ZTD test and verification workflows.

- `ztd-cli` implicitly uses only `ZTD_TEST_DATABASE_URL`.
- `DATABASE_URL` and other runtime or deployment database settings are outside the ownership of `ztd-cli`.
- Any non-ZTD database target must be passed explicitly via `--url` or a complete `--db-*` flag set.
- `ztd-cli` may generate migration SQL artifacts, but it does not apply them.

Quick boundary table:

- `ZTD_TEST_DATABASE_URL`: used by `ztd-cli` for ZTD tests and verification
- `DATABASE_URL`: runtime or deployment concern, not read automatically by `ztd-cli`
- `--url` / complete `--db-*`: explicit target inspection only

## Project layout

Key folders:

- `ztd/ddl`: schema files and source of truth for database structure
- `src/sql`: handwritten SQL assets, one query unit at a time
- `src/catalog`: QuerySpec contracts and runtime wiring
- `src/repositories`: repository entrypoints and DTO mappings
- `tests`: ZTD tests, smoke checks, and example samples

Think in query units:

- 1 SQL file
- 1 QuerySpec
- 1 repository entrypoint
- 1 DTO

Keep handwritten SQL assets in `src/sql/` as the single human-owned source location for query logic.

## Getting Started with AI

Use this scaffold as a query-unit project.

When asking an AI assistant to extend it, a natural request like the following usually works well:

```text
Install @rawsql-ts/ztd-cli from npm and implement CRUD operations for a product master table.
Use PostgreSQL 18 and Docker.
You may use the AGENTS.md included in the template as-is.
Work one query unit at a time: complete one SQL file, the corresponding QuerySpec, and its test before moving to the next.
For repository implementation, use QuerySpec + CatalogExecutor.
For tests, use the ZTD approach with tableFixture() and the testkit client.
Follow the QuerySpec and test examples included in the template.
```

A few points matter when using AI with this scaffold:

* Work one query unit at a time.
* Treat PostgreSQL and Docker as the execution environment.
* For repository code, use `QuerySpec + CatalogExecutor`.
* For tests, use fixture-backed ZTD rewrite through `tableFixture()` and the testkit client.
* Start from the provided examples instead of inventing a different structure first.

Good example files to start from:

* `tests/queryspec.example.test.ts` for the `QuerySpec + CatalogExecutor` path
* `tests/smoke.test.ts` for the fixture-backed ZTD rewrite path
* `tests/support/testkit-client.ts` for the testkit client helper

## Typical workflow

1. Update `ztd/ddl/<schema>.sql` if needed.
2. Add or edit your first SQL asset under `src/sql/`.
3. Run `npx ztd ztd-config` to regenerate DDL-derived test rows and layout metadata.
4. Run `npx ztd model-gen --probe-mode ztd <sql-file> --out <spec-file>` to scaffold a QuerySpec from that SQL file.
5. Review `src/catalog/specs/_smoke.spec.ts`, `tests/queryspec.example.test.ts`, and `src/db/sql-client.ts` so the first SQL-backed repository stays aligned as 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.
6. Run tests with `npm run test` or `npx vitest run`.
7. After the smoke path is green, continue with the next query unit.

## If a command fails

* If `npx ztd ztd-config` fails, continue editing `ztd/ddl/<schema>.sql` and `src/sql/` first, then rerun generation after the DDL is ready.
* If `npx ztd model-gen` fails, keep the SQL file and rerun after `npx ztd ztd-config` succeeds.
* The `ztd` probe path does not require `DATABASE_URL`.
* If you do not have `ZTD_TEST_DATABASE_URL` yet, use the generated smoke test as the first DB-free pass and add SQL-backed tests after the connection is ready.
* If you want a concrete repository-oriented sample, start from `tests/queryspec.example.test.ts` after the smoke path is green.

Use these commands only for explicit target inspection by passing `--url` or a complete `--db-*` flag set:

* `ztd model-gen --probe-mode live`
* `ztd ddl pull`
* `ztd ddl diff`

If you generate migration SQL artifacts, apply them with your deployment tooling instead of `ztd-cli`.

## Local source mode

If this project was scaffolded with `ztd init --local-source-root <monorepo-root>`, run:

1. `pnpm install`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm ztd ztd-config`

If the project is nested under another `pnpm-workspace.yaml`, use `pnpm install --ignore-workspace` first.

The scaffold keeps `@rawsql-ts/sql-contract` as a normal package import even in local-source developer mode.

## Schema-change impact checks

For schema-change impact checks, `npx ztd query uses` defaults to the `impact` view.

Table add and column add checks usually work well with the default scan.
Table rename, column rename, and column type change checks often benefit from `--exclude-generated` so review-only specs under `src/catalog/specs/generated` do not add noise.

The flag is optional and does not change the default scan set.

Examples:

```bash
npx ztd query uses table public.sale_items --exclude-generated
npx ztd query uses table public.sale_lines --exclude-generated
npx ztd query uses column public.products.title --exclude-generated
npx ztd query uses column public.sale_items.quantity --exclude-generated
npx ztd query uses table public.sale_lines --view detail --exclude-generated
```
