# DOGFOOD REPORT

## Metadata
- Run date: 2026-03-05
- Runner: Codex (GPT-5)
- Spec file: `DOGFOODING.md`
- Repo commit: `6269f39a` (base), plus working-tree docs updates

## Environment
- OS: Microsoft Windows 11 Home
- Node.js: v22.14.0
- pnpm: 10.17.0 (workspace), 10.19.0 (scaffold execution)
- Docker: 27.3.1
- PostgreSQL image: `postgres:18` (container start failed because daemon not running)

## Files changed
- `DOGFOODING.md`
- `DOGFOOD_LOG.txt`
- `DOGFOOD_REPORT.md`

## Scenario 1: New backend
- Result: PARTIAL
- Implemented scope:
  - Baseline DDL applied to `ztd/ddl/public.sql`
  - CRUD-related SQL assets created under `src/sql/sale/`
  - `ztd-config` generation succeeded (3 rows)
- Evidence pointers: LOG STEP 7, 8, 9
- Notes:
  - QuerySpec generation via `model-gen --probe-mode ztd` failed due required DB connection metadata.
  - End-to-end tests could not be completed because local-source dependency resolution failed in scaffold runtime.

## Scenario 2: Schema/spec changes (Candidate C)
- Result: PARTIAL
- Change summary:
  - Added `payment` table/indexes to DDL
  - Added fixed join query `list_sales_with_payment.sql`
  - Re-ran `ztd-config` and confirmed row-map expansion (3 -> 4 rows)
- Evidence pointers: LOG STEP 11
- Notes:
  - `model-gen --probe-mode ztd` for join query still failed with missing DB connection requirement.

## Command and trial metrics
- Total step count: 15
- Trial/error count: 6
- Commands that required retries:
  - `pnpm install --ignore-workspace` (failed once, retried after dependency trimming)
  - `model-gen --probe-mode ztd` (repeated failure in both scenarios)

## Frictions

### Needs CLI automation
- Local-source scaffold should avoid emitting dependency combinations that break isolated `pnpm install --ignore-workspace`.
  - Evidence: LOG STEP 5, 6, 13, 14
- `model-gen --probe-mode ztd` should not require DB connection metadata when schema information is locally available.
  - Evidence: LOG STEP 10, 12

### Feature exists but undiscoverable
- Recovery path for local-source guard is partially documented but not enough to resolve workspace protocol leakage from linked packages.
  - Evidence: LOG STEP 13
- Runtime prerequisites for `ztd lint` (container runtime dependency) are not obvious in command help.
  - Evidence: LOG STEP 15

### Forces migration (ZTD violation)
- None observed.
  - Evidence: LOG STEP 8, 11

### Forces SQL string concatenation (security risk)
- None observed.
  - Evidence: LOG STEP 9

## Improvement proposals
- CLI:
  - Add `ztd doctor local-source` to validate scaffold dependency graph and patch known workspace-protocol pitfalls.
  - Make `model-gen --probe-mode ztd` fully DDL-backed without requiring DB metadata, or provide explicit `--require-db` mode.
- Docs:
  - Add a troubleshooting section for local-source + pnpm isolated installs with exact package rewrite examples.
  - Document Docker/runtime requirements per command (`lint`, probe modes) in help output and README command table.
- Discoverability:
  - Emit structured, machine-readable error codes for common setup blocks (daemon-off, missing local package entry, workspace protocol mismatch).
- Templates/scaffolding:
  - In local-source mode, avoid optional adapter/testkit dependencies unless explicitly requested by a flag.

## Happy-path draft (shortest successful steps)
1. Ensure Docker daemon is running and PostgreSQL 18 container is healthy.
2. Run `ztd init --workflow empty --validator zod --local-source-root <repo>` in an untracked `tmp/` folder.
3. Run `pnpm install --ignore-workspace` with local-source-safe dependency set.
4. Apply DDL to `ztd/ddl/public.sql` and run `ztd-config`.
5. Create SQL assets and run `model-gen --probe-mode ztd`.
6. Execute tests and lint; collect evidence in fixed log format.

## Open questions
- Should local-source dogfooding officially support fully isolated `pnpm install --ignore-workspace` without editing generated `package.json`?
- Is DB-less `model-gen --probe-mode ztd` an intended contract or currently unsupported behavior?
