<div v-pre>
# Interface: InsertResultSelectOptions

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:17](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/transformers/InsertResultSelectConverter.ts#L17)

Options that drive how the insert-to-select transformation resolves table metadata.

## Properties

### tableDefinitions?

> `optional` **tableDefinitions**: [`TableDefinitionRegistry`](../type-aliases/TableDefinitionRegistry.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:19](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/transformers/InsertResultSelectConverter.ts#L19)

Optional registry keyed by table name (matching the target table name case).

***

### tableDefinitionResolver()?

> `optional` **tableDefinitionResolver**: (`tableName`) => `undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:21](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/transformers/InsertResultSelectConverter.ts#L21)

Optional callback to resolve metadata by full table name (useful for schemified names).

#### Parameters

##### tableName

`string`

#### Returns

`undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

***

### fixtureTables?

> `optional` **fixtureTables**: [`FixtureTableDefinition`](FixtureTableDefinition.md)[]

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:23](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/transformers/InsertResultSelectConverter.ts#L23)

Optional fixtures that should shadow real tables inside the generated SELECT.

***

### missingFixtureStrategy?

> `optional` **missingFixtureStrategy**: [`MissingFixtureStrategy`](../type-aliases/MissingFixtureStrategy.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:25](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/transformers/InsertResultSelectConverter.ts#L25)

Strategy to control behavior when fixtures are missing for real tables.
</div>
