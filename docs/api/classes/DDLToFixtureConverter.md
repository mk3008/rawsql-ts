<div v-pre>
# Class: DDLToFixtureConverter

Defined in: [packages/core/src/transformers/DDLToFixtureConverter.ts:10](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/transformers/DDLToFixtureConverter.ts#L10)

## Constructors

### Constructor

> **new DDLToFixtureConverter**(): `DDLToFixtureConverter`

#### Returns

`DDLToFixtureConverter`

## Methods

### convert()

> `static` **convert**(`ddlSql`): `Record`&lt;`string`, `any`\&gt;

Defined in: [packages/core/src/transformers/DDLToFixtureConverter.ts:25](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/transformers/DDLToFixtureConverter.ts#L25)

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
