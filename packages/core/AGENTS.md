# rawsql-ts Core Package

## Core Philosophy: Dialect-Agnostic AST, Dialect-Aware Formatting

The **core package** is a pure TypeScript SQL engine responsible for
tokenization, AST construction, query analysis, and formatting.\
It must remain **DBMS‑neutral in behavior**, but **capable of representing any dialect** in its AST.

### Principles

-   The parser should preserve SQL structure from any vendor (Postgres,
    SQLite, MySQL, etc.).
-   It is acceptable to introduce AST fields that represent
    vendor-specific constructs\
    (e.g., `DISTINCT ON`, `NOT MATERIALIZED`, `WINDOW` clauses, custom
    operators).
-   The AST must *not* enforce database execution semantics.\
    It describes **what the query looks like**, not how a database would
    execute it.
-   Dialect decisions belong to the **formatter** or upper layers
    (testkit-core, drivers).
-   Never hard-wire DB-specific logic or branching in AST pipelines\
    (no `isPostgres`, `isSQLite`, dialect checks inside parser or
    analyzer code).

## Dev Principles

1.  **KISS** -- prefer simple data structures and flows that directly
    explain behavior.
2.  Maintainability comes before micro-optimizations unless a benchmark
    justifies it.
3.  Focus on one problem at a time; ship incremental patches instead of
    mega-commits.
4.  Keep pull requests scoped to a single conceptual area.

## Critical Rules

-   Tests act as specifications---never update expectations without
    intent and alignment.
-   Add or update tests whenever adding features or fixing bugs.
-   TypeScript errors must stay at zero before running tests.
-   All comments and identifiers remain in **English**.

## SQL Parsing Expectations

-   Always prefer AST helpers (`SelectQueryParser`, `SelectAnalyzer`,
    `splitQueries`, formatter APIs).
-   Regex-based rewrites are allowed **only** as explicit fallbacks
    with:
    -   A comment explaining the limitation
    -   A tracking issue reference
-   When triaging parser/formatter bugs:
    -   Prefer extending tokens, visitors, or AST nodes
    -   Avoid layering new regex filters outside AST

## TDD: Red → Compile → Green → Refactor

1.  **Red**: add a failing Vitest or reproduction script---even for bug
    fixes.\
2.  **Compile**: fix TypeScript errors *before* running tests.\
3.  **Green**: implement the minimum logic required to satisfy the
    test.\
4.  **Refactor**: clean naming, structure, and control flow.\
5.  **Verify**: intentionally break the test to ensure it truly protects
    behavior.

## Debug & Cleanup

-   Temporary artifacts belong in `./tmp/`; delete them after use.
-   Remove `console.log`, `debugger`, and tracing hooks before
    submitting a PR.

## Prohibited (Anti‑Patterns)

-   Embedding driver-level, DB-level, or testkit-level semantics inside
    the core engine.\
    AST may hold vendor constructs, but **behavior** is decided by
    formatters or higher layers.
-   Performing or simulating query rewriting inside core (belongs to
    testkit-core).
-   Introducing dialect branching (`if postgres...`) in parser or
    analyzer logic.
-   Premature optimization that harms readability or AST clarity.
-   Hand-written SQL comparison without normalizing via `SqlFormatter`.

## Mandatory Pre-commit Steps

Run within `packages/core` or via workspace filters:

    pnpm --filter rawsql-ts test && pnpm --filter rawsql-ts build && pnpm --filter rawsql-ts lint

All must pass before committing.

## Commit Sequence

1.  Refactor for clarity → document public APIs.
2.  Run the validation pipeline (test/build/lint).
3.  `git add -p` to review staged changes.
4.  Commit with a focused, descriptive message.

## Code Not Updating?

1.  Confirm imports: built `rawsql-ts` vs. `../../core/src` (live paths).
2.  Clear caches:\
    `rm -rf dist node_modules && pnpm --filter rawsql-ts build`
3.  Add temporary instrumentation (remember to remove):\
    `console.log('[trace] SelectAnalyzer', payload)`
4.  Note: consumers using `file:../core` load from `dist/`, not TS paths.

## Commands

    pnpm --filter rawsql-ts test
    pnpm --filter rawsql-ts build
    pnpm --filter rawsql-ts lint
    pnpm --filter rawsql-ts benchmark
    pnpm demo:complex-sql        # regression demo (workspace root)

## Library Notes: JSON Mapping Helpers

``` ts
import { convertModelDrivenMapping } from 'rawsql-ts';
// Use when mapping.typeInfo && mapping.structure.
// Legacy mode expects mapping.rootName && mapping.rootEntity.
```

Common errors: - `Cannot read 'columns'`: ensure wrappers around
descriptor objects. - `Module not found`: run build to refresh
`dist/`. - Prefer `import { ... } from 'rawsql-ts'` over deep relative
paths. - When comparing SQL in tests, normalize using `SqlFormatter`.

## Regression Testing: Complex SQL Demo

    pnpm demo:complex-sql

### Watch for:

-   ≥95% comment preservation\
-   No token splits like `table. /* comment */ column`
-   CASE expression comments preserved in evaluation order
-   Performance target: **\<50ms** for the 169-line sample\
-   Output in `packages/core/reports/`; compare before/after on
    formatter or AST rewrites

## Build & Bundling Notes

-   Use esbuild with `--minify-syntax --minify-whitespace`
-   Avoid `--minify-identifiers` (breaks comment bookkeeping & named
    exports)
-   Browser bundles depend on `tsconfig.browser.json`
-   After formatter export changes, run:\
    `pnpm --filter rawsql-ts build:browser`
