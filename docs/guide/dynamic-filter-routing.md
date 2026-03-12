---
title: Dynamic Filter Routing
outline: deep
---

# Dynamic Filter Routing

Use this guide when the request is "add an optional search condition" and you need to decide whether the first move is **DynamicQueryBuilder filter injection** or **SSSQL optional-branch authoring**.

## Start with DynamicQueryBuilder when

Choose `DynamicQueryBuilder` filter injection first when all of the following are true:

- the optional predicate targets a column that already belongs to the current query graph
- the base SQL already joins every table needed for the filter
- the request is ordinary runtime filtering rather than SQL-shape branching

In that path, hardcoded predicates already present in SQL remain mandatory predicates.
Filters passed through `filter` are optional runtime additions and are ignored when the caller omits them.

## Escalate to SSSQL when

Choose SSSQL when the optional condition needs SQL that `DynamicQueryBuilder` cannot truthfully inject by column matching alone.
Typical examples are:

- the filter needs a table that the query does not otherwise reference
- the optional condition needs an `EXISTS` branch or other removable SQL fragment
- the query should stay truthful in one SQL file instead of relying on out-of-band string assembly

SSSQL is the fallback that covers removable branches such as `(:category_name IS NULL OR EXISTS (...))`.

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
| Add an optional filter on a column already present in the current query | `DynamicQueryBuilder` `filter` | Lowest-friction path; no SQL shape change required |
| Add an optional filter that needs a table or branch not present in the current query | SSSQL + `optionalConditionParameters` | Keeps the optional branch truthful in SQL |
| Bind an already hardcoded mandatory parameter | `filter` binding of existing placeholders | Preserves the SQL's required predicate |
| Remove a branch when the caller passes `null` / `undefined` | SSSQL + `optionalConditionParameters` | Prunes only explicitly targeted optional branches |

## Recommended authoring loop

1. Ask whether the requested filter only touches columns already present in the query.
2. If yes, prefer `DynamicQueryBuilder` filter injection.
3. If no, author the missing optional branch in SQL with SSSQL.
4. Keep hardcoded required predicates separate from removable optional branches.
5. Add or update the focused unit test that proves the routing choice.
