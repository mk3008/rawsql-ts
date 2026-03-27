<div v-pre>
# Class: DDLToFixtureConverter

Defined in: [packages/core/src/transformers/DDLToFixtureConverter.ts:12](https://github.com/mk3008/rawsql-ts/blob/c91e9fb79026c72cdb2e714bfb7a8f3421f758ab/packages/core/src/transformers/DDLToFixtureConverter.ts#L12)

## Constructors

### Constructor

> **new DDLToFixtureConverter**(): `DDLToFixtureConverter`

#### Returns

`DDLToFixtureConverter`

## Methods

### convert()

> `static` **convert**(`ddlSql`): `Record`&lt;`string`, `any`\&gt;

Defined in: [packages/core/src/transformers/DDLToFixtureConverter.ts:20](https://github.com/mk3008/rawsql-ts/blob/c91e9fb79026c72cdb2e714bfb7a8f3421f758ab/packages/core/src/transformers/DDLToFixtureConverter.ts#L20)

Converts DDL statements (CREATE TABLE) in the provided SQL text to a Fixture JSON object.
Ignores non-DDL statements and parse errors.

#### Parameters

##### ddlSql

`string`

The SQL text containing CREATE TABLE statements.

#### Returns

`Record`&lt;`string`, `any`\&gt;

A Record representing the Fixture JSON.
</div>
