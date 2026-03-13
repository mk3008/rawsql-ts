---
title: ztd-cli SSSQL Authoring
outline: deep
---

# ztd-cli SSSQL Authoring

`ztd-cli` does not execute or rewrite SQL by itself, but it is part of the authoring loop that decides what kind of SQL gets saved under `src/sql/`.

When the request is "add an optional filter" or "make this condition optional", prefer **SSSQL** before falling back to string-built SQL assembly outside the SQL file.

## What this means in a ZTD project

In a ZTD project, the authoring loop usually looks like this:

1. Update the SQL asset under `src/sql/`
2. Regenerate or verify the QuerySpec with `ztd model-gen`
3. Run ZTD tests

If the change is a routine optional predicate, the SQL asset should stay truthful:

```sql
select
  p.product_id,
  p.product_name
from public.products p
where (:brand_name is null or p.brand_name = :brand_name)
  and (:category_name is null or exists (
    select 1
    from public.product_categories pc
    join public.categories c
      on c.category_id = pc.category_id
    where pc.product_id = p.product_id
      and c.category_name = :category_name
  ))
```

Then keep the runtime pruning intent explicit in application code:

```ts
const query = builder.buildQuery(sql, {
  optionalConditionParameters: {
    brand_name: input.brandName ?? null,
    category_name: input.categoryName ?? null,
  },
});
```

## When to choose SSSQL first

Reach for SSSQL first when the prompt sounds like:

- "add an optional filter"
- "make `brand_name` optional"
- "support search-by-category when the value is present"
- "keep one SQL file instead of branching queries in code"

These requests are usually about preserving a single truthful SQL asset, not about inventing a new SQL-construction layer.

## What to avoid

For routine optional predicates, avoid:

- building `WHERE` fragments with string concatenation
- adding `WHERE 1 = 1` sentinels only to make later concatenation easier
- splitting one readable query into multiple near-duplicate query files
- hiding ordinary optional-filter logic in imperative branching before the SQL is even parsed

## Where ztd-cli fits

Use `ztd-cli` to keep the SQL-first loop tight:

- `ztd model-gen --probe-mode ztd` validates the saved SQL asset against your DDL snapshot
- `ztd lint` checks structural issues in authored SQL files
- ZTD tests keep the spec, fixtures, and DDL snapshot aligned

`ztd-cli` should help validate the authored SQL, not push the project toward non-SQL-first assembly for ordinary optional filters.

## End-to-end authoring example

Use a single SQL asset as the source of truth:

```sql
-- src/sql/products/list_products.sql
select
  p.product_id,
  p.product_name,
  p.brand_name
from public.products p
where (:brand_name is null or p.brand_name = :brand_name)
  and (:category_name is null or exists (
    select 1
    from public.product_categories pc
    join public.categories c
      on c.category_id = pc.category_id
    where pc.product_id = p.product_id
      and c.category_name = :category_name
  ))
order by p.product_name
```

Then run the normal ZTD loop:

```bash
ztd model-gen src/sql/products/list_products.sql \
  --probe-mode ztd \
  --sql-root src/sql \
  --out src/catalog/specs/products/list-products.spec.ts
ztd lint src/sql/products/list_products.sql
vitest run
```

If the runtime layer uses `rawsql-ts`, keep the pruning contract explicit instead of inventing a second SQL assembly path:

```ts
const query = builder.buildQuery(sql, {
  optionalConditionParameters: {
    brand_name: input.brandName ?? null,
    category_name: input.categoryName ?? null,
  },
});
```

This is the intended flow for prompts such as "add an optional filter to `src/sql/products/list_products.sql`" or "make category search optional without splitting the SQL file".

## Agent prompt routing

When an AI or scripted caller receives requests like these, the first response should stay on the SQL-first path:

- "Add an optional filter to `src/sql/products/list_products.sql`."
- "Make `brand_name` optional without branching the repository method."
- "Support category filtering only when the value is present."

A good response shape is:

1. edit the SQL asset with truthful optional predicates
2. rerun `ztd model-gen --probe-mode ztd` if the contract changed
3. rerun `ztd lint` and tests
4. wire `optionalConditionParameters` only for branch pruning

Do not steer these requests toward string-built `WHERE` concatenation or redundant `LEFT JOIN` scaffolding plus later cleanup.

## Read next

- [What Is SSSQL?](./sssql-overview.md)
- [SSSQL Optional Branch Pruning MVP](./sssql-optional-branch-pruning.md)
- [Querybuilding Recipes](./querybuilding-recipes.md)
- [SSSQL Optional-Condition Dogfooding](../dogfooding/sssql-optional-condition.md)
