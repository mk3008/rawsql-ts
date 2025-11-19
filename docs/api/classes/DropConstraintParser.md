<div v-pre>
# Class: DropConstraintParser

Defined in: [packages/core/src/parsers/DropConstraintParser.ts:9](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/parsers/DropConstraintParser.ts#L9)

Parses standalone DROP CONSTRAINT statements.

## Constructors

### Constructor

> **new DropConstraintParser**(): `DropConstraintParser`

#### Returns

`DropConstraintParser`

## Methods

### parse()

> `static` **parse**(`sql`): [`DropConstraintStatement`](DropConstraintStatement.md)

Defined in: [packages/core/src/parsers/DropConstraintParser.ts:10](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/parsers/DropConstraintParser.ts#L10)

#### Parameters

##### sql

`string`

#### Returns

[`DropConstraintStatement`](DropConstraintStatement.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/DropConstraintParser.ts:20](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/parsers/DropConstraintParser.ts#L20)

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`DropConstraintStatement`](DropConstraintStatement.md)

##### newIndex

> **newIndex**: `number`
</div>
