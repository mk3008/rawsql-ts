<div v-pre>
# Interface: GenericFixture

Defined in: [packages/core/src/types/GenericFixture.ts:13](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/types/GenericFixture.ts#L13)

Generic fixture definition that can be adapted by driver layers.

## Properties

### tableName

> **tableName**: `string`

Defined in: [packages/core/src/types/GenericFixture.ts:14](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/types/GenericFixture.ts#L14)

***

### columns

> **columns**: [`GenericFixtureColumn`](GenericFixtureColumn.md)[]

Defined in: [packages/core/src/types/GenericFixture.ts:15](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/types/GenericFixture.ts#L15)

***

### rows?

> `optional` **rows**: `Record`&lt;`string`, `unknown`\&gt;[]

Defined in: [packages/core/src/types/GenericFixture.ts:17](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/types/GenericFixture.ts#L17)

Optional fixture rows; values are kept untyped to allow driver-specific coercion.
</div>
