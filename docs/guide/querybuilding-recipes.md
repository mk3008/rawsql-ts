---
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

## Column-Anchored EXISTS filters

You can now attach `EXISTS`/`NOT EXISTS` predicates directly to filter targets, which is useful when the relationship requires correlated subqueries. For a single column you can add an `exists` or `notExists` object:

```ts
const query = builder.buildQuery(baseSql, {
  filter: {
    'users.id': {
      exists: {
        sql: `
          SELECT 1 FROM orders o
          WHERE o.user_id = $c0
            AND o.status = :status
        `,
        params: { status: 'paid' }
      }
    }
  }
});
```

The placeholder tokens `$c0`, `$c1`, … refer to the filters’ anchor columns in declaration order, so every anchor column must appear in the subquery. `$exists`/`$notExists` metadata blocks let you declare multi-column anchors together:

```ts
filter: {
  $exists: [
    {
      on: ['users.id', 'users.tenant_id'],
      sql: `
        SELECT 1 FROM subscriptions s
        WHERE s.user_id = $c0
          AND s.tenant_id = $c1
      `,
      params: { status: 'active' }
    }
  ]
}
```

If placeholder numbering or column resolution fails the builder skips the predicate by default, but enabling `existsStrict: true` in `QueryBuildOptions` surfaces the error so you can fix the metadata.

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

## Pruning unused structures

`DynamicQueryBuilder` exposes two opt-in clean-up knobs that run after filters, sorts, and paging have been applied:

- `removeUnusedLeftJoins`: when supplied together with `schemaInfo`, the builder will iteratively strip LEFT JOINs whose target alias is never referenced beyond the join itself and whose ON clause maps to a single column equality on a declared unique key.
- `removeUnusedCtes`: removes SELECT-only, non-recursive CTEs that never feed the final query (including chained dependencies) while leaving data-modifying, recursive, or otherwise ambiguous CTEs untouched.

Both options must be explicitly enabled via `QueryBuildOptions` (or builder defaults) and rely on AST-driven reference analysis rather than string matching. Supplying accurate `schemaInfo` metadata is critical for safely pruning joins, and the fixed-point updater ensures cascading deletions are handled predictably.

## Learn More

- [`FilterConditions` API](../api/type-aliases/FilterConditions.md) documents every supported operator shape.
- [`DynamicQueryBuilder` API](../api/classes/DynamicQueryBuilder.md) covers sorting, pagination, and JSON serialization helpers.
- Revisit the [`SqlFormatter` recipes](formatting-recipes.md) to prepare the query for transport or display.
