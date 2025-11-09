<div v-pre>
# Class: MultiQuerySplitter

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:81](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/MultiQuerySplitter.ts#L81)

Splits SQL text containing multiple queries separated by semicolons

Provides sophisticated query boundary detection that properly handles:
- String literals containing semicolons
- Comments containing semicolons  
- Nested structures and complex SQL
- Empty queries and whitespace handling

## Example

```typescript
const multiSQL = `
  -- First query
  SELECT 'hello;world' FROM users;
  
  // Second query with comment
  SELECT id FROM orders WHERE status = 'active';
  
  -- Empty query
  ;
`;

const queries = MultiQuerySplitter.split(multiSQL);
console.log(queries.queries.length); // 3 queries

// Find query at cursor position
const active = queries.getActive(150);
console.log(active?.sql); // Query containing position 150
```

## Constructors

### Constructor

> **new MultiQuerySplitter**(): `MultiQuerySplitter`

#### Returns

`MultiQuerySplitter`

## Methods

### split()

> `static` **split**(`text`): [`QueryCollection`](../interfaces/QueryCollection.md)

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:88](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/utils/MultiQuerySplitter.ts#L88)

Split multi-query SQL text into individual queries

#### Parameters

##### text

`string`

SQL text that may contain multiple queries separated by semicolons

#### Returns

[`QueryCollection`](../interfaces/QueryCollection.md)

Collection of individual queries with position information
</div>
