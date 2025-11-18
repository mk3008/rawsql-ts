<div v-pre>
# Interface: UpdateResultSelectOptions

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:33](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/UpdateResultSelectConverter.ts#L33)

Options that control how UPDATE-to-SELECT conversion resolves metadata and fixtures.

## Properties

### tableDefinitions?

> `optional` **tableDefinitions**: [`TableDefinitionRegistry`](../type-aliases/TableDefinitionRegistry.md)

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:35](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/UpdateResultSelectConverter.ts#L35)

Optional registry keyed by table name (matching the target table name case).

***

### tableDefinitionResolver()?

> `optional` **tableDefinitionResolver**: (`tableName`) => `undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:37](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/UpdateResultSelectConverter.ts#L37)

Optional callback that resolves metadata by table name (useful for schemified targets).

#### Parameters

##### tableName

`string`

#### Returns

`undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

***

### fixtureTables?

> `optional` **fixtureTables**: [`FixtureTableDefinition`](FixtureTableDefinition.md)[]

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:39](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/UpdateResultSelectConverter.ts#L39)

Optional fixtures that should shadow real tables inside the generated SELECT.

***

### missingFixtureStrategy?

> `optional` **missingFixtureStrategy**: [`MissingFixtureStrategy`](../type-aliases/MissingFixtureStrategy.md)

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:41](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/transformers/UpdateResultSelectConverter.ts#L41)

Strategy for how missing fixtures should be tolerated.
</div>
