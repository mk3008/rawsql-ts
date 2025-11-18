$---
title: DELETE-to-SELECT Conversion
outline: deep
---

# DELETE ? SELECT Conversion

`DeleteResultSelectConverter` builds a read-only query that reflects what `DELETE ... RETURNING` (or a plain `DELETE`) would emit. It reuses any `USING` clause, `WITH` definitions, and `WHERE` predicates so the select targets the same rows the delete would remove.

## Conversion workflow

1. Rebuild the `FROM` clause from the `DELETE` target, its alias, and any `USING` sources.
2. If `RETURNING` is present, resolve each column (including expanding `RETURNING *` when metadata is available) and select them from the target or referencing fixtures.
3. When no `RETURNING` clause exists, return `SELECT count(*) AS "count"` over the deleted rows.
4. Ensure fixture coverage for every table referenced in the from/join sources, inject the fixtures as CTEs, and merge them with any existing `WITH` clause.

## Fixtures and `USING`

Fixtures describe the columns and rows of every involved table via `fixtureTables`. The converter walks the query, ignores CTE aliases when checking coverage, and either injects a shadow table (the default) or lets the physical table through depending on `missingFixtureStrategy`. You can also return columns from the `USING` tables by supplying their metadata in `tableDefinitions`.

## Missing fixture strategy

`missingFixtureStrategy` defaults to `error`, so a missing `users` fixture will throw before the select runs. Switch to `warn` or `passthrough` to soften the enforcement once you trust the coverage.

## When to read this doc

- You need to explain why a `DELETE` test fails because `fixtureTables` does not include every referenced table.
- You want to reproduce the `RETURNING *` expansion that picks up defaults and required columns.
- You are debugging the fixture injection for a `DELETE ... USING` clause.

## Learn more

- [DeleteResultSelectConverter API](../api/classes/DeleteResultSelectConverter.md)
- [Select-Centered Philosophy](./select-centered-philosophy.md)
- [SQLite Testkit Guide](./sqlite-testkit-howto.md)

