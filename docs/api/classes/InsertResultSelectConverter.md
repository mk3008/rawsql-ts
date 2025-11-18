<div v-pre>
# Class: InsertResultSelectConverter

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:40](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/InsertResultSelectConverter.ts#L40)

## Constructors

### Constructor

> **new InsertResultSelectConverter**(): `InsertResultSelectConverter`

#### Returns

`InsertResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`insertQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:49](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/InsertResultSelectConverter.ts#L49)

Converts an INSERT ... SELECT/VALUES query into a SELECT that mirrors its RETURNING output
(or a count(*) when RETURNING is absent).

#### Parameters

##### insertQuery

[`InsertQuery`](InsertQuery.md)

##### options?

[`InsertResultSelectOptions`](../interfaces/InsertResultSelectOptions.md)

#### Returns

[`SimpleSelectQuery`](SimpleSelectQuery.md)
</div>
