---
title: SELECT-to-CREATE TABLE Conversion
outline: deep
---

# SELECT -> CREATE TABLE Conversion

`QueryBuilder.buildCreateTableQuery` turns a projection into a `CREATE TABLE ... AS SELECT ...` statement so `rawsql-ts` can seed temporary tables without exposing mutable state to the test runner. Because the select query already contains the desired columns and CTEs, the helper simply wraps it inside the new table definition while preserving optional flags such as `TEMPORARY` or `IF NOT EXISTS`.

## Transformation details

- The given `SelectQuery` becomes the `AS SELECT` source of the `CreateTableQuery`, so any `WITH` clauses or computed columns survive untouched.
- `tableName` identifies where the rows should land, and `isTemporary` controls whether the table is created in the session-local namespace.
- `ifNotExists` ensures the helper can be re-run without failing when bootstrap fixtures already created the table.

This conversion is especially helpful for the SQLite testkit demos, where a temporary table hosts fixture rows before the repository under test runs `SELECT` statements against it.

```ts
const createTableQuery = QueryBuilder.buildCreateTableQuery(simpleSelectQuery, 'tmp_customers', true, true);
```

## Learn More

- [QueryBuilder API](../api/classes/QueryBuilder.md) for `buildCreateTableQuery` and the flags that mirror native DDL.
- [SQLite Testkit Guide](./sqlite-testkit-howto.md) to see where temporary tables help compose fixtures.
- [Why SQL Unit Testing Is Hard](./testkit-concept.md) for the philosophy of relying on `SELECT` rewrites and letting conversions manage DML/DDL.
