# rawsql-ts Workspace (Revised DAL C Version)

## Scope
- Monorepo housing the rawsql-ts parser and supporting packages.
- Repository-wide rules live here; package-specific rules live in each package's subfolder.

## Working Agreements
- Use pnpm for all workspace tasks.
- Code comments, docs, and identifiers remain in English.
- Temporary assets go under ./tmp.
- Remove console.log / debugger statements before creating patches.

## SQL Parsing Policy (AST First)
- Any package that touches SQL must use rawsql-ts AST utilities.
- Regex rewrites are allowed only as fallback with an explanation.
- Block PRs that introduce regex parsing when an AST alternative exists.

# DAL C INSERT Guidelines (Revised)

## Core Principle
DAL C rewrites `INSERT ... RETURNING` into a pure SELECT.
The SELECT is evaluated by the Testkit to produce the logical RETURNING row
using DTO + TableDef, NOT NULL rules, nullable columns, auto-number counters, etc.

The repository continues to call `repo.create(dto)` normally,
but the executed query is the DAL-generated SELECT.

# Testkit Responsibilities
- `TestkitDbAdapter` provides a helper (e.g., `simulateReturningRows`) that:
  - Accepts a DTO and TableDef
  - Applies required and nullable constraints
  - Coerces types when needed
  - Fills auto-number columns from a stable counter
  - Returns a fully materialized RETURNING row

# Connection Behavior (Revised & Clean)

## DAL C tests do **not** rely on driver-style QueryResult.
- No dummy `command`
- No `rowCount`
- No `fields`
- No fake INSERT/SELECT metadata
- No `{ rows: [] }` placeholders
- No SQL recording unless explicitly needed by a test (rare)

The minimal connection implementation may simply be:

```ts
query(sql, params) {
  return testkit.execute(sql, params); // Execute DAL-generated SELECT
}
```

The connection does not fabricate results and does not participate
in DAL logic beyond forwarding the SQL.

# DAL C Test Requirements
DAL C tests must assert only:

1. **Returned row correctness**
   - Required columns filled
   - Nullable constraints respected
   - Auto-number assigned
   - Values derived from DTO + schema

2. **SELECT rewriting correctness**
   - The DAL-generated SELECT is valid and can be executed by Testkit

Tests must NOT assert:
- Number of executed queries
- driver QueryResult metadata
- command, rowCount, oid, fields
- dummy rows or mock RETURNING rows

# DAL C Acceptance Criteria
1. DAL C tests pass by executing the DAL-generated SELECT via Testkit.
2. No driver-side overrides or fabricated rows.
3. No hand-crafted RETURNING rows in any tests.
4. Returned rows rely solely on DTO + TableDef.

# Validation Checklist
- pnpm lint
- pnpm test
- pnpm build
- Run benchmarks if rewriting logic changed

# Collaboration Tips
- Use small TDD cycles.
- Keep cross-package commits minimal.
- Read each package's AGENTS.md before modifying its internals.
