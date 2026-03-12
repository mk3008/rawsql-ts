---
title: What Is SSSQL?
---

# What Is SSSQL?

SSSQL is the rawsql-ts convention for writing SQL that stays structurally truthful in source form while still allowing narrowly-scoped compile-time simplification passes.

The core idea is:

- start from valid SQL that already says the truth about the condition
- avoid string concatenation for ordinary optional-filter use cases
- apply explicit opt-in rewrites only when the requested shape is already understood and safe

SSSQL is not a separate query language.
It is still SQL first.
The "SS" part is about keeping the SQL source shape honest enough that tooling can simplify it without inventing a second imperative templating language.

## When SSSQL is the right first choice

Reach for SSSQL first when the request sounds like:

- "add an optional filter"
- "make this search parameter nullable"
- "support optional brand / category / date filters"
- "stop building WHERE clauses with string concatenation"

Typical source shape:

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

This shape keeps the SQL readable for humans and analyzable for tooling.

## What SSSQL is trying to avoid

SSSQL exists to avoid common fallback patterns such as:

- assembling `WHERE` clauses with string concatenation
- sentinel-heavy `WHERE 1 = 1` builders as the default authoring style
- imperative branching outside SQL for routine optional filters

Those approaches can work, but they make source SQL less truthful, less reviewable, and harder to reason about with tooling.

## What rawsql-ts currently supports

Today the saved SSSQL story in rawsql-ts is intentionally narrow:

- truthful optional branches shaped like `(:p IS NULL OR ...)`
- explicit opt-in targeting through `optionalConditionParameters`
- conservative pruning only for supported top-level `AND` branches
- exact no-op behavior for unsupported or ambiguous shapes

Read the exact MVP support contract in [SSSQL Optional Branch Pruning MVP](./sssql-optional-branch-pruning.md).

## Decision rule for AI and maintainers

If the prompt is "add an optional condition" and the condition can be expressed as a truthful SQL branch, prefer SSSQL before inventing dynamic SQL assembly.

Only leave SSSQL when one of these is true:

- the boolean shape is outside the supported pruning surface
- the request genuinely needs query-shape generation rather than optional predicates
- safety or readability would be worse than a non-SSSQL alternative

## Related guides

- [SSSQL Optional Branch Pruning MVP](./sssql-optional-branch-pruning.md)
- [Querybuilding Recipes](./querybuilding-recipes.md)
- [SQL Tool Happy Paths](./sql-tool-happy-paths.md)
