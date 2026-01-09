<div v-pre>
# Class: AlterTableParser

Defined in: [packages/core/src/parsers/AlterTableParser.ts:29](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/parsers/AlterTableParser.ts#L29)

Parses ALTER TABLE statements focused on constraint operations.

## Constructors

### Constructor

> **new AlterTableParser**(): `AlterTableParser`

#### Returns

`AlterTableParser`

## Methods

### parse()

> `static` **parse**(`sql`): [`AlterTableStatement`](AlterTableStatement.md)

Defined in: [packages/core/src/parsers/AlterTableParser.ts:62](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/parsers/AlterTableParser.ts#L62)

#### Parameters

##### sql

`string`

#### Returns

[`AlterTableStatement`](AlterTableStatement.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/AlterTableParser.ts:72](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/parsers/AlterTableParser.ts#L72)

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
