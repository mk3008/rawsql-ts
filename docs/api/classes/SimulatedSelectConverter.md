<div v-pre>
# Class: SimulatedSelectConverter

Defined in: [packages/core/src/transformers/SimulatedSelectConverter.ts:23](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/SimulatedSelectConverter.ts#L23)

## Constructors

### Constructor

> **new SimulatedSelectConverter**(): `SimulatedSelectConverter`

#### Returns

`SimulatedSelectConverter`

## Methods

### convert()

> `static` **convert**(`ast`, `options?`): `null` \| [`SqlComponent`](SqlComponent.md)

Defined in: [packages/core/src/transformers/SimulatedSelectConverter.ts:37](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/transformers/SimulatedSelectConverter.ts#L37)

Converts a SQL statement into a simulated SELECT statement for previewing results.

Rules:
1. INSERT/UPDATE/DELETE/MERGE: Converted to SELECT statement showing affected rows.
2. SELECT: Preserved as is (with fixtures injected).
3. CREATE TEMPORARY TABLE ... AS SELECT: Preserved as is (with fixtures injected into inner SELECT).
4. Other DDL (CREATE TABLE, DROP, ALTER, etc.): Ignored (returns null).

#### Parameters

##### ast

[`SqlComponent`](SqlComponent.md)

The SQL component to convert

##### options?

[`SimulatedSelectOptions`](../type-aliases/SimulatedSelectOptions.md)

Options for conversion (fixtures, table definitions, etc.)

#### Returns

`null` \| [`SqlComponent`](SqlComponent.md)

The converted SqlComponent or null if the statement should be ignored.
</div>
