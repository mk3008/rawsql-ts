<div v-pre>
# Interface: GenericFixture

Defined in: [packages/core/src/types/GenericFixture.ts:13](https://github.com/mk3008/rawsql-ts/blob/d05c323631d1c06a7d31e973b82bbb5e6eed5b3a/packages/core/src/types/GenericFixture.ts#L13)

Generic fixture definition that can be adapted by driver layers.

## Properties

### tableName

> **tableName**: `string`

Defined in: [packages/core/src/types/GenericFixture.ts:14](https://github.com/mk3008/rawsql-ts/blob/d05c323631d1c06a7d31e973b82bbb5e6eed5b3a/packages/core/src/types/GenericFixture.ts#L14)

***

### columns

> **columns**: [`GenericFixtureColumn`](GenericFixtureColumn.md)[]

Defined in: [packages/core/src/types/GenericFixture.ts:15](https://github.com/mk3008/rawsql-ts/blob/d05c323631d1c06a7d31e973b82bbb5e6eed5b3a/packages/core/src/types/GenericFixture.ts#L15)

***

### rows?

> `optional` **rows**: `Record`&lt;`string`, `unknown`\&gt;[]

Defined in: [packages/core/src/types/GenericFixture.ts:17](https://github.com/mk3008/rawsql-ts/blob/d05c323631d1c06a7d31e973b82bbb5e6eed5b3a/packages/core/src/types/GenericFixture.ts#L17)

Optional fixture rows; values are kept untyped to allow driver-specific coercion.
</div>
