<div v-pre>
# Class: UpdateResultSelectConverter

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:44](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/UpdateResultSelectConverter.ts#L44)

## Constructors

### Constructor

> **new UpdateResultSelectConverter**(): `UpdateResultSelectConverter`

#### Returns

`UpdateResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`updateQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:50](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/UpdateResultSelectConverter.ts#L50)

Converts an UPDATE with RETURNING (or a bare UPDATE) into a SELECT that mirrors its output rows.

#### Parameters

##### updateQuery

[`UpdateQuery`](UpdateQuery.md)

##### options?

[`UpdateResultSelectOptions`](../interfaces/UpdateResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
