# Core Package Design Notes

## Role and Boundaries
- The `rawsql-ts` core package owns tokenization, AST construction, query analysis, and formatting.
- Parser/analyzer responsibilities remain DBMS-neutral.
- Runtime execution semantics are delegated to formatters and upper-layer packages.

## Non-Goals
- Embedding driver-level, DB-level, or testkit semantics in this package.
- Duplicating rewrite logic owned by `testkit-core`.

## Dialect-Agnostic AST Model

The parser is expected to preserve query structure across vendor SQL dialects (Postgres, SQLite, MySQL, and others).

Vendor-specific syntax may appear in the AST as structural fields. This is intentional because the AST captures syntax shape, not execution semantics.

Dialect execution decisions are deferred to formatters or upper-layer packages.

## Development Principles

- Keep design and control flow simple and maintainable.
- Keep changes scoped and incremental.
- Optimize only when benchmark results justify complexity.
- Keep pull requests focused on one conceptual area.

## Testing Philosophy

Tests are treated as behavior specifications.

Recommended implementation loop:
1. Red: add a failing test or minimal reproduction.
2. Compile: keep TypeScript errors at zero.
3. Green: implement minimum changes to satisfy the test.
4. Refactor: improve naming/structure without changing behavior.
5. Verify: confirm tests detect behavior regressions.

## Tradeoffs and Non-Goals

- Non-goal: embedding driver-level, DB-level, or testkit semantics in the core package.
- Non-goal: duplicating rewrite logic owned by `testkit-core`.
- Tradeoff: regex fallback is tolerated only for gaps where AST-based handling is currently not viable, and should be tracked explicitly.
