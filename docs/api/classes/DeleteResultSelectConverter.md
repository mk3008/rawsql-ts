<div v-pre>
# Class: DeleteResultSelectConverter

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:58](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/transformers/DeleteResultSelectConverter.ts#L58)

## Constructors

### Constructor

> **new DeleteResultSelectConverter**(): `DeleteResultSelectConverter`

#### Returns

`DeleteResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`deleteQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:64](https://github.com/mk3008/rawsql-ts/blob/475003f6d0f577c6e069ca316c6d3fed750ef893/packages/core/src/transformers/DeleteResultSelectConverter.ts#L64)

Converts a DELETE (with optional RETURNING) into a SELECT that mirrors its output rows.

#### Parameters

##### deleteQuery

[`DeleteQuery`](DeleteQuery.md)

##### options?

[`DeleteResultSelectOptions`](../interfaces/DeleteResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
