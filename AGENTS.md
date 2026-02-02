# rawsql-ts Workspace

## Non-Negotiable Rules (Read First)

These rules override all other sections.

* **No guessing.** If something is not observed, explicitly write "Not observed" and list the next command to run.
* **Every claim must be backed by observation.** Always include:

  * the exact command executed
  * its exit code
  * a key output excerpt (first ~30 lines or the root error)
* **Reproduce before fixing.** No change without a reproduced failure.
* **One hypothesis, one fix.** Do not bundle unrelated changes.
* **Mandatory report format:** Observations → Changes → Verification → Assumptions (must be empty unless unavoidable).

Violating these rules is considered a failed contribution, even if tests pass.

---

## Foundational Philosophy (ZTD / Fixture-First / AST-First)

rawsql-ts treats the database engine as a **planner and type checker**, not a schema host.

In tests, no physical tables are created, migrated, or mutated.
All schema information and seed rows must come from **DDL files and fixtures**.

The testkit rewrites application CRUD statements into fixture-backed `SELECT` queries, and all test execution flows through this rewrite pipeline.

---

## Monorepo Architecture

* `packages/core`
  Pure TypeScript SQL parser and AST utilities (DBMS-independent)

* `packages/testkit-core`
  ZTD logic: CRUD rewriting, fixtures, result-as-SELECT semantics

* `packages/pg-testkit`
  Postgres-specific adapter using a real PostgreSQL engine

* `packages/sqlite-testkit`
  SQLite-specific adapter

* `packages/ztd-cli`
  Zero Table Dependency scaffolding, DDL helpers, and AGENTS-aware templates

Dependency direction:

```
core → testkit-core → pg-testkit / sqlite-testkit
```

Reverse dependencies are forbidden and will be treated as architectural violations.

---

## SQL Parsing Policy (AST-First)

* All SQL rewrites must use rawsql-ts AST utilities (parser, analyzer, splitQueries).
* Regex-based rewrites are allowed only as guarded fallbacks.
* Any regex fallback must include a comment explaining why an AST approach is not viable.
* Contributions introducing regex parsing when an AST alternative exists must be rejected.

---

## Anti-Patterns (Do NOT Do This)

* Do not treat the backing database as a migration target.
  The DB engine is used **only** for planning and type-checking.

* Never execute `CREATE TABLE`, `ALTER TABLE`, or seed `INSERT` statements against a pg-testkit connection.

* Do not make pg-testkit "helpfully" apply schemas or writes to physical tables.

* Do not hand-construct `QueryResult` objects or mock `Client#query`.
  All tests must flow through the rewrite pipeline and fixtures.

* Do not let demo helpers silently accept non-array `QueryParams` or drop named bindings.
  Validate parameters before calling `toRowsExecutor` so misuse surfaces as an explicit error.

---

## Allowed Application SQL

* Repository and application SQL may freely use normal CRUD (`INSERT`, `UPDATE`, `DELETE`).
* pg-testkit will automatically rewrite these into fixture-backed `SELECT` queries.
* Library code must never bypass the rewriter.

---

## Schema Resolution

* Application SQL may omit schema qualifiers (for example `SELECT * FROM users`).
* pg-testkit resolves unqualified names using `ddl.defaultSchema` and `ddl.searchPath` from `ztd.config.json`.
* Resolution occurs before fixture and DDL metadata lookup.

DDL files, row fixtures, and TestRowMap entries must stay consistent with the configured schema search path.
When changing schemas or search paths, update `ztd.config.json` accordingly.

---

## Working Agreements

* Use `pnpm` and `pnpm --filter <package>` for scoped tasks.
* All identifiers, comments, and documentation must be written in English.
* Use `./tmp` for throwaway assets.
* README and driver demos must exercise the rewrite and fixture helpers located at
  `packages/sql-contract/tests/readme/support/postgres-demo.ts`.
* Remove console debugging statements before committing.
* `packages/core/dist` must remain synchronized with the pnpm store copy consumed by CLI tests.
  `pnpm --filter rawsql-ts build` runs `scripts/sync-rawsql-dist.js` automatically; rerun it manually if CLI tests report stale artifacts.
* This workspace uses Changesets with independent versioning.
  Create a changeset for every release-worthy change and never edit `package.json` versions by hand.

---

## Formatting and Linting Operations

* Run `pnpm format` to normalize TypeScript, SQL, Markdown, and config files.
* Do not manually adjust formatting; `pnpm lint:fix` is the only allowed mutating lint command.
* The pre-commit pipeline uses `simple-git-hooks` and `lint-staged` to run `pnpm format` on staged files.
* Any deviation from this workflow must be documented in AGENTS so AI contributors understand that formatting is script-owned.

---

## Validation Checklist

Run the following before opening or updating a PR:

1. `pnpm lint`
2. `pnpm test` or `pnpm --filter <pkg> test`
3. `pnpm build`
4. Run benchmarks when modifying SQL rewriting logic

---

## Docs Demo Updates

* Rebuild the browser bundle when parser or formatter behavior changes:
  `pnpm --filter rawsql-ts build:browser`
* Re-bundle the docs demo using esbuild.
* Commit the updated `docs/public/demo/vendor/rawsql.browser.js`.

---

## Public API Documentation

This repository enforces docstring coverage in CI.

* All exported classes, functions, and types in `src/` are considered public API.
* Every exported symbol must include clear English JSDoc explaining:

  * what the API does
  * what it consumes
  * what it returns

The CI job "docstring coverage" fails if documentation is missing or misleading.

Rules:

* When adding a new exported symbol, always add English JSDoc in the same commit.
* When modifying an exported symbol, update the existing JSDoc to keep it truthful.
* Never delete a docstring to reduce diff size.
* If a helper is not intended to be public, make it non-exported or mark it with `@internal`.

---

## Self-Recovery Procedure (Observation-First)

When a commit, push, or CI job fails, follow this playbook strictly.

### 1. Observe

Collect observations by running and recording:

* `git status`
* `git diff`
* `git log -n 3 --oneline`
* `pnpm -r --if-present run test`
* `pnpm -r --if-present run lint`
* `pnpm -r --if-present run build`
* Relevant hook logs (`.husky/pre-commit`, `.husky/pre-push`)
* Re-run `git push --verbose` if the failure occurred during push

Record each command, its exit code, and key output.

### 2. Classify

Classify the failure into a known category (for example tooling, generation mismatch, formatting, dependency direction).

### 3. Fix Minimally

* Modify only files implicated by the observed failure.
* Do not disable hooks or bypass policies.

### 4. Verify

Re-run the failed commands from step 1 and confirm a clean workspace.

### 5. Report

Report using the mandatory format:

* Observations
* Changes
* Verification
* Assumptions (must be empty unless explicitly unavoidable)

---

## Observation-First Troubleshooting Rules

* Never infer without evidence.
* If no command has been run yet, write "Not observed" and list the next command.
* Capture the root error or first meaningful failure output.
* Limit scope: one failure, one fix, one verification.
* Any assumption must be labeled `UNOBSERVED` and followed by the next observation step.
