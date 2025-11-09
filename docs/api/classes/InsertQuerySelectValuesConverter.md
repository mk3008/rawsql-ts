<div v-pre>
# Class: InsertQuerySelectValuesConverter

Defined in: [packages/core/src/transformers/InsertQuerySelectValuesConverter.ts:13](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/transformers/InsertQuerySelectValuesConverter.ts#L13)

Utility to convert INSERT ... VALUES statements into INSERT ... SELECT UNION ALL form and vice versa.
Enables easier column-by-column comparison across multi-row inserts.

## Constructors

### Constructor

> **new InsertQuerySelectValuesConverter**(): `InsertQuerySelectValuesConverter`

#### Returns

`InsertQuerySelectValuesConverter`

## Methods

### toSelectUnion()

> `static` **toSelectUnion**(`insertQuery`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/transformers/InsertQuerySelectValuesConverter.ts:18](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/transformers/InsertQuerySelectValuesConverter.ts#L18)

Converts an INSERT query that uses VALUES into an equivalent INSERT ... SELECT UNION ALL form.
The original InsertQuery remains untouched; the returned InsertQuery references cloned structures.

#### Parameters

##### insertQuery

[`InsertQuery`](InsertQuery.md)

#### Returns

[`InsertQuery`](InsertQuery.md)

***

### toValues()

> `static` **toValues**(`insertQuery`): [`InsertQuery`](InsertQuery.md)

Defined in: [packages/core/src/transformers/InsertQuerySelectValuesConverter.ts:65](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/transformers/InsertQuerySelectValuesConverter.ts#L65)

Converts an INSERT query that leverages SELECT statements (with optional UNION ALL)
into an equivalent INSERT ... VALUES representation.

#### Parameters

##### insertQuery

[`InsertQuery`](InsertQuery.md)

#### Returns

[`InsertQuery`](InsertQuery.md)
</div>
