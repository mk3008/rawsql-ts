<div v-pre>
# Class: ScopeResolver

Defined in: [packages/core/src/utils/ScopeResolver.ts:98](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/utils/ScopeResolver.ts#L98)

Resolves scope information at cursor positions for SQL IntelliSense

Provides comprehensive scope analysis including table availability, CTE resolution,
and column visibility for intelligent code completion suggestions.

## Example

```typescript
const sql = `
  WITH users AS (SELECT id, name FROM accounts)
  SELECT u.name FROM users u 
  LEFT JOIN orders o ON u.id = o.user_id
  WHERE u.|
`;
const scope = ScopeResolver.resolveAt(sql, { line: 4, column: 12 });

console.log(scope.availableTables); // [{ name: 'users', alias: 'u' }, { name: 'orders', alias: 'o' }]
console.log(scope.availableCTEs); // [{ name: 'users', columns: ['id', 'name'] }]
```

## Constructors

### Constructor

> **new ScopeResolver**(): `ScopeResolver`

#### Returns

`ScopeResolver`

## Methods

### resolve()

> `static` **resolve**(`sql`, `cursorPosition`): [`ScopeInfo`](../interfaces/ScopeInfo.md)

Defined in: [packages/core/src/utils/ScopeResolver.ts:106](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/utils/ScopeResolver.ts#L106)

Resolve scope information at the specified cursor position

#### Parameters

##### sql

`string`

SQL text to analyze

##### cursorPosition

`number`

Character position of cursor (0-based)

#### Returns

[`ScopeInfo`](../interfaces/ScopeInfo.md)

Complete scope information

***

### resolveAt()

> `static` **resolveAt**(`sql`, `position`): [`ScopeInfo`](../interfaces/ScopeInfo.md)

Defined in: [packages/core/src/utils/ScopeResolver.ts:119](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/utils/ScopeResolver.ts#L119)

Resolve scope information at line/column position

#### Parameters

##### sql

`string`

SQL text to analyze

##### position

Line and column position (1-based)

###### line

`number`

###### column

`number`

#### Returns

[`ScopeInfo`](../interfaces/ScopeInfo.md)

Complete scope information

***

### getColumnsForTable()

> `static` **getColumnsForTable**(`sql`, `cursorPosition`, `tableOrAlias`): [`AvailableColumn`](../interfaces/AvailableColumn.md)[]

Defined in: [packages/core/src/utils/ScopeResolver.ts:135](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/utils/ScopeResolver.ts#L135)

Get available columns for a specific table or alias

#### Parameters

##### sql

`string`

SQL text containing the query

##### cursorPosition

`number`

Cursor position for scope resolution

##### tableOrAlias

`string`

Table name or alias to get columns for

#### Returns

[`AvailableColumn`](../interfaces/AvailableColumn.md)[]

Array of available columns for the specified table
</div>
