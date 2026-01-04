<div v-pre>
# Class: SmartRenamer

Defined in: [packages/core/src/transformers/SmartRenamer.ts:47](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SmartRenamer.ts#L47)

Smart renamer that detects whether a cursor points to a CTE or table alias and routes to the correct renamer.

- CTE targets use CTERenamer so dependency graphs stay consistent.
- Table aliases use AliasRenamer with scope detection.
- Optional formatting preservation uses SqlIdentifierRenamer.

## Example

```typescript
const renamer = new SmartRenamer();
const sql = `WITH user_data AS (SELECT * FROM users) SELECT * FROM user_data`;

const result = renamer.rename(sql, { line: 1, column: 8 }, 'customer_data');

if (result.success) {
  console.log(result.newSql);
}
```
Related tests: packages/core/tests/transformers/SmartRenamer.demo.test.ts

## Constructors

### Constructor

> **new SmartRenamer**(): `SmartRenamer`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:52](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SmartRenamer.ts#L52)

#### Returns

`SmartRenamer`

## Methods

### isRenameable()

> **isRenameable**(`sql`, `position`): `object`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:67](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SmartRenamer.ts#L67)

Check if the token at the given position is renameable (CTE name or table alias).
This is a lightweight check for GUI applications to determine if a rename context menu
should be shown when right-clicking.

#### Parameters

##### sql

`string`

The complete SQL string

##### position

[`LineColumn`](../interfaces/LineColumn.md)

Line and column position where user clicked (1-based)

#### Returns

`object`

Object indicating if renameable and what type of renamer would be used

##### renameable

> **renameable**: `boolean`

##### renamerType

> **renamerType**: `"none"` \| `"cte"` \| `"alias"`

##### tokenName?

> `optional` **tokenName**: `string`

##### reason?

> `optional` **reason**: `string`

***

### rename()

> **rename**(`sql`, `position`, `newName`, `options?`): [`SmartRenameResult`](../interfaces/SmartRenameResult.md)

Defined in: [packages/core/src/transformers/SmartRenamer.ts:138](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SmartRenamer.ts#L138)

Automatically detect and rename CTE names or table aliases based on cursor position.

#### Parameters

##### sql

`string`

The complete SQL string

##### position

[`LineColumn`](../interfaces/LineColumn.md)

Line and column position where user clicked (1-based)

##### newName

`string`

The new name to assign

##### options?

Optional configuration { preserveFormatting?: boolean }

###### preserveFormatting?

`boolean`

#### Returns

[`SmartRenameResult`](../interfaces/SmartRenameResult.md)

Result object with success status and details

***

### batchRename()

> **batchRename**(`sql`, `renames`, `options?`): [`SmartRenameResult`](../interfaces/SmartRenameResult.md)

Defined in: [packages/core/src/transformers/SmartRenamer.ts:437](https://github.com/mk3008/rawsql-ts/blob/7ed76bb57a262268db148cceb82b6cde3d707d8a/packages/core/src/transformers/SmartRenamer.ts#L437)

Batch rename multiple identifiers with optional formatting preservation.

#### Parameters

##### sql

`string`

The complete SQL string

##### renames

`Record`&lt;`string`, `string`\&gt;

Map of old names to new names

##### options?

Optional configuration { preserveFormatting?: boolean }

###### preserveFormatting?

`boolean`

#### Returns

[`SmartRenameResult`](../interfaces/SmartRenameResult.md)

Result with success status and details
</div>
