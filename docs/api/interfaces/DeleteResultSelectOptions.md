<div v-pre>
# Interface: DeleteResultSelectOptions

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:28](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/DeleteResultSelectConverter.ts#L28)

Options that control how DELETE-to-SELECT conversion resolves metadata and fixtures.

## Properties

### tableDefinitions?

> `optional` **tableDefinitions**: [`TableDefinitionRegistry`](../type-aliases/TableDefinitionRegistry.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:30](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/DeleteResultSelectConverter.ts#L30)

Optional registry keyed by table name (matching the target table name case).

***

### tableDefinitionResolver()?

> `optional` **tableDefinitionResolver**: (`tableName`) => `undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:32](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/DeleteResultSelectConverter.ts#L32)

Optional callback that resolves metadata by table name (useful for schemified targets).

#### Parameters

##### tableName

`string`

#### Returns

`undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

***

### fixtureTables?

> `optional` **fixtureTables**: [`FixtureTableDefinition`](FixtureTableDefinition.md)[]

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:34](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/DeleteResultSelectConverter.ts#L34)

Optional fixtures that should shadow real tables inside the generated SELECT.

***

### missingFixtureStrategy?

> `optional` **missingFixtureStrategy**: [`MissingFixtureStrategy`](../type-aliases/MissingFixtureStrategy.md)

Defined in: [packages/core/src/transformers/DeleteResultSelectConverter.ts:36](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/DeleteResultSelectConverter.ts#L36)

Strategy for how missing fixtures should be tolerated.
</div>
