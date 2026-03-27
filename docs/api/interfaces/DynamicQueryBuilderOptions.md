<div v-pre>
# Interface: DynamicQueryBuilderOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:173](https://github.com/mk3008/rawsql-ts/blob/c91e9fb79026c72cdb2e714bfb7a8f3421f758ab/packages/core/src/transformers/DynamicQueryBuilder.ts#L173)

Builder-level configuration that can be reused across multiple build calls.

## Properties

### tableColumnResolver()?

> `optional` **tableColumnResolver**: (`tableName`) => `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:175](https://github.com/mk3008/rawsql-ts/blob/c91e9fb79026c72cdb2e714bfb7a8f3421f758ab/packages/core/src/transformers/DynamicQueryBuilder.ts#L175)

Optional resolver for table column names (retains backward compatibility).

#### Parameters

##### tableName

`string`

#### Returns

`string`[]

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:180](https://github.com/mk3008/rawsql-ts/blob/c91e9fb79026c72cdb2e714bfb7a8f3421f758ab/packages/core/src/transformers/DynamicQueryBuilder.ts#L180)

Schema metadata that may be applied by default when the optimizer is enabled.
Schema info provided via QueryBuildOptions takes precedence.
</div>
