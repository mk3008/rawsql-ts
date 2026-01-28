<div v-pre>
# Interface: DynamicQueryBuilderOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:160](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L160)

Builder-level configuration that can be reused across multiple build calls.

## Properties

### tableColumnResolver()?

> `optional` **tableColumnResolver**: (`tableName`) => `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:162](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L162)

Optional resolver for table column names (retains backward compatibility).

#### Parameters

##### tableName

`string`

#### Returns

`string`[]

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:167](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/DynamicQueryBuilder.ts#L167)

Schema metadata that may be applied by default when the optimizer is enabled.
Schema info provided via QueryBuildOptions takes precedence.
</div>
