<div v-pre>
# Class: MergeResultSelectConverter

Defined in: [packages/core/src/transformers/MergeResultSelectConverter.ts:16](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/MergeResultSelectConverter.ts#L16)

## Constructors

### Constructor

> **new MergeResultSelectConverter**(): `MergeResultSelectConverter`

#### Returns

`MergeResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`mergeQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/MergeResultSelectConverter.ts:22](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/MergeResultSelectConverter.ts#L22)

Converts a MERGE query into a SELECT that counts or models the rows affected by each action.

#### Parameters

##### mergeQuery

[`MergeQuery`](MergeQuery.md)

##### options?

[`MergeResultSelectOptions`](../interfaces/MergeResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
