<div v-pre>
# Interface: SmartRenameResult

Defined in: [packages/core/src/transformers/SmartRenamer.ts:14](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L14)

Result of smart rename operation

## Properties

### success

> **success**: `boolean`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:15](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L15)

***

### originalSql

> **originalSql**: `string`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:16](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L16)

***

### newSql?

> `optional` **newSql**: `string`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:17](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L17)

***

### renamerType

> **renamerType**: `"unknown"` \| `"cte"` \| `"alias"`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:18](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L18)

***

### originalName

> **originalName**: `string`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:19](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L19)

***

### newName

> **newName**: `string`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:20](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L20)

***

### error?

> `optional` **error**: `string`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:21](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L21)

***

### formattingPreserved?

> `optional` **formattingPreserved**: `boolean`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:23](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L23)

***

### formattingMethod?

> `optional` **formattingMethod**: `"sql-identifier-renamer"` \| `"smart-renamer-only"`

Defined in: [packages/core/src/transformers/SmartRenamer.ts:24](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SmartRenamer.ts#L24)
</div>
