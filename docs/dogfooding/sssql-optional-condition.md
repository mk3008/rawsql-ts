---
title: SSSQL Optional-Condition Dogfooding
---

# SSSQL Optional-Condition Dogfooding

This scenario checks whether an AI agent or maintainer reaches for SSSQL first when the request is "add an optional condition" rather than falling back to SQL string concatenation, `WHERE 1 = 1` assembly, or redundant LEFT JOIN authoring plus later cleanup.

## Goal

Verify that the shortest successful response to an optional-filter request uses truthful SQL branches shaped like `(:p IS NULL OR ...)` plus explicit opt-in pruning metadata.

## Canonical prompt

Use a request equivalent to:

> Add an optional condition for `brand_name` and `category_name`.

The expected dogfooding response is not "build the WHERE clause dynamically."
The expected response is "keep the SQL truthful and express the optional filters as SSSQL branches."

## Expected happy path

1. Write the SQL with truthful optional branches.
2. Pass the targeted parameters through `optionalConditionParameters`.
3. Let unsupported shapes stay exact no-op instead of widening the simplifier.

Example target shape:

```sql
SELECT p.product_id, p.product_name
FROM products p
WHERE (:brand_name IS NULL OR p.brand_name = :brand_name)
  AND (
    :category_name IS NULL
    OR EXISTS (
      SELECT 1
      FROM product_categories pc
      JOIN categories c
        ON c.category_id = pc.category_id
      WHERE pc.product_id = p.product_id
        AND c.category_name = :category_name
    )
  )
```

Example builder usage:

```ts
const query = builder.buildQuery(sql, {
  optionalConditionParameters: {
    brand_name: params.brand_name ?? null,
    category_name: params.category_name ?? null,
  },
});
```

## Regression surface

- Test file: `packages/core/tests/transformers/SSSQLDogfooding.test.ts`
- Test name: `dogfood: optional-condition prompt chooses truthful SSSQL branches before dynamic SQL assembly`

This regression surface keeps the product decision in git:
when the request is just "add optional filters", SSSQL should be the first successful path.

## What counts as a failure

Treat these responses as dogfooding regressions:

- building SQL by concatenating AND ... fragments first
- expressing routine optional predicates as redundant LEFT JOINs and hoping unused-join cleanup removes them later
- requiring `WHERE 1 = 1` as the primary authoring pattern
- widening pruning support instead of keeping unsupported shapes exact no-op
- hiding the optional-filter intent outside the SQL source

## Why this scenario matters

This is one of the most important SSSQL entry points because optional search filters are where people most often regress back to imperative SQL construction.

If this path is smooth, SSSQL is not just implemented, it is teachable and likely to be chosen in real requests.
