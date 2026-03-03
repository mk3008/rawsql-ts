---
title: Postgres Pitfalls
---

# Postgres Pitfalls

Common surprises when using rawsql-ts / ZTD with PostgreSQL and how to avoid them.

## 1. `bigint` / `serial8` returns strings, not numbers

PostgreSQL's `bigint` type exceeds JavaScript's safe integer range. The `pg` driver returns these as strings, not numbers.

**Symptom:** Zod `z.number()` validation fails on a `bigint` column.

**Mitigation:**
- Use `z.coerce.number()` or a runtime coercion to convert the string to a number (if values fit in safe integer range).
- Or use `z.string()` and keep the ID as a string throughout your application layer.
- In `rowMapping`, this happens transparently — the mapped value is whatever the driver returns.

## 2. `timestamptz` returns `Date` objects (or ISO strings depending on driver config)

The `pg` driver parses `timestamptz` into JavaScript `Date` objects by default, but custom type parsers or connection-pool configurations can change this.

**Symptom:** Validation expects a `Date` but receives a string (or vice versa).

**Mitigation:**
- Use `normalizeTimestamp` from `@rawsql-ts/sql-contract` in your runtime coercion layer. It handles both `Date` objects and ISO string representations.
- In your validator schema, use `z.date()` (not `z.coerce.date()`) when the runtime coercion has already normalized the value.

## 3. `pg_dump` output varies across PostgreSQL versions

Schema pulled with `ztd ddl pull` may differ in formatting, keyword casing, or feature syntax between PostgreSQL 14, 15, and 16.

**Symptom:** `ztd-config` parse errors after upgrading PostgreSQL or switching environments.

**Mitigation:**
- Pin the DDL to a single PostgreSQL major version for your project.
- Run `ztd ddl diff` to compare local DDL against the live database after version changes.
- Simplify DDL constructs that use version-specific syntax if cross-version portability matters.

## 4. Quoted identifiers are case-sensitive

PostgreSQL folds unquoted identifiers to lowercase. If your DDL uses `"User"` (quoted), SQL queries must also quote the identifier.

**Symptom:** `relation "user" does not exist` when the table was created as `"User"`.

**Mitigation:**
- Prefer lowercase, unquoted identifiers in DDL: `create table user_account (...)`.
- If you must use quoted identifiers, ensure all SQL files, `rowMapping` column maps, and fixtures use the same quoting.

## 5. `boolean` columns return `true`/`false`, not `1`/`0`

Unlike MySQL/SQLite, PostgreSQL returns native JavaScript booleans.

**Symptom:** None in most cases, but code that checks `if (row.active === 1)` will silently fail.

**Mitigation:**
- Use `z.boolean()` in validators.
- Avoid numeric comparisons on boolean columns.

## 6. `NULL` ordering differs from other databases

PostgreSQL sorts `NULL` values last in ascending order and first in descending order (opposite of MySQL's default).

**Symptom:** Test fixtures produce unexpected sort orders when compared to expected output.

**Mitigation:**
- Use explicit `NULLS FIRST` or `NULLS LAST` in `ORDER BY` clauses.
- Document the expected sort behavior in test fixtures.

## 7. Schema search path affects table resolution

PostgreSQL uses `search_path` to resolve unqualified table names. ZTD's `ztd.config.json` has `ddl.searchPath` to match this behavior.

**Symptom:** `ztd-config` generates types for the wrong schema or misses tables.

**Mitigation:**
- Set `ddl.defaultSchema` and `ddl.searchPath` in `ztd.config.json` to match your database's `search_path`.
- Use `ztd ztd-config --default-schema <name> --search-path <list>` to override.

## Further reading

- [sql-contract README](../../packages/sql-contract/README.md) — DBMS differences section
- [Mapping vs validation pipeline](../recipes/mapping-vs-validation.md) — how coercions and validators interact
- [Happy Path Quickstart](../../packages/ztd-cli/README.md#happy-path-quickstart) — end-to-end setup guide
