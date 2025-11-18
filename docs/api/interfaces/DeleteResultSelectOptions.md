<div v-pre>
# Interface: DeleteResultSelectOptions

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:27](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/DeleteResultSelectConverter.ts#L27)

Options that control how DELETE-to-SELECT conversion resolves metadata and fixtures.

## Properties

### tableDefinitions?

> `optional` **tableDefinitions**: [`TableDefinitionRegistry`](../type-aliases/TableDefinitionRegistry.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:29](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/DeleteResultSelectConverter.ts#L29)

Optional registry keyed by table name (matching the target table name case).

***

### tableDefinitionResolver()?

> `optional` **tableDefinitionResolver**: (`tableName`) => `undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:31](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/DeleteResultSelectConverter.ts#L31)

Optional callback that resolves metadata by table name (useful for schemified targets).

#### Parameters

##### tableName

`string`

#### Returns

`undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

***

### fixtureTables?

> `optional` **fixtureTables**: [`FixtureTableDefinition`](FixtureTableDefinition.md)[]

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:33](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/DeleteResultSelectConverter.ts#L33)

Optional fixtures that should shadow real tables inside the generated SELECT.

***

### missingFixtureStrategy?

> `optional` **missingFixtureStrategy**: [`MissingFixtureStrategy`](../type-aliases/MissingFixtureStrategy.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:35](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/DeleteResultSelectConverter.ts#L35)

Strategy for how missing fixtures should be tolerated.
</div>
