<div v-pre>
# Interface: CursorPositionInfo

Defined in: [packages/core/src/utils/CTERegionDetector.ts:42](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/utils/CTERegionDetector.ts#L42)

Result of cursor position analysis for SQL editor integration.
Contains information about what SQL should be executed based on cursor position.

## Example

```typescript
const info: CursorPositionInfo = {
  isInCTE: true,
  cteRegion: { name: 'users_cte', startPosition: 10, endPosition: 100, sqlContent: '...' },
  executableSQL: 'SELECT id, name FROM users WHERE active = true'
};
```

## Properties

### isInCTE

> **isInCTE**: `boolean`

Defined in: [packages/core/src/utils/CTERegionDetector.ts:44](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/utils/CTERegionDetector.ts#L44)

Whether the cursor is currently positioned inside a CTE region

***

### cteRegion

> **cteRegion**: `null` \| [`CTERegion`](CTERegion.md)

Defined in: [packages/core/src/utils/CTERegionDetector.ts:46](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/utils/CTERegionDetector.ts#L46)

The CTE region containing the cursor (null if cursor is not in a CTE)

***

### executableSQL

> **executableSQL**: `null` \| `string`

Defined in: [packages/core/src/utils/CTERegionDetector.ts:48](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/utils/CTERegionDetector.ts#L48)

The SQL that should be executed based on cursor position (CTE content or main query)
</div>
