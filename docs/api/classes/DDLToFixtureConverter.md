<div v-pre>
# Class: DDLToFixtureConverter

Defined in: [packages/core/src/transformers/DDLToFixtureConverter.ts:10](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/DDLToFixtureConverter.ts#L10)

## Constructors

### Constructor

> **new DDLToFixtureConverter**(): `DDLToFixtureConverter`

#### Returns

`DDLToFixtureConverter`

## Methods

### convert()

> `static` **convert**(`ddlSql`): `Record`&lt;`string`, `any`\&gt;

Defined in: [packages/core/src/transformers/DDLToFixtureConverter.ts:25](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/DDLToFixtureConverter.ts#L25)

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
