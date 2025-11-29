<div v-pre>
# Class: FixtureCteBuilder

Defined in: [packages/core/src/transformers/FixtureCteBuilder.ts:21](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/FixtureCteBuilder.ts#L21)

## Constructors

### Constructor

> **new FixtureCteBuilder**(): `FixtureCteBuilder`

#### Returns

`FixtureCteBuilder`

## Methods

### fromSQL()

> `static` **fromSQL**(`sql`): [`FixtureTableDefinition`](../interfaces/FixtureTableDefinition.md)[]

Defined in: [packages/core/src/transformers/FixtureCteBuilder.ts:28](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/FixtureCteBuilder.ts#L28)

Creates fixture definitions from a SQL string containing DDL (CREATE TABLE) and INSERT statements.

#### Parameters

##### sql

`string`

The SQL string containing DDL and INSERTs.

#### Returns

[`FixtureTableDefinition`](../interfaces/FixtureTableDefinition.md)[]

An array of FixtureTableDefinition objects.

***

### fromJSON()

> `static` **fromJSON**(`jsonDefinitions`): [`FixtureTableDefinition`](../interfaces/FixtureTableDefinition.md)[]

Defined in: [packages/core/src/transformers/FixtureCteBuilder.ts:57](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/FixtureCteBuilder.ts#L57)

Converts JSON fixture definitions to FixtureTableDefinition format.
Accepts an object where keys are table names and values contain columns and rows.

#### Parameters

##### jsonDefinitions

`Record`&lt;`string`, \{ `columns`: `object`[]; `rows?`: `Record`\<`string`, `any`\&gt;[]; \}\>

Object with table definitions

#### Returns

[`FixtureTableDefinition`](../interfaces/FixtureTableDefinition.md)[]

Array of FixtureTableDefinition

#### Example

```typescript
const json = {
  users: {
    columns: [
      { name: 'id', type: 'integer' },
      { name: 'name', type: 'text' }
    ],
    rows: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]
  }
};
const fixtures = FixtureCteBuilder.fromJSON(json);
```

***

### buildFixtures()

> `static` **buildFixtures**(`fixtures`): [`CommonTable`](CommonTable.md)[]

Defined in: [packages/core/src/transformers/FixtureCteBuilder.ts:94](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/transformers/FixtureCteBuilder.ts#L94)

Builds CommonTable representations for the provided fixtures.

#### Parameters

##### fixtures

[`FixtureTableDefinition`](../interfaces/FixtureTableDefinition.md)[]

#### Returns

[`CommonTable`](CommonTable.md)[]
</div>
