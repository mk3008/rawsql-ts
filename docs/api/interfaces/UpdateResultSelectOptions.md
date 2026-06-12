<div v-pre>
# Interface: UpdateResultSelectOptions

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:37](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/UpdateResultSelectConverter.ts#L37)

Options that control how UPDATE-to-SELECT conversion resolves metadata and fixtures.

## Properties

### tableDefinitions?

> `optional` **tableDefinitions**: [`TableDefinitionRegistry`](../type-aliases/TableDefinitionRegistry.md)

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:39](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/UpdateResultSelectConverter.ts#L39)

Optional registry keyed by table name (matching the target table name case).

***

### tableDefinitionResolver()?

> `optional` **tableDefinitionResolver**: (`tableName`) => [`TableDefinitionModel`](TableDefinitionModel.md) \| `undefined`

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:41](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/UpdateResultSelectConverter.ts#L41)

Optional callback that resolves metadata by table name (useful for schemified targets).

#### Parameters

##### tableName

`string`

#### Returns

[`TableDefinitionModel`](TableDefinitionModel.md) \| `undefined`

***

### fixtureTables?

> `optional` **fixtureTables**: [`FixtureTableDefinition`](FixtureTableDefinition.md)[]

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:43](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/UpdateResultSelectConverter.ts#L43)

Optional fixtures that should shadow real tables inside the generated SELECT.

***

### missingFixtureStrategy?

> `optional` **missingFixtureStrategy**: [`MissingFixtureStrategy`](../type-aliases/MissingFixtureStrategy.md)

Defined in: [packages/core/src/transformers/UpdateResultSelectConverter.ts:45](https://github.com/mk3008/rawsql-ts/blob/27a71e4abe1d7d16d81359d10b4cec1a45e5d027/packages/core/src/transformers/UpdateResultSelectConverter.ts#L45)

Strategy for how missing fixtures should be tolerated.
</div>
