<div v-pre>
# Interface: CTERegion

Defined in: [packages/core/src/utils/CTERegionDetector.ts:18](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/utils/CTERegionDetector.ts#L18)

Information about a CTE (Common Table Expression) region in SQL text.
Provides boundaries and content for SQL editor integration.

## Example

```typescript
const region: CTERegion = {
  name: 'monthly_sales',
  startPosition: 5,
  endPosition: 150,
  sqlContent: 'SELECT id, name FROM users WHERE active = true'
};
```

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/utils/CTERegionDetector.ts:20](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/utils/CTERegionDetector.ts#L20)

The name of the CTE (e.g., 'monthly_sales')

***

### startPosition

> **startPosition**: `number`

Defined in: [packages/core/src/utils/CTERegionDetector.ts:22](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/utils/CTERegionDetector.ts#L22)

Starting character position in the original SQL text (0-based)

***

### endPosition

> **endPosition**: `number`

Defined in: [packages/core/src/utils/CTERegionDetector.ts:24](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/utils/CTERegionDetector.ts#L24)

Ending character position in the original SQL text (0-based)

***

### sqlContent

> **sqlContent**: `string`

Defined in: [packages/core/src/utils/CTERegionDetector.ts:26](https://github.com/mk3008/rawsql-ts/blob/52cdfc64a16473ecb6ab0064c5360071f2d8b841/packages/core/src/utils/CTERegionDetector.ts#L26)

The executable SQL content of the CTE (SELECT statement without CTE wrapper)
</div>
