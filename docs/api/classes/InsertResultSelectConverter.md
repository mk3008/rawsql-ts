<div v-pre>
# Class: InsertResultSelectConverter

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:67](https://github.com/mk3008/rawsql-ts/blob/9a43510a16e39bf2c2a913e6d2e5ec12b36391e6/packages/core/src/transformers/InsertResultSelectConverter.ts#L67)

## Constructors

### Constructor

> **new InsertResultSelectConverter**(): `InsertResultSelectConverter`

#### Returns

`InsertResultSelectConverter`

## Methods

### toSelectQuery()

> `static` **toSelectQuery**(`insertQuery`, `options?`): [`SimpleSelectQuery`](SimpleSelectQuery.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:76](https://github.com/mk3008/rawsql-ts/blob/9a43510a16e39bf2c2a913e6d2e5ec12b36391e6/packages/core/src/transformers/InsertResultSelectConverter.ts#L76)

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
