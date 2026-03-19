<div v-pre>
# Interface: DynamicQueryBuilderOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:175](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/DynamicQueryBuilder.ts#L175)

Builder-level configuration that can be reused across multiple build calls.

## Properties

### tableColumnResolver()?

> `optional` **tableColumnResolver**: (`tableName`) => `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:177](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/DynamicQueryBuilder.ts#L177)

Optional resolver for table column names (retains backward compatibility).

#### Parameters

##### tableName

`string`

#### Returns

`string`[]

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:182](https://github.com/mk3008/rawsql-ts/blob/1f5539f5ca8ae5592d6a0246b09ae3cb6fd0e095/packages/core/src/transformers/DynamicQueryBuilder.ts#L182)

Schema metadata that may be applied by default when the optimizer is enabled.
Schema info provided via QueryBuildOptions takes precedence.
</div>
