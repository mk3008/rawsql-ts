<div v-pre>
# Interface: GenericFixtureColumn

Defined in: [packages/core/src/types/GenericFixture.ts:2](https://github.com/mk3008/rawsql-ts/blob/93e13cd77a71b8ce48bfa99c612638e88e31251f/packages/core/src/types/GenericFixture.ts#L2)

Column definition for generic, driver-agnostic fixtures.

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/types/GenericFixture.ts:3](https://github.com/mk3008/rawsql-ts/blob/93e13cd77a71b8ce48bfa99c612638e88e31251f/packages/core/src/types/GenericFixture.ts#L3)

***

### typeName?

> `optional` **typeName**: `string`

Defined in: [packages/core/src/types/GenericFixture.ts:5](https://github.com/mk3008/rawsql-ts/blob/93e13cd77a71b8ce48bfa99c612638e88e31251f/packages/core/src/types/GenericFixture.ts#L5)

Optional database-specific type name (kept as a raw string).

***

### required?

> `optional` **required**: `boolean`

Defined in: [packages/core/src/types/GenericFixture.ts:7](https://github.com/mk3008/rawsql-ts/blob/93e13cd77a71b8ce48bfa99c612638e88e31251f/packages/core/src/types/GenericFixture.ts#L7)

Whether the column should be treated as required when simulating writes.

***

### defaultValue?

> `optional` **defaultValue**: `null` \| `string`

Defined in: [packages/core/src/types/GenericFixture.ts:9](https://github.com/mk3008/rawsql-ts/blob/93e13cd77a71b8ce48bfa99c612638e88e31251f/packages/core/src/types/GenericFixture.ts#L9)

Default expression/value as string when available.
</div>
