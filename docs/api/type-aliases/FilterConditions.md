<div v-pre>
# Type Alias: FilterConditions

> **FilterConditions** = `Record`&lt;`string`, [`FilterConditionValue`](FilterConditionValue.md)\&gt;

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:100](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/DynamicQueryBuilder.ts#L100)

Filter conditions for dynamic query building.

Supports both unqualified and qualified column names:
- Unqualified: `{ name: 'Alice' }` - applies to all columns named 'name'
- Qualified: `{ 'users.name': 'Bob' }` - applies only to the 'name' column in the 'users' table/alias
- Hybrid: `{ name: 'Default', 'users.name': 'Override' }` - qualified names take priority over unqualified

## Example

```typescript
// Basic usage (backward compatible)
const filter: FilterConditions = {
  name: 'Alice',
  status: 'active'
};

// Qualified names for disambiguation in JOINs
const filter: FilterConditions = {
  'users.name': 'Alice',    // Only applies to users.name
  'profiles.name': 'Bob'    // Only applies to profiles.name
};

// Hybrid approach
const filter: FilterConditions = {
  status: 'active',         // Applies to all 'status' columns
  'users.name': 'Alice',    // Overrides for users.name specifically
  'profiles.name': 'Bob'    // Overrides for profiles.name specifically
};
```
Related tests: packages/core/tests/transformers/DynamicQueryBuilder.test.ts
</div>
