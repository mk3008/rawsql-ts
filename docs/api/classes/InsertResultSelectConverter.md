<div v-pre>
# Class: InsertResultSelectConverter

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:65](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/transformers/InsertResultSelectConverter.ts#L65)

## Constructors

### Constructor

> **new InsertResultSelectConverter**(): `InsertResultSelectConverter`

#### Returns

`InsertResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`insertQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:74](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/transformers/InsertResultSelectConverter.ts#L74)

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
