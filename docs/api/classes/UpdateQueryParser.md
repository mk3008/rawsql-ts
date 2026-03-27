<div v-pre>
# Class: UpdateQueryParser

Defined in: [packages/core/src/parsers/UpdateQueryParser.ts:14](https://github.com/mk3008/rawsql-ts/blob/c91e9fb79026c72cdb2e714bfb7a8f3421f758ab/packages/core/src/parsers/UpdateQueryParser.ts#L14)

## Constructors

### Constructor

> **new UpdateQueryParser**(): `UpdateQueryParser`

#### Returns

`UpdateQueryParser`

## Methods

### parse()

> `static` **parse**(`query`): [`UpdateQuery`](UpdateQuery.md)

Defined in: [packages/core/src/parsers/UpdateQueryParser.ts:19](https://github.com/mk3008/rawsql-ts/blob/c91e9fb79026c72cdb2e714bfb7a8f3421f758ab/packages/core/src/parsers/UpdateQueryParser.ts#L19)

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

Defined in: [packages/core/src/parsers/UpdateQueryParser.ts:32](https://github.com/mk3008/rawsql-ts/blob/c91e9fb79026c72cdb2e714bfb7a8f3421f758ab/packages/core/src/parsers/UpdateQueryParser.ts#L32)

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
