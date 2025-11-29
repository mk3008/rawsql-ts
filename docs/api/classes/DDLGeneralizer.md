<div v-pre>
# Class: DDLGeneralizer

Defined in: [packages/core/src/transformers/DDLGeneralizer.ts:6](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/transformers/DDLGeneralizer.ts#L6)

## Constructors

### Constructor

> **new DDLGeneralizer**(): `DDLGeneralizer`

#### Returns

`DDLGeneralizer`

## Methods

### generalize()

> `static` **generalize**(`ast`): [`SqlComponent`](SqlComponent.md)[]

Defined in: [packages/core/src/transformers/DDLGeneralizer.ts:14](https://github.com/mk3008/rawsql-ts/blob/24a3c8345b2b19492777bf7dfaaa046f943ebb07/packages/core/src/transformers/DDLGeneralizer.ts#L14)

Generalizes DDL statements by moving constraints from CREATE TABLE to ALTER TABLE statements.
This normalizes the DDL for easier comparison.

#### Parameters

##### ast

[`SqlComponent`](SqlComponent.md)[]

List of SQL components (DDL statements)

#### Returns

[`SqlComponent`](SqlComponent.md)[]

Generalized list of SQL components
</div>
