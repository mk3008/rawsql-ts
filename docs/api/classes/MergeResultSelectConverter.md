<div v-pre>
# Class: MergeResultSelectConverter

Defined in: [packages/core/src/transformers/MergeResultSelectConverter.ts:15](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/MergeResultSelectConverter.ts#L15)

## Constructors

### Constructor

> **new MergeResultSelectConverter**(): `MergeResultSelectConverter`

#### Returns

`MergeResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`mergeQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/MergeResultSelectConverter.ts:21](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/MergeResultSelectConverter.ts#L21)

Converts a MERGE query into a SELECT that counts or models the rows affected by each action.

#### Parameters

##### mergeQuery

[`MergeQuery`](MergeQuery.md)

##### options?

[`MergeResultSelectOptions`](../interfaces/MergeResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
