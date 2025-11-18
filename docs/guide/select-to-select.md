$---
title: SELECT-to-SELECT Conversion
outline: deep
---

# SELECT ? SELECT Conversion

Sometimes the select query that a repository or test performs is enough to describe every row it needs, but that query may still reach out to physical tables. The SELECT-to-SELECT workflow keeps every reference on the fixture side and never depends on the real schema by shadowing tables through CTEs and focusing on the projected result set `R`.

## How it works

1. Analyze the original select to discover every physical table and column it touches, including CTE sources, joins, and nested subqueries.
2. Provide `fixtureTables` that declare the columns and rows for each referenced table. `FixtureCteBuilder` turns those definitions into `WITH` entries that replace the real tables under the same names.
3. Detach any user-defined `WITH` definitions and reattach them after the fixture CTEs so the rewritten query continues to reuse shared CTEs while still resolving to fixtures for base tables.
4. Keep the select list, filters, and joins untouched so the rewritten reader emits the exact `R` that the original query produces even though it never runs against the physical database.

## Eliminating physical-table dependencies

By rewriting every select that would normally read from `users`, `products`, or other tables into a fixture-fed query, you remove the need to create schemas, seed data, or clean up snapshots. Fixtures live entirely in code, so:

- Tests can run without connecting to a prepared schema or worrying about data races.
- You can describe new tables by adding entries to the `fixtureTables` array instead of modifying migrations.
- There is no rollback or cleanup step because nothing writes to the database; the fixtures describe the final state up front.

## When to read this doc

- You want to document how a `SELECT`-only fixture avoids touching real tables.
- You are adding new fixture coverage for a repository query and need to know why `InvalidQueryFixture` errors mention uncovered tables.
- You are pairing this approach with `QueryAnalyzer` tooling that introspects the rewritten select to ensure its shape is unchanged.

## Learn more

- [Select-Centered Philosophy](./select-centered-philosophy.md)
- [SQLite Testkit Guide](./sqlite-testkit-howto.md)

