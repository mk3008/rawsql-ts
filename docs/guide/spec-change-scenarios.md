---
title: Spec-Change Scenarios
---

# Spec-Change Scenarios (Quick Reference)

Condensed scenarios covering common specification and schema changes, what steps were needed, and the key takeaway for each.

## 1. Add a NOT NULL column

**What changed:** A new `NOT NULL` column added to an existing table's DDL.

**Steps:** `ashiba check` → fix compile errors in fixtures (must include the new column) → update SQL, boundary types, and generated mapper output if needed → re-run tests.

**Takeaway:** NOT NULL columns force fixture updates everywhere the table appears. Plan fixture changes before adding the column.

## 2. Rename a column

**What changed:** Column renamed in DDL (e.g., `name` → `display_name`).

**Steps:** `ashiba check` → update SQL files, boundary types, generated mapper output, validator schemas when present, and fixtures → re-run tests.

**Takeaway:** TypeScript compile errors are your guide — the generated `TestRowMap` reflects the new name immediately. Fix all references before running tests.

## 3. Change a column type

**What changed:** Column type changed (e.g., `integer` → `bigint`, `text` → `jsonb`).

**Steps:** `ashiba check` → update runtime coercions if driver behavior differs (e.g., bigint returns strings) → update validator schemas → re-run tests.

**Takeaway:** Type changes often require runtime coercion updates. Check the [Postgres pitfalls](./postgres-pitfalls.md) page for driver-specific quirks.

## 4. Add a new table

**What changed:** New CREATE TABLE added to DDL.

**Steps:** `ashiba check` → new type appears in `TestRowMap` → write SQL queries, fixtures, and tests → run tests.

**Takeaway:** The simplest scenario — no existing code is affected. Generated types are immediately available.

## 5. Drop a table

**What changed:** Table removed from DDL.

**Steps:** `ashiba check` → type disappears from `TestRowMap` → compile errors show all affected code → remove SQL files, repository methods, fixtures, and tests.

**Takeaway:** Compile errors are exhaustive. Fix them all and you're done.

## 6. Add a foreign key or index

**What changed:** Constraint or index added to DDL.

**Steps:** `ashiba check` → no type-level changes (indexes/FKs don't affect `TestRowMap`) → test behavior is unchanged.

**Takeaway:** ZTD doesn't enforce FK constraints in test fixtures — it operates on data, not schema constraints. Runtime tests against a live DB will enforce them.

## 7. Change the default schema or search path

**What changed:** `defaultSchema` or `searchPath` updated in `ztd.config.json`.

**Steps:** `ashiba check` → regenerate types → SQL files may need schema-qualified names → re-run tests.

**Takeaway:** Schema resolution is a common source of "table not found" errors. Always keep `ztd.config.json` in sync with the database's `search_path`.

## 8. Validator schema drift after DDL change

**What changed:** DDL changed but the Zod/ArkType schema was not updated.

**Steps:** Tests pass (validator still matches old shape) → runtime fails on real data → update validator schema to match new `TestRowMap` shape → re-run tests.

**Takeaway:** Validators are not auto-generated — they must be manually kept in sync with the mapped DTO. Run `ashiba check-contract` to catch drift early.

## 9. Add/remove a column used by a generated mapper

**What changed:** Column projected by a generated query boundary was removed or renamed in DDL.

**Steps:** `ashiba check` → update the SQL asset and boundary row type → run `ashiba feature query refresh` → re-run tests.

**Takeaway:** Generated mappers are machine-owned artifacts. Use generated mapper drift checks and `ashiba lint` to catch mismatches early.

## 10. Switch validator backend (Zod ↔ ArkType)

**What changed:** Project migrated from one validator to another.

**Steps:** Update feature-local QuerySpec files, or legacy spec files in `src/catalog/specs/` when the project still uses that layout → update runtime files → update `package.json` dependencies → re-run tests.

**Takeaway:** Validator-agnostic design means the switch is limited to boundary/runtime validation files. The SQL layer and generated mapper are unaffected.

## Further reading

- [Ashiba](https://github.com/mk3008/ashiba) — SQL-first CLI workflows and schema-change guidance
- [ZTD Theory](./ztd-theory.md) — conceptual foundation
