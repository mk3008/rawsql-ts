# ztd-cli Docs

`ztd-cli` Docs are review pages for the target package concept, policies, and staged runtime-free code generation direction of `@rawsql-ts/ztd-cli`.

The current pages are draft review surfaces.
They describe the intended package direction, not the current implementation state.

## What Is ztd-cli?

`ztd-cli` is intended to be a runtime-free code generation CLI for SQL-first backend development.

It treats DDL as the source of truth for database structure, uses `rawsql-ts` SQL AST analysis at generation time, and generates SQL execution boundaries, DAO-style access code, AOT mappers, and ZTD-backed unit-test scaffolds.

The standard generated runtime path does not require `ztd-cli`, `rawsql-ts`, runtime mapper libraries, or runtime validator libraries.
Generated SQL should stay ordinary row/column SQL. Response shape should be built by generated AOT mappers rather than hidden SQL JSON aggregation or runtime result-shaping helpers.

## Standard Runtime Shape

The standard scaffold is intentionally small at runtime:

- SQL resources remain reviewable as normal SQL files.
- Query boundaries call thin generated executor helpers.
- Generated `row-mapper.ts` files build response objects through direct assignment.
- Runtime row validation libraries are optional compatibility choices, not the default.
- `@rawsql-ts/sql-contract` and `@rawsql-ts/sql-contract-zod` are not part of the generated application runtime.

## Review Order

Use these pages to review the ztd-cli package from durable package concept toward policy and implementation direction.
Start with the package concept, then review testing, authority, and technology policies as they are added.

## Specification Views

- [Package Concept Draft](./ztd-cli/package-concept.md)
- [Testing Policy Draft](./ztd-cli/testing-policy.md)
- [Review Authority Model Draft](./ztd-cli/review-authority-model.md)
- [Technology Policy Draft](./ztd-cli/technology-policy.md)

## Review Views

- Implementation migration plan: planned
- Runtime dependency inventory: drafted in [Technology Policy Draft](./ztd-cli/technology-policy.md)
