<div v-pre>
# Class: SqlIdentifierRenamer

Defined in: [packages/core/src/transformers/SqlIdentifierRenamer.ts:39](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/SqlIdentifierRenamer.ts#L39)

Handles safe renaming of SQL identifiers within plain SQL strings.

## Example

```typescript
const renamer = new SqlIdentifierRenamer();
const sql = 'SELECT u.id FROM users u';
const result = renamer.renameIdentifier(sql, 'u', 'users_alias');
```
Related tests: packages/core/tests/transformers/SqlIdentifierRenamer.test.ts

## Constructors

### Constructor

> **new SqlIdentifierRenamer**(): `SqlIdentifierRenamer`

#### Returns

`SqlIdentifierRenamer`

## Methods

### renameIdentifiers()

> **renameIdentifiers**(`sql`, `renames`): `string`

Defined in: [packages/core/src/transformers/SqlIdentifierRenamer.ts:47](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/SqlIdentifierRenamer.ts#L47)

Safely renames identifiers in SQL string while preserving context

#### Parameters

##### sql

`string`

SQL string to modify

##### renames

`Map`&lt;`string`, `string`\&gt;

Map of original identifiers to new identifiers

#### Returns

`string`

Modified SQL string with renamed identifiers

***

### renameIdentifier()

> **renameIdentifier**(`sql`, `oldIdentifier`, `newIdentifier`): `string`

Defined in: [packages/core/src/transformers/SqlIdentifierRenamer.ts:69](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/SqlIdentifierRenamer.ts#L69)

Renames a single identifier in SQL string

#### Parameters

##### sql

`string`

SQL string to modify

##### oldIdentifier

`string`

Original identifier to replace

##### newIdentifier

`string`

New identifier to replace with

#### Returns

`string`

Modified SQL string

***

### renameIdentifierInScope()

> **renameIdentifierInScope**(`sql`, `oldIdentifier`, `newIdentifier`, `scopeRange?`): `string`

Defined in: [packages/core/src/transformers/SqlIdentifierRenamer.ts:81](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/SqlIdentifierRenamer.ts#L81)

Renames a single identifier within a specified scope range

#### Parameters

##### sql

`string`

SQL string to modify

##### oldIdentifier

`string`

Original identifier to replace

##### newIdentifier

`string`

New identifier to replace with

##### scopeRange?

[`ScopeRange`](../interfaces/ScopeRange.md)

Optional scope range to limit replacement

#### Returns

`string`

Modified SQL string

***

### checkRenameability()

> **checkRenameability**(`sql`, `position`): [`Renameability`](../interfaces/Renameability.md)

Defined in: [packages/core/src/transformers/SqlIdentifierRenamer.ts:105](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/SqlIdentifierRenamer.ts#L105)

Checks if an identifier at the given position can be renamed

#### Parameters

##### sql

`string`

SQL string

##### position

[`Position`](../interfaces/Position.md)

Position in the SQL text

#### Returns

[`Renameability`](../interfaces/Renameability.md)

Renameability result

***

### renameAtPosition()

> **renameAtPosition**(`sql`, `position`, `newName`): `string`

Defined in: [packages/core/src/transformers/SqlIdentifierRenamer.ts:148](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/SqlIdentifierRenamer.ts#L148)

Renames identifier at the specified position

#### Parameters

##### sql

`string`

SQL string

##### position

[`Position`](../interfaces/Position.md)

Position in the SQL text

##### newName

`string`

New identifier name

#### Returns

`string`

Modified SQL string

***

### validateRename()

> **validateRename**(`originalSql`, `modifiedSql`, `oldIdentifier`, `newIdentifier`): `boolean`

Defined in: [packages/core/src/transformers/SqlIdentifierRenamer.ts:382](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/SqlIdentifierRenamer.ts#L382)

Validates that the rename operation was successful

#### Parameters

##### originalSql

`string`

Original SQL string

##### modifiedSql

`string`

Modified SQL string after rename

##### oldIdentifier

`string`

Old identifier that was replaced

##### newIdentifier

`string`

New identifier that was added

#### Returns

`boolean`

True if rename appears successful
</div>
