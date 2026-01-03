<div v-pre>
# Interface: InsertResultSelectOptions

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:43](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/InsertResultSelectConverter.ts#L43)

Options that drive how the insert-to-select transformation resolves table metadata.

## Properties

### tableDefinitions?

> `optional` **tableDefinitions**: [`TableDefinitionRegistry`](../type-aliases/TableDefinitionRegistry.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:45](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/InsertResultSelectConverter.ts#L45)

Optional registry keyed by table name (matching the target table name case).

***

### tableDefinitionResolver()?

> `optional` **tableDefinitionResolver**: (`tableName`) => `undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:47](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/InsertResultSelectConverter.ts#L47)

Optional callback to resolve metadata by full table name (useful for schemified names).

#### Parameters

##### tableName

`string`

#### Returns

`undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

***

### fixtureTables?

> `optional` **fixtureTables**: [`FixtureTableDefinition`](FixtureTableDefinition.md)[]

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:49](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/InsertResultSelectConverter.ts#L49)

Optional fixtures that should shadow real tables inside the generated SELECT.

***

### missingFixtureStrategy?

> `optional` **missingFixtureStrategy**: [`MissingFixtureStrategy`](../type-aliases/MissingFixtureStrategy.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:51](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/InsertResultSelectConverter.ts#L51)

Strategy to control behavior when fixtures are missing for real tables.
</div>
