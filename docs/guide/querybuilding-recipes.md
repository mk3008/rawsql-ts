﻿---
title: Querybuilding Recipes
outline: deep
---

# Dynamic Query Building Recipes

## Why FilterConditions Matter

`DynamicQueryBuilder` accepts `FilterConditions` so you can graft runtime constraints onto static SQL. Filters are shape-safe: every key maps to a column target, and the value decides which comparison operators enter the `WHERE` clause.

```typescript
import { DynamicQueryBuilder } from 'rawsql-ts';

const builder = new DynamicQueryBuilder();
const query = builder.buildQuery(baseSql, {
  filter: {
    status: 'active',
    created_at: { '>=': '2024-01-01', '<=': '2024-12-31' }
  }
});
```

## Column Targeting Patterns

- Plain keys target every column with the same name (useful when the base SQL already scopes tables).
- Qualified keys such as `"users.status"` bind filters to one table or CTE alias.
- Mix both styles: unqualified rules act as defaults, qualified entries override them where ambiguity exists.

## Value Shapes

`FilterConditionValue` supports multiple idioms:

| Shape | Example | Effect |
| --- | --- | --- |
| Scalar | `status: 'active'` | Emits `status = :status` (or its positional equivalent). |
| Array | `status: ['active', 'pending']` | Expands into an `IN` list. |
| Range | `price: { min: 10, max: 99 }` | Emits `price BETWEEN :price_min AND :price_max`. |
| Comparators | `created_at: { '>=': '2024-01-01' }` | Uses the provided operator verbatim. |
| Pattern | `email: { ilike: '%@example.com' }` | Supports `like` and `ilike`. |
| Nested logic | `{ or: [{ column: 'status', '=': 'trial' }, { column: 'expires_at', '<': now }] }` | Groups multiple branches into a single predicate block. |

The injector also honors `in`, `any`, and explicit `column` overrides for edge cases such as JSON paths.

## Combining Filters With Sorts And Paging

You can layer `filter`, `sort`, and `paging` in one call. The builder parses the base SQL once, injects filters, then applies ordering and pagination so each step sees the updated projection.

```typescript
const query = builder.buildQuery(baseSql, {
  filter: {
    'orders.status': ['active', 'pending'],
    'customers.country': 'JP'
  },
  sort: { 'orders.created_at': { desc: true } },
  paging: { page: 2, pageSize: 50 }
});
```

## Printing The Resulting SQL

`DynamicQueryBuilder` returns a structured `SelectQuery`. Use `SqlFormatter` to print the final SQL text and capture bound parameters. Pick a `parameterStyle` that matches your driver so the `params` payload has the right shape.

```typescript
import { SqlFormatter } from 'rawsql-ts';

const formatter = new SqlFormatter({ parameterStyle: 'named' });
const { formattedSql, params } = formatter.format(query);
```

Reuse the formatter recipes to tune whitespace or switch placeholder conventions when sharing queries with analysts or logging pipelines.

## Learn More

- [`FilterConditions` API](../api/type-aliases/FilterConditions.md) documents every supported operator shape.
- [`DynamicQueryBuilder` API](../api/classes/DynamicQueryBuilder.md) covers sorting, pagination, and JSON serialization helpers.
- Revisit the [`SqlFormatter` recipes](formatting-recipes.md) to prepare the query for transport or display.
