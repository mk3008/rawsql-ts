<div v-pre>
# Class: DeleteResultSelectConverter

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:59](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/DeleteResultSelectConverter.ts#L59)

## Constructors

### Constructor

> **new DeleteResultSelectConverter**(): `DeleteResultSelectConverter`

#### Returns

`DeleteResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`deleteQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:65](https://github.com/mk3008/rawsql-ts/blob/5afba95c60fb400d9054799e9d9c76aefae1898d/packages/core/src/transformers/DeleteResultSelectConverter.ts#L65)

Converts a DELETE (with optional RETURNING) into a SELECT that mirrors its output rows.

#### Parameters

##### deleteQuery

[`DeleteQuery`](DeleteQuery.md)

##### options?

[`DeleteResultSelectOptions`](../interfaces/DeleteResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
