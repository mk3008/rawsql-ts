# rawsql-ts Workspace

## Foundational Philosophy (ZTD / Fixture‑First / AST‑First)

rawsql-ts treats the database engine as a **planner and type checker**,
not a schema host.\
In tests, no physical tables are created, migrated, or mutated.\
All schema information and seed rows must come from **DDL files and fixtures**, and pg-testkit rewrites CRUD statements into fixture-backed
`SELECT` queries.

## Monorepo Architecture

-   `packages/core` --- pure TypeScript SQL parser & AST utilities (DBMS
    independent)
-   `packages/testkit-core` --- ZTD logic: CRUD rewriting, fixtures,
    Result‑Select semantics
-   `packages/pg-testkit` --- Postgres-specific adapter using a real pg
    engine
-   `packages/sqlite-testkit` --- SQLite-specific adapter
-   `packages/ztd-cli` --- Zero Table Dependency scaffolding, DDL helpers, and AGENTS-aware project templates

Dependency direction:

    core → testkit-core → pg-testkit / sqlite-testkit

Reverse dependencies are forbidden.

## SQL Parsing Policy (AST First)

-   All SQL rewrites must rely on `rawsql-ts` AST utilities (parser,
    analyzer, splitQueries).
-   Regex-based rewrites are allowed only as guarded fallbacks with
    comments explaining why.
-   Block contributions introducing regex parsing when an AST
    alternative exists.

## Anti‑patterns (Do NOT do this)

-   Do not treat the backing DB as a migration target.\
    The DB engine is **only** for planning/type-checking.\
    Never execute `CREATE TABLE`, `ALTER TABLE`, or seed `INSERT`s over
    a pg-testkit connection.

-   Do not attempt to make pg-testkit "helpfully" apply schema or writes
    to physical tables.

-   Do not hand‑construct `QueryResult` or mock `Client#query`.\
    All tests must flow through the rewrite pipeline + fixtures.

-   Do not let demo helpers silently accept non-array `QueryParams` and drop
    named bindings; validate the params before calling `toRowsExecutor` so
    misuse surfaces as an explicit error instead of returning misleading rows.

## Allowed Application SQL

-   Repository/application SQL may freely use normal CRUD (`INSERT`,
    `UPDATE`, `DELETE`).\
    pg-testkit will automatically rewrite them into `SELECT` queries.\
    Library code must never bypass the rewriter.

## Schema Resolution

-   Application SQL can omit schema qualifiers (e.g., `SELECT ... FROM users`). pg-testkit maps those references to canonical `schema.table` keys by consulting the `ddl.defaultSchema` / `ddl.searchPath` block in `ztd.config.json` before looking up fixtures or DDL metadata.
-   DDL files, row fixtures, and TestRowMap entries should be aware of the configured schema search path so the canonical keys remain consistent. Update `ztd.config.json` whenever you change the target schema or search path so the rewrite pipeline still matches tables as expected.

## Working Agreements

-   Use `pnpm` and `pnpm --filter <package>` for scoped tasks.
-   All identifiers, comments, and docs remain in English.
-   Use `./tmp` for throwaway assets.
-   README/driver demos should exercise the rewrite/fixtures helper at
    `packages/sql-contract/tests/readme/support/postgres-demo.ts` instead of
    running schema setup through Testcontainers.
-   Remove console debugging before committing.
-   `packages/core/dist` outputs must stay synchronized with the pnpm store copy that CLI tests consume (`node_modules/.pnpm/rawsql-ts@<version>/node_modules/rawsql-ts/dist`). `pnpm --filter rawsql-ts build` already runs `scripts/sync-rawsql-dist.js` as a `postbuild` step, but you can rerun that script manually if a CLI test complains about outdated `rawsql-ts` artifacts.
-   The workspace now uses Changesets with independent versioning; create a changeset for each release-worthy change, run `pnpm changeset version`, and rely on the generated updates rather than editing `package.json` `version` fields by hand.

## Formatting and linting operations

-   Run `pnpm format` to normalize TypeScript, SQL, Markdown, and config files; avoid touching formatting manually and keep `pnpm lint:fix` as the only way to mutate lintable files.
-   The `simple-git-hooks` + `lint-staged` pre-commit pipeline runs `pnpm lint-staged`, which in turn executes `pnpm format` over staged files before a commit is recorded.
-   Document any deviations from the standard formatting workflow in AGENTS so AI contributors understand that formatting is owned by the scripts, not by hand edits.

## Validation Checklist

1.  `pnpm lint`
2.  `pnpm test` or `pnpm --filter <pkg> test`
3.  `pnpm build`
4.  Run benchmarks for SQL‑rewriter changes when relevant.

## Docs Demo Updates

-   Rebuild the browser bundle when parser/formatter changes:
    `pnpm --filter rawsql-ts build:browser`
-   Then re‑bundle for the docs demo using esbuild.
-   Commit updated `docs/public/demo/vendor/rawsql.browser.js`.

## Public API Documentation

This repository enforces docstring coverage in CI.

- All **exported classes, functions, and types in `src/`** are considered part of the public API.
- Every exported symbol in `src/` **must have clear English JSDoc** attached to its declaration.
- The GitHub Actions job `docstring coverage` will fail if:
  - an exported symbol has no JSDoc, or
  - the JSDoc is missing the parts that explain in plain English what the API does and what the inputs/outputs are.

### Rules for contributors and AI assistants

- When you **add a new exported symbol** in `src/` (class, function, type, interface, enum, etc.):
  - Always add English JSDoc in the same commit.
  - The JSDoc should briefly explain the role of the API and how to consume it.
- When you **modify an exported symbol**:
  - Update the existing docstring to keep it truthful.
  - Never delete a docstring merely to keep the diff small.
- If the CI error references **docstring coverage**:
  - Do **not** change the coverage threshold or disable the workflow.
  - Identify the exported symbols lacking documentation and add concise yet descriptive English JSDoc.
  - Prefer clarifying intended usage over placeholder text.
- If a helper is **not meant to be public**:
  - Make it non-exported, or add `@internal` to its docstring rather than leaving an undocumented export.
