---
name: core-parser-analyzer-change
description: Implement or review rawsql-ts packages/core parser, analyzer, formatter, SQL syntax, AST, SelectValueCollector, SelectOutputCollector, or SelectBodyExtractor changes with DBMS-neutral boundary checks, regression tests, benchmark/demo gates, and release-note classification.
---

# Core Parser Analyzer Change

Use this skill for changes under `packages/core` that affect SQL parsing, AST shape, analyzer output, formatter behavior, syntax-derived metadata, wildcard expansion, select output collection, or wrapper SELECT extraction.

## Required Reads

1. Read `packages/core/AGENTS.md`.
2. Read `packages/core/DESIGN.md` when the change touches parser/analyzer boundaries, dialect syntax, formatter output, or public API shape.
3. Read the issue or PR comment that defines the requested SQL shape before editing.

## Workflow

1. Classify the change as parser, analyzer, formatter, public API, test-only, or documentation-only.
2. State the DBMS-neutral boundary: what syntax is represented, and what driver, database, rewrite, testkit, lineage, or viewer semantics remain out of scope.
3. Add or update regression tests that execute the changed parser/analyzer/formatter behavior.
4. For syntax-derived collectors, cover ordering, duplicates, unsupported forms, and alias/source metadata explicitly when they are relevant.
5. Prefer AST APIs and existing visitors. Use regex only when `packages/core/AGENTS.md` permits it, with an inline AST-limitation comment and tracking issue.
6. Add or update a changeset when package behavior or public API changes.
7. Run the package verification commands required by `packages/core/AGENTS.md`.

## Verification

Run these for behavior changes:

```bash
pnpm --filter rawsql-ts test
pnpm --filter rawsql-ts build
pnpm --filter rawsql-ts lint
```

Also run these when parser or formatter behavior changes:

```bash
pnpm --filter rawsql-ts benchmark
pnpm demo:complex-sql
```

Focused tests may be run first, but they do not replace the package gates unless the final report explicitly narrows the claim.

## PR Notes

- Name the SQL forms covered by tests.
- State whether duplicate output names, output order, aliases, source metadata, or unsupported cases were checked.
- State the concept/package-boundary result without importing upper-layer semantics into `packages/core`.
- If a verification command is skipped, keep the affected claim partial and explain the blocker.

## Constraints

- Do not add dialect flags or branch parser/analyzer behavior by runtime database.
- Do not implement driver, DB, testkit, rewrite, lineage viewer, or graph semantics in `packages/core`.
- Do not treat CodeRabbit comments as accepted requirements until they are checked against package policy and the source issue.
