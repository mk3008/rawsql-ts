<div v-pre>
# Class: DropConstraintParser

Defined in: [packages/core/src/parsers/DropConstraintParser.ts:9](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/parsers/DropConstraintParser.ts#L9)

Parses standalone DROP CONSTRAINT statements.

## Constructors

### Constructor

> **new DropConstraintParser**(): `DropConstraintParser`

#### Returns

`DropConstraintParser`

## Methods

### parse()

> `static` **parse**(`sql`): [`DropConstraintStatement`](DropConstraintStatement.md)

Defined in: [packages/core/src/parsers/DropConstraintParser.ts:10](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/parsers/DropConstraintParser.ts#L10)

#### Parameters

##### sql

`string`

#### Returns

[`DropConstraintStatement`](DropConstraintStatement.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/DropConstraintParser.ts:20](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/parsers/DropConstraintParser.ts#L20)

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
