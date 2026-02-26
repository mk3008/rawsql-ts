$---
title: UPDATE-to-SELECT Conversion
outline: deep
---

# UPDATE ? SELECT Conversion

`UpdateResultSelectConverter` mirrors the update semantics by rewiring the `SET` expressions and predicate filters into a read-only query. This makes it possible to assert returning rows or row counts without touching a live table while keeping the semantics of joins, `FROM` sources, and `WHERE` predicates intact.

## Conversion workflow

1. Rewrite the `SET` clause expressions so the requested return columns either emit the updated expressions or fall back to existing column references.
2. Attach the original `FROM` sources and `WHERE` predicate to the new select so the same rows are targeted.
3. Expand `RETURNING *` when a table definition is supplied, and emit `SELECT count(*) AS "count"` when no `RETURNING` clause exists.
4. Detach any user-defined `WITH` clause, ensure fixture coverage for the referenced tables, and prepend the fixture CTEs back into the result so the final `SELECT` only touches fixtures.

## Fixtures and joins

The converter needs `fixtureTables` for every table that appears in the `FROM` clause, including `UPDATE ... FROM` targets. By default, missing fixtures raise an error, but you can switch to `warn` or `passthrough` when you are still composing coverage. `FixtureCteBuilder` takes those definitions and injects them ahead of the rewritten select so each table (target or helper) resolves to its fixture rows.

## Missing fixture strategy

Use the `missingFixtureStrategy` option to control how strict the converter is. `error` (the default) enforces coverage, `warn` logs the uncovered table without stopping the conversion, and `passthrough` leaves the table reference alone so you can integrate against an external database when needed.

## When to read this doc

- You are investigating why the update converter reports a missing fixture for the target or one of the joined tables.
- You want to understand how returning expressions like `price + 10` survive the translation.
- You need to pair the select with fixture definitions so the converter can run in a fixture-only test harness.

## Learn more

- [UpdateResultSelectConverter API](../api/classes/UpdateResultSelectConverter.md)
- [Select-Centered Philosophy](./select-centered-philosophy.md) for the rationale behind read-only assertions.
- [SQLite Testkit Guide](./testkit-sqlite-howto.md) to see how fixtures feed into the rewritten select.

