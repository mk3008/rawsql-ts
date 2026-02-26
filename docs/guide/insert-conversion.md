---
title: SELECT-to-INSERT Conversion
outline: deep
---

# SELECT -> INSERT Conversion

`rawsql-ts` keeps the focus on `SELECT` statements, so every `INSERT` scenario is modeled as a projection plus a `QueryBuilder.buildInsertQuery` call. This keeps fixtures aligned with the rewritten `SELECT` bodies while producing the `INSERT INTO ... SELECT ...` statements that repository code actually executes.

## Conversion workflow

1. Normalize the conversion options (target table, columns, optional alias) so legacy calling patterns remain supported.
2. Inspect the select list with `SelectValueCollector`, ensure every column has an explicit name, and preserve the requested order before converting.
3. Extract any `WITH` clause from the select query and attach it to the resulting `InsertQuery` so shared CTEs remain valid for the insert.
4. Build the `InsertClause` (target expression plus columns) and reuse the original `SimpleSelectQuery` as the data source.

This transformation guarantees that fixtures for columns such as `id`, `email`, and `tier` stay aligned with the `SELECT` metadata that powered the conversion.

## VALUES/SELECT toggles

`QueryBuilder.convertInsertValuesToSelect` rewrites `VALUES` tuples into a `SELECT` union so the same instrumentation path can keep intercepting data preparation, while `QueryBuilder.convertInsertSelectToValues` emits `VALUES` tuples when tooling needs concrete literals instead of computed expressions.

```ts
const insertQuery = QueryBuilder.buildInsertQuery(simpleSelectQuery, {
  target: 'customers',
  columns: ['id', 'email', 'tier'],
});
```

## When to read this doc

- You are maintaining `testkit-sqlite` fixtures and want to confirm why the runtime only rewrites `SELECT` statements.
- You are extending `rawsql-ts` to synthesize `INSERT` statements from computed rows or CTEs.
- You need to surface conversion errors that originate from unnamed select items, missing columns, or mismatched ordering.

## Learn More

- [QueryBuilder API](../api/classes/QueryBuilder.md) describes `buildInsertQuery` and the supporting helpers that enforce column names.
- [SQLite Testkit Guide](./testkit-sqlite-howto.md) shows how the same conversion keeps fixtures isolated from the physical database.
- [Why SQL Unit Testing Is Hard](./testkit-concept.md) explains why `rawsql-ts` targets `SELECT` statements and relies on conversions for DML coverage.
