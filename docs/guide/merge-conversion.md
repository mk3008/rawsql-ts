---
title: SELECT-to-MERGE Conversion
outline: deep
---

# SELECT -> MERGE Conversion

`QueryBuilder.buildMergeQuery` lets `rawsql-ts` synthesize conditional upserts while still keeping the instrumentation read-oriented. The helper accepts a single `SimpleSelectQuery` plus conversion options and emits a `MERGE` statement whose `source` derives from the projection and whose `target` is the alias you already operate against.

## How the helper decides actions

1. Normalize the options to fix the `target`, `sourceAlias`, `primaryKeys`, and optional column lists.
2. Ensure the select clause exposes every primary key and any columns that will participate in updates or inserts.
3. Determine update-worthy columns by removing primary keys and optionally honoring an `updateColumns` whitelist.
4. Build a `when matched` clause containing either an `UPDATE`, `DELETE`, or `DO NOTHING` action depending on `matchedAction`. For updates, each column becomes a `SetClauseItem` wired to the source alias.
5. Build a `when not matched` clause that either inserts the source values or does nothing, and optionally add `when not matched by source` actions such as `DELETE` to handle orphaned rows.
6. Emit `MERGE` with the normalized `WITH` clause, the correlation predicate returned by `buildEqualityPredicate`, and the assembled `whenClauses` array.

By keeping all of the logic inside a single conversion helper, the testkit can reason about upserts purely in terms of the `SELECT` that would produce the same row-set, and the capture-and-replay path stays deterministic.

```ts
const mergeQuery = QueryBuilder.buildMergeQuery(simpleSelectQuery, {
  target: 'customers',
  primaryKeys: ['id'],
  sourceAlias: 'src',
});
```

> You can omit the alias — the helper will infer it from the table name. You can still provide an explicit alias (e.g., `customers c`) when needed.

## Conversion knobs

- `matchedAction`: `'update'`, `'delete'`, or `'doNothing'` controls whether a match updates target columns, deletes the row, or skips it altogether.
- `notMatchedAction`: `'insert'` or `'doNothing'` permits optionally skipping inserts when fixtures should leave missing rows untouched.
- `notMatchedBySourceAction`: includes `'delete'` to remove rows that no longer match the projection.
- `updateColumns` / `insertColumns`: enforce ordering and let you exclude columns from updates or inserts even when the select projection contains them.

The helper rebuilds the select clause to reflect the chosen column order and guards against duplicate/missing columns before constructing the `MergeQuery`.

## Learn More

- [QueryBuilder API](../api/classes/QueryBuilder.md) for the `buildMergeQuery` signature and action builders such as `MergeUpdateAction`.
- [SQLite Testkit Guide](./testkit-sqlite-howto.md) showing how merge scenarios remain compatible with the select-driven pipeline.
- [Why SQL Unit Testing Is Hard](./testkit-concept.md) because it explains why the library locks to reads and rewrites writes instead of running them directly.
