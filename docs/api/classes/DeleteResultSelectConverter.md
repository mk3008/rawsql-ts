<div v-pre>
# Class: DeleteResultSelectConverter

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:56](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/DeleteResultSelectConverter.ts#L56)

## Constructors

### Constructor

> **new DeleteResultSelectConverter**(): `DeleteResultSelectConverter`

#### Returns

`DeleteResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`deleteQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:62](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/DeleteResultSelectConverter.ts#L62)

Converts a DELETE (with optional RETURNING) into a SELECT that mirrors its output rows.

#### Parameters

##### deleteQuery

[`DeleteQuery`](DeleteQuery.md)

##### options?

[`DeleteResultSelectOptions`](../interfaces/DeleteResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
