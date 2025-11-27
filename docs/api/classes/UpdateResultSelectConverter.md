<div v-pre>
# Class: UpdateResultSelectConverter

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:46](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/UpdateResultSelectConverter.ts#L46)

## Constructors

### Constructor

> **new UpdateResultSelectConverter**(): `UpdateResultSelectConverter`

#### Returns

`UpdateResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`updateQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:52](https://github.com/mk3008/rawsql-ts/blob/f6bbef44f8af5ec6c2ca7cae709c0f77fc593271/packages/core/src/transformers/UpdateResultSelectConverter.ts#L52)

Converts an UPDATE with RETURNING (or a bare UPDATE) into a SELECT that mirrors its output rows.

#### Parameters

##### updateQuery

[`UpdateQuery`](UpdateQuery.md)

##### options?

[`UpdateResultSelectOptions`](../interfaces/UpdateResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
