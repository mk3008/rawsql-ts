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
-   Remove console debugging before committing.
-   `packages/core/dist` outputs must stay synchronized with the pnpm store copy that CLI tests consume (`node_modules/.pnpm/rawsql-ts@<version>/node_modules/rawsql-ts/dist`). `pnpm --filter rawsql-ts build` already runs `scripts/sync-rawsql-dist.js` as a `postbuild` step, but you can rerun that script manually if a CLI test complains about outdated `rawsql-ts` artifacts.

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

All exported classes/types must include clear English JSDoc in `src/`.
