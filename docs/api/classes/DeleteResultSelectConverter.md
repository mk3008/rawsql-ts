<div v-pre>
# Class: DeleteResultSelectConverter

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:59](https://github.com/mk3008/rawsql-ts/blob/d05c323631d1c06a7d31e973b82bbb5e6eed5b3a/packages/core/src/transformers/DeleteResultSelectConverter.ts#L59)

## Constructors

### Constructor

> **new DeleteResultSelectConverter**(): `DeleteResultSelectConverter`

#### Returns

`DeleteResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`deleteQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:65](https://github.com/mk3008/rawsql-ts/blob/d05c323631d1c06a7d31e973b82bbb5e6eed5b3a/packages/core/src/transformers/DeleteResultSelectConverter.ts#L65)

Converts a DELETE (with optional RETURNING) into a SELECT that mirrors its output rows.

#### Parameters

##### deleteQuery

[`DeleteQuery`](DeleteQuery.md)

##### options?

[`DeleteResultSelectOptions`](../interfaces/DeleteResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
