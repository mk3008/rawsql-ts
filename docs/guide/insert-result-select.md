$---
title: INSERT-to-SELECT Conversion
outline: deep
---

# INSERT ? SELECT Conversion

The new converters in `rawsql-ts` keep every DML path rooted in a `SELECT` so that fixtures only need to describe result rows. `InsertResultSelectConverter` rewrites `INSERT` statements into an equivalent read query that mirrors what the database would return via `RETURNING` or a simple row count.

## Conversion workflow

1. Build a `WITH "__inserted_rows"` CTE that unions `VALUES` tuples or the projection that feeds the insert.
2. Apply casts and defaults from the resolved table definition so the select items carry the same types as the real table columns.
3. If the original statement had `RETURNING`, keep the listed columns (and expand `*` when a table definition is available); otherwise produce `SELECT count(*)` over the synthetic rows.
4. Reuse the original `WITH` clause and inject fixture CTEs for any table referenced by the source query so the read model never touches real tables.

## RETURNING handling and counts

`InsertResultSelectConverter` recognizes `RETURNING` clauses and preserves the column ordering requested by repository code. Missing columns or required fields without defaults raise a helpful exception, which lets test suites pin down conversion problems early. When `RETURNING` is absent, the converter emits a `SELECT count(*) AS "count"` so the test can still assert how many rows would have been affected.

## Table metadata and fixtures

Provide a `tableDefinitions` map or a `tableDefinitionResolver` so the converter knows column types, defaults, and required flags. That metadata drives the casts inside the `__inserted_rows` CTE and powers `RETURNING *` expansion. To shadow physical tables that the insert selects from, pass `fixtureTables` describing rows and their column names; `FixtureCteBuilder` turns them into CTEs that override the real tables with predictable fixtures.

## Missing-fixture strategy

The default `missingFixtureStrategy` is `error`, which helps you catch uncovered tables (for example when the insert selects from `users`). Switch to `warn` or `passthrough` when you want to let the converter emit the original physical table references instead of injecting fixtures.

## When to read this doc

- You are implementing new insert-based fixtures and need to understand how the return values are faked.
- You want to rerun the logic from `InsertResultSelectConverter` at runtime to inspect the generated read query.
- You need to debug missing fixtures for tables referenced inside more complex `SELECT` sources.

## Learn more

- [InsertResultSelectConverter API](../api/classes/InsertResultSelectConverter.md)
- [Select-Centered Philosophy](./select-centered-philosophy.md) explains why the library prefers this read-first approach.
- [SQLite Testkit Guide](./sqlite-testkit-howto.md) shows how the resulting `SELECT` keeps tests schema-independent.

