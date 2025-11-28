<div v-pre>
# Class: DeleteResultSelectConverter

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:57](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/DeleteResultSelectConverter.ts#L57)

## Constructors

### Constructor

> **new DeleteResultSelectConverter**(): `DeleteResultSelectConverter`

#### Returns

`DeleteResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`deleteQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:63](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/DeleteResultSelectConverter.ts#L63)

Converts a DELETE (with optional RETURNING) into a SELECT that mirrors its output rows.

#### Parameters

##### deleteQuery

[`DeleteQuery`](DeleteQuery.md)

##### options?

[`DeleteResultSelectOptions`](../interfaces/DeleteResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
