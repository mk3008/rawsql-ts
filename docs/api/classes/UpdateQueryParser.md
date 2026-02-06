<div v-pre>
# Class: UpdateQueryParser

Defined in: [packages/core/src/parsers/UpdateQueryParser.ts:14](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/parsers/UpdateQueryParser.ts#L14)

## Constructors

### Constructor

> **new UpdateQueryParser**(): `UpdateQueryParser`

#### Returns

`UpdateQueryParser`

## Methods

### parse()

> `static` **parse**(`query`): [`UpdateQuery`](UpdateQuery.md)

Defined in: [packages/core/src/parsers/UpdateQueryParser.ts:19](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/parsers/UpdateQueryParser.ts#L19)

Parse SQL string to UpdateQuery AST.

#### Parameters

##### query

`string`

SQL string

#### Returns

[`UpdateQuery`](UpdateQuery.md)

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/UpdateQueryParser.ts:32](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/parsers/UpdateQueryParser.ts#L32)

Parse from lexeme array (for internal use and tests)

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`UpdateQuery`](UpdateQuery.md)

##### newIndex

> **newIndex**: `number`
</div>
