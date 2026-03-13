---
title: SSSQL for Humans
outline: deep
---

# SSSQL for Humans

This guide explains **why SSSQL exists**, **what problem it solves**, and **how it should coexist with DynamicQueryBuilder**. It is written for humans first: maintainers, reviewers, and AI operators who need a stable mental model before they touch SQL.

## Why SSSQL exists

Routine optional filters are easy to describe in product language but easy to implement badly in code. Teams often fall back to one of these patterns:

- string-building WHERE clauses outside SQL
- sentinel-heavy `WHERE 1 = 1` authoring as the default style
- extra joins or scaffolding added only so a later cleanup pass can remove them

Those patterns can work, but they hide the real SQL shape and make review, debugging, and AI-assisted editing harder. SSSQL exists to keep the source SQL truthful while still allowing explicit simplification when a parameter is absent.

## What SSSQL is

SSSQL is **not** a new query language. It is regular SQL written in a shape that rawsql-ts can simplify conservatively when the author opts in.

Typical example:

```sql
SELECT p.product_id, p.product_name
FROM products p
WHERE (:brand_name IS NULL OR p.brand_name = :brand_name)
  AND (:category_name IS NULL OR EXISTS (
    SELECT 1
    FROM product_categories pc
    JOIN categories c
      ON c.category_id = pc.category_id
    WHERE pc.product_id = p.product_id
      AND c.category_name = :category_name
  ))
```

This SQL already tells the truth about the condition. The pruning pass only removes the branch when the author explicitly lists the parameter in `optionalConditionParameters`.

## Why this matters to humans and AI

When the source SQL stays truthful, humans can review it as SQL instead of reverse-engineering a string builder. AI agents also get a more stable target: they can edit one SQL asset, rerun tooling, and verify the result without inventing a second control flow outside the query file.

That leads to better outcomes for:

- reviewability
- debuggability
- safe refactoring
- dogfooding scenarios where the exact SQL shape matters

## How SSSQL and DynamicQueryBuilder fit together

These two features solve related but different problems.

### Prefer DynamicQueryBuilder first when

Use DynamicQueryBuilder when the optional filter targets a column that already exists in the query graph. This is the most flexible and maintainable path for routine search forms because the source SQL can keep mandatory predicates hardcoded while runtime filter objects decide which optional predicates are inserted.

Examples:

- adding optional filters on columns that are already selected or joined
- exposing user-entered search fields without rewriting the SQL file shape
- preserving the rule that hardcoded predicates are mandatory by default

### Prefer SSSQL when

Use SSSQL when the optional filter needs SQL structure that DynamicQueryBuilder cannot synthesize safely from the current query graph.

Examples:

- the optional filter depends on a table that is not otherwise present in the query
- the filter needs an `EXISTS` branch or correlated subquery
- the source SQL should directly express an optional branch for review or optimizer work

## Mandatory predicates vs removable branches

The rule set should stay simple:

- hardcoded predicates are mandatory predicates
- DynamicQueryBuilder-added filters are optional unless the caller supplies them
- SSSQL branches are only removable when they are explicitly authored as removable branches and explicitly targeted by `optionalConditionParameters`

That means the following ideas can both be true without conflict:

- `status = 'active'` is mandatory if it is hardcoded in SQL
- `(:status IS NULL OR status = :status)` is removable because the SQL author intentionally made it removable

SSSQL does not weaken the meaning of hardcoded predicates. It adds an explicit escape hatch for branches that were designed to disappear when their parameter is absent.

## What SSSQL should not be used for

Avoid using SSSQL as a blanket replacement for every dynamic-search problem. It is not the first choice for:

- ordinary optional filters already covered by DynamicQueryBuilder
- arbitrary query-shape generation
- broad SQL templating or string concatenation workflows
- redundant LEFT JOIN scaffolding that exists only for later cleanup

## Human checklist before choosing SSSQL

1. Can DynamicQueryBuilder insert the filter because the target column already exists in the query?
2. If not, can the optional condition be written as truthful SQL in one branch?
3. Is the branch explicitly removable, and is that removability important to runtime behavior?
4. Will the result stay easier to review than a builder-based alternative?

If the answers are yes to 2-4 and no to 1, SSSQL is usually the right tool.

## Related guides

- [What Is SSSQL?](./sssql-overview.md)
- [Dynamic Filter Routing](./dynamic-filter-routing.md)
- [ztd-cli SSSQL Authoring](./ztd-cli-sssql-authoring.md)
- [SSSQL Optional Branch Pruning MVP](./sssql-optional-branch-pruning.md)