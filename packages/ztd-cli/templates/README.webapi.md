# Zero Table Dependency WebAPI Project

This scaffold separates WebAPI concerns into explicit layers so transport, application, and persistence code stay easy to reason about.

## What ZTD owns

`ztd-cli` is responsible for ZTD test and verification workflows.

- `ztd-cli` implicitly uses only `ZTD_TEST_DATABASE_URL`.
- Projects often also have a runtime or deployment database setting such as `DATABASE_URL`, but `ztd-cli` does not read it automatically.
- Any non-ZTD database target must be passed explicitly via `--url` or a complete `--db-*` flag set.
- `ztd-cli` may generate migration SQL artifacts, but it does not apply them.

Quick boundary table:

- `ZTD_TEST_DATABASE_URL`: used by `ztd-cli` for ZTD tests and verification
- `DATABASE_URL`: runtime or deployment concern, not read automatically by `ztd-cli`
- `--url` / complete `--db-*`: explicit target inspection only

## Project layout

Key folders:

- `src/domain`: domain types and business rules with no direct SQL dependency
- `src/application`: use cases and orchestration over domain-facing ports
- `src/presentation/http`: HTTP handlers, request parsing, and response shaping
- `src/infrastructure/persistence`: repositories, DTO mappings, and QuerySpec wiring
- `src/sql`: handwritten SQL assets, one query unit at a time
- `src/catalog`: QuerySpec contracts and runtime support
- `ztd/ddl`: schema files and source of truth for database structure
- `tests`: smoke tests, ZTD tests, and example samples

Think in query units:

- 1 SQL file
- 1 QuerySpec
- 1 repository entrypoint
- 1 DTO

Keep handwritten SQL assets in `src/sql/` as the single human-owned source location for query logic.

Keep SQL and QuerySpec work inside the persistence side of the project.
`src/domain`, `src/application`, and `src/presentation/http` should stay free from direct SQL or DDL concerns.

## Getting Started with AI

Use this scaffold as a layered WebAPI project with query-unit persistence.

When asking an AI assistant to extend it, a natural request like the following usually works well:

```text
Install @rawsql-ts/ztd-cli from npm and implement CRUD operations for a product master table in this WebAPI project.
Use PostgreSQL 18 and Docker.
You may use the AGENTS.md included in the template as-is.
Work one query unit at a time: complete one SQL file, the corresponding QuerySpec, and its test before moving to the next.
For repository implementation, use QuerySpec + CatalogExecutor.
For tests, use the ZTD approach with tableFixture() and the testkit client.
Keep handwritten SQL in src/sql/ and persistence code in src/infrastructure/persistence/.
Follow the QuerySpec and test examples included in the template.
```

A few points matter when using AI with this scaffold:

* Work one query unit at a time.
* Treat PostgreSQL and Docker as the execution environment.
* For repository code, use `QuerySpec + CatalogExecutor`.
* For tests, use fixture-backed ZTD rewrite through `tableFixture()` and the testkit client.
* Keep handwritten SQL in `src/sql/`.
* Keep persistence-specific code under `src/infrastructure/persistence/`.
* Keep `src/domain`, `src/application`, and `src/presentation/http` free from direct SQL or DDL concerns.
* Start from the provided examples instead of creating a new structure first.

Good example files to start from:

* `tests/queryspec.example.test.ts` for the `QuerySpec + CatalogExecutor` path
* `tests/smoke.test.ts` for the fixture-backed ZTD rewrite path
* `tests/support/testkit-client.webapi.ts` for the testkit client helper

## Typical workflow

1. Update `ztd/ddl/<schema>.sql` if needed.
2. Add or edit your first SQL asset under `src/sql/`.
3. Keep SQL-facing code in `src/infrastructure/persistence/`, while keeping `src/domain`, `src/application`, and `src/presentation/http` free from direct SQL and DDL concerns.
4. Run `npx ztd ztd-config` to regenerate DDL-derived test rows and layout metadata.
5. Run `npx ztd model-gen --probe-mode ztd <sql-file> --out <spec-file>` to scaffold a QuerySpec from that SQL file.
6. Review `src/catalog/specs/_smoke.spec.ts`, `tests/queryspec.example.test.ts`, and `src/infrastructure/db/sql-client.ts` so the first SQL-backed repository stays aligned as 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.
7. Run tests with `npm run test` or `npx vitest run`.
8. After the smoke path is green, continue with the next query unit.

## If a command fails

* If `npx ztd ztd-config` fails, continue editing `ztd/ddl/<schema>.sql` and `src/sql/` first, then rerun generation after the DDL is ready.
* If `npx ztd model-gen` fails, keep the SQL file and rerun after `npx ztd ztd-config` succeeds.
* The `ztd` probe path does not require `DATABASE_URL`.
* If you do not have `ZTD_TEST_DATABASE_URL` yet, use the generated smoke test as the first DB-free pass and add SQL-backed tests after the connection is ready.
* If you want a concrete repository-oriented sample, start from `tests/queryspec.example.test.ts`.
* Treat `ztd ddl pull` and `ztd ddl diff` as explicit target inspection commands that require `--url` or a complete `--db-*` flag set.
* If you generate migration SQL artifacts, apply them with your deployment tooling instead of `ztd-cli`.

## Local source mode

If this project was scaffolded with `ztd init --local-source-root <monorepo-root>`, run:

1. `pnpm install`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm ztd ztd-config`

If the project is nested under another `pnpm-workspace.yaml`, use `pnpm install --ignore-workspace` first.

The scaffold keeps `@rawsql-ts/sql-contract` as a normal package import even in local-source developer mode.
