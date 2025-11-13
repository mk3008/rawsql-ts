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

## Mapping request data to `FilterConditions`

DynamicQueryBuilder expects every filter to be expressed as a `FilterConditions` value, so your handler can treat the request DTO as a bag of optional helpers rather than scattering SQL fragments. Each helper returns `undefined` when no filtering is needed, leaving the focus on translating inputs into the shape-safe comparison operators that the builder understands.

```typescript
/**
 * Converts domain-level search criteria into filter conditions understood
 * by the infrastructure layer. This function does not apply business meaning;
 * it only shapes already-interpreted domain rules into the structure required
 * by DynamicQueryBuilder and SQL generation.
 */
private buildFilterConditions(params: TaskSearchParams): FilterConditions {
  // Compose candidate filters and rely on each helper to return undefined when the parameter is missing.
  const candidate: FilterConditions = {
    status: statusFilter(params.done),
    or: textSearchFilters(params.q),
    due_date: dueDateRange(params.dueAfter, params.dueBefore)
  };

  return candidate;
}

/**
 * Translates domain-level status semantics into infrastructure-friendly
 * filter conditions. This function expresses "what the domain wants to search"
 * using the vocabulary understood by the repository, without exposing physical
 * storage details (e.g., DB codes or flags).
 */
function statusFilter(done?: boolean): FilterConditionValue | undefined {
  if (done === undefined) return undefined;
  return done ? 'done' : 'pending';
}

/**
 * Converts domain-specific free-text search rules into filter fragments
 * consumable by the repository layer. The domain decides *what* should be
 * matched; this function shapes those intents into queryable conditions.
 */
function textSearchFilters(query?: string): FilterConditionValue | undefined {
  if (!query) return undefined;
  // Build a reusable pattern that covers both title and description.
  const pattern = `%${query}%`;
  return {
    or: [
      { column: 'title', like: pattern },
      { column: 'description', like: pattern }
    ]
  } as FilterConditionValue;
}

/**
 * Maps domain-level date range semantics (e.g., "due before", "due after")
 * into concrete filter conditions usable by the underlying query builder.
 * Domain meaning is preserved while producing infrastructure-ready criteria.
 */
function dueDateRange(after?: string, before?: string): FilterConditionValue | undefined {
  if (!after && !before) return undefined;
  // Only emit comparator entries when the corresponding boundary is supplied.
  const range: FilterConditionValue = {};
  if (after) range['>='] = after;
  if (before) range['<='] = before;
  return range;
}
```

This keeps every transformation close to the request DTO while letting `DynamicQueryBuilder` drop helpers that returned `undefined` automatically.

## Naming logical OR clauses

When you need grouped OR conditions, prefer a property named `or` and put the actual branches inside the nested `{ or: [...] }` object. The builder inspects each filter value for an `or` array, so the outer property name can be anything (`orGroup`, `orPolicy`, etc.); using `or` keeps the intent obvious and is convenient when you omit the optional `column` field. Each entry in the `or` array should follow `{ column: 'column_name', ... }` so the parser can resolve the target column before combining the branches.

```typescript
const filters: FilterConditions = {
  or: {
    or: [
      { column: 'status', '=': 'pending' },
      { column: 'priority', '=': 'urgent' }
    ]
  },
  orGroup: {
    or: [
      { column: 'category', '=': 'billing' },
      { column: 'type', '=': 'feature' }
    ]
  }
};
```

The helper name is only a convenience; as long as the filter value exposes `or`, the injector will wrap the branches in parentheses and append them with `AND`. You can still use `filter: { or: ['active', 'pending'] }` to target a column literally named `or` (it is treated as an `IN` list), or choose a different property name if you prefer, as long as the launcher does not interpret the value as a logical object. The recommendation to pick `or` stems from needing a memorable label when you omit the explicit `column` mapping.

### Required vs. optional predicates

- Hard-coded predicates in your base SQL are never removed.  
- Hard-coded parameters behave the same way: they are not overridden, and the builder will not emit duplicate conditions.  
- All other inputs are treated as optional predicates. A filter becomes active only when its value is not `undefined`.  
- Dynamic predicates are inserted at positions chosen for optimal query performance.  
- Injected predicates are not limited to top-level columns; nested targets (e.g., qualified columns or JSON paths) are supported.

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

This also applies to single columns that need a range of explicit operators. For example, the builder gladly combines `'>='` and `'<'` comparators when you need to cover a window such as the first year of 2024:

```typescript
const result = builder.buildQuery(baseSql, {
  filter: {
    created_at: {
      '>=': '2024-01-01',
      '<': '2025-01-01'
    }
  }
});
```

The tests in `packages/core/tests/transformers/DynamicQueryBuilder.test.ts` (see the qualified column coverage around lines 530-555) verify that multiple comparators for a single column are combined properly, so you can safely declare as many operators as you need in one object literal.

The injector also honors `in`, `any`, and explicit `column` overrides for edge cases such as JSON paths.

You can force the injector to target a computed alias or JSON extraction by passing a `column` override that matches the alias (or column name) declared in the base SQL. For example, when the base query already exposes the JSON extraction as `status_path`, map the runtime filter key `statusPath` back to that alias:

```typescript
const baseSql = `
  SELECT
    payload ->> 'status' AS status_path
  FROM tasks
`;

const query = builder.buildQuery(baseSql, {
  filter: {
    statusPath: {
      column: 'status_path',
      '=': 'active'
    }
  }
});
```

This tells the injector to bind `statusPath` to the aliased expression rather than trying to match a literal column named `statusPath`.

**Filter targets must resolve to an actual column name or alias.** The builder inspects every column and alias emitted by the SELECT clause (and its upstream CTEs/subqueries) via the internal collector, so any exposed name there can be filtered without extra configuration.

**Qualify only when needed.** If you want to be explicit or disambiguate, prefix the key with the real table name such as `orders.status`; DynamicQueryBuilder understands that even if the SQL uses aliases because it maps the real table names back to the query aliases.

**Provide schema hints for hidden columns.** Passing a schema dictionary through the optional `tableColumnResolver` constructor argument (`new DynamicQueryBuilder(schemaDictionary)`) lets the injector recognize columns that are not part of the SELECT list but exist in your tables.

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
