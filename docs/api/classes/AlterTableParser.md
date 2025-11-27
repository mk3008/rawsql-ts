<div v-pre>
# Class: AlterTableParser

Defined in: [packages/core/src/parsers/AlterTableParser.ts:28](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/parsers/AlterTableParser.ts#L28)

Parses ALTER TABLE statements focused on constraint operations.

## Constructors

### Constructor

> **new AlterTableParser**(): `AlterTableParser`

#### Returns

`AlterTableParser`

## Methods

### parse()

> `static` **parse**(`sql`): [`AlterTableStatement`](AlterTableStatement.md)

Defined in: [packages/core/src/parsers/AlterTableParser.ts:61](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/parsers/AlterTableParser.ts#L61)

#### Parameters

##### sql

`string`

#### Returns

[`AlterTableStatement`](AlterTableStatement.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/AlterTableParser.ts:71](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/parsers/AlterTableParser.ts#L71)

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`AlterTableStatement`](AlterTableStatement.md)

##### newIndex

> **newIndex**: `number`
</div>
