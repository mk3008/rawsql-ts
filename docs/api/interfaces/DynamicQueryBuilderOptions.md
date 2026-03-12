<div v-pre>
# Interface: DynamicQueryBuilderOptions

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:175](https://github.com/mk3008/rawsql-ts/blob/777ce1575085b73504d744d64496cb92b0c79583/packages/core/src/transformers/DynamicQueryBuilder.ts#L175)

Builder-level configuration that can be reused across multiple build calls.

## Properties

### tableColumnResolver()?

> `optional` **tableColumnResolver**: (`tableName`) => `string`[]

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:177](https://github.com/mk3008/rawsql-ts/blob/777ce1575085b73504d744d64496cb92b0c79583/packages/core/src/transformers/DynamicQueryBuilder.ts#L177)

Optional resolver for table column names (retains backward compatibility).

#### Parameters

##### tableName

`string`

#### Returns

`string`[]

***

### schemaInfo?

> `optional` **schemaInfo**: [`SchemaInfo`](../type-aliases/SchemaInfo.md)

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:182](https://github.com/mk3008/rawsql-ts/blob/777ce1575085b73504d744d64496cb92b0c79583/packages/core/src/transformers/DynamicQueryBuilder.ts#L182)

Schema metadata that may be applied by default when the optimizer is enabled.
Schema info provided via QueryBuildOptions takes precedence.
</div>
