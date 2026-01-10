<div v-pre>
# Interface: DynamicQueryBuilderOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:149](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/transformers/DynamicQueryBuilder.ts#L149)

Builder-level configuration that can be reused across multiple build calls.

## Properties

### tableColumnResolver()?

> `optional` **tableColumnResolver**: (`tableName`) => `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:151](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/transformers/DynamicQueryBuilder.ts#L151)

Optional resolver for table column names (retains backward compatibility).

#### Parameters

##### tableName

`string`

#### Returns

`string`[]

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:156](https://github.com/mk3008/rawsql-ts/blob/b67effd3c0d482ecdd9c112f2ecdaab94d2121ab/packages/core/src/transformers/DynamicQueryBuilder.ts#L156)

Schema metadata that may be applied by default when the optimizer is enabled.
Schema info provided via QueryBuildOptions takes precedence.
</div>
