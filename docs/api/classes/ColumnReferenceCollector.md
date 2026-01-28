<div v-pre>
# Class: ColumnReferenceCollector

Defined in: [packages/core/src/transformers/ColumnReferenceCollector.ts:81](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/ColumnReferenceCollector.ts#L81)

A comprehensive collector for all ColumnReference instances in SQL query structures.

This collector extends beyond the capabilities of SelectableColumnCollector by traversing
CTE internal queries, subqueries, and all nested SQL components to collect every column
reference instance in the query tree. It's specifically designed for transformation
scenarios where all column references need to be identified and potentially modified.

## Key Differences from SelectableColumnCollector

| Feature | SelectableColumnCollector | ColumnReferenceCollector |
|---------|---------------------------|---------------------------|
| CTE Internal Scanning | ❌ Skipped | ✅ Included |
| Subquery Traversal | ❌ Limited | ✅ Comprehensive |
| Deduplication | ✅ Yes | ❌ No (preserves all instances) |
| Use Case | Column selection analysis | Column reference transformation |

## Supported Query Types

- **SimpleSelectQuery**: Standard SELECT statements with all clauses
- **BinarySelectQuery**: UNION, INTERSECT, EXCEPT operations
- **Nested CTEs**: WITH clauses and their internal queries
- **Subqueries**: All subquery types in FROM, WHERE, SELECT clauses
- **Complex Expressions**: CASE, functions, binary operations, etc.

## Examples

```typescript
import { ColumnReferenceCollector, SelectQueryParser } from 'rawsql-ts';

const sql = `
  WITH user_data AS (
    SELECT id, name FROM users WHERE status = 'active'
  ),
  order_summary AS (
    SELECT user_data.id, COUNT(*) as order_count
    FROM user_data
    JOIN orders ON user_data.id = orders.user_id
    GROUP BY user_data.id
  )
  SELECT * FROM order_summary
`;

const query = SelectQueryParser.parse(sql);
const collector = new ColumnReferenceCollector();
const columnRefs = collector.collect(query);

console.log(`Found ${columnRefs.length} column references:`);
columnRefs.forEach(ref => {
  const tableName = ref.namespaces?.[0]?.name || 'NO_TABLE';
  console.log(`- ${tableName}.${ref.column.name}`);
});

// Output includes references from:
// - CTE definitions: users.id, users.name, users.status
// - Main query: user_data.id, orders.user_id, etc.
```

```typescript
// Use for column reference transformation
const columnRefs = collector.collect(query);

// Update all references to 'old_table' to 'new_table'
columnRefs.forEach(ref => {
  if (ref.namespaces?.[0]?.name === 'old_table') {
    ref.namespaces[0].name = 'new_table';
  }
});
```

## Since

0.11.16

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`void`\&gt;

## Constructors

### Constructor

> **new ColumnReferenceCollector**(): `ColumnReferenceCollector`

Defined in: [packages/core/src/transformers/ColumnReferenceCollector.ts:86](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/ColumnReferenceCollector.ts#L86)

#### Returns

`ColumnReferenceCollector`

## Methods

### collect()

> **collect**(`query`): [`ColumnReference`](ColumnReference.md)[]

Defined in: [packages/core/src/transformers/ColumnReferenceCollector.ts:179](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/ColumnReferenceCollector.ts#L179)

Collects all ColumnReference instances from the given SQL query component.

This method performs a comprehensive traversal of the entire query structure,
including CTE definitions, subqueries, and all expression types to collect
every ColumnReference instance. The returned references are actual instances
from the query tree, allowing for direct modification.

#### Parameters

##### query

[`SqlComponent`](SqlComponent.md)

The SQL query component to analyze. Can be SimpleSelectQuery, BinarySelectQuery, or any SqlComponent.

#### Returns

[`ColumnReference`](ColumnReference.md)[]

An array of all ColumnReference instances found in the query. Each reference maintains its original object identity for modification purposes.

#### Examples

```typescript
const collector = new ColumnReferenceCollector();
const columnRefs = collector.collect(query);

// Analyze collected references
`const tableReferences = new Map<string, number>();`
columnRefs.forEach(ref => {
  const tableName = ref.namespaces?.[0]?.name || 'unqualified';
  tableReferences.set(tableName, (tableReferences.get(tableName) || 0) + 1);
});

console.log('Table reference counts:', tableReferences);
```

```typescript
// Transform references during collection
const columnRefs = collector.collect(query);

// Replace all references to 'old_schema.table' with 'new_schema.table'
columnRefs.forEach(ref => {
  if (ref.namespaces?.length === 2 && 
      ref.namespaces[0].name === 'old_schema' && 
      ref.namespaces[1].name === 'table') {
    ref.namespaces[0].name = 'new_schema';
  }
});
```

#### Since

0.11.16

***

### visit()

> **visit**(`component`): `void`

Defined in: [packages/core/src/transformers/ColumnReferenceCollector.ts:297](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/ColumnReferenceCollector.ts#L297)

#### Parameters

##### component

[`SqlComponent`](SqlComponent.md)

#### Returns

`void`

#### Implementation of

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md).[`visit`](../interfaces/SqlComponentVisitor.md#visit)
</div>
