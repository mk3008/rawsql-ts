# Package Scope
- Applies to `packages/testkit-sqlite`.
- Adapts testkit rewrite output to `better-sqlite3` execution surfaces.
- Provides fixture layering and wrapped driver behavior for SQLite-backed tests.

# Policy
## REQUIRED
- Query execution MUST pass through rewrite output from testkit-core.
- Fixture/schema validation errors MUST surface with explicit diagnostics.
- `.withFixtures()` MUST preserve base config and layer scenario fixtures.
- `driver.close()` behavior MUST be idempotent.
- Integration tests MUST run against real `better-sqlite3` connections.

## ALLOWED
- Temporary regex merge fallback MAY be used only with inline TODO/comment, debug notice, and tracking issue.
- In-memory and file-backed SQLite engines MAY be used as execution backends.

## PROHIBITED
- Physical schema management through wrapped driver flow.
- Persisted write semantics as test state.
- Parser ownership inside testkit-sqlite.
- Bypassing rewrite pipeline with mocked result shapes.

# Mandatory Workflow
- Before committing changes under `packages/testkit-sqlite`, these commands MUST pass:
  - `pnpm --filter @rawsql-ts/testkit-sqlite lint`
  - `pnpm --filter @rawsql-ts/testkit-sqlite test`
  - `pnpm --filter @rawsql-ts/testkit-sqlite build`

# Hygiene
- Debug instrumentation and temporary artifacts MUST be removed before commit.

# References
- Rationale: [DESIGN.md](./DESIGN.md)
- Operational notes: [DEV_NOTES.md](./DEV_NOTES.md)
