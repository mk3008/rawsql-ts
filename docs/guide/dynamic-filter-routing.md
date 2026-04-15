---
title: Dynamic Filter Routing
outline: deep
---

# Dynamic Filter Routing

Use this guide when the request is "add an optional search condition" and you need to decide whether the first move is **binding an existing mandatory placeholder** or **authoring a truthful SSSQL optional branch**.

## Start with existing placeholder binding when

Choose `DynamicQueryBuilder` placeholder binding first when all of the following are true:

- the predicate already exists in SQL as a mandatory placeholder-driven condition
- the caller only needs to provide runtime values for that existing condition
- no new removable SQL branch needs to be authored

In that path, hardcoded predicates already present in SQL remain mandatory predicates.
`filter` may still bind existing placeholders, but it no longer injects new optional predicates at runtime.

## Escalate to SSSQL when

Choose SSSQL when the request would otherwise require inventing a new SQL fragment outside the saved SQL asset.
Typical examples are:

- the filter needs a table that the query does not otherwise reference
- the optional condition needs an `EXISTS` / `NOT EXISTS` branch or other removable SQL fragment
- the query should stay truthful in one SQL file instead of relying on out-of-band string assembly

SSSQL covers removable branches such as:

- `(:category_name IS NULL OR EXISTS (...))`
- `(:archived_name IS NULL OR NOT EXISTS (...))`
- `(:product_name IS NULL OR product_name ILIKE :product_name)`

## Mandatory vs removable predicates

Use this rule to avoid confusing AI agents:

- hardcoded predicates in SQL are mandatory predicates by default
- SSSQL optional branches are a special case because they are explicitly authored as removable branches and pruned only when the targeted parameter is `null` or `undefined`

That means these two statements can both be true without contradiction:

1. `tenant_id = :tenant_id` is mandatory and must stay in the query
2. `(:status IS NULL OR status = :status)` is removable because the SQL explicitly marks that branch as optional

## Routing table

| Request shape | First choice | Why |
| --- | --- | --- |
| Bind an already hardcoded mandatory parameter | `filter` binding of existing placeholders | Preserves the SQL's required predicate |
| Add an optional filter on a column already present in the current query | SSSQL authoring | Runtime no longer injects new optional predicates |
| Add an optional filter that needs a table or branch not present in the current query | SSSQL + `optionalConditionParameters` | Keeps the optional branch truthful in SQL |
| Remove a branch when the caller passes `null` / `undefined` | SSSQL + `optionalConditionParameters` | Prunes only explicitly targeted optional branches |

## Recommended authoring loop

1. Ask whether the requested filter only touches columns already present in the query.
2. If the predicate already exists in SQL, bind its required placeholders only.
3. Otherwise, author the missing optional branch in SQL with SSSQL.
4. Keep hardcoded required predicates separate from removable optional branches.
5. Use `ztd query sssql list` to inspect authored branches and `ztd query sssql remove --preview` when cleaning them up.
6. Add or update the focused unit test that proves the routing choice.

## Related guides

- [SSSQL for Humans](./sssql-for-humans.md)
- [SSSQL Optional Branch Pruning MVP](./sssql-optional-branch-pruning.md)
