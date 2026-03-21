<div v-pre>
# Class: SqlSchemaValidator

Defined in: [packages/core/src/utils/SqlSchemaValidator.ts:20](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/SqlSchemaValidator.ts#L20)

Validates SQL query structures against known tables and columns.

## Example

```typescript
const tables = [
  { name: 'users', columns: ['id', 'email'] }
];

SqlSchemaValidator.validate('SELECT id FROM users', tables);
```
Related tests: packages/core/tests/utils/SqlSchemaValidator.validate.test.ts

## Constructors

### Constructor

> **new SqlSchemaValidator**(): `SqlSchemaValidator`

#### Returns

`SqlSchemaValidator`

## Methods

### validate()

> `static` **validate**(`sql`, `tableResolver`): `void`

Defined in: [packages/core/src/utils/SqlSchemaValidator.ts:27](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/SqlSchemaValidator.ts#L27)

Validates a SQL query structure against a provided TableColumnResolver or TableSchema array.

#### Parameters

##### sql

The SQL query structure to validate, can be a SQL string or a SqlComponent.

`string` | [`SqlComponent`](SqlComponent.md)

##### tableResolver

The TableColumnResolver or TableSchema array to validate against.

[`TableColumnResolver`](../type-aliases/TableColumnResolver.md) | [`TableSchema`](TableSchema.md)[]

#### Returns

`void`

#### Throws

Error if the query contains undefined tables or columns.
</div>
