---
title: SELECT-to-DELETE Conversion
outline: deep
---

# SELECT -> DELETE Conversion

`QueryBuilder.buildDeleteQuery` keeps the runtime in the `SELECT` world by rewriting the rows that matched the projection into a correlated `DELETE` that the repository can execute. Instead of running destructive statements directly, the conversion produces a `DELETE FROM ... WHERE EXISTS (...)` form that reuses the original select metadata.

## How the helper works

1. Normalize the conversion configuration so the delete target, primary keys, and optional matching columns are always defined.
2. Assert that every primary key comes from the select clause and optionally collect additional columns to tighten the predicate.
3. Extract any `WITH` clause, rebuild the select clause to the required order, and wrap the select into an inline source named by the normalized alias.
4. Build a correlated `EXISTS` predicate using `QueryBuilder.buildEqualityPredicate`, then place the resulting `SimpleSelectQuery` inside a `UnaryExpression('exists', new InlineQuery(...))` that becomes the `WHERE` clause of the `DeleteQuery`.

By expressing the predicate via `EXISTS`, the delete still honors the same filters as the select projection without materializing a temporary table or violating the testkit's read-only contract.

```ts
const deleteQuery = QueryBuilder.buildDeleteQuery(simpleSelectQuery, {
  target: 'customers',
  primaryKeys: ['id'],
});
```

> You can simply specify the table name, and the helper will automatically derive an alias. If you prefer, you can also provide an explicit alias (e.g., `customers c`).

## Keeping the predicate precise

- Use `primaryKeys` to describe the identity columns that define row ownership.
- Provide `columns` to include extra select items you want to guard the deletion with (the conversion rebuilds the select clause accordingly).
- The helper always insists on an alias for the delete target, mirroring repository SQL that already includes explicit aliases.

## Learn More

- [QueryBuilder API](../api/classes/QueryBuilder.md) for `buildDeleteQuery` and the supporting predicate builders.
- [SQLite Testkit Guide](./sqlite-testkit-howto.md) to understand how this conversion stays inside the `SELECT`-rewrite model.
- [Why SQL Unit Testing Is Hard](./testkit-concept.md) for the decision to keep the fixture surface limited to `SELECT` statements.

