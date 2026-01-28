<div v-pre>
# Class: DropIndexParser

Defined in: [packages/core/src/parsers/DropIndexParser.ts:10](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/parsers/DropIndexParser.ts#L10)

Parses DROP INDEX statements.

## Constructors

### Constructor

> **new DropIndexParser**(): `DropIndexParser`

#### Returns

`DropIndexParser`

## Methods

### parse()

> `static` **parse**(`sql`): [`DropIndexStatement`](DropIndexStatement.md)

Defined in: [packages/core/src/parsers/DropIndexParser.ts:11](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/parsers/DropIndexParser.ts#L11)

#### Parameters

##### sql

`string`

#### Returns

[`DropIndexStatement`](DropIndexStatement.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/DropIndexParser.ts:21](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/parsers/DropIndexParser.ts#L21)

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`DropIndexStatement`](DropIndexStatement.md)

##### newIndex

> **newIndex**: `number`
</div>
