<div v-pre>
# Class: AliasRenamer

Defined in: [packages/core/src/transformers/AliasRenamer.ts:112](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/AliasRenamer.ts#L112)

A utility class for renaming table and column aliases in SQL queries.

This class provides functionality to rename aliases within specific scopes
(CTE, subquery, or main query) based on cursor position from GUI editors.
It automatically detects the appropriate scope and updates all references
to the alias within that scope boundary.

## Example

```typescript
import { AliasRenamer } from 'rawsql-ts';

const sql = `
  SELECT u.name, o.date
  FROM users u
  JOIN orders o ON u.id = o.user_id
`;

const renamer = new AliasRenamer();

// Rename 'u' to 'user_alias' by selecting it at line 2, column 10
const result = renamer.renameAlias(sql, { line: 2, column: 10 }, 'user_alias');

if (result.success) {
  console.log(result.newSql);
  // SELECT user_alias.name, o.date
  // FROM users user_alias
  // JOIN orders o ON user_alias.id = o.user_id
}
```

Related tests: packages/core/tests/transformers/AliasRenamer.functional.test.ts

## Since

0.12.0

## Constructors

### Constructor

> **new AliasRenamer**(): `AliasRenamer`

Defined in: [packages/core/src/transformers/AliasRenamer.ts:120](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/AliasRenamer.ts#L120)

Creates a new instance of AliasRenamer.

#### Returns

`AliasRenamer`

## Methods

### renameAlias()

> **renameAlias**(`sql`, `position`, `newName`, `options`): [`RenameResult`](../interfaces/RenameResult.md)

Defined in: [packages/core/src/transformers/AliasRenamer.ts:151](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/AliasRenamer.ts#L151)

Renames an alias based on the cursor position in GUI editor.

This method detects the alias at the specified line and column position,
determines its scope (CTE, subquery, or main query), and renames all
references to that alias within the scope boundaries.

#### Parameters

##### sql

`string`

The SQL string containing the alias to rename

##### position

[`LineColumn`](../interfaces/LineColumn.md)

Line and column position (1-based) from GUI editor

##### newName

`string`

The new name for the alias

##### options

[`RenameOptions`](../interfaces/RenameOptions.md) = `{}`

Optional configuration for the rename operation

#### Returns

[`RenameResult`](../interfaces/RenameResult.md)

Result containing success status, modified SQL, and change details

#### Example

```typescript
const sql = "SELECT u.name FROM users u WHERE u.active = true";
const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_table');

if (result.success) {
  console.log(result.newSql);
  // "SELECT user_table.name FROM users user_table WHERE user_table.active = true"
}
```

#### Throws

When the SQL cannot be parsed or position is invalid
</div>
