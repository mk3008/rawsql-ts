<div v-pre>
# Class: UpdateResultSelectConverter

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:47](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/transformers/UpdateResultSelectConverter.ts#L47)

## Constructors

### Constructor

> **new UpdateResultSelectConverter**(): `UpdateResultSelectConverter`

#### Returns

`UpdateResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`updateQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:53](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/transformers/UpdateResultSelectConverter.ts#L53)

Converts an UPDATE with RETURNING (or a bare UPDATE) into a SELECT that mirrors its output rows.

#### Parameters

##### updateQuery

[`UpdateQuery`](UpdateQuery.md)

##### options?

[`UpdateResultSelectOptions`](../interfaces/UpdateResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
