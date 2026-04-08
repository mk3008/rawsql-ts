<div v-pre>
# Class: UpdateResultSelectConverter

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:48](https://github.com/mk3008/rawsql-ts/blob/c0f0f68e19e11de9d7a4c6a3a888252dc2ccb053/packages/core/src/transformers/UpdateResultSelectConverter.ts#L48)

## Constructors

### Constructor

> **new UpdateResultSelectConverter**(): `UpdateResultSelectConverter`

#### Returns

`UpdateResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`updateQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:54](https://github.com/mk3008/rawsql-ts/blob/c0f0f68e19e11de9d7a4c6a3a888252dc2ccb053/packages/core/src/transformers/UpdateResultSelectConverter.ts#L54)

Converts an UPDATE with RETURNING (or a bare UPDATE) into a SELECT that mirrors its output rows.

#### Parameters

##### updateQuery

[`UpdateQuery`](UpdateQuery.md)

##### options?

[`UpdateResultSelectOptions`](../interfaces/UpdateResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
