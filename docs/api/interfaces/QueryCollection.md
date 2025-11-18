<div v-pre>
# Interface: QueryCollection

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:27](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/utils/MultiQuerySplitter.ts#L27)

Collection of queries from multi-query text

## Properties

### queries

> **queries**: [`QueryInfo`](QueryInfo.md)[]

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:29](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/utils/MultiQuerySplitter.ts#L29)

All queries found in the text

***

### originalText

> **originalText**: `string`

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:31](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/utils/MultiQuerySplitter.ts#L31)

Original text that was split

## Methods

### getActive()

> **getActive**(`cursorPosition`): `undefined` \| [`QueryInfo`](QueryInfo.md)

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:37](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/utils/MultiQuerySplitter.ts#L37)

Get the query that contains the specified cursor position

#### Parameters

##### cursorPosition

Cursor position (character offset or line/column)

`number` | [`LineColumn`](LineColumn.md)

#### Returns

`undefined` \| [`QueryInfo`](QueryInfo.md)

***

### getQuery()

> **getQuery**(`index`): `undefined` \| [`QueryInfo`](QueryInfo.md)

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:43](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/utils/MultiQuerySplitter.ts#L43)

Get the query at the specified index

#### Parameters

##### index

`number`

Query index (0-based)

#### Returns

`undefined` \| [`QueryInfo`](QueryInfo.md)

***

### getNonEmpty()

> **getNonEmpty**(): [`QueryInfo`](QueryInfo.md)[]

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:48](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/utils/MultiQuerySplitter.ts#L48)

Get all non-empty queries

#### Returns

[`QueryInfo`](QueryInfo.md)[]
</div>
