<div v-pre>
# Interface: InsertResultSelectOptions

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:44](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/transformers/InsertResultSelectConverter.ts#L44)

Options that drive how the insert-to-select transformation resolves table metadata.

## Properties

### tableDefinitions?

> `optional` **tableDefinitions**: [`TableDefinitionRegistry`](../type-aliases/TableDefinitionRegistry.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:46](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/transformers/InsertResultSelectConverter.ts#L46)

Optional registry keyed by table name (matching the target table name case).

***

### tableDefinitionResolver()?

> `optional` **tableDefinitionResolver**: (`tableName`) => `undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:48](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/transformers/InsertResultSelectConverter.ts#L48)

Optional callback to resolve metadata by full table name (useful for schemified names).

#### Parameters

##### tableName

`string`

#### Returns

`undefined` \| [`TableDefinitionModel`](TableDefinitionModel.md)

***

### fixtureTables?

> `optional` **fixtureTables**: [`FixtureTableDefinition`](FixtureTableDefinition.md)[]

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:50](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/transformers/InsertResultSelectConverter.ts#L50)

Optional fixtures that should shadow real tables inside the generated SELECT.

***

### missingFixtureStrategy?

> `optional` **missingFixtureStrategy**: [`MissingFixtureStrategy`](../type-aliases/MissingFixtureStrategy.md)

Defined in: [packages/core/src/transformers/InsertResultSelectConverter.ts:52](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/transformers/InsertResultSelectConverter.ts#L52)

Strategy to control behavior when fixtures are missing for real tables.
</div>
