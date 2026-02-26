---
title: SELECT-to-UPDATE Conversion
outline: deep
---

# SELECT -> UPDATE Conversion

The SQLite testkit intercepts modification attempts by capturing the `SELECT` representation of the rows that will be affected and letting `QueryBuilder.buildUpdateQuery` turn that projection into an `UPDATE` statement. The conversion keeps the instrumentation layer read-only while executing the same assignment logic that the repository would run.

## Key transformation steps

1. Normalize the conversion options so the source alias, target expression, and primary keys are always available.
2. Gather the column metadata from the `SimpleSelectQuery`, ensure each primary key exists, and collect the non-key columns to update.
3. Rebuild the select clause to match the final column ordering, extract any `WITH` clause, and wrap the query in a `FromClause` that references the normalized alias.
4. Create a `SetClause` where each column is assigned a `ColumnReference` from the source alias and add a `WHERE` clause that compares the primary keys using `QueryBuilder.buildEqualityPredicate`.

If there are no writable columns beyond the primary keys, `buildUpdateQuery` raises a descriptive error so fixture authors can expose additional select targets.

```ts
const updateQuery = QueryBuilder.buildUpdateQuery(simpleSelectQuery, {
  target: 'customers c',
  primaryKeys: ['id'],
  sourceAlias: 'src',
});
```

## Options to control the update

- `primaryKeys` determines which identity columns the `WHERE` predicate uses and must match columns emitted by the select list.
- `columns` lets you whitelist the writable columns; the helper normalizes duplicates and invalid entries before building the `SetClause`.
- `sourceAlias` defaults to `src` but can be overridden when the surrounding repository already names the subquery.

These knobs keep the conversion deterministic and preserve the column ordering required for triangular assignments.

## Learn More

- [QueryBuilder API](../api/classes/QueryBuilder.md) for the full `buildUpdateQuery` signature and alias helpers.
- [SQLite Testkit Guide](./testkit-sqlite-howto.md) to see how repository wrappers rely on this helper for fixture verification.
- [Why SQL Unit Testing Is Hard](./testkit-concept.md) for the guiding philosophy behind focusing on reads and replaying writes via conversions.
